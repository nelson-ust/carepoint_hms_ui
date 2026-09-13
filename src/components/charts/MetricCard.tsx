import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Skeleton } from "@/components/ui/Skeleton";

export type MetricTone = "primary" | "cyan" | "violet" | "amber" | "rose" | "slate";

export interface MetricCardProps {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  tone?: MetricTone;
  /** Percent delta vs previous period, e.g. +12.4 / -3.1 */
  delta?: number;
  deltaLabel?: string;
  isLoading?: boolean;
  className?: string;
}

const tones: Record<MetricTone, { chip: string; glow: string }> = {
  primary: { chip: "bg-primary-500/10 text-primary-500", glow: "group-hover:shadow-glow-sm" },
  cyan: { chip: "bg-cyan-500/10 text-cyan-500", glow: "group-hover:shadow-glow-cyan" },
  violet: { chip: "bg-violet-500/10 text-violet-500", glow: "" },
  amber: { chip: "bg-amber-500/10 text-amber-500", glow: "group-hover:shadow-glow-amber" },
  rose: { chip: "bg-rose-500/10 text-rose-500", glow: "group-hover:shadow-glow-rose" },
  slate: { chip: "bg-secondary-500/10 text-secondary-500", glow: "" },
};

/** KPI stat tile — the standard dashboard metric card. */
export function MetricCard({
  label,
  value,
  icon: Icon,
  tone = "primary",
  delta,
  deltaLabel,
  isLoading = false,
  className,
}: MetricCardProps) {
  const toneStyle = tones[tone];
  const DeltaIcon = delta === undefined || delta === 0 ? Minus : delta > 0 ? TrendingUp : TrendingDown;
  const deltaColor =
    delta === undefined || delta === 0
      ? "text-secondary-400"
      : delta > 0
        ? "text-emerald-500"
        : "text-rose-500";

  return (
    <div className={cn("glass-card group p-6 transition-all duration-300 hover:-translate-y-0.5", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-secondary-400">
            {label}
          </p>
          {isLoading ? (
            <Skeleton className="mt-3 h-8 w-24" />
          ) : (
            <p className="mt-2 truncate font-display text-3xl font-bold tracking-tight text-secondary-900">
              {value}
            </p>
          )}
          {!isLoading && delta !== undefined ? (
            <p className={cn("mt-2 flex items-center gap-1 text-xs font-bold", deltaColor)}>
              <DeltaIcon className="h-3.5 w-3.5" aria-hidden />
              {Math.abs(delta).toFixed(1)}%
              {deltaLabel ? (
                <span className="font-medium text-secondary-400"> {deltaLabel}</span>
              ) : null}
            </p>
          ) : null}
        </div>
        {Icon ? (
          <div
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-shadow duration-300",
              toneStyle.chip,
              toneStyle.glow
            )}
          >
            <Icon className="h-6 w-6" aria-hidden />
          </div>
        ) : null}
      </div>
    </div>
  );
}
