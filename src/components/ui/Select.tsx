import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options?: SelectOption[];
  placeholder?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    { className, label, error, hint, options, placeholder, children, id, ...props },
    ref
  ) => {
    const autoId = React.useId();
    const selectId = id ?? autoId;

    return (
      <div className="w-full">
        {label ? (
          <label
            htmlFor={selectId}
            className="mb-2 block text-xs font-bold uppercase tracking-widest text-secondary-500"
          >
            {label}
          </label>
        ) : null}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            aria-invalid={!!error}
            className={cn(
              "input-field appearance-none pr-10 cursor-pointer",
              error &&
                "border-rose-400 focus:border-rose-500 focus:ring-rose-500/10 dark:border-rose-500/50",
              className
            )}
            {...props}
          >
            {placeholder ? (
              <option value="" disabled hidden>
                {placeholder}
              </option>
            ) : null}
            {options
              ? options.map((opt) => (
                  <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                    {opt.label}
                  </option>
                ))
              : children}
          </select>
          <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary-400" />
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
Select.displayName = "Select";
