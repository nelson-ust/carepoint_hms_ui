import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** `panel` adds the animated gradient sheen on hover. */
  variant?: "glass" | "panel" | "plain";
  padding?: "none" | "sm" | "md" | "lg";
}

const paddings = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

/** Glassmorphism surface — the standard container for all module content. */
export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "glass", padding = "md", ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        variant === "panel" ? "glass-panel" : variant === "glass" ? "glass-card" : "rounded-[2rem]",
        paddings[padding],
        className
      )}
      {...props}
    />
  )
);
Card.displayName = "Card";

export function CardHeader({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-4 mb-6", className)}>
      <div className="min-w-0">
        <h3 className="text-lg font-display font-bold text-secondary-900 tracking-tight">
          {title}
        </h3>
        {description ? (
          <p className="mt-1 text-sm text-secondary-500 font-medium">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2 shrink-0">{actions}</div> : null}
    </div>
  );
}
