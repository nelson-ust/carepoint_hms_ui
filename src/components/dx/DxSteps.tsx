import * as React from "react";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils/cn";

// ============================================================
// Horizontal stepper — care pathway checkpoints
// ============================================================

export type DxStepStatus = "done" | "current" | "pending" | "skipped";

export interface DxStepItem {
  key: React.Key;
  label: React.ReactNode;
  sub?: React.ReactNode;
  status: DxStepStatus;
}

export function DxSteps({ items, className }: { items: DxStepItem[]; className?: string }) {
  return (
    <ol className={cn("dx-steps", className)}>
      {items.map((s, i) => (
        <li
          key={s.key}
          className={cn(
            "dx-step",
            s.status === "done" && "dx-step-done",
            s.status === "current" && "dx-step-current",
            s.status === "skipped" && "dx-step-skipped",
          )}
          aria-current={s.status === "current" ? "step" : undefined}
        >
          <span className="dx-step-dot">
            {s.status === "done" ? <Check aria-hidden /> : s.status === "skipped" ? <Minus aria-hidden /> : i + 1}
          </span>
          <span className="min-w-0">
            <span className="dx-step-label block truncate">{s.label}</span>
            {s.sub ? <span className="dx-step-sub block truncate">{s.sub}</span> : null}
          </span>
        </li>
      ))}
    </ol>
  );
}

// ============================================================
// Vertical timeline
// ============================================================

export interface DxTimelineItem {
  key: React.Key;
  title: React.ReactNode;
  meta?: React.ReactNode;
  body?: React.ReactNode;
  tone?: "default" | "accent" | "success" | "danger";
}

export function DxTimeline({ items, className }: { items: DxTimelineItem[]; className?: string }) {
  return (
    <ul className={cn("dx-timeline", className)}>
      {items.map((it) => (
        <li key={it.key} className={cn(it.tone && it.tone !== "default" && `dx-tl-${it.tone}`)}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className="text-[12.5px] font-semibold text-[var(--dx-text)]">{it.title}</span>
            {it.meta ? <span className="dx-mono dx-faint text-[11px]">{it.meta}</span> : null}
          </div>
          {it.body ? <div className="mt-0.5 text-[12px] text-[var(--dx-text-muted)]">{it.body}</div> : null}
        </li>
      ))}
    </ul>
  );
}
