import * as React from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type ToastKind = "success" | "error" | "info" | "warning";

interface ToastItem {
  id: number;
  kind: ToastKind;
  title: string;
  description?: string;
}

interface ToastContextValue {
  toast: (kind: ToastKind, title: string, description?: string) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | undefined>(undefined);

const kindStyles: Record<ToastKind, { icon: React.ReactNode; accent: string }> = {
  success: {
    icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
    accent: "border-l-emerald-500",
  },
  error: {
    icon: <AlertCircle className="h-5 w-5 text-rose-500" />,
    accent: "border-l-rose-500",
  },
  info: {
    icon: <Info className="h-5 w-5 text-cyan-500" />,
    accent: "border-l-cyan-500",
  },
  warning: {
    icon: <AlertTriangle className="h-5 w-5 text-amber-500" />,
    accent: "border-l-amber-500",
  },
};

const TOAST_TTL_MS = 5000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);
  const idRef = React.useRef(0);

  const dismiss = React.useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = React.useCallback(
    (kind: ToastKind, title: string, description?: string) => {
      // Defensive: callers sometimes pass raw API error payloads (objects or
      // FastAPI validation arrays). Rendering those as React children crashes
      // the whole tree, so coerce anything non-string to a readable string.
      if (description != null && typeof description !== "string") {
        const d: any = description;
        description =
          Array.isArray(d)
            ? d.map((x) => (typeof x === "string" ? x : x?.msg ?? JSON.stringify(x))).join("; ")
            : typeof d === "object"
              ? (Object.keys(d).length ? JSON.stringify(d) : "")
              : String(d);
        description = description || undefined;
      }
      const id = ++idRef.current;
      setToasts((list) => [...list.slice(-4), { id, kind, title, description }]);
      window.setTimeout(() => dismiss(id), TOAST_TTL_MS);
    },
    [dismiss]
  );

  const value = React.useMemo<ToastContextValue>(
    () => ({
      toast: push,
      success: (t, d) => push("success", t, d),
      error: (t, d) => push("error", t, d),
      info: (t, d) => push("info", t, d),
      warning: (t, d) => push("warning", t, d),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div
          aria-live="polite"
          className="pointer-events-none fixed bottom-6 right-6 z-[100] flex w-full max-w-sm flex-col gap-3"
        >
          {toasts.map((t) => {
            const style = kindStyles[t.kind];
            return (
              <div
                key={t.id}
                role="status"
                className={cn(
                  "pointer-events-auto flex items-start gap-3 rounded-2xl border border-white/40 border-l-4 bg-white/90 p-4 shadow-premium-lg backdrop-blur-xl animate-slide-up",
                  "dark:border-white/10 dark:bg-secondary-900/90",
                  style.accent
                )}
              >
                <span className="mt-0.5 shrink-0">{style.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-secondary-900">{t.title}</p>
                  {t.description ? (
                    <p className="mt-0.5 text-xs font-medium text-secondary-500">
                      {t.description}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(t.id)}
                  aria-label="Dismiss notification"
                  className="shrink-0 rounded-lg p-1 text-secondary-400 transition-colors hover:text-secondary-900 dark:hover:text-secondary-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
