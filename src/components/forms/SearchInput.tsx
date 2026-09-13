import * as React from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useDebounce } from "@/hooks/useDebounce";

export interface SearchInputProps {
  value?: string;
  /** Fires debounced — safe to hit an API directly. */
  onSearch: (term: string) => void;
  placeholder?: string;
  debounceMs?: number;
  className?: string;
  autoFocus?: boolean;
}

/** Debounced search box with a clear button, styled for filter bars. */
export function SearchInput({
  value: controlled,
  onSearch,
  placeholder = "Search…",
  debounceMs = 350,
  className,
  autoFocus,
}: SearchInputProps) {
  const [term, setTerm] = React.useState(controlled ?? "");
  const debounced = useDebounce(term, debounceMs);
  const onSearchRef = React.useRef(onSearch);
  onSearchRef.current = onSearch;
  const isFirst = React.useRef(true);

  React.useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    onSearchRef.current(debounced.trim());
  }, [debounced]);

  return (
    <div className={cn("group relative", className)}>
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary-400 transition-colors group-focus-within:text-primary-500" />
      <input
        type="text"
        value={term}
        autoFocus={autoFocus}
        onChange={(e) => setTerm(e.target.value)}
        placeholder={placeholder}
        className="input-field pl-11 pr-10 py-2.5"
      />
      {term ? (
        <button
          type="button"
          onClick={() => setTerm("")}
          aria-label="Clear search"
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-secondary-400 transition-colors hover:text-secondary-900 dark:hover:text-secondary-100"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
