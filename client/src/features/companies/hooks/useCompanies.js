// Acceso a datos del módulo de empresas (TanStack Query).
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as companiesApi from '../../../api/companiesApi.js';
import { toApiError } from '../../../api/client.js';

export const companiesKeys = {
  all: ['companies'],
  list: (filters) => ['companies', 'list', filters],
  detail: (id) => ['companies', 'detail', id],
  contacts: (id) => ['companies', 'contacts', id],
  notes: (id) => ['companies', 'notes', id],
  timeline: (id) => ['companies', 'timeline', id],
};

export function useCompanies(filters) {
  return useQuery({
    queryKey: companiesKeys.list(filters),
    queryFn: () => companiesApi.listCompanies(filters),
    placeholderData: (previous) => previous,
  });
}

export function useCompany(id) {
  return useQuery({
    queryKey: companiesKeys.detail(id),
    queryFn: () => companiesApi.getCompany(id),
    enabled: Boolean(id),
  });
}

export function useCompanyContacts(id) {
  return useQuery({
    queryKey: companiesKeys.contacts(id),
    queryFn: () => companiesApi.listCompanyContacts(id, { pageSize: 100 }),
    enabled: Boolean(id),
  });
}

export function useCompanyNotes(id) {
  return useQuery({
    queryKey: companiesKeys.notes(id),
    queryFn: () => companiesApi.listCompanyNotes(id),
    enabled: Boolean(id),
  });
}

export function useCompanyTimeline(id) {
  return useQuery({
    queryKey: companiesKeys.timeline(id),
    queryFn: () => companiesApi.getCompanyTimeline(id, { pageSize: 50 }),
    enabled: Boolean(id),
  });
}

function useInvalidate() {
  const queryClient = useQueryClient();
  return (id) => {
    queryClient.invalidateQueries({ queryKey: companiesKeys.all });
    if (id) queryClient.invalidateQueries({ queryKey: companiesKeys.detail(id) });
  };
}

export function useCreateCompany() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: companiesApi.createCompany,
    onSuccess: () => {
      invalidate();
      toast.success('Empresa creada');
    },
  });
}

export function useUpdateCompany() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...payload }) => companiesApi.updateCompany(id, payload),
    onSuccess: (company) => {
      invalidate(company.id);
      toast.success('Empresa actualizada');
    },
  });
}

export function useArchiveCompany() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id) => companiesApi.archiveCompany(id),
    onSuccess: (company) => {
      invalidate(company.id);
      toast.success('Empresa archivada');
    },
    onError: (error) => toast.error(toApiError(error).message),
  });
}

export function useRestoreCompany() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id) => companiesApi.restoreCompany(id),
    onSuccess: (company) => {
      invalidate(company.id);
      toast.success('Empresa restaurada');
    },
    onError: (error) => toast.error(toApiError(error).message),
  });
}
