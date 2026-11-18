import * as React from "react";
import { cn } from "@/lib/utils/cn";

// ============================================================
// Field wrapper
// ============================================================

export interface DxFieldProps {
  label?: React.ReactNode;
  htmlFor?: string;
  required?: boolean;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  /** Label on the left (160px) instead of on top. */
  inline?: boolean;
  className?: string;
  children: React.ReactNode;
}

/** Label + editor + hint/error. Use directly for custom controls. */
export function DxField({ label, htmlFor, required, hint, error, inline, className, children }: DxFieldProps) {
  return (
    <div className={cn("dx-field", inline && "dx-field-inline", className)}>
      {label !== undefined && label !== null ? (
        <label className="dx-field-label" htmlFor={htmlFor}>
          {label}
          {required ? <span className="dx-required">*</span> : null}
        </label>
      ) : inline ? (
        <span />
      ) : null}
      {children}
      {error ? (
        <span className="dx-field-error" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="dx-field-hint">{hint}</span>
      ) : null}
    </div>
  );
}

type FieldPassthrough = Pick<DxFieldProps, "label" | "required" | "hint" | "error" | "inline"> & {
  /** Class applied to the outer field wrapper. */
  fieldClassName?: string;
};

// ============================================================
// Text input
// ============================================================

export interface DxInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
    FieldPassthrough {
  leftIcon?: React.ReactNode;
  unit?: React.ReactNode;
  editorSize?: "sm" | "md" | "lg";
  mono?: boolean;
}

export const DxInput = React.forwardRef<HTMLInputElement, DxInputProps>(
  (
    { label, required, hint, error, inline, fieldClassName, leftIcon, unit, editorSize = "md", mono, className, id, ...props },
    ref,
  ) => {
    const autoId = React.useId();
    const inputId = id ?? autoId;
    const editor = (
      <input
        ref={ref}
        id={inputId}
        aria-invalid={!!error || undefined}
        className={cn(
          "dx-editor",
          editorSize === "sm" && "dx-editor-sm",
          editorSize === "lg" && "dx-editor-lg",
          mono && "dx-mono",
          error && "dx-invalid",
          unit && "pr-12",
          className,
        )}
        {...props}
      />
    );
    const control =
      leftIcon || unit ? (
        <div className="dx-editor-wrap">
          {leftIcon}
          {editor}
          {unit ? <span className="dx-editor-unit">{unit}</span> : null}
        </div>
      ) : (
        editor
      );
    if (label === undefined && !hint && !error && !inline) return control;
    return (
      <DxField label={label} htmlFor={inputId} required={required} hint={hint} error={error} inline={inline} className={fieldClassName}>
        {control}
      </DxField>
    );
  },
);
DxInput.displayName = "DxInput";

// ============================================================
// Select
// ============================================================

export interface DxSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface DxSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement>, FieldPassthrough {
  options?: DxSelectOption[];
  placeholder?: string;
  editorSize?: "sm" | "md";
}

export const DxSelect = React.forwardRef<HTMLSelectElement, DxSelectProps>(
  (
    { label, required, hint, error, inline, fieldClassName, options, placeholder, editorSize = "md", className, id, children, ...props },
    ref,
  ) => {
    const autoId = React.useId();
    const selectId = id ?? autoId;
    const control = (
      <select
        ref={ref}
        id={selectId}
        aria-invalid={!!error || undefined}
        className={cn("dx-editor", editorSize === "sm" && "dx-editor-sm", error && "dx-invalid", className)}
        {...props}
      >
        {placeholder !== undefined ? (
          <option value="" disabled={required}>
            {placeholder}
          </option>
        ) : null}
        {options
          ? options.map((o) => (
              <option key={o.value} value={o.value} disabled={o.disabled}>
                {o.label}
              </option>
            ))
          : children}
      </select>
    );
    if (label === undefined && !hint && !error && !inline) return control;
    return (
      <DxField label={label} htmlFor={selectId} required={required} hint={hint} error={error} inline={inline} className={fieldClassName}>
        {control}
      </DxField>
    );
  },
);
DxSelect.displayName = "DxSelect";

// ============================================================
// Textarea
// ============================================================

export interface DxTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement>, FieldPassthrough {}

export const DxTextarea = React.forwardRef<HTMLTextAreaElement, DxTextareaProps>(
  ({ label, required, hint, error, inline, fieldClassName, className, id, rows = 3, ...props }, ref) => {
    const autoId = React.useId();
    const areaId = id ?? autoId;
    const control = (
      <textarea
        ref={ref}
        id={areaId}
        rows={rows}
        aria-invalid={!!error || undefined}
        className={cn("dx-editor", error && "dx-invalid", className)}
        {...props}
      />
    );
    if (label === undefined && !hint && !error && !inline) return control;
    return (
      <DxField label={label} htmlFor={areaId} required={required} hint={hint} error={error} inline={inline} className={fieldClassName}>
        {control}
      </DxField>
    );
  },
);
DxTextarea.displayName = "DxTextarea";

// ============================================================
// Checkbox
// ============================================================

export interface DxCheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: React.ReactNode;
  description?: React.ReactNode;
}

export const DxCheckbox = React.forwardRef<HTMLInputElement, DxCheckboxProps>(
  ({ label, description, className, ...props }, ref) => (
    <label className={cn("dx-check", className)}>
      <input ref={ref} type="checkbox" {...props} />
      <span className="min-w-0 flex-1">
        <span className="block min-w-0">{label}</span>
        {description ? <span className="block dx-field-hint min-w-0">{description}</span> : null}
      </span>
    </label>
  ),
);
DxCheckbox.displayName = "DxCheckbox";

// ============================================================
// Form layout grid
// ============================================================

export interface DxFormProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Number of columns at ≥640px. */
  cols?: 1 | 2 | 3 | 4;
}

export function DxForm({ cols = 2, className, ...props }: DxFormProps) {
  return <div className={cn("dx-form", cols > 1 && `dx-form-${cols}`, className)} {...props} />;
}
