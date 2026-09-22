import { createBrowserRouter, RouterProvider, Navigate } from 'react-router';
import { AppLayout } from './AppLayout.jsx';
import { ProtectedRoute } from '../features/auth/components/ProtectedRoute.jsx';
import { LoginPage } from '../features/auth/pages/LoginPage.jsx';
import { ChangePasswordPage } from '../features/auth/pages/ChangePasswordPage.jsx';
import { ProfilePage } from '../features/auth/pages/ProfilePage.jsx';
import { DashboardPage } from '../features/dashboard/pages/DashboardPage.jsx';
import { UsersPage } from '../features/users/pages/UsersPage.jsx';
import { CompaniesPage } from '../features/companies/pages/CompaniesPage.jsx';
import { CompanyDetailPage } from '../features/companies/pages/CompanyDetailPage.jsx';
import { ContactsPage } from '../features/contacts/pages/ContactsPage.jsx';
import { ContactDetailPage } from '../features/contacts/pages/ContactDetailPage.jsx';
import { NotFoundPage } from '../components/common/NotFoundPage.jsx';

// Las rutas de cada módulo se añaden en su fase (docs/architecture.md § 4.2).
export const routes = [
  { path: '/login', element: <LoginPage /> },
  {
    path: '/change-password',
    element: (
      <ProtectedRoute>
        <ChangePasswordPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      {
        path: 'dashboard',
        element: (
          <ProtectedRoute permission="dashboard:view">
            <DashboardPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'companies',
        element: (
          <ProtectedRoute permission="companies:read">
            <CompaniesPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'companies/:id',
        element: (
          <ProtectedRoute permission="companies:read">
            <CompanyDetailPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'contacts',
        element: (
          <ProtectedRoute permission="contacts:read">
            <ContactsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'contacts/:id',
        element: (
          <ProtectedRoute permission="contacts:read">
            <ContactDetailPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'users',
        element: (
          <ProtectedRoute permission="users:read">
            <UsersPage />
          </ProtectedRoute>
        ),
      },
      { path: 'profile', element: <ProfilePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

export const router = createBrowserRouter(routes);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
