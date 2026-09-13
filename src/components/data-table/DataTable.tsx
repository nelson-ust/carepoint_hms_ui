import * as React from "react";
import { AlertCircle, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { EmptyState, type EmptyStateProps } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";

export interface DataTableColumn<T> {
  key: string;
  header: React.ReactNode;
  /** Render a cell. Defaults to `row[key]` when omitted. */
  render?: (row: T, index: number) => React.ReactNode;
  className?: string;
  headerClassName?: string;
  align?: "left" | "center" | "right";
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[] | undefined | null;
  rowKey: (row: T, index: number) => React.Key;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onRowClick?: (row: T) => void;
  empty?: Partial<EmptyStateProps>;
  /** Number of skeleton rows while loading. */
  skeletonRows?: number;
  footer?: React.ReactNode;
  className?: string;
}

const alignClass = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
} as const;

/**
 * Standard glass data table: sticky header, hover rows, loading skeleton,
 * error + empty states built in. Wrap in a <Card padding="none"> or use bare.
 */
export function DataTable<T>({
  columns,
  data,
  rowKey,
  isLoading = false,
  error = null,
  onRetry,
  onRowClick,
  empty,
  skeletonRows = 6,
  footer,
  className,
}: DataTableProps<T>) {
  const colCount = columns.length;

  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="table-shell">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(alignClass[col.align ?? "left"], col.headerClassName)}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            Array.from({ length: skeletonRows }).map((_, i) => (
              <tr key={`skeleton-${i}`}>
                {columns.map((col) => (
                  <td key={col.key}>
                    <Skeleton className="h-5 w-full max-w-[160px]" />
                  </td>
                ))}
              </tr>
            ))
          ) : error ? (
            <tr>
              <td colSpan={colCount}>
                <div className="flex flex-col items-center gap-3 px-8 py-14 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-rose-500/10 text-rose-500">
                    <AlertCircle className="h-7 w-7" aria-hidden />
                  </div>
                  <p className="text-sm font-bold text-secondary-900">{error}</p>
                  {onRetry ? (
                    <Button variant="secondary" size="sm" onClick={onRetry} leftIcon={<RotateCcw className="h-3.5 w-3.5" />}>
                      Retry
                    </Button>
                  ) : null}
                </div>
              </td>
            </tr>
          ) : !data || data.length === 0 ? (
            <tr>
              <td colSpan={colCount}>
                <EmptyState
                  title={empty?.title ?? "Nothing here yet"}
                  description={empty?.description ?? "Records will appear here as they are created."}
                  icon={empty?.icon}
                  action={empty?.action}
                />
              </td>
            </tr>
          ) : (
            data.map((row, index) => (
              <tr
                key={rowKey(row, index)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(onRowClick && "cursor-pointer")}
              >
                {columns.map((col) => (
                  <td key={col.key} className={cn(alignClass[col.align ?? "left"], col.className)}>
                    {col.render
                      ? col.render(row, index)
                      : String((row as Record<string, unknown>)[col.key] ?? "—")}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
      {footer}
    </div>
  );
}
