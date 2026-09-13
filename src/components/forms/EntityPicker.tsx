import { useEffect, useId, useRef, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface EntityOption {
  value: number;
  label: string;
  sublabel?: string;
}

export interface EntityPickerProps {
  label?: string;
  placeholder?: string;
  hint?: string;
  value: EntityOption | null;
  onChange: (option: EntityOption | null) => void;
  /** Async lookup — called (debounced) with the typed query. */
  search: (query: string) => Promise<EntityOption[]>;
  /** Load options immediately on focus, before any typing. */
  preloadOnFocus?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * Debounced async combobox for picking records by name/number instead of
 * raw database IDs — patients, invoices, vendors, enrollees.
 *
 * Fully keyboard operable: ArrowUp/Down move through results, Enter selects,
 * Escape closes, and the clear button is a real focusable button. Announced
 * to assistive tech via the WAI-ARIA combobox pattern.
 */
export function EntityPicker({
  label, placeholder = "Type to search…", hint, value, onChange, search,
  preloadOnFocus = false, disabled, className,
}: EntityPickerProps) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<EntityOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const seq = useRef(0);
  const listboxId = useId();

  useEffect(() => {
    if (!open) return;
    if (!preloadOnFocus && query.trim().length < 2) {
      setOptions([]);
      setActiveIndex(-1);
      return;
    }
    const mine = ++seq.current;
    setLoading(true);
    const t = setTimeout(() => {
      search(query.trim())
        .then((opts) => {
          if (seq.current === mine) {
            setOptions(opts);
            setActiveIndex(opts.length ? 0 : -1);
          }
        })
        .catch(() => { if (seq.current === mine) setOptions([]); })
        .finally(() => { if (seq.current === mine) setLoading(false); });
    }, 250);
    return () => clearTimeout(t);
  }, [query, open, preloadOnFocus, search]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const select = (o: EntityOption) => {
    onChange(o);
    setOpen(false);
    setQuery("");
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setOpen(true);
      e.preventDefault();
      return;
    }
    if (!options.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % options.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + options.length) % options.length);
    } else if (e.key === "Enter") {
      if (open && activeIndex >= 0 && activeIndex < options.length) {
        e.preventDefault();
        select(options[activeIndex]);
      }
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  const showList = open && (query.trim().length >= 2 || preloadOnFocus);

  return (
    <div className={cn("relative", className)} ref={boxRef}>
      {label && (
        <label className="mb-1.5 block text-sm font-medium text-secondary-700"
          htmlFor={value ? undefined : `${listboxId}-input`}>{label}</label>
      )}
      {value ? (
        <div className="flex items-center justify-between rounded-xl border border-secondary-200 bg-secondary-50 px-3 py-2.5">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-secondary-900">{value.label}</div>
            {value.sublabel && (
              <div className="truncate text-xs text-secondary-500">{value.sublabel}</div>
            )}
          </div>
          {!disabled && (
            <button type="button"
              className="ml-2 rounded p-1 text-secondary-400 hover:text-secondary-700 focus:outline-none focus:ring-2 focus:ring-primary-300"
              onClick={() => {
                onChange(null);
                setQuery("");
                requestAnimationFrame(() => inputRef.current?.focus());
              }}
              aria-label={`Clear selected ${label ?? "item"}: ${value.label}`}>
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      ) : (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary-400" aria-hidden />
          <input
            ref={inputRef}
            id={`${listboxId}-input`}
            role="combobox"
            aria-expanded={showList}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined}
            className="w-full rounded-xl border border-secondary-200 py-2.5 pl-9 pr-9 text-sm outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
            placeholder={placeholder}
            value={query}
            disabled={disabled}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          />
          {loading && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-secondary-400" aria-hidden />
          )}
          {showList && (
            <ul id={listboxId} role="listbox"
              className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-secondary-200 bg-white py-1 shadow-lg">
              {options.length === 0 && !loading && (
                <li className="px-3 py-2 text-sm text-secondary-500" role="presentation">
                  {query.trim().length < 2 && !preloadOnFocus
                    ? "Type at least 2 characters…" : "No matches."}
                </li>
              )}
              {options.map((o, i) => (
                <li key={o.value} id={`${listboxId}-opt-${i}`} role="option"
                  aria-selected={i === activeIndex}>
                  <button type="button" tabIndex={-1}
                    className={cn("block w-full px-3 py-2 text-left",
                      i === activeIndex ? "bg-primary-50" : "hover:bg-primary-50")}
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => select(o)}>
                    <div className="text-sm font-medium text-secondary-900">{o.label}</div>
                    {o.sublabel && <div className="text-xs text-secondary-500">{o.sublabel}</div>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {hint && <p className="mt-1 text-xs text-secondary-500">{hint}</p>}
    </div>
  );
}
