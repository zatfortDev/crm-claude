// Sesión del usuario: token en memoria + datos y permisos.
// Al cargar la app se intenta un refresh silencioso (cookie httpOnly) para restaurar la sesión.
import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { refreshSession, setAccessToken, setSessionLostHandler } from '../api/client.js';
import * as authApi from '../api/authApi.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | authenticated | anonymous
  const queryClient = useQueryClient();

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    setStatus('anonymous');
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => {
    setSessionLostHandler(clearSession);
    return () => setSessionLostHandler(null);
  }, [clearSession]);

  useEffect(() => {
    let cancelled = false;
    refreshSession()
      .then((session) => {
        if (cancelled) return;
        setUser(session.user);
        setStatus('authenticated');
      })
      .catch(() => {
        if (!cancelled) setStatus('anonymous');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (credentials) => {
    const session = await authApi.login(credentials);
    setUser(session.user);
    setStatus('authenticated');
    return session.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const refreshUser = useCallback(async () => {
    const current = await authApi.me();
    setUser(current);
    return current;
  }, []);

  const value = useMemo(
    () => ({
      user,
      status,
      isAuthenticated: status === 'authenticated',
      isLoading: status === 'loading',
      login,
      logout,
      refreshUser,
      clearSession,
      // Solo controla la UI: la autorización real la aplica el backend.
      hasPermission: (code) => Boolean(user?.permissions?.includes(code)),
      hasAnyPermission: (...codes) => codes.some((code) => user?.permissions?.includes(code)),
    }),
    [user, status, login, logout, refreshUser, clearSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return context;
}
