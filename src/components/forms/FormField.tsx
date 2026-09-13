import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface FormFieldProps {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

/**
 * Label + control + error wrapper for custom controls (react-select,
 * date pickers, radio groups). Plain inputs can use <Input label=…> directly.
 */
export function FormField({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={cn("w-full", className)}>
      <label
        htmlFor={htmlFor}
        className="mb-2 block text-xs font-bold uppercase tracking-widest text-secondary-500"
      >
        {label}
        {required ? <span className="ml-1 text-rose-500">*</span> : null}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 text-xs font-semibold text-rose-500">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-secondary-400">{hint}</p>
      ) : null}
    </div>
  );
}
