import * as React from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { DxButton } from "./DxButton";

export interface DxPopupProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  footer?: React.ReactNode;
  /** Prevent closing via backdrop / Escape (e.g. while saving). */
  locked?: boolean;
  className?: string;
}

/** DevExpress-style popup: square corners, header strip, pinned footer. */
export function DxPopup({ isOpen, onClose, title, children, size = "md", footer, locked, className }: DxPopupProps) {
  React.useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !locked) onClose();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen, onClose, locked]);

  if (!isOpen) return null;

  return createPortal(
    <div className="dx dx-popup-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !locked && onClose()}>
      <div className={cn("dx-popup", `dx-popup-${size}`, className)} role="dialog" aria-modal="true">
        <header className="dx-popup-header">
          <h3 className="dx-popup-title">{title}</h3>
          <button type="button" className="dx-icon-btn" aria-label="Close" onClick={onClose} disabled={locked}>
            <X />
          </button>
        </header>
        <div className="dx-popup-body">{children}</div>
        {footer ? <footer className="dx-popup-footer">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  );
}

export interface DxConfirmProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
}

export function DxConfirm({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "danger",
}: DxConfirmProps) {
  const [busy, setBusy] = React.useState(false);
  const run = async () => {
    setBusy(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setBusy(false);
    }
  };
  return (
    <DxPopup
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      locked={busy}
      footer={
        <>
          <DxButton onClick={onClose} disabled={busy}>
            {cancelLabel}
          </DxButton>
          <DxButton variant={tone === "danger" ? "danger" : "primary"} onClick={run} isLoading={busy}>
            {confirmLabel}
          </DxButton>
        </>
      }
    >
      <div className="flex gap-3">
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded",
            tone === "danger" ? "bg-[var(--dx-danger-soft)] text-[var(--dx-danger)]" : "bg-[var(--dx-accent-soft)] text-[var(--dx-accent)]",
          )}
        >
          <AlertTriangle className="h-4.5 w-4.5" aria-hidden />
        </span>
        <div className="text-[13px] text-[var(--dx-text-muted)]">{description}</div>
      </div>
    </DxPopup>
  );
}
