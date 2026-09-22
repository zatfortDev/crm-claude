import { StickyNote, History, Plus, Pencil, Archive, RotateCcw } from 'lucide-react';
import { EmptyState } from './EmptyState.jsx';
import { formatDateTime } from '../../lib/formatters.js';

const AUDIT_LABELS = {
  CREATE: { label: 'Creó el registro', icon: Plus },
  UPDATE: { label: 'Actualizó datos', icon: Pencil },
  DELETE: { label: 'Archivó el registro', icon: Archive },
  RESTORE: { label: 'Restauró el registro', icon: RotateCcw },
  STATUS_CHANGE: { label: 'Cambió el estado', icon: History },
  STAGE_CHANGE: { label: 'Cambió la etapa', icon: History },
  ASSIGN: { label: 'Cambió el responsable', icon: History },
  CONVERT: { label: 'Convirtió el lead', icon: History },
};

/** Nombres legibles de los campos más habituales en el detalle de cambios. */
const FIELD_LABELS = {
  name: 'Nombre',
  legalName: 'Razón social',
  taxId: 'Identificador fiscal',
  industry: 'Industria',
  email: 'Email',
  phone: 'Teléfono',
  city: 'Ciudad',
  country: 'País',
  firstName: 'Nombre',
  lastName: 'Apellido',
  jobTitle: 'Cargo',
  companyId: 'Empresa',
  status: 'Estado',
  isActive: 'Activo',
};

function ChangeDetail({ changes }) {
  if (!changes?.after) return null;
  const fields = Object.keys(changes.after).slice(0, 5);
  if (fields.length === 0) return null;

  return (
    <ul className="mt-1 flex flex-col gap-0.5 text-xs text-muted">
      {fields.map((field) => (
        <li key={field}>
          <span className="text-foreground">{FIELD_LABELS[field] ?? field}</span>:{' '}
          {String(changes.before?.[field] ?? '—')} → {String(changes.after[field] ?? '—')}
        </li>
      ))}
    </ul>
  );
}

/** Historial unificado de una entidad: notas y cambios auditados. */
export function EntityTimeline({ entries = [], isLoading }) {
  if (isLoading) return <p className="py-6 text-center text-sm text-muted">Cargando historial…</p>;

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="Sin actividad registrada"
        description="Acá vas a ver las notas y los cambios del registro."
      />
    );
  }

  return (
    <ol className="flex flex-col">
      {entries.map((entry, index) => {
        const audit = entry.kind === 'audit' ? AUDIT_LABELS[entry.payload.action] : null;
        const Icon = entry.kind === 'note' ? StickyNote : (audit?.icon ?? History);
        const actor = entry.actor ? `${entry.actor.firstName} ${entry.actor.lastName}` : 'Sistema';

        return (
          <li key={`${entry.kind}-${index}`} className="flex gap-3 pb-5 last:pb-0">
            <div className="flex flex-col items-center">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted-soft text-muted">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              {index < entries.length - 1 && <span className="mt-1 w-px flex-1 bg-border" />}
            </div>
            <div className="min-w-0 flex-1 pt-1">
              <p className="text-sm text-foreground">
                <span className="font-medium">{actor}</span>{' '}
                {entry.kind === 'note' ? 'agregó una nota' : (audit?.label ?? entry.payload.action)}
              </p>
              {entry.kind === 'note' ? (
                <p className="mt-1 line-clamp-3 text-sm whitespace-pre-wrap text-muted">
                  {entry.payload.content}
                </p>
              ) : (
                <ChangeDetail changes={entry.payload.changes} />
              )}
              <p className="mt-1 text-xs text-muted">{formatDateTime(entry.at)}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
