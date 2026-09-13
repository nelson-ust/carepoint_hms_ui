import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
  /** Footer slot pinned below the scrollable body. */
  footer?: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children, size = "md", footer }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleEscape);
    }
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
    "2xl": "max-w-6xl",
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-secondary-950/60 backdrop-blur-sm transition-opacity animate-fade-in dark:bg-secondary-950/80"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div
        ref={modalRef}
        className={`relative w-full ${sizeClasses[size]} bg-white/95 backdrop-blur-2xl rounded-[2rem] shadow-premium-lg border border-white/40 animate-slide-up flex flex-col max-h-[90vh] dark:bg-secondary-900/95 dark:border-white/10`}
      >
        {/* Header */}
        <div className="px-8 py-6 border-b border-secondary-100 flex items-center justify-between shrink-0 dark:border-white/10">
          <h3 className="text-xl font-bold text-secondary-900">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="p-2 hover:bg-secondary-50 rounded-xl transition-all text-secondary-400 hover:text-secondary-900 dark:hover:bg-white/5 dark:hover:text-secondary-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-8 overflow-y-auto flex-1">{children}</div>

        {footer ? (
          <div className="px-8 py-5 border-t border-secondary-100 shrink-0 dark:border-white/10">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
