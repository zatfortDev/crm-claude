import { createBrowserRouter, RouterProvider, Navigate } from 'react-router';
import { AppLayout } from './AppLayout.jsx';
import { DashboardPage } from '../features/dashboard/pages/DashboardPage.jsx';
import { NotFoundPage } from '../components/common/NotFoundPage.jsx';

// Las rutas de cada módulo se añaden en su fase (docs/architecture.md § 4.2).
export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
