import * as React from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useDebounce } from "@/hooks/useDebounce";

export interface DxToolbarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Sit flush on top of a `DxGrid attached` (no bottom radius/border). */
  attached?: boolean;
}

/** 42px command strip. Compose with DxToolbarGroup / DxToolbarSeparator / DxToolbarSpacer. */
export function DxToolbar({ attached, className, children, ...props }: DxToolbarProps) {
  return (
    <div role="toolbar" className={cn("dx-toolbar", attached && "dx-toolbar-attached", className)} {...props}>
      {children}
    </div>
  );
}

export function DxToolbarGroup({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("dx-toolbar-group", className)} {...props} />;
}

export function DxToolbarSeparator() {
  return <span className="dx-toolbar-sep" aria-hidden />;
}

export function DxToolbarSpacer() {
  return <span className="dx-toolbar-spacer" aria-hidden />;
}

export function DxToolbarLabel({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("dx-toolbar-label", className)} {...props} />;
}

export interface DxSearchBoxProps {
  defaultValue?: string;
  onSearch: (term: string) => void;
  placeholder?: string;
  debounceMs?: number;
  className?: string;
  autoFocus?: boolean;
  size?: "sm" | "md";
}

/**
 * Debounced search editor with a clear button. Uncontrolled — to reset it
 * from a parent, remount it with a new `key`.
 */
export function DxSearchBox({
  defaultValue = "",
  onSearch,
  placeholder = "Search…",
  debounceMs = 300,
  className,
  autoFocus,
  size = "md",
}: DxSearchBoxProps) {
  const [text, setText] = React.useState(defaultValue);
  const debounced = useDebounce(text, debounceMs);
  const lastSent = React.useRef<string | null>(defaultValue);
  const onSearchRef = React.useRef(onSearch);
  React.useEffect(() => {
    onSearchRef.current = onSearch;
  }, [onSearch]);

  React.useEffect(() => {
    if (lastSent.current === debounced) return;
    lastSent.current = debounced;
    onSearchRef.current(debounced.trim());
  }, [debounced]);

  return (
    <div className={cn("dx-editor-wrap", className)}>
      <Search aria-hidden />
      <input
        type="search"
        autoFocus={autoFocus}
        className={cn("dx-editor pr-8", size === "sm" && "dx-editor-sm")}
        placeholder={placeholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            lastSent.current = text;
            onSearch(text.trim());
          }
        }}
      />
      {text ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => setText("")}
          className="absolute right-2 inline-flex h-5 w-5 items-center justify-center rounded text-[var(--dx-text-faint)] hover:bg-[var(--dx-neutral-soft)] hover:text-[var(--dx-text)]"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}
