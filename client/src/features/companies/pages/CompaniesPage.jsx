import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Plus, Building2, Pencil, Archive, RotateCcw } from 'lucide-react';
import { PageHeader } from '../../../components/layout/PageHeader.jsx';
import { Card } from '../../../components/ui/Card.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Badge } from '../../../components/ui/Badge.jsx';
import { Input } from '../../../components/ui/Input.jsx';
import { Select } from '../../../components/ui/Select.jsx';
import { DataTable } from '../../../components/common/DataTable.jsx';
import { Pagination } from '../../../components/common/Pagination.jsx';
import { SearchInput } from '../../../components/common/SearchInput.jsx';
import { EmptyState } from '../../../components/common/EmptyState.jsx';
import { ConfirmDialog } from '../../../components/common/ConfirmDialog.jsx';
import { useDebounce } from '../../../hooks/useDebounce.js';
import { useAuth } from '../../../context/AuthContext.jsx';
import { EMPLOYEES_RANGES } from '../../../lib/schemas.js';
import { useCompanies, useArchiveCompany, useRestoreCompany } from '../hooks/useCompanies.js';
import { CompanyFormModal } from '../components/CompanyFormModal.jsx';

export function CompaniesPage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [search, setSearch] = useState('');
  const [city, setCity] = useState('');
  const [employeesRange, setEmployeesRange] = useState('');
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState({ sortBy: 'name', sortOrder: 'asc' });
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [archiveTarget, setArchiveTarget] = useState(null);

  const debouncedSearch = useDebounce(search);
  const debouncedCity = useDebounce(city);
  const filters = {
    page,
    pageSize: 20,
    ...sort,
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(debouncedCity ? { city: debouncedCity } : {}),
    ...(employeesRange ? { employeesRange } : {}),
    ...(includeDeleted ? { includeDeleted: 'true' } : {}),
  };

  const { data, isLoading, error, refetch } = useCompanies(filters);
  const archiveCompany = useArchiveCompany();
  const restoreCompany = useRestoreCompany();

  const canCreate = hasPermission('companies:create');
  const canUpdate = hasPermission('companies:update');
  const canDelete = hasPermission('companies:delete');

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
      key: 'name',
      header: 'Empresa',
      sortable: true,
      render: (row) => (
        <div>
          <p className="font-medium text-foreground">{row.name}</p>
          <p className="text-xs text-muted">{row.legalName ?? row.taxId ?? '—'}</p>
        </div>
      ),
    },
    {
      key: 'industry',
      header: 'Industria',
      sortable: true,
      render: (row) => row.industry ?? <span className="text-muted">—</span>,
    },
    {
      key: 'city',
      header: 'Ubicación',
      sortable: true,
      render: (row) => (
        <span className="text-muted">
          {[row.city, row.country].filter(Boolean).join(', ') || '—'}
        </span>
      ),
    },
    {
      key: 'contactsCount',
      header: 'Contactos',
      render: (row) => row.contactsCount ?? 0,
    },
    {
      key: 'status',
      header: 'Estado',
      render: (row) =>
        row.isArchived ? (
          <Badge tone="neutral">Archivada</Badge>
        ) : (
          <Badge tone="success">Activa</Badge>
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
              aria-label={`Editar ${row.name}`}
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
                aria-label={`Restaurar ${row.name}`}
                onClick={() => restoreCompany.mutate(row.id)}
              >
                <RotateCcw className="size-4 text-success" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Archivar ${row.name}`}
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
        title="Empresas"
        description="Directorio de organizaciones con las que trabaja tu equipo."
        actions={
          canCreate && (
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="size-4" aria-hidden="true" />
              Nueva empresa
            </Button>
          )
        }
      />

      <Card>
        <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-end">
          <SearchInput
            value={search}
            onChange={onFilterChange(setSearch)}
            placeholder="Buscar por nombre, razón social o CUIT…"
          />
          <div className="flex flex-wrap items-end gap-2 lg:ml-auto">
            <Input
              label="Ciudad"
              value={city}
              onChange={(event) => onFilterChange(setCity)(event.target.value)}
              className="h-9 w-40"
            />
            <Select
              label="Tamaño"
              value={employeesRange}
              onChange={(event) => onFilterChange(setEmployeesRange)(event.target.value)}
              placeholder="Cualquiera"
              options={EMPLOYEES_RANGES.map((range) => ({ value: range, label: range }))}
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
                Ver archivadas
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
          onRowClick={(row) => navigate(`/companies/${row.id}`)}
          empty={
            <EmptyState
              icon={Building2}
              title="No se encontraron empresas"
              description="Ajustá los filtros o registrá una empresa nueva."
              action={
                canCreate && (
                  <Button
                    onClick={() => {
                      setEditing(null);
                      setFormOpen(true);
                    }}
                  >
                    <Plus className="size-4" aria-hidden="true" />
                    Nueva empresa
                  </Button>
                )
              }
            />
          }
        />
        <Pagination meta={data?.meta} onPageChange={setPage} />
      </Card>

      <CompanyFormModal open={formOpen} company={editing} onClose={() => setFormOpen(false)} />

      <ConfirmDialog
        open={Boolean(archiveTarget)}
        title="Archivar empresa"
        description={`${archiveTarget?.name} dejará de aparecer en los listados. Podés restaurarla después.`}
        confirmLabel="Archivar"
        tone="danger"
        loading={archiveCompany.isPending}
        onClose={() => setArchiveTarget(null)}
        onConfirm={async () => {
          try {
            await archiveCompany.mutateAsync(archiveTarget.id);
          } finally {
            setArchiveTarget(null);
          }
        }}
      />
    </>
  );
}
