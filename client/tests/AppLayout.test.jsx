import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { AppLayout } from '../src/app/AppLayout.jsx';
import { NAV_ITEMS } from '../src/components/layout/Sidebar.jsx';

function renderWithRouter(initialPath = '/dashboard') {
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
  return render(<RouterProvider router={router} />);
}

describe('AppLayout', () => {
  it('muestra la navegación principal y el contenido de la ruta', () => {
    renderWithRouter();
    for (const item of NAV_ITEMS) {
      expect(screen.getByRole('link', { name: item.label })).toBeInTheDocument();
    }
    expect(screen.getByText('Contenido')).toBeInTheDocument();
  });

  it('marca como activo el enlace de la ruta actual', () => {
    renderWithRouter('/dashboard');
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
  });
});
