import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type DxButtonVariant =
  | "default"
  | "primary"
  | "danger"
  | "outline-danger"
  | "text"
  | "accent-text";
export type DxButtonSize = "sm" | "md" | "lg";

export interface DxButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: DxButtonVariant;
  size?: DxButtonSize;
  isLoading?: boolean;
  /** Icon-only square button (pass the icon as children, add `title`). */
  icon?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variantClass: Record<DxButtonVariant, string> = {
  default: "",
  primary: "dx-btn-primary",
  danger: "dx-btn-danger",
  "outline-danger": "dx-btn-outline-danger",
  text: "dx-btn-text",
  "accent-text": "dx-btn-accent-text",
};

const sizeClass: Record<DxButtonSize, string> = {
  sm: "dx-btn-sm",
  md: "",
  lg: "dx-btn-lg",
};

/** Flat DevExpress-style button: 1px border, 4px radius, 32px tall. */
export const DxButton = React.forwardRef<HTMLButtonElement, DxButtonProps>(
  (
    {
      className,
      variant = "default",
      size = "md",
      isLoading = false,
      icon = false,
      leftIcon,
      rightIcon,
      disabled,
      children,
      type = "button",
      ...props
    },
    ref,
  ) => (
    <button
      ref={ref}
      type={type}
      disabled={disabled || isLoading}
      className={cn("dx-btn", variantClass[variant], sizeClass[size], icon && "dx-btn-icon", className)}
      {...props}
    >
      {isLoading ? <Loader2 className="animate-spin" aria-hidden /> : leftIcon}
      {children}
      {!isLoading && rightIcon}
    </button>
  ),
);
DxButton.displayName = "DxButton";
