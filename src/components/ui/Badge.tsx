import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?:
    | "default"
    | "secondary"
    | "destructive"
    | "outline"
    | "success"
    | "warning"
    | "info"
    | "soft-success"
    | "soft-warning"
    | "soft-danger"
    | "soft-info";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variants = {
    default: "border-transparent bg-primary-500 text-white",
    secondary:
      "border-transparent bg-secondary-100 text-secondary-900 dark:bg-white/10 dark:text-secondary-100",
    destructive: "border-transparent bg-rose-500 text-white",
    outline: "text-secondary-900 border-secondary-200 dark:text-secondary-100 dark:border-white/15",
    success: "border-transparent bg-emerald-500 text-white",
    warning: "border-transparent bg-amber-500 text-white",
    info: "border-transparent bg-cyan-500 text-white",
    // Soft tinted pills — the preferred style for status columns
    "soft-success":
      "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
    "soft-warning": "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-300",
    "soft-danger": "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-300",
    "soft-info": "border-cyan-500/20 bg-cyan-500/10 text-cyan-600 dark:text-cyan-300",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest transition-colors",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

export { Badge };
