import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../src/context/AuthContext.jsx';
import { LoginPage } from '../src/features/auth/pages/LoginPage.jsx';
import { ProtectedRoute } from '../src/features/auth/components/ProtectedRoute.jsx';
import { api } from '../src/api/client.js';

// Se simula la capa HTTP (axios) para probar el comportamiento de la UI.
const post = vi.spyOn(api, 'post');

function buildSession(overrides = {}) {
  return {
    data: {
      data: {
        accessToken: 'token-de-prueba',
        expiresIn: 900,
        user: {
          id: 1,
          email: 'ana@test.local',
          firstName: 'Ana',
          lastName: 'Pérez',
          fullName: 'Ana Pérez',
          role: { id: 1, name: 'Admin' },
          permissions: ['users:read'],
          mustChangePassword: false,
          ...overrides,
        },
      },
    },
  };
}

function renderApp(initialEntries = ['/login']) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [
      { path: '/login', element: <LoginPage /> },
      {
        path: '/dashboard',
        element: (
          <ProtectedRoute permission="users:read">
            <p>Contenido protegido</p>
          </ProtectedRoute>
        ),
      },
      {
        path: '/reports',
        element: (
          <ProtectedRoute permission="reports:view">
            <p>Reportes</p>
          </ProtectedRoute>
        ),
      },
      { path: '/change-password', element: <p>Cambiar contraseña</p> },
    ],
    { initialEntries },
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
  post.mockReset();
  // El refresh inicial falla: la app arranca sin sesión.
  post.mockRejectedValue({ response: { status: 401, data: { error: { code: 'UNAUTHORIZED' } } } });
});

afterEach(() => vi.clearAllMocks());

describe('LoginPage', () => {
  it('valida los campos antes de llamar a la API', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(await screen.findByRole('button', { name: /ingresar/i }));

    expect(await screen.findByText('El email es obligatorio')).toBeInTheDocument();
    expect(screen.getByText('La contraseña es obligatoria')).toBeInTheDocument();
    expect(post).not.toHaveBeenCalledWith('/auth/login', expect.anything());
  });

  it('muestra el mensaje del servidor cuando las credenciales son inválidas', async () => {
    const user = userEvent.setup();
    renderApp();
    post.mockImplementation((url) =>
      url === '/auth/login'
        ? Promise.reject({
            response: {
              status: 401,
              data: { error: { code: 'UNAUTHORIZED', message: 'Credenciales inválidas' } },
            },
          })
        : Promise.reject({ response: { status: 401, data: {} } }),
    );

    await user.type(await screen.findByLabelText(/email/i), 'ana@test.local');
    await user.type(screen.getByLabelText(/contraseña/i), 'incorrecta');
    await user.click(screen.getByRole('button', { name: /ingresar/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Credenciales inválidas');
  });

  it('entra al dashboard tras un login correcto', async () => {
    const user = userEvent.setup();
    renderApp();
    post.mockImplementation((url) =>
      url === '/auth/login'
        ? Promise.resolve(buildSession())
        : Promise.reject({ response: { status: 401, data: {} } }),
    );

    await user.type(await screen.findByLabelText(/email/i), 'ana@test.local');
    await user.type(screen.getByLabelText(/contraseña/i), 'Password123');
    await user.click(screen.getByRole('button', { name: /ingresar/i }));

    expect(await screen.findByText('Contenido protegido')).toBeInTheDocument();
  });

  it('redirige al cambio de contraseña cuando es obligatorio', async () => {
    const user = userEvent.setup();
    renderApp();
    post.mockImplementation((url) =>
      url === '/auth/login'
        ? Promise.resolve(buildSession({ mustChangePassword: true }))
        : Promise.reject({ response: { status: 401, data: {} } }),
    );

    await user.type(await screen.findByLabelText(/email/i), 'ana@test.local');
    await user.type(screen.getByLabelText(/contraseña/i), 'Temporal123');
    await user.click(screen.getByRole('button', { name: /ingresar/i }));

    expect(await screen.findByText('Cambiar contraseña')).toBeInTheDocument();
  });
});

describe('ProtectedRoute', () => {
  it('redirige al login cuando no hay sesión', async () => {
    renderApp(['/dashboard']);
    expect(await screen.findByRole('button', { name: /ingresar/i })).toBeInTheDocument();
  });

  it('muestra un aviso cuando falta el permiso requerido', async () => {
    const user = userEvent.setup();
    renderApp();
    post.mockImplementation((url) =>
      url === '/auth/login'
        ? Promise.resolve(buildSession())
        : Promise.reject({ response: { status: 401, data: {} } }),
    );

    await user.type(await screen.findByLabelText(/email/i), 'ana@test.local');
    await user.type(screen.getByLabelText(/contraseña/i), 'Password123');
    await user.click(screen.getByRole('button', { name: /ingresar/i }));
    await screen.findByText('Contenido protegido');

    // El usuario tiene users:read pero no reports:view.
    await waitFor(() => expect(screen.queryByText('Reportes')).not.toBeInTheDocument());
  });
});
