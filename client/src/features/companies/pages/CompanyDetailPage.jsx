import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import {
  ArrowLeft,
  Pencil,
  Archive,
  RotateCcw,
  Plus,
  Globe,
  Mail,
  Phone,
  MapPin,
  Users,
} from 'lucide-react';
import { PageHeader } from '../../../components/layout/PageHeader.jsx';
import { Card, CardContent } from '../../../components/ui/Card.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Badge } from '../../../components/ui/Badge.jsx';
import { Tabs } from '../../../components/ui/Tabs.jsx';
import { DataTable } from '../../../components/common/DataTable.jsx';
import { EmptyState } from '../../../components/common/EmptyState.jsx';
import { ErrorState } from '../../../components/common/ErrorState.jsx';
import { NotesPanel } from '../../../components/common/NotesPanel.jsx';
import { EntityTimeline } from '../../../components/common/EntityTimeline.jsx';
import { ConfirmDialog } from '../../../components/common/ConfirmDialog.jsx';
import { useAuth } from '../../../context/AuthContext.jsx';
import { formatDate } from '../../../lib/formatters.js';
import {
  useCompany,
  useCompanyContacts,
  useCompanyNotes,
  useCompanyTimeline,
  useArchiveCompany,
  useRestoreCompany,
} from '../hooks/useCompanies.js';
import { CompanyFormModal } from '../components/CompanyFormModal.jsx';
import { ContactFormModal } from '../../contacts/components/ContactFormModal.jsx';

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

export function CompanyDetailPage() {
  const { id } = useParams();
  const companyId = Number(id);
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [tab, setTab] = useState('resumen');
  const [editOpen, setEditOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  const { data: company, isLoading, error, refetch } = useCompany(companyId);
  const { data: contacts, isLoading: contactsLoading } = useCompanyContacts(companyId);
  const { data: notes, isLoading: notesLoading } = useCompanyNotes(companyId);
  const { data: timeline, isLoading: timelineLoading } = useCompanyTimeline(companyId);
  const archiveCompany = useArchiveCompany();
  const restoreCompany = useRestoreCompany();

  if (error) return <ErrorState description={error.message} onRetry={refetch} />;
  if (isLoading || !company)
    return <p className="py-10 text-center text-sm text-muted">Cargando…</p>;

  const contactColumns = [
    {
      key: 'fullName',
      header: 'Contacto',
      render: (row) => (
        <Link to={`/contacts/${row.id}`} className="font-medium text-primary hover:underline">
          {row.fullName}
          {row.isPrimary && (
            <Badge tone="primary" className="ml-2">
              Principal
            </Badge>
          )}
        </Link>
      ),
    },
    { key: 'jobTitle', header: 'Cargo', render: (row) => row.jobTitle ?? '—' },
    { key: 'email', header: 'Email', render: (row) => row.email ?? '—' },
    { key: 'phone', header: 'Teléfono', render: (row) => row.phone ?? row.mobile ?? '—' },
  ];

  const tabs = [
    { value: 'resumen', label: 'Resumen' },
    { value: 'contactos', label: 'Contactos', count: contacts?.meta?.total ?? 0 },
    { value: 'notas', label: 'Notas', count: notes?.length ?? 0 },
    { value: 'historial', label: 'Historial' },
  ];

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="mb-2 -ml-2"
        onClick={() => navigate('/companies')}
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Volver a empresas
      </Button>

      <PageHeader
        title={company.name}
        description={company.legalName ?? undefined}
        actions={
          <div className="flex gap-2">
            {hasPermission('companies:update') && !company.isArchived && (
              <Button variant="secondary" onClick={() => setEditOpen(true)}>
                <Pencil className="size-4" aria-hidden="true" />
                Editar
              </Button>
            )}
            {hasPermission('companies:delete') &&
              (company.isArchived ? (
                <Button variant="secondary" onClick={() => restoreCompany.mutate(company.id)}>
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

      {company.isArchived && (
        <div className="mb-4 rounded-md bg-warning-soft px-4 py-2 text-sm text-warning">
          Esta empresa está archivada: no aparece en los listados ni puede editarse.
        </div>
      )}

      <Tabs tabs={tabs} value={tab} onChange={setTab} className="mb-4" />

      {tab === 'resumen' && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <InfoRow icon={Globe} label="Sitio web">
                {company.website && (
                  <a
                    href={company.website}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-primary hover:underline"
                  >
                    {company.website}
                  </a>
                )}
              </InfoRow>
              <InfoRow icon={Mail} label="Email">
                {company.email}
              </InfoRow>
              <InfoRow icon={Phone} label="Teléfono">
                {company.phone}
              </InfoRow>
              <InfoRow icon={MapPin} label="Dirección">
                {[company.addressLine, company.city, company.state, company.country]
                  .filter(Boolean)
                  .join(', ')}
              </InfoRow>
              <InfoRow icon={Users} label="Tamaño">
                {company.employeesRange && `${company.employeesRange} empleados`}
              </InfoRow>
              <InfoRow icon={Users} label="Identificador fiscal">
                {company.taxId}
              </InfoRow>
              {company.description && (
                <div className="sm:col-span-2">
                  <p className="text-xs text-muted">Descripción</p>
                  <p className="mt-1 text-sm whitespace-pre-wrap text-foreground">
                    {company.description}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-4">
              <div>
                <p className="text-xs text-muted">Industria</p>
                <p className="text-sm text-foreground">{company.industry ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted">Cliente</p>
                {company.client ? (
                  <Badge tone="success">Sí · {company.client.status}</Badge>
                ) : (
                  <Badge tone="neutral">Todavía no</Badge>
                )}
              </div>
              <div>
                <p className="text-xs text-muted">Alta</p>
                <p className="text-sm text-foreground">{formatDate(company.createdAt)}</p>
              </div>
              <div>
                <p className="text-xs text-muted">Creada por</p>
                <p className="text-sm text-foreground">
                  {company.createdBy
                    ? `${company.createdBy.firstName} ${company.createdBy.lastName}`
                    : '—'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'contactos' && (
        <Card>
          <div className="flex items-center justify-between border-b border-border p-4">
            <p className="text-sm text-muted">Personas vinculadas a esta empresa</p>
            {hasPermission('contacts:create') && !company.isArchived && (
              <Button size="sm" onClick={() => setContactOpen(true)}>
                <Plus className="size-4" aria-hidden="true" />
                Nuevo contacto
              </Button>
            )}
          </div>
          <DataTable
            columns={contactColumns}
            rows={contacts?.items ?? []}
            isLoading={contactsLoading}
            empty={
              <EmptyState
                icon={Users}
                title="Sin contactos"
                description="Agregá las personas con las que te comunicás en esta empresa."
              />
            }
          />
        </Card>
      )}

      {tab === 'notas' && (
        <Card>
          <CardContent>
            <NotesPanel
              resource="companies"
              parentKey="companyId"
              entityId={companyId}
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

      <CompanyFormModal open={editOpen} company={company} onClose={() => setEditOpen(false)} />
      <ContactFormModal
        open={contactOpen}
        lockedCompanyId={companyId}
        onClose={() => setContactOpen(false)}
      />
      <ConfirmDialog
        open={archiveOpen}
        title="Archivar empresa"
        description={`${company.name} dejará de aparecer en los listados.`}
        confirmLabel="Archivar"
        tone="danger"
        loading={archiveCompany.isPending}
        onClose={() => setArchiveOpen(false)}
        onConfirm={async () => {
          try {
            await archiveCompany.mutateAsync(company.id);
          } finally {
            setArchiveOpen(false);
          }
        }}
      />
    </>
  );
}
