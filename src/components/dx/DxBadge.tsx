import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { humanize, statusTone } from "./dx-utils";

export type DxBadgeTone =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "accent"
  | "outline"
  | "solid-accent"
  | "solid-danger";

export interface DxBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: DxBadgeTone;
  /** Prepend a coloured status dot. */
  dot?: boolean;
}

/** Flat status tag. Text is rendered as given (no forced uppercase). */
export function DxBadge({ tone = "neutral", dot, className, ...props }: DxBadgeProps) {
  return <span className={cn("dx-badge", `dx-badge-${tone}`, dot && "dx-badge-dot", className)} {...props} />;
}

export function DxStatusBadge({ status, className }: { status?: string | null; className?: string }) {
  return (
    <DxBadge tone={statusTone(status)} dot className={className}>
      {humanize(status)}
    </DxBadge>
  );
}
