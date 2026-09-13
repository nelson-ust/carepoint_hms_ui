import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** `danger` renders a red confirm button — use for destructive actions. */
  tone?: "danger" | "primary";
}

/** Confirmation modal for destructive or consequential actions. */
export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "danger",
}: ConfirmDialogProps) {
  const [busy, setBusy] = React.useState(false);

  const handleConfirm = async () => {
    try {
      setBusy(true);
      await onConfirm();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={busy ? () => undefined : onClose} title={title} size="sm">
      <div className="flex items-start gap-4">
        <div
          className={
            tone === "danger"
              ? "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500"
              : "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-500/10 text-primary-500"
          }
        >
          <AlertTriangle className="h-6 w-6" aria-hidden />
        </div>
        <p className="text-sm font-medium leading-relaxed text-secondary-600">
          {description ?? "This action cannot be undone. Are you sure you want to continue?"}
        </p>
      </div>
      <div className="mt-8 flex justify-end gap-3">
        <Button variant="secondary" size="sm" onClick={onClose} disabled={busy}>
          {cancelLabel}
        </Button>
        <Button
          variant={tone === "danger" ? "danger" : "primary"}
          size="sm"
          onClick={handleConfirm}
          isLoading={busy}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
