import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, leftIcon, id, ...props }, ref) => {
    const autoId = React.useId();
    const inputId = id ?? autoId;

    return (
      <div className="w-full">
        {label ? (
          <label
            htmlFor={inputId}
            className="mb-2 block text-xs font-bold uppercase tracking-widest text-secondary-500"
          >
            {label}
          </label>
        ) : null}
        <div className="relative">
          {leftIcon ? (
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-secondary-400">
              {leftIcon}
            </span>
          ) : null}
          <input
            ref={ref}
            id={inputId}
            aria-invalid={!!error}
            className={cn(
              "input-field",
              leftIcon && "pl-11",
              error &&
                "border-rose-400 focus:border-rose-500 focus:ring-rose-500/10 dark:border-rose-500/50",
              className
            )}
            {...props}
          />
        </div>
        {error ? (
          <p className="mt-1.5 text-xs font-semibold text-rose-500">{error}</p>
        ) : hint ? (
          <p className="mt-1.5 text-xs text-secondary-400">{hint}</p>
        ) : null}
      </div>
    );
  }
);
Input.displayName = "Input";
