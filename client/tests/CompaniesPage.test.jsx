import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../src/context/AuthContext.jsx';
import { CompaniesPage } from '../src/features/companies/pages/CompaniesPage.jsx';
import { api } from '../src/api/client.js';

const get = vi.spyOn(api, 'get');
const post = vi.spyOn(api, 'post');

const company = (overrides = {}) => ({
  id: 1,
  name: 'Acme S.A.',
  legalName: 'Acme Sociedad Anónima',
  taxId: '30-1',
  industry: 'Tecnología',
  city: 'Buenos Aires',
  country: 'Argentina',
  contactsCount: 2,
  isArchived: false,
  ...overrides,
});

function listResponse(items, meta = {}) {
  return {
    data: {
      success: true,
      data: items,
      meta: { page: 1, pageSize: 20, total: items.length, totalPages: 1, ...meta },
    },
  };
}

function session(permissions) {
  return {
    data: {
      data: {
        accessToken: 'token',
        expiresIn: 900,
        user: {
          id: 1,
          email: 'ana@test.local',
          firstName: 'Ana',
          lastName: 'Pérez',
          fullName: 'Ana Pérez',
          role: { id: 1, name: 'Admin' },
          permissions,
          mustChangePassword: false,
        },
      },
    },
  };
}

function renderPage(
  permissions = ['companies:read', 'companies:create', 'companies:update', 'companies:delete'],
) {
  post.mockResolvedValue(session(permissions));
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [
      { path: '/companies', element: <CompaniesPage /> },
      { path: '/companies/:id', element: <p>Detalle de empresa</p> },
    ],
    { initialEntries: ['/companies'] },
  );

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  get.mockReset();
  post.mockReset();
});

describe('CompaniesPage', () => {
  it('muestra las empresas devueltas por la API', async () => {
    get.mockResolvedValue(listResponse([company(), company({ id: 2, name: 'Beta Corp' })]));
    renderPage();

    expect(await screen.findByText('Acme S.A.')).toBeInTheDocument();
    expect(screen.getByText('Beta Corp')).toBeInTheDocument();
    // El resumen de paginación reparte el texto en varios nodos.
    expect(screen.getByText(/Página 1 de 1/)).toBeInTheDocument();
  });

  it('muestra el estado vacío cuando no hay resultados', async () => {
    get.mockResolvedValue(listResponse([], { total: 0 }));
    renderPage();

    expect(await screen.findByText('No se encontraron empresas')).toBeInTheDocument();
  });

  it('muestra un error con opción de reintentar', async () => {
    get.mockRejectedValue({
      response: { status: 500, data: { error: { code: 'INTERNAL_ERROR', message: 'Falló' } } },
      message: 'Falló',
    });
    renderPage();

    expect(await screen.findByRole('button', { name: /reintentar/i })).toBeInTheDocument();
  });

  it('envía la búsqueda al backend tras el debounce', async () => {
    const user = userEvent.setup();
    get.mockResolvedValue(listResponse([company()]));
    renderPage();
    await screen.findByText('Acme S.A.');

    await user.type(screen.getByRole('searchbox', { name: /buscar/i }), 'beta');

    await waitFor(
      () => {
        expect(get).toHaveBeenCalledWith(
          '/companies',
          expect.objectContaining({ params: expect.objectContaining({ search: 'beta' }) }),
        );
      },
      { timeout: 2000 },
    );
  });

  it('navega al detalle al hacer clic en una fila', async () => {
    const user = userEvent.setup();
    get.mockResolvedValue(listResponse([company()]));
    renderPage();

    await user.click(await screen.findByText('Acme S.A.'));
    expect(await screen.findByText('Detalle de empresa')).toBeInTheDocument();
  });

  it('oculta las acciones de escritura sin permisos', async () => {
    get.mockResolvedValue(listResponse([company()]));
    renderPage(['companies:read']);

    await screen.findByText('Acme S.A.');
    expect(screen.queryByRole('button', { name: /nueva empresa/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /editar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /archivar/i })).not.toBeInTheDocument();
  });

  it('pide confirmación antes de archivar', async () => {
    const user = userEvent.setup();
    get.mockResolvedValue(listResponse([company()]));
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Archivar Acme S.A.' }));
    expect(await screen.findByRole('dialog')).toHaveTextContent('Archivar empresa');
  });
});
