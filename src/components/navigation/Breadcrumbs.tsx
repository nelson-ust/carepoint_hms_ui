import { Link } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface BreadcrumbItem {
  label: string;
  to?: string;
}

/** Compact breadcrumb trail rendered above page headers. */
export function Breadcrumbs({
  items,
  className,
}: {
  items: BreadcrumbItem[];
  className?: string;
}) {
  return (
    <nav aria-label="Breadcrumb" className={cn("mb-4", className)}>
      <ol className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-secondary-400">
        <li>
          <Link
            to="/dashboard"
            className="flex items-center gap-1 rounded-lg px-1.5 py-1 transition-colors hover:text-primary-500"
          >
            <Home className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </li>
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="flex items-center gap-1.5">
              <ChevronRight className="h-3 w-3 text-secondary-300 dark:text-secondary-600" aria-hidden />
              {item.to && !isLast ? (
                <Link
                  to={item.to}
                  className="rounded-lg px-1.5 py-1 transition-colors hover:text-primary-500"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={isLast ? "page" : undefined}
                  className={cn("px-1.5 py-1", isLast && "text-secondary-900 dark:text-secondary-100")}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
