import * as React from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variants = {
    default: "border-transparent bg-primary-500 text-white hover:bg-primary-500/80",
    secondary: "border-transparent bg-secondary-100 text-secondary-900 hover:bg-secondary-100/80",
    destructive: "border-transparent bg-rose-500 text-white hover:bg-rose-500/80",
    outline: "text-secondary-900 border-secondary-200",
    success: "border-transparent bg-emerald-500 text-white hover:bg-emerald-500/80",
    warning: "border-transparent bg-amber-500 text-white hover:bg-amber-500/80",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

export { Badge };
