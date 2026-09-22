import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import {
  ArrowLeft,
  Pencil,
  Archive,
  RotateCcw,
  Mail,
  Phone,
  Smartphone,
  Briefcase,
  Building2,
  Link as LinkIcon,
} from 'lucide-react';
import { PageHeader } from '../../../components/layout/PageHeader.jsx';
import { Card, CardContent } from '../../../components/ui/Card.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Badge } from '../../../components/ui/Badge.jsx';
import { Tabs } from '../../../components/ui/Tabs.jsx';
import { ErrorState } from '../../../components/common/ErrorState.jsx';
import { NotesPanel } from '../../../components/common/NotesPanel.jsx';
import { EntityTimeline } from '../../../components/common/EntityTimeline.jsx';
import { ConfirmDialog } from '../../../components/common/ConfirmDialog.jsx';
import { useAuth } from '../../../context/AuthContext.jsx';
import { formatDate } from '../../../lib/formatters.js';
import {
  useContact,
  useContactNotes,
  useContactTimeline,
  useArchiveContact,
  useRestoreContact,
} from '../hooks/useContacts.js';
import { ContactFormModal } from '../components/ContactFormModal.jsx';

function InfoRow({ icon: Icon, label, children }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-xs text-muted">{label}</p>
        <p className="truncate text-foreground">{children || '—'}</p>
      </div>
    </div>
  );
}

export function ContactDetailPage() {
  const { id } = useParams();
  const contactId = Number(id);
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [tab, setTab] = useState('resumen');
  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  const { data: contact, isLoading, error, refetch } = useContact(contactId);
  const { data: notes, isLoading: notesLoading } = useContactNotes(contactId);
  const { data: timeline, isLoading: timelineLoading } = useContactTimeline(contactId);
  const archiveContact = useArchiveContact();
  const restoreContact = useRestoreContact();

  if (error) return <ErrorState description={error.message} onRetry={refetch} />;
  if (isLoading || !contact)
    return <p className="py-10 text-center text-sm text-muted">Cargando…</p>;

  const tabs = [
    { value: 'resumen', label: 'Resumen' },
    { value: 'notas', label: 'Notas', count: notes?.length ?? 0 },
    { value: 'historial', label: 'Historial' },
  ];

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="mb-2 -ml-2"
        onClick={() => navigate('/contacts')}
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Volver a contactos
      </Button>

      <PageHeader
        title={contact.fullName}
        description={contact.jobTitle ?? undefined}
        actions={
          <div className="flex gap-2">
            {hasPermission('contacts:update') && !contact.isArchived && (
              <Button variant="secondary" onClick={() => setEditOpen(true)}>
                <Pencil className="size-4" aria-hidden="true" />
                Editar
              </Button>
            )}
            {hasPermission('contacts:delete') &&
              (contact.isArchived ? (
                <Button variant="secondary" onClick={() => restoreContact.mutate(contact.id)}>
                  <RotateCcw className="size-4" aria-hidden="true" />
                  Restaurar
                </Button>
              ) : (
                <Button variant="secondary" onClick={() => setArchiveOpen(true)}>
                  <Archive className="size-4" aria-hidden="true" />
                  Archivar
                </Button>
              ))}
          </div>
        }
      />

      {contact.isArchived && (
        <div className="mb-4 rounded-md bg-warning-soft px-4 py-2 text-sm text-warning">
          Este contacto está archivado.
        </div>
      )}

      <Tabs tabs={tabs} value={tab} onChange={setTab} className="mb-4" />

      {tab === 'resumen' && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <InfoRow icon={Mail} label="Email">
                {contact.email && (
                  <a href={`mailto:${contact.email}`} className="text-primary hover:underline">
                    {contact.email}
                  </a>
                )}
              </InfoRow>
              <InfoRow icon={Phone} label="Teléfono">
                {contact.phone}
              </InfoRow>
              <InfoRow icon={Smartphone} label="Móvil">
                {contact.mobile}
              </InfoRow>
              <InfoRow icon={Briefcase} label="Área">
                {contact.department}
              </InfoRow>
              <InfoRow icon={LinkIcon} label="LinkedIn">
                {contact.linkedinUrl}
              </InfoRow>
              <InfoRow icon={Building2} label="Empresa">
                {contact.company && (
                  <Link
                    to={`/companies/${contact.company.id}`}
                    className="text-primary hover:underline"
                  >
                    {contact.company.name}
                  </Link>
                )}
              </InfoRow>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-4">
              <div>
                <p className="text-xs text-muted">Contacto principal</p>
                {contact.isPrimary ? (
                  <Badge tone="primary">Sí</Badge>
                ) : (
                  <Badge tone="neutral">No</Badge>
                )}
              </div>
              <div>
                <p className="text-xs text-muted">Alta</p>
                <p className="text-sm text-foreground">{formatDate(contact.createdAt)}</p>
              </div>
              <div>
                <p className="text-xs text-muted">Creado por</p>
                <p className="text-sm text-foreground">
                  {contact.createdBy
                    ? `${contact.createdBy.firstName} ${contact.createdBy.lastName}`
                    : '—'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'notas' && (
        <Card>
          <CardContent>
            <NotesPanel
              resource="contacts"
              parentKey="contactId"
              entityId={contactId}
              notes={notes ?? []}
              isLoading={notesLoading}
            />
          </CardContent>
        </Card>
      )}

      {tab === 'historial' && (
        <Card>
          <CardContent>
            <EntityTimeline entries={timeline?.items ?? []} isLoading={timelineLoading} />
          </CardContent>
        </Card>
      )}

      <ContactFormModal open={editOpen} contact={contact} onClose={() => setEditOpen(false)} />
      <ConfirmDialog
        open={archiveOpen}
        title="Archivar contacto"
        description={`${contact.fullName} dejará de aparecer en los listados.`}
        confirmLabel="Archivar"
        tone="danger"
        loading={archiveContact.isPending}
        onClose={() => setArchiveOpen(false)}
        onConfirm={async () => {
          try {
            await archiveContact.mutateAsync(contact.id);
          } finally {
            setArchiveOpen(false);
          }
        }}
      />
    </>
  );
}
