// Acceso a datos del módulo de usuarios (TanStack Query).
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as usersApi from '../../../api/usersApi.js';
import { toApiError } from '../../../api/client.js';

const usersKey = (filters) => ['users', filters];

export function useUsers(filters) {
  return useQuery({
    queryKey: usersKey(filters),
    queryFn: () => usersApi.listUsers(filters),
    placeholderData: (previous) => previous,
  });
}

export function useRoles() {
  return useQuery({
    queryKey: ['roles'],
    queryFn: usersApi.listRoles,
    staleTime: 5 * 60_000,
  });
}

/** Invalida los listados de usuarios tras una mutación. */
function useInvalidateUsers() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['users'] });
}

export function useCreateUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: usersApi.createUser,
    onSuccess: () => {
      invalidate();
      toast.success('Usuario creado');
    },
  });
}

export function useUpdateUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: ({ id, ...payload }) => usersApi.updateUser(id, payload),
    onSuccess: () => {
      invalidate();
      toast.success('Usuario actualizado');
    },
  });
}

export function useSetUserStatus() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: ({ id, isActive }) => usersApi.setUserStatus(id, isActive),
    onSuccess: (user) => {
      invalidate();
      toast.success(user.isActive ? 'Usuario activado' : 'Usuario desactivado');
    },
    onError: (error) => toast.error(toApiError(error).message),
  });
}

export function useSetUserRole() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: ({ id, roleId }) => usersApi.setUserRole(id, roleId),
    onSuccess: () => {
      invalidate();
      toast.success('Rol actualizado');
    },
    onError: (error) => toast.error(toApiError(error).message),
  });
}

export function useResetUserPassword() {
  return useMutation({
    mutationFn: ({ id, temporaryPassword }) => usersApi.resetUserPassword(id, temporaryPassword),
    onSuccess: () => toast.success('Contraseña temporal asignada'),
  });
}
