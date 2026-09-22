import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../src/context/AuthContext.jsx';
import { AppLayout } from '../src/app/AppLayout.jsx';
import { NAV_ITEMS } from '../src/components/layout/Sidebar.jsx';
import { api } from '../src/api/client.js';

const post = vi.spyOn(api, 'post');

function sessionFor(permissions) {
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

function renderLayout(permissions, initialPath = '/dashboard') {
  // La sesión se restaura con el refresh silencioso al montar la app.
  post.mockResolvedValue(sessionFor(permissions));
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <AppLayout />,
        children: [{ path: 'dashboard', element: <p>Contenido</p> }],
      },
    ],
    { initialEntries: [initialPath] },
  );

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => post.mockReset());

describe('AppLayout', () => {
  it('muestra la navegación permitida y el contenido de la ruta', async () => {
    const permissions = NAV_ITEMS.map((item) => item.permission);
    renderLayout(permissions);

    for (const item of NAV_ITEMS) {
      expect(await screen.findByRole('link', { name: item.label })).toBeInTheDocument();
    }
    expect(screen.getByText('Contenido')).toBeInTheDocument();
  });

  it('oculta las secciones para las que el usuario no tiene permiso', async () => {
    renderLayout(['dashboard:view', 'clients:read']);

    expect(await screen.findByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Clientes' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Usuarios' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Reportes' })).not.toBeInTheDocument();
  });

  it('marca como activo el enlace de la ruta actual', async () => {
    renderLayout(['dashboard:view']);
    expect(await screen.findByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('muestra el menú de usuario con su nombre', async () => {
    renderLayout(['dashboard:view']);
    expect(await screen.findByText('Ana Pérez')).toBeInTheDocument();
  });
});
