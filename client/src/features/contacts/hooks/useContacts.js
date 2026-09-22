// Acceso a datos del módulo de contactos (TanStack Query).
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as contactsApi from '../../../api/contactsApi.js';
import { toApiError } from '../../../api/client.js';

export const contactsKeys = {
  all: ['contacts'],
  list: (filters) => ['contacts', 'list', filters],
  detail: (id) => ['contacts', 'detail', id],
  notes: (id) => ['contacts', 'notes', id],
  timeline: (id) => ['contacts', 'timeline', id],
};

export function useContacts(filters) {
  return useQuery({
    queryKey: contactsKeys.list(filters),
    queryFn: () => contactsApi.listContacts(filters),
    placeholderData: (previous) => previous,
  });
}

export function useContact(id) {
  return useQuery({
    queryKey: contactsKeys.detail(id),
    queryFn: () => contactsApi.getContact(id),
    enabled: Boolean(id),
  });
}

export function useContactNotes(id) {
  return useQuery({
    queryKey: contactsKeys.notes(id),
    queryFn: () => contactsApi.listContactNotes(id),
    enabled: Boolean(id),
  });
}

export function useContactTimeline(id) {
  return useQuery({
    queryKey: contactsKeys.timeline(id),
    queryFn: () => contactsApi.getContactTimeline(id, { pageSize: 50 }),
    enabled: Boolean(id),
  });
}

function useInvalidate() {
  const queryClient = useQueryClient();
  return (id) => {
    queryClient.invalidateQueries({ queryKey: contactsKeys.all });
    // El detalle de la empresa muestra sus contactos.
    queryClient.invalidateQueries({ queryKey: ['companies'] });
    if (id) queryClient.invalidateQueries({ queryKey: contactsKeys.detail(id) });
  };
}

export function useCreateContact() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: contactsApi.createContact,
    onSuccess: () => {
      invalidate();
      toast.success('Contacto creado');
    },
  });
}

export function useUpdateContact() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...payload }) => contactsApi.updateContact(id, payload),
    onSuccess: (contact) => {
      invalidate(contact.id);
      toast.success('Contacto actualizado');
    },
  });
}

export function useArchiveContact() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id) => contactsApi.archiveContact(id),
    onSuccess: (contact) => {
      invalidate(contact.id);
      toast.success('Contacto archivado');
    },
    onError: (error) => toast.error(toApiError(error).message),
  });
}

export function useRestoreContact() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id) => contactsApi.restoreContact(id),
    onSuccess: (contact) => {
      invalidate(contact.id);
      toast.success('Contacto restaurado');
    },
    onError: (error) => toast.error(toApiError(error).message),
  });
}
