import * as React from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Inbox,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { DxButton } from "./DxButton";

// ============================================================
// Types
// ============================================================

export type DxSortDirection = "asc" | "desc";
export type DxSortState = { key: string; direction: DxSortDirection } | null;

export interface DxGridColumn<T> {
  key: string;
  header: React.ReactNode;
  /** Cell renderer. Defaults to `String(row[key])`. */
  render?: (row: T, index: number) => React.ReactNode;
  /** Value used for client-side sorting and filtering. Defaults to `row[key]`. */
  accessor?: (row: T) => string | number | boolean | null | undefined;
  width?: number | string;
  minWidth?: number | string;
  align?: "left" | "center" | "right";
  sortable?: boolean;
  /** `true` → text filter; `{options}` → dropdown filter. */
  filter?: boolean | { options: { value: string; label: string }[] };
  /** Allow wrapping / multi-line cells. */
  wrap?: boolean;
  className?: string;
  headerClassName?: string;
}

export interface DxGridProps<T> {
  columns: DxGridColumn<T>[];
  data: T[] | undefined | null;
  rowKey: (row: T, index: number) => React.Key;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onRowClick?: (row: T) => void;
  /** Key of the row to highlight as selected. */
  selectedKey?: React.Key | null;
  rowClassName?: (row: T) => string | undefined;
  empty?: { icon?: React.ElementType; title?: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode };
  skeletonRows?: number;
  /** Show the DevExpress-style filter row under the header. */
  filterRow?: boolean;
  /** Controlled sort. When omitted the grid sorts client-side. */
  sort?: DxSortState;
  onSortChange?: (sort: DxSortState) => void;
  /** Controlled filters (by column key). When omitted the grid filters client-side. */
  filters?: Record<string, string>;
  onFiltersChange?: (filters: Record<string, string>) => void;
  /** Summary cells keyed by column key (rendered in <tfoot>). */
  summary?: Record<string, React.ReactNode>;
  footer?: React.ReactNode;
  striped?: boolean;
  /** Sits directly under a `dx-toolbar-attached` toolbar. */
  attached?: boolean;
  /** No outer border — when the grid lives inside a flush DxPanel. */
  borderless?: boolean;
  verticalLines?: boolean;
  maxHeight?: number | string;
  className?: string;
  /** Rendered above the grid state message when there is data but no rows pass the filter. */
  noMatchText?: string;
}

const alignClass = { left: "", center: "dx-cell-center", right: "dx-cell-right" } as const;

function defaultAccessor<T>(row: T, key: string) {
  const v = (row as Record<string, unknown>)[key];
  return v as string | number | boolean | null | undefined;
}

function compare(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  const na = Number(a);
  const nb = Number(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb) && String(a).trim() !== "" && String(b).trim() !== "") return na - nb;
  return String(a).localeCompare(String(b), undefined, { sensitivity: "base", numeric: true });
}

// ============================================================
// Grid
// ============================================================

/**
 * DevExpress-inspired data grid: banded sticky header with sort indicators,
 * optional filter row, zebra striping, selection highlight, summary footer.
 * Sorting/filtering run client-side unless the controlled props are supplied.
 */
export function DxGrid<T>({
  columns,
  data,
  rowKey,
  isLoading = false,
  error = null,
  onRetry,
  onRowClick,
  selectedKey,
  rowClassName,
  empty,
  skeletonRows = 6,
  filterRow = false,
  sort: sortProp,
  onSortChange,
  filters: filtersProp,
  onFiltersChange,
  summary,
  footer,
  striped = true,
  attached = false,
  borderless = false,
  verticalLines = true,
  maxHeight,
  className,
  noMatchText = "No rows match the current filter.",
}: DxGridProps<T>) {
  const [localSort, setLocalSort] = React.useState<DxSortState>(null);
  const [localFilters, setLocalFilters] = React.useState<Record<string, string>>({});
  const sort = sortProp !== undefined ? sortProp : localSort;
  const filters = filtersProp ?? localFilters;
  const controlledSort = sortProp !== undefined;
  const controlledFilters = filtersProp !== undefined;

  const toggleSort = (col: DxGridColumn<T>) => {
    if (!col.sortable) return;
    let next: DxSortState;
    if (!sort || sort.key !== col.key) next = { key: col.key, direction: "asc" };
    else if (sort.direction === "asc") next = { key: col.key, direction: "desc" };
    else next = null;
    if (!controlledSort) setLocalSort(next);
    onSortChange?.(next);
  };

  const setFilter = (key: string, value: string) => {
    const next = { ...filters, [key]: value };
    if (!value) delete next[key];
    if (!controlledFilters) setLocalFilters(next);
    onFiltersChange?.(next);
  };

  const rows = React.useMemo(() => {
    let out = Array.isArray(data) ? [...data] : [];
    if (!controlledFilters) {
      const active = Object.entries(filters).filter(([, v]) => v !== "");
      if (active.length) {
        out = out.filter((row) =>
          active.every(([key, needle]) => {
            const col = columns.find((c) => c.key === key);
            const value = col?.accessor ? col.accessor(row) : defaultAccessor(row, key);
            if (col?.filter && typeof col.filter === "object") {
              return String(value ?? "").toLowerCase() === needle.toLowerCase();
            }
            return String(value ?? "").toLowerCase().includes(needle.toLowerCase());
          }),
        );
      }
    }
    if (!controlledSort && sort) {
      const col = columns.find((c) => c.key === sort.key);
      const acc = (row: T) => (col?.accessor ? col.accessor(row) : defaultAccessor(row, sort.key));
      out.sort((a, b) => {
        const r = compare(acc(a), acc(b));
        return sort.direction === "asc" ? r : -r;
      });
    }
    return out;
  }, [data, filters, sort, columns, controlledFilters, controlledSort]);

  const colCount = columns.length;
  const hasData = !!data && data.length > 0;
  const EmptyIcon = empty?.icon ?? Inbox;

  return (
    <div className={cn("dx-grid-outer", className)}>
      <div
        className={cn("dx-grid-wrap", attached && "dx-grid-attached", borderless && "dx-grid-borderless")}
        style={maxHeight ? { maxHeight } : undefined}
      >
        <table className={cn("dx-grid", striped && "dx-grid-striped", !verticalLines && "dx-grid-no-vlines")}>
          <colgroup>
            {columns.map((c) => (
              <col key={c.key} style={{ width: c.width, minWidth: c.minWidth }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {columns.map((col) => {
                const active = sort?.key === col.key;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={active ? (sort!.direction === "asc" ? "ascending" : "descending") : undefined}
                    className={cn(alignClass[col.align ?? "left"], col.sortable && "dx-sortable", col.headerClassName)}
                    onClick={col.sortable ? () => toggleSort(col) : undefined}
                  >
                    <span className="dx-th-inner">
                      <span className="truncate">{col.header}</span>
                      {col.sortable ? (
                        active ? (
                          sort!.direction === "asc" ? (
                            <ArrowUp className="dx-sort-icon" aria-hidden />
                          ) : (
                            <ArrowDown className="dx-sort-icon" aria-hidden />
                          )
                        ) : (
                          <ArrowUpDown className="dx-sort-icon dx-sort-idle" aria-hidden />
                        )
                      ) : null}
                    </span>
                  </th>
                );
              })}
            </tr>
            {filterRow ? (
              <tr className="dx-filter-row">
                {columns.map((col) => (
                  <th key={col.key} scope="col">
                    {col.filter ? (
                      typeof col.filter === "object" ? (
                        <select
                          className="dx-filter-input"
                          aria-label={`Filter ${typeof col.header === "string" ? col.header : col.key}`}
                          value={filters[col.key] ?? ""}
                          onChange={(e) => setFilter(col.key, e.target.value)}
                        >
                          <option value="">(All)</option>
                          {col.filter.options.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          className="dx-filter-input"
                          aria-label={`Filter ${typeof col.header === "string" ? col.header : col.key}`}
                          placeholder="Filter…"
                          value={filters[col.key] ?? ""}
                          onChange={(e) => setFilter(col.key, e.target.value)}
                        />
                      )
                    ) : null}
                  </th>
                ))}
              </tr>
            ) : null}
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: skeletonRows }).map((_, i) => (
                <tr key={`sk-${i}`}>
                  {columns.map((col) => (
                    <td key={col.key}>
                      <div className="dx-skeleton h-3.5" style={{ width: `${55 + ((i * 17 + col.key.length * 7) % 40)}%` }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : error ? (
              <tr>
                <td colSpan={colCount} className="dx-wrap">
                  <div className="dx-grid-state">
                    <AlertCircle aria-hidden />
                    <p className="dx-grid-state-title">{error}</p>
                    {onRetry ? (
                      <DxButton size="sm" onClick={onRetry} leftIcon={<RotateCcw />}>
                        Retry
                      </DxButton>
                    ) : null}
                  </div>
                </td>
              </tr>
            ) : !hasData ? (
              <tr>
                <td colSpan={colCount} className="dx-wrap">
                  <div className="dx-grid-state">
                    <EmptyIcon aria-hidden />
                    <p className="dx-grid-state-title">{empty?.title ?? "No records"}</p>
                    {empty?.description ? <p>{empty.description}</p> : null}
                    {empty?.action ? <div className="mt-2">{empty.action}</div> : null}
                  </div>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="dx-wrap">
                  <div className="dx-grid-state">
                    <p>{noMatchText}</p>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((row, index) => {
                const key = rowKey(row, index);
                const selected = selectedKey != null && key === selectedKey;
                return (
                  <tr
                    key={key}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    aria-selected={selected || undefined}
                    className={cn(onRowClick && "dx-row-clickable", selected && "dx-row-selected", rowClassName?.(row))}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={cn(alignClass[col.align ?? "left"], col.wrap && "dx-wrap dx-td-multiline", col.className)}
                      >
                        {col.render
                          ? col.render(row, index)
                          : String((row as Record<string, unknown>)[col.key] ?? "—")}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
          {summary && hasData && !isLoading && !error ? (
            <tfoot>
              <tr>
                {columns.map((col) => (
                  <td key={col.key} className={alignClass[col.align ?? "left"]}>
                    {summary[col.key] ?? null}
                  </td>
                ))}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
      {footer}
    </div>
  );
}

// ============================================================
// Pager
// ============================================================

export interface DxPagerProps {
  page: number;
  totalPages?: number;
  totalItems?: number;
  pageSize?: number;
  hasNext?: boolean;
  onPageChange: (page: number) => void;
  pageSizeOptions?: number[];
  onPageSizeChange?: (size: number) => void;
  className?: string;
}

export function DxPager({
  page,
  totalPages,
  totalItems,
  pageSize,
  hasNext,
  onPageChange,
  pageSizeOptions,
  onPageSizeChange,
  className,
}: DxPagerProps) {
  const last = totalPages ?? (hasNext ? page + 1 : page);
  const canPrev = page > 1;
  const canNext = totalPages ? page < totalPages : !!hasNext;

  const windowPages = React.useMemo(() => {
    if (!totalPages) return [page];
    const span = 2;
    const start = Math.max(1, page - span);
    const end = Math.min(totalPages, page + span);
    const out: number[] = [];
    for (let p = start; p <= end; p++) out.push(p);
    return out;
  }, [page, totalPages]);

  const from = pageSize && totalItems ? Math.min(totalItems, (page - 1) * pageSize + 1) : null;
  const to = pageSize && totalItems ? Math.min(totalItems, page * pageSize) : null;

  return (
    <div className={cn("dx-pager", className)}>
      <div className="flex items-center gap-3">
        {pageSizeOptions && onPageSizeChange ? (
          <label className="flex items-center gap-1.5">
            <span>Rows</span>
            <select
              className="dx-filter-input"
              style={{ width: 64 }}
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
            >
              {pageSizeOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <span>
          {from != null && to != null ? (
            <>
              {from}–{to} of <b className="dx-strong">{totalItems}</b>
            </>
          ) : totalItems != null ? (
            <>
              <b className="dx-strong">{totalItems}</b> records
            </>
          ) : (
            <>
              Page <b className="dx-strong">{page}</b>
              {totalPages ? ` of ${totalPages}` : ""}
            </>
          )}
        </span>
      </div>
      <div className="dx-pager-pages">
        <button className="dx-pager-btn" onClick={() => onPageChange(1)} disabled={!canPrev} aria-label="First page">
          <ChevronsLeft />
        </button>
        <button className="dx-pager-btn" onClick={() => onPageChange(page - 1)} disabled={!canPrev} aria-label="Previous page">
          <ChevronLeft />
        </button>
        {windowPages[0] > 1 ? <span className="px-1">…</span> : null}
        {windowPages.map((p) => (
          <button
            key={p}
            className={cn("dx-pager-btn", p === page && "dx-pager-active")}
            onClick={() => onPageChange(p)}
            aria-current={p === page ? "page" : undefined}
          >
            {p}
          </button>
        ))}
        {totalPages && windowPages[windowPages.length - 1] < totalPages ? <span className="px-1">…</span> : null}
        <button className="dx-pager-btn" onClick={() => onPageChange(page + 1)} disabled={!canNext} aria-label="Next page">
          <ChevronRight />
        </button>
        <button
          className="dx-pager-btn"
          onClick={() => onPageChange(last)}
          disabled={!canNext || !totalPages}
          aria-label="Last page"
        >
          <ChevronsRight />
        </button>
      </div>
    </div>
  );
}
