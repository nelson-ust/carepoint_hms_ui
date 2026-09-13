import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { CornerDownLeft, Search } from "lucide-react";
import type { AppModule } from "@/config/module-registry";

/**
 * "Jump anywhere" command palette (⌘K / Ctrl+K).
 *
 * Lists every menu entry the current user can see — icon, label, description
 * and category tag — filtered live as they type. Full keyboard support:
 * ↑/↓ to navigate, ↵ to open, ESC to close. Rendered through a portal so no
 * ancestor backdrop-filter can trap the fixed overlay.
 */
export function CommandPalette({
  open,
  onClose,
  items,
  brand,
}: {
  open: boolean;
  onClose: () => void;
  items: AppModule[];
  brand?: string;
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    const words = q.split(/\s+/);
    return items.filter((m) => {
      const hay = `${m.label} ${m.description ?? ""} ${m.category} ${m.code}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [items, query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setIndex(0);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => setIndex(0), [query]);

  useEffect(() => {
    const el = listRef.current?.querySelector('[data-active="true"]');
    (el as HTMLElement | null)?.scrollIntoView({ block: "nearest" });
  }, [index, filtered.length]);

  const openItem = (m?: AppModule) => {
    if (!m) return;
    onClose();
    navigate(m.path);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      openItem(filtered[index]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[130] flex items-start justify-center bg-slate-950/60 backdrop-blur-sm p-4 pt-[12vh] animate-fade-in"
      onMouseDown={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Jump to anywhere in your workspace"
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-secondary-950/95 shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-primary-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Jump to anywhere in your workspace…"
            className="data-mono flex-1 bg-transparent text-sm text-white placeholder:text-secondary-500 outline-none border border-primary-500/40 focus:border-primary-400 rounded-lg px-3 py-1.5"
          />
          <button
            onClick={onClose}
            className="rounded-md border border-white/15 px-1.5 py-0.5 text-[10px] font-bold text-secondary-400 hover:text-white"
          >
            ESC
          </button>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-secondary-500">
              Nothing matches “{query}”.
            </p>
          ) : (
            filtered.map((m, i) => {
              const active = i === index;
              return (
                <button
                  key={m.code}
                  data-active={active || undefined}
                  onMouseEnter={() => setIndex(i)}
                  onClick={() => openItem(m)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                    active
                      ? "bg-primary-500/15 ring-1 ring-primary-500/30"
                      : "hover:bg-white/5"
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                      active ? "bg-primary-500 text-white" : "bg-white/5 text-secondary-300"
                    }`}
                  >
                    <m.icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-sm font-bold ${active ? "text-white" : "text-secondary-100"}`}>
                      {m.label}
                    </span>
                    {m.description ? (
                      <span className="block truncate text-xs text-secondary-500">{m.description}</span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-[9px] font-black uppercase tracking-[0.2em] text-secondary-500">
                    {m.category}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Footer hints */}
        <div className="flex items-center justify-between border-t border-white/10 px-4 py-2 text-[10px] font-bold text-secondary-500">
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-white/15 px-1">↑↓</kbd> navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-white/15 px-1"><CornerDownLeft className="h-2.5 w-2.5 inline" /></kbd> open
            </span>
          </span>
          <span className="uppercase tracking-[0.2em] text-primary-500">
            {(brand || "Carepoint").toUpperCase()} · COMMAND
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
