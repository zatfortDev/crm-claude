import { useState } from 'react';
import { Plus, UserPlus, Pencil, KeyRound, UserCheck, UserX } from 'lucide-react';
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
import { formatDateTime } from '../../../lib/formatters.js';
import { useAuth } from '../../../context/AuthContext.jsx';
import { useUsers, useRoles, useSetUserStatus, useSetUserRole } from '../hooks/useUsers.js';
import { UserFormModal } from '../components/UserFormModal.jsx';
import { ResetPasswordModal } from '../components/ResetPasswordModal.jsx';

export function UsersPage() {
  const { user: currentUser, hasPermission } = useAuth();
  const [search, setSearch] = useState('');
  const [roleId, setRoleId] = useState('');
  const [isActive, setIsActive] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState({ sortBy: 'createdAt', sortOrder: 'desc' });
  const [editing, setEditing] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState(null);
  const [statusTarget, setStatusTarget] = useState(null);

  const debouncedSearch = useDebounce(search);
  const filters = {
    page,
    pageSize: 20,
    ...sort,
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(roleId ? { roleId } : {}),
    ...(isActive ? { isActive } : {}),
  };

  const { data, isLoading, error, refetch } = useUsers(filters);
  const { data: roles = [] } = useRoles();
  const setStatus = useSetUserStatus();
  const setRole = useSetUserRole();

  const canManage = hasPermission('users:manage');
  const canCreate = hasPermission('users:create');
  const canUpdate = hasPermission('users:update');

  const onSort = (key) => {
    setSort((current) =>
      current.sortBy === key
        ? { sortBy: key, sortOrder: current.sortOrder === 'asc' ? 'desc' : 'asc' }
        : { sortBy: key, sortOrder: 'asc' },
    );
    setPage(1);
  };

  const resetFilters = (setter) => (value) => {
    setter(value);
    setPage(1);
  };

  const columns = [
    {
      key: 'firstName',
      header: 'Usuario',
      sortable: true,
      render: (row) => (
        <div>
          <p className="font-medium text-foreground">
            {row.fullName}
            {row.id === currentUser?.id && <span className="ml-2 text-xs text-muted">(vos)</span>}
          </p>
          <p className="text-xs text-muted">{row.email}</p>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Rol',
      render: (row) =>
        canManage && row.id !== currentUser?.id ? (
          <Select
            aria-label={`Rol de ${row.fullName}`}
            value={row.role?.id ?? ''}
            onChange={(event) => setRole.mutate({ id: row.id, roleId: Number(event.target.value) })}
            options={roles.map((role) => ({ value: role.id, label: role.name }))}
            className="h-8 w-40"
          />
        ) : (
          <Badge tone="primary">{row.role?.name}</Badge>
        ),
    },
    {
      key: 'isActive',
      header: 'Estado',
      render: (row) => (
        <div className="flex flex-col gap-1">
          <Badge tone={row.isActive ? 'success' : 'neutral'}>
            {row.isActive ? 'Activo' : 'Inactivo'}
          </Badge>
          {row.mustChangePassword && (
            <span className="text-xs text-warning">Debe cambiar contraseña</span>
          )}
        </div>
      ),
    },
    {
      key: 'lastLoginAt',
      header: 'Último acceso',
      sortable: true,
      render: (row) => <span className="text-muted">{formatDateTime(row.lastLoginAt)}</span>,
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (row) => (
        <div className="flex justify-end gap-1">
          {canUpdate && (
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
          {canManage && (
            <>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Resetear contraseña de ${row.fullName}`}
                onClick={() => setResetTarget(row)}
              >
                <KeyRound className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`${row.isActive ? 'Desactivar' : 'Activar'} ${row.fullName}`}
                disabled={row.id === currentUser?.id && row.isActive}
                onClick={() => setStatusTarget(row)}
              >
                {row.isActive ? (
                  <UserX className="size-4 text-danger" />
                ) : (
                  <UserCheck className="size-4 text-success" />
                )}
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Usuarios"
        description="Administrá las cuentas del sistema, sus roles y su estado."
        actions={
          canCreate && (
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="size-4" aria-hidden="true" />
              Nuevo usuario
            </Button>
          )
        }
      />

      <Card>
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center">
          <SearchInput
            value={search}
            onChange={resetFilters(setSearch)}
            placeholder="Buscar por nombre o email…"
          />
          <div className="flex gap-2 sm:ml-auto">
            <Select
              aria-label="Filtrar por rol"
              value={roleId}
              onChange={(event) => resetFilters(setRoleId)(event.target.value)}
              placeholder="Todos los roles"
              options={roles.map((role) => ({ value: role.id, label: role.name }))}
              className="h-9"
            />
            <Select
              aria-label="Filtrar por estado"
              value={isActive}
              onChange={(event) => resetFilters(setIsActive)(event.target.value)}
              placeholder="Todos los estados"
              options={[
                { value: 'true', label: 'Activos' },
                { value: 'false', label: 'Inactivos' },
              ]}
              className="h-9"
            />
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
          empty={
            <EmptyState
              icon={UserPlus}
              title="No se encontraron usuarios"
              description="Probá con otros filtros o creá un usuario nuevo."
            />
          }
        />
        <Pagination meta={data?.meta} onPageChange={setPage} />
      </Card>

      <UserFormModal
        open={formOpen}
        user={editing}
        roles={roles}
        onClose={() => setFormOpen(false)}
      />
      <ResetPasswordModal
        open={Boolean(resetTarget)}
        user={resetTarget}
        onClose={() => setResetTarget(null)}
      />
      <ConfirmDialog
        open={Boolean(statusTarget)}
        title={statusTarget?.isActive ? 'Desactivar usuario' : 'Activar usuario'}
        description={
          statusTarget?.isActive
            ? `${statusTarget?.fullName} perderá el acceso y se cerrarán sus sesiones abiertas.`
            : `${statusTarget?.fullName} podrá volver a iniciar sesión.`
        }
        confirmLabel={statusTarget?.isActive ? 'Desactivar' : 'Activar'}
        tone={statusTarget?.isActive ? 'danger' : 'primary'}
        loading={setStatus.isPending}
        onClose={() => setStatusTarget(null)}
        onConfirm={async () => {
          await setStatus.mutateAsync({ id: statusTarget.id, isActive: !statusTarget.isActive });
          setStatusTarget(null);
        }}
      />
    </>
  );
}
