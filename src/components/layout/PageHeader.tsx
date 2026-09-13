import * as React from "react";
import { cn } from "@/lib/utils/cn";

type PageHeaderProps = {
  title: string;
  description?: string;
  /** Action buttons rendered to the right of the title. */
  actions?: React.ReactNode;
  /** Optional breadcrumb / eyebrow content rendered above the title. */
  eyebrow?: React.ReactNode;
  className?: string;
};

export function PageHeader({ title, description, actions, eyebrow, className }: PageHeaderProps) {
  return (
    <header className={cn("mb-8 animate-slide-up", className)}>
      {eyebrow}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-4xl font-display font-bold text-secondary-900 tracking-tight">
            {title}
          </h1>
          {description && (
            <p className="mt-3 text-base text-secondary-500 font-medium max-w-2xl">
              {description}
            </p>
          )}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-3 pt-1">{actions}</div>
        ) : null}
      </div>
    </header>
  );
}
