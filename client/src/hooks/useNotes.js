// Notas: mutaciones compartidas por todos los módulos con timeline.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as notesApi from '../api/notesApi.js';
import { toApiError } from '../api/client.js';

/**
 * @param {string} resource  'companies' | 'contacts' | 'clients' | 'leads' | 'opportunities'
 */
export function useNoteMutations(resource, entityId) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [resource, 'notes', entityId] });
    queryClient.invalidateQueries({ queryKey: [resource, 'timeline', entityId] });
  };
  const onError = (error) => toast.error(toApiError(error).message);

  return {
    createNote: useMutation({ mutationFn: notesApi.createNote, onSuccess: invalidate, onError }),
    updateNote: useMutation({
      mutationFn: ({ id, ...payload }) => notesApi.updateNote(id, payload),
      onSuccess: invalidate,
      onError,
    }),
    deleteNote: useMutation({
      mutationFn: notesApi.deleteNote,
      onSuccess: () => {
        invalidate();
        toast.success('Nota eliminada');
      },
      onError,
    }),
  };
}
