import * as React from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils/cn";

// ============================================================
// Panel — bordered surface with optional header/footer
// ============================================================

export interface DxPanelProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  /** Remove body padding (for grids). */
  flush?: boolean;
  bodyClassName?: string;
}

export function DxPanel({
  title,
  description,
  icon,
  actions,
  footer,
  flush,
  bodyClassName,
  className,
  children,
  ...props
}: DxPanelProps) {
  const hasHeader = title !== undefined || actions !== undefined;
  return (
    <section className={cn("dx-panel", className)} {...props}>
      {hasHeader ? (
        <header className="dx-panel-header">
          <div className="min-w-0">
            <h3 className="dx-panel-title">
              {icon}
              <span className="truncate">{title}</span>
            </h3>
            {description ? <p className="dx-panel-desc">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
        </header>
      ) : null}
      <div className={cn(flush ? "dx-panel-body-flush" : "dx-panel-body", bodyClassName)}>{children}</div>
      {footer ? <footer className="dx-panel-footer">{footer}</footer> : null}
    </section>
  );
}

// ============================================================
// Group box — fieldset with floating caption
// ============================================================

export interface DxGroupBoxProps extends React.HTMLAttributes<HTMLFieldSetElement> {
  caption: React.ReactNode;
}

export function DxGroupBox({ caption, className, children, ...props }: DxGroupBoxProps) {
  return (
    <fieldset className={cn("dx-group", className)} {...props}>
      <legend className="dx-group-caption">{caption}</legend>
      {children}
    </fieldset>
  );
}

// ============================================================
// Property grid — label/value rows
// ============================================================

export interface DxPropsItem {
  label: React.ReactNode;
  value: React.ReactNode;
}

export function DxProps({
  items,
  tight,
  className,
}: {
  items: DxPropsItem[];
  tight?: boolean;
  className?: string;
}) {
  return (
    <dl className={cn("dx-props", tight && "dx-props-tight", className)}>
      {items.map((it, i) => (
        <React.Fragment key={i}>
          <dt>{it.label}</dt>
          <dd>{it.value ?? "—"}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

// ============================================================
// Message bar
// ============================================================

export type DxMessageTone = "info" | "success" | "warning" | "danger";

const toneIcon: Record<DxMessageTone, React.ElementType> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: AlertCircle,
};

export function DxMessage({
  tone = "info",
  title,
  children,
  className,
  action,
}: {
  tone?: DxMessageTone;
  title?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  const Icon = toneIcon[tone];
  return (
    <div className={cn("dx-msg", `dx-msg-${tone}`, className)} role={tone === "danger" ? "alert" : "status"}>
      <Icon aria-hidden />
      <div className="min-w-0 flex-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={cn(title && "mt-0.5", "dx-muted")}>{children}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
