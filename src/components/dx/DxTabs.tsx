import * as React from "react";
import { cn } from "@/lib/utils/cn";

// ============================================================
// Tabs (underline)
// ============================================================

export interface DxTabItem<K extends string = string> {
  key: K;
  label: React.ReactNode;
  icon?: React.ReactNode;
  count?: number | null;
  disabled?: boolean;
}

export interface DxTabsProps<K extends string = string> {
  items: DxTabItem<K>[];
  value: K;
  onChange: (key: K) => void;
  className?: string;
  /** Right-aligned content on the tab strip (e.g. actions). */
  trailing?: React.ReactNode;
}

export function DxTabs<K extends string = string>({ items, value, onChange, className, trailing }: DxTabsProps<K>) {
  return (
    <div className={cn("dx-tabs", className)} role="tablist">
      {items.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={t.key === value}
          disabled={t.disabled}
          className="dx-tab"
          onClick={() => onChange(t.key)}
        >
          {t.icon}
          {t.label}
          {t.count != null ? <span className="dx-tab-count">{t.count}</span> : null}
        </button>
      ))}
      {trailing ? <div className="ml-auto flex items-center gap-1 pb-1 pl-3">{trailing}</div> : null}
    </div>
  );
}

// ============================================================
// Segmented button group
// ============================================================

export interface DxSegmentedProps<K extends string = string> {
  items: { key: K; label: React.ReactNode; icon?: React.ReactNode; disabled?: boolean }[];
  value: K;
  onChange: (key: K) => void;
  className?: string;
  ariaLabel?: string;
}

export function DxSegmented<K extends string = string>({ items, value, onChange, className, ariaLabel }: DxSegmentedProps<K>) {
  return (
    <div className={cn("dx-segmented", className)} role="group" aria-label={ariaLabel}>
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          aria-pressed={it.key === value}
          disabled={it.disabled}
          onClick={() => onChange(it.key)}
        >
          {it.icon}
          {it.label}
        </button>
      ))}
    </div>
  );
}

// ============================================================
// Choice tile (radio-card)
// ============================================================

export interface DxChoiceProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "title"> {
  selected: boolean;
  icon?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  trailing?: React.ReactNode;
}

export function DxChoice({ selected, icon, title, subtitle, trailing, className, ...props }: DxChoiceProps) {
  return (
    <button type="button" role="radio" aria-checked={selected} className={cn("dx-choice", className)} {...props}>
      {icon ? <span className="flex h-7 w-7 shrink-0 items-center justify-center text-[var(--dx-text-muted)] [&>svg]:h-4 [&>svg]:w-4">{icon}</span> : null}
      <span className="min-w-0 flex-1">
        <span className="dx-choice-title block truncate">{title}</span>
        {subtitle ? <span className="dx-choice-sub block">{subtitle}</span> : null}
      </span>
      {trailing}
    </button>
  );
}
