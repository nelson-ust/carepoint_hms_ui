import * as React from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";

// ============================================================
// Page root — opts a page into the DX workbench type scale
// ============================================================

export function DxPage({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("dx space-y-4 animate-fade-in", className)} {...props}>
      {children}
    </div>
  );
}

// ============================================================
// Page header with breadcrumbs + command actions
// ============================================================

export interface DxCrumb {
  label: React.ReactNode;
  to?: string;
}

export interface DxPageHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  crumbs?: DxCrumb[];
  actions?: React.ReactNode;
  /** Content shown under the title row (e.g. a patient banner). */
  children?: React.ReactNode;
  className?: string;
}

export function DxPageHeader({ title, subtitle, crumbs, actions, children, className }: DxPageHeaderProps) {
  return (
    <div className={className}>
      <div className="dx-page-header">
        <div className="min-w-0">
          {crumbs && crumbs.length ? (
            <nav className="dx-crumbs" aria-label="Breadcrumb">
              {crumbs.map((c, i) => {
                const last = i === crumbs.length - 1;
                return (
                  <React.Fragment key={i}>
                    {c.to && !last ? <Link to={c.to}>{c.label}</Link> : <span className={cn(last && "dx-crumb-current")}>{c.label}</span>}
                    {!last ? <ChevronRight className="h-3 w-3 opacity-60" aria-hidden /> : null}
                  </React.Fragment>
                );
              })}
            </nav>
          ) : null}
          <h1 className="dx-page-title">{title}</h1>
          {subtitle ? <p className="dx-page-subtitle">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}

// ============================================================
// Status bar
// ============================================================

export function DxStatusBar({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("dx-statusbar", className)} role="status" {...props}>
      {children}
    </div>
  );
}

export function DxStatusItem({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {icon}
      {children}
    </span>
  );
}

// ============================================================
// Small atoms
// ============================================================

export function DxSkeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={cn("dx-skeleton h-4 w-full", className)} style={style} aria-hidden />;
}

export function DxAvatar({ name, className, size = "md" }: { name?: string | null; className?: string; size?: "md" | "lg" }) {
  const initials = React.useMemo(() => {
    const parts = String(name ?? "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    return (parts.length >= 2 ? parts[0][0] + parts[parts.length - 1][0] : parts[0].slice(0, 2)).toUpperCase();
  }, [name]);
  return (
    <span className={cn("dx-avatar", size === "lg" && "dx-avatar-lg", className)} aria-hidden>
      {initials}
    </span>
  );
}

export function DxLiveDot({ label = "Live" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-[11.5px] text-[var(--dx-text-muted)]">
      <span className="dx-live-dot" aria-hidden />
      {label}
    </span>
  );
}

/** Full-page centered loading block for route-level loads. */
export function DxPageLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="dx flex min-h-[40vh] flex-col items-center justify-center gap-3 text-[var(--dx-text-muted)]">
      <span className="h-7 w-7 animate-spin rounded-full border-2 border-[var(--dx-border-strong)] border-t-[var(--dx-accent)]" />
      <span className="text-[12.5px]">{label}</span>
    </div>
  );
}
