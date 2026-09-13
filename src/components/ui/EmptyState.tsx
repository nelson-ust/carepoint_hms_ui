import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

/** Centered empty state for tables / lists with an optional call to action. */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-8 py-16 text-center",
        className
      )}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-primary-500/10 text-primary-500 shadow-glow-sm">
        <Icon className="h-8 w-8" aria-hidden />
      </div>
      <h3 className="mt-2 text-lg font-display font-bold text-secondary-900">{title}</h3>
      {description ? (
        <p className="max-w-sm text-sm font-medium text-secondary-500">{description}</p>
      ) : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
