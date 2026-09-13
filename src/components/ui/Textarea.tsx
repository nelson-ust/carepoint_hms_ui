import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, hint, id, rows = 4, ...props }, ref) => {
    const autoId = React.useId();
    const textareaId = id ?? autoId;

    return (
      <div className="w-full">
        {label ? (
          <label
            htmlFor={textareaId}
            className="mb-2 block text-xs font-bold uppercase tracking-widest text-secondary-500"
          >
            {label}
          </label>
        ) : null}
        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          aria-invalid={!!error}
          className={cn(
            "input-field resize-y min-h-[96px]",
            error &&
              "border-rose-400 focus:border-rose-500 focus:ring-rose-500/10 dark:border-rose-500/50",
            className
          )}
          {...props}
        />
        {error ? (
          <p className="mt-1.5 text-xs font-semibold text-rose-500">{error}</p>
        ) : hint ? (
          <p className="mt-1.5 text-xs text-secondary-400">{hint}</p>
        ) : null}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";
