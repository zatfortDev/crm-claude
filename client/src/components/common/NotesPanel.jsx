import { useState } from 'react';
import { Pin, PinOff, Trash2, Pencil, StickyNote } from 'lucide-react';
import { Button } from '../ui/Button.jsx';
import { EmptyState } from './EmptyState.jsx';
import { ConfirmDialog } from './ConfirmDialog.jsx';
import { formatDateTime } from '../../lib/formatters.js';
import { useNoteMutations } from '../../hooks/useNotes.js';
import { useAuth } from '../../context/AuthContext.jsx';

/**
 * Panel de notas reutilizable por cualquier entidad con timeline.
 * @param {string} resource   'companies' | 'contacts' | …
 * @param {string} parentKey  Campo que asocia la nota ('companyId', 'contactId', …)
 */
export function NotesPanel({ resource, parentKey, entityId, notes = [], isLoading }) {
  const { user, hasPermission } = useAuth();
  const { createNote, updateNote, deleteNote } = useNoteMutations(resource, entityId);
  const [content, setContent] = useState('');
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const canCreate = hasPermission('notes:create');
  const canManageAll = hasPermission('notes:manage');
  const canEdit = (note) => canManageAll || note.author?.id === user?.id;

  const submit = async (event) => {
    event.preventDefault();
    const text = content.trim();
    if (!text) return;

    if (editing) {
      await updateNote.mutateAsync({ id: editing.id, content: text, isPinned: editing.isPinned });
      setEditing(null);
    } else {
      await createNote.mutateAsync({ content: text, [parentKey]: entityId });
    }
    setContent('');
  };

  const togglePin = (note) =>
    updateNote.mutate({ id: note.id, content: note.content, isPinned: !note.isPinned });

  return (
    <div className="flex flex-col gap-4">
      {canCreate && (
        <form onSubmit={submit} className="flex flex-col gap-2">
          <label htmlFor="note-content" className="sr-only">
            {editing ? 'Editar nota' : 'Nueva nota'}
          </label>
          <textarea
            id="note-content"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            rows={3}
            maxLength={4000}
            placeholder="Escribí una nota sobre este registro…"
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm placeholder:text-muted focus:border-primary focus:outline-none"
          />
          <div className="flex justify-end gap-2">
            {editing && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setEditing(null);
                  setContent('');
                }}
              >
                Cancelar
              </Button>
            )}
            <Button
              type="submit"
              size="sm"
              disabled={!content.trim()}
              loading={createNote.isPending || updateNote.isPending}
            >
              {editing ? 'Guardar nota' : 'Agregar nota'}
            </Button>
          </div>
        </form>
      )}

      {isLoading ? (
        <p className="py-6 text-center text-sm text-muted">Cargando notas…</p>
      ) : notes.length === 0 ? (
        <EmptyState
          icon={StickyNote}
          title="Sin notas"
          description="Registrá acuerdos, preferencias o cualquier detalle relevante."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {notes.map((note) => (
            <li
              key={note.id}
              className="rounded-md border border-border bg-surface p-3 text-sm shadow-card"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="text-xs text-muted">
                  <span className="font-medium text-foreground">
                    {note.author ? `${note.author.firstName} ${note.author.lastName}` : 'Sistema'}
                  </span>{' '}
                  · {formatDateTime(note.createdAt)}
                  {note.isPinned && <span className="ml-2 text-primary">Fijada</span>}
                </div>
                {canEdit(note) && (
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={note.isPinned ? 'Desfijar nota' : 'Fijar nota'}
                      onClick={() => togglePin(note)}
                    >
                      {note.isPinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Editar nota"
                      onClick={() => {
                        setEditing(note);
                        setContent(note.content);
                      }}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Eliminar nota"
                      onClick={() => setDeleting(note)}
                    >
                      <Trash2 className="size-4 text-danger" />
                    </Button>
                  </div>
                )}
              </div>
              <p className="whitespace-pre-wrap text-foreground">{note.content}</p>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Eliminar nota"
        description="La nota se eliminará de forma permanente."
        confirmLabel="Eliminar"
        tone="danger"
        loading={deleteNote.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          await deleteNote.mutateAsync(deleting.id);
          setDeleting(null);
        }}
      />
    </div>
  );
}
