import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface PaginationProps {
  page: number;
  /** Total pages when known; otherwise pass `hasNext`. */
  totalPages?: number;
  hasNext?: boolean;
  totalItems?: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  className?: string;
}

/** Compact glass pagination bar for list pages. */
export function Pagination({
  page,
  totalPages,
  hasNext,
  totalItems,
  pageSize,
  onPageChange,
  className,
}: PaginationProps) {
  const canPrev = page > 1;
  const canNext =
    typeof totalPages === "number" ? page < totalPages : Boolean(hasNext);

  const rangeLabel = (() => {
    if (typeof totalItems === "number" && typeof pageSize === "number") {
      const start = (page - 1) * pageSize + 1;
      const end = Math.min(page * pageSize, totalItems);
      if (totalItems === 0) return "0 records";
      return `${start}–${end} of ${totalItems.toLocaleString()}`;
    }
    if (typeof totalPages === "number") return `Page ${page} of ${totalPages}`;
    return `Page ${page}`;
  })();

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 border-t border-secondary-100 px-6 py-4 dark:border-white/5",
        className
      )}
    >
      <span className="data-mono text-xs text-secondary-400">{rangeLabel}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={!canPrev}
          className="btn-ghost px-3 py-2 text-xs disabled:opacity-40"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
          Prev
        </button>
        <span className="data-mono rounded-xl bg-primary-500/10 px-3 py-1.5 text-xs font-bold text-primary-600 dark:text-primary-300">
          {page}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={!canNext}
          className="btn-ghost px-3 py-2 text-xs disabled:opacity-40"
          aria-label="Next page"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
