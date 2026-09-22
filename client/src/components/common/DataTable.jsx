import { ChevronUp, ChevronDown, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils.js';
import { EmptyState } from './EmptyState.jsx';
import { ErrorState } from './ErrorState.jsx';

/**
 * Tabla de datos reutilizable con orden, estados de carga/vacío/error y scroll horizontal.
 * @param {{ key: string, header: string, render?: Function, sortable?: boolean, className?: string }[]} columns
 */
export function DataTable({
  columns,
  rows = [],
  rowKey = (row) => row.id,
  isLoading = false,
  error = null,
  onRetry,
  sortBy,
  sortOrder = 'desc',
  onSort,
  empty,
  onRowClick,
}) {
  if (error) return <ErrorState onRetry={onRetry} description={error.message} />;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-muted" role="status">
        <Loader2 className="size-5 animate-spin" aria-hidden="true" />
        <span className="text-sm">Cargando…</span>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      empty ?? <EmptyState title="Sin resultados" description="No hay registros para mostrar." />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            {columns.map((column) => {
              const isSorted = sortBy === column.key;
              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={
                    isSorted ? (sortOrder === 'asc' ? 'ascending' : 'descending') : undefined
                  }
                  className={cn(
                    'px-4 py-3 text-xs font-semibold tracking-wide text-muted uppercase',
                    column.className,
                  )}
                >
                  {column.sortable && onSort ? (
                    <button
                      type="button"
                      onClick={() => onSort(column.key)}
                      className="inline-flex items-center gap-1 hover:text-foreground"
                    >
                      {column.header}
                      {isSorted &&
                        (sortOrder === 'asc' ? (
                          <ChevronUp className="size-3.5" aria-hidden="true" />
                        ) : (
                          <ChevronDown className="size-3.5" aria-hidden="true" />
                        ))}
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(
                'border-b border-border last:border-0',
                onRowClick && 'cursor-pointer hover:bg-muted-soft',
              )}
            >
              {columns.map((column) => (
                <td key={column.key} className={cn('px-4 py-3 align-middle', column.className)}>
                  {column.render ? column.render(row) : row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
