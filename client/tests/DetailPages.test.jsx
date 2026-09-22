// Smoke test de las páginas de detalle: garantiza que renderizan con datos reales
// y detecta importaciones rotas (p. ej. un icono inexistente) que dejarían la pantalla en blanco.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../src/context/AuthContext.jsx';
import { CompanyDetailPage } from '../src/features/companies/pages/CompanyDetailPage.jsx';
import { ContactDetailPage } from '../src/features/contacts/pages/ContactDetailPage.jsx';
import { api } from '../src/api/client.js';

const get = vi.spyOn(api, 'get');
const post = vi.spyOn(api, 'post');

const PERMISSIONS = [
  'companies:read',
  'companies:update',
  'companies:delete',
  'contacts:read',
  'contacts:create',
  'contacts:update',
  'contacts:delete',
  'notes:create',
];

const company = {
  id: 1,
  name: 'Acme S.A.',
  legalName: 'Acme Sociedad Anónima',
  taxId: '30-1',
  industry: 'Tecnología',
  website: 'https://acme.example',
  email: 'info@acme.example',
  phone: '+54 11 4000-0000',
  addressLine: 'Av. Corrientes 1234',
  city: 'Buenos Aires',
  country: 'Argentina',
  employeesRange: '51-200',
  description: 'Cliente estratégico',
  isArchived: false,
  createdAt: '2026-09-01T10:00:00.000Z',
  createdBy: { id: 1, firstName: 'Ana', lastName: 'Pérez' },
  client: null,
  contactsCount: 1,
};

const contact = {
  id: 7,
  firstName: 'Juan',
  lastName: 'Gómez',
  fullName: 'Juan Gómez',
  email: 'juan@acme.example',
  phone: '+54 11 5000-0000',
  mobile: null,
  jobTitle: 'CTO',
  department: 'Tecnología',
  linkedinUrl: 'https://linkedin.com/in/juan',
  isPrimary: true,
  isArchived: false,
  createdAt: '2026-09-02T10:00:00.000Z',
  createdBy: { id: 1, firstName: 'Ana', lastName: 'Pérez' },
  company: { id: 1, name: 'Acme S.A.' },
};

const note = {
  id: 3,
  content: 'Prefieren que los contactemos por email',
  isPinned: true,
  createdAt: '2026-09-03T10:00:00.000Z',
  author: { id: 1, firstName: 'Ana', lastName: 'Pérez' },
};

const timelineEntry = {
  kind: 'audit',
  at: '2026-09-03T11:00:00.000Z',
  actor: { id: 1, firstName: 'Ana', lastName: 'Pérez' },
  payload: {
    action: 'UPDATE',
    changes: { before: { name: 'Acme' }, after: { name: 'Acme S.A.' } },
  },
};

function wrap(data, meta) {
  return { data: meta ? { success: true, data, meta } : { success: true, data } };
}

function mockEndpoints() {
  get.mockImplementation((url) => {
    if (url === '/companies/1') return Promise.resolve(wrap(company));
    if (url === '/companies/1/contacts')
      return Promise.resolve(wrap([contact], { page: 1, pageSize: 100, total: 1, totalPages: 1 }));
    if (url === '/companies/1/notes') return Promise.resolve(wrap([note]));
    if (url === '/companies/1/timeline')
      return Promise.resolve(
        wrap([timelineEntry], { page: 1, pageSize: 50, total: 1, totalPages: 1 }),
      );
    if (url === '/contacts/7') return Promise.resolve(wrap(contact));
    if (url === '/contacts/7/notes') return Promise.resolve(wrap([note]));
    if (url === '/contacts/7/timeline')
      return Promise.resolve(
        wrap([timelineEntry], { page: 1, pageSize: 50, total: 1, totalPages: 1 }),
      );
    if (url === '/companies')
      return Promise.resolve(wrap([company], { page: 1, pageSize: 100, total: 1, totalPages: 1 }));
    return Promise.reject(new Error(`URL no simulada: ${url}`));
  });
  post.mockResolvedValue({
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
          permissions: PERMISSIONS,
          mustChangePassword: false,
        },
      },
    },
  });
}

function renderRoute(path, element, routePattern) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [
      { path: routePattern, element },
      { path: '*', element: <p>otra</p> },
    ],
    {
      initialEntries: [path],
    },
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
  mockEndpoints();
});

describe('CompanyDetailPage', () => {
  it('muestra los datos de la empresa', async () => {
    renderRoute('/companies/1', <CompanyDetailPage />, '/companies/:id');

    expect(await screen.findByRole('heading', { name: 'Acme S.A.' })).toBeInTheDocument();
    expect(screen.getByText('info@acme.example')).toBeInTheDocument();
    expect(screen.getByText('Av. Corrientes 1234, Buenos Aires, Argentina')).toBeInTheDocument();
  });

  it('cambia de pestaña y lista contactos, notas e historial', async () => {
    const user = userEvent.setup();
    renderRoute('/companies/1', <CompanyDetailPage />, '/companies/:id');
    await screen.findByRole('heading', { name: 'Acme S.A.' });

    await user.click(screen.getByRole('tab', { name: /Contactos/ }));
    expect(await screen.findByRole('link', { name: /Juan Gómez/ })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /Notas/ }));
    expect(await screen.findByText(note.content)).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Historial' }));
    expect(await screen.findByText(/Actualizó datos/)).toBeInTheDocument();
  });
});

describe('ContactDetailPage', () => {
  it('muestra los datos del contacto y su empresa', async () => {
    renderRoute('/contacts/7', <ContactDetailPage />, '/contacts/:id');

    expect(await screen.findByRole('heading', { name: 'Juan Gómez' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'juan@acme.example' })).toHaveAttribute(
      'href',
      'mailto:juan@acme.example',
    );
    expect(screen.getByRole('link', { name: 'Acme S.A.' })).toHaveAttribute('href', '/companies/1');
  });
});
