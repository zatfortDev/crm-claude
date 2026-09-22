import { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { Plus, Users, Pencil, Archive, RotateCcw } from 'lucide-react';
import { PageHeader } from '../../../components/layout/PageHeader.jsx';
import { Card } from '../../../components/ui/Card.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Badge } from '../../../components/ui/Badge.jsx';
import { Select } from '../../../components/ui/Select.jsx';
import { DataTable } from '../../../components/common/DataTable.jsx';
import { Pagination } from '../../../components/common/Pagination.jsx';
import { SearchInput } from '../../../components/common/SearchInput.jsx';
import { EmptyState } from '../../../components/common/EmptyState.jsx';
import { ConfirmDialog } from '../../../components/common/ConfirmDialog.jsx';
import { useDebounce } from '../../../hooks/useDebounce.js';
import { useAuth } from '../../../context/AuthContext.jsx';
import { useCompanies } from '../../companies/hooks/useCompanies.js';
import { useContacts, useArchiveContact, useRestoreContact } from '../hooks/useContacts.js';
import { ContactFormModal } from '../components/ContactFormModal.jsx';

export function ContactsPage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [search, setSearch] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState({ sortBy: 'lastName', sortOrder: 'asc' });
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [archiveTarget, setArchiveTarget] = useState(null);

  const debouncedSearch = useDebounce(search);
  const filters = {
    page,
    pageSize: 20,
    ...sort,
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(companyId ? { companyId } : {}),
    ...(includeDeleted ? { includeDeleted: 'true' } : {}),
  };

  const { data, isLoading, error, refetch } = useContacts(filters);
  const { data: companies } = useCompanies({
    page: 1,
    pageSize: 100,
    sortBy: 'name',
    sortOrder: 'asc',
  });
  const archiveContact = useArchiveContact();
  const restoreContact = useRestoreContact();

  const canCreate = hasPermission('contacts:create');
  const canUpdate = hasPermission('contacts:update');
  const canDelete = hasPermission('contacts:delete');

  const onFilterChange = (setter) => (value) => {
    setter(value);
    setPage(1);
  };

  const onSort = (key) => {
    setSort((current) =>
      current.sortBy === key
        ? { sortBy: key, sortOrder: current.sortOrder === 'asc' ? 'desc' : 'asc' }
        : { sortBy: key, sortOrder: 'asc' },
    );
    setPage(1);
  };

  const columns = [
    {
      key: 'lastName',
      header: 'Contacto',
      sortable: true,
      render: (row) => (
        <div>
          <p className="font-medium text-foreground">
            {row.fullName}
            {row.isPrimary && (
              <Badge tone="primary" className="ml-2">
                Principal
              </Badge>
            )}
          </p>
          <p className="text-xs text-muted">{row.jobTitle ?? '—'}</p>
        </div>
      ),
    },
    {
      key: 'company',
      header: 'Empresa',
      render: (row) =>
        row.company ? (
          <Link
            to={`/companies/${row.company.id}`}
            className="text-primary hover:underline"
            onClick={(event) => event.stopPropagation()}
          >
            {row.company.name}
          </Link>
        ) : (
          <span className="text-muted">Sin empresa</span>
        ),
    },
    { key: 'email', header: 'Email', sortable: true, render: (row) => row.email ?? '—' },
    { key: 'phone', header: 'Teléfono', render: (row) => row.phone ?? row.mobile ?? '—' },
    {
      key: 'status',
      header: 'Estado',
      render: (row) =>
        row.isArchived ? (
          <Badge tone="neutral">Archivado</Badge>
        ) : (
          <Badge tone="success">Activo</Badge>
        ),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (row) => (
        <div className="flex justify-end gap-1" onClick={(event) => event.stopPropagation()}>
          {canUpdate && !row.isArchived && (
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Editar ${row.fullName}`}
              onClick={() => {
                setEditing(row);
                setFormOpen(true);
              }}
            >
              <Pencil className="size-4" />
            </Button>
          )}
          {canDelete &&
            (row.isArchived ? (
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Restaurar ${row.fullName}`}
                onClick={() => restoreContact.mutate(row.id)}
              >
                <RotateCcw className="size-4 text-success" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Archivar ${row.fullName}`}
                onClick={() => setArchiveTarget(row)}
              >
                <Archive className="size-4 text-danger" />
              </Button>
            ))}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Contactos"
        description="Personas con las que se relaciona tu equipo comercial."
        actions={
          canCreate && (
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="size-4" aria-hidden="true" />
              Nuevo contacto
            </Button>
          )
        }
      />

      <Card>
        <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center">
          <SearchInput
            value={search}
            onChange={onFilterChange(setSearch)}
            placeholder="Buscar por nombre, email o teléfono…"
          />
          <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
            <Select
              aria-label="Filtrar por empresa"
              value={companyId}
              onChange={(event) => onFilterChange(setCompanyId)(event.target.value)}
              placeholder="Todas las empresas"
              options={(companies?.items ?? []).map((company) => ({
                value: company.id,
                label: company.name,
              }))}
              className="h-9"
            />
            {canDelete && (
              <label className="flex h-9 items-center gap-2 text-sm text-muted">
                <input
                  type="checkbox"
                  checked={includeDeleted}
                  onChange={(event) => onFilterChange(setIncludeDeleted)(event.target.checked)}
                  className="size-4 rounded border-border text-primary"
                />
                Ver archivados
              </label>
            )}
          </div>
        </div>

        <DataTable
          columns={columns}
          rows={data?.items ?? []}
          isLoading={isLoading}
          error={error}
          onRetry={refetch}
          sortBy={sort.sortBy}
          sortOrder={sort.sortOrder}
          onSort={onSort}
          onRowClick={(row) => navigate(`/contacts/${row.id}`)}
          empty={
            <EmptyState
              icon={Users}
              title="No se encontraron contactos"
              description="Ajustá los filtros o registrá un contacto nuevo."
            />
          }
        />
        <Pagination meta={data?.meta} onPageChange={setPage} />
      </Card>

      <ContactFormModal open={formOpen} contact={editing} onClose={() => setFormOpen(false)} />

      <ConfirmDialog
        open={Boolean(archiveTarget)}
        title="Archivar contacto"
        description={`${archiveTarget?.fullName} dejará de aparecer en los listados.`}
        confirmLabel="Archivar"
        tone="danger"
        loading={archiveContact.isPending}
        onClose={() => setArchiveTarget(null)}
        onConfirm={async () => {
          try {
            await archiveContact.mutateAsync(archiveTarget.id);
          } finally {
            setArchiveTarget(null);
          }
        }}
      />
    </>
  );
}
