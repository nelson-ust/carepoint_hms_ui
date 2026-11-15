import * as React from "react";
import { cn } from "@/lib/utils/cn";

export type DxKpiTone = "accent" | "success" | "warning" | "danger" | "info" | "neutral";

const toneVars: Record<DxKpiTone, React.CSSProperties> = {
  accent: { ["--dx-kpi-tone" as string]: "var(--dx-accent)", ["--dx-kpi-tone-soft" as string]: "var(--dx-accent-soft)" },
  success: { ["--dx-kpi-tone" as string]: "var(--dx-success)", ["--dx-kpi-tone-soft" as string]: "var(--dx-success-soft)" },
  warning: { ["--dx-kpi-tone" as string]: "var(--dx-warning)", ["--dx-kpi-tone-soft" as string]: "var(--dx-warning-soft)" },
  danger: { ["--dx-kpi-tone" as string]: "var(--dx-danger)", ["--dx-kpi-tone-soft" as string]: "var(--dx-danger-soft)" },
  info: { ["--dx-kpi-tone" as string]: "var(--dx-info)", ["--dx-kpi-tone-soft" as string]: "var(--dx-info-soft)" },
  neutral: { ["--dx-kpi-tone" as string]: "var(--dx-text-muted)", ["--dx-kpi-tone-soft" as string]: "var(--dx-neutral-soft)" },
};

export interface DxKpiProps {
  label: React.ReactNode;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ElementType;
  tone?: DxKpiTone;
  isLoading?: boolean;
  className?: string;
  onClick?: () => void;
}

/** Compact KPI tile with a coloured left rule — DevExpress "card view" style. */
export function DxKpi({ label, value, sub, icon: Icon, tone = "accent", isLoading, className, onClick }: DxKpiProps) {
  const Tag: React.ElementType = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      style={toneVars[tone]}
      className={cn("dx-kpi text-left", onClick && "cursor-pointer hover:bg-[var(--dx-surface-alt)]", className)}
    >
      {Icon ? (
        <span className="dx-kpi-icon">
          <Icon aria-hidden />
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="dx-kpi-label block truncate">{label}</span>
        {isLoading ? (
          <span className="dx-skeleton mt-1 block h-5 w-14" />
        ) : (
          <span className="dx-kpi-value block">{value}</span>
        )}
        {sub ? <span className="dx-kpi-sub block truncate">{sub}</span> : null}
      </span>
    </Tag>
  );
}
