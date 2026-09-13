import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import { localStorageService, storageKeys } from "@/lib/storage/local-storage";

export type Theme = "light" | "dark";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  /**
   * Apply a theme that came from the server (the user's saved profile
   * preference) WITHOUT persisting it back — used to hydrate on login so the
   * choice follows the user across devices.
   */
  hydrateTheme: (theme: Theme) => void;
  /** True when the user hasn't explicitly chosen — we're following OS preference. */
  isSystem: boolean;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function readStoredTheme(): Theme | null {
  const stored = localStorageService.get(storageKeys.theme);
  return stored === "light" || stored === "dark" ? stored : null;
}

function detectSystemTheme(): Theme {
  if (typeof window === "undefined" || !window.matchMedia) return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (theme === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
  root.style.colorScheme = theme;
}

type ThemeProviderProps = {
  children: ReactNode;
  /** Theme to use when the user has no stored preference. Defaults to OS preference. */
  defaultTheme?: Theme;
  /**
   * Called whenever the user explicitly changes the theme (via setTheme /
   * toggleTheme). Use it to persist the choice to the user's profile. Not
   * called during hydration from the server.
   */
  onPersist?: (theme: Theme) => void;
};

export function ThemeProvider({ children, defaultTheme, onPersist }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = readStoredTheme();
    if (stored) return stored;
    if (defaultTheme) return defaultTheme;
    return detectSystemTheme();
  });
  const [isSystem, setIsSystem] = useState<boolean>(() => readStoredTheme() === null);

  // Apply on mount + whenever theme changes
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Watch OS changes — but only when the user has not explicitly chosen.
  useEffect(() => {
    if (!isSystem || typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (event: MediaQueryListEvent) => {
      setThemeState(event.matches ? "dark" : "light");
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [isSystem]);

  const setTheme = useCallback(
    (next: Theme) => {
      localStorageService.set(storageKeys.theme, next);
      setIsSystem(false);
      setThemeState(next);
      onPersist?.(next);
    },
    [onPersist],
  );

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      localStorageService.set(storageKeys.theme, next);
      onPersist?.(next);
      return next;
    });
    setIsSystem(false);
  }, [onPersist]);

  // Apply a server-provided preference without persisting it back.
  const hydrateTheme = useCallback((next: Theme) => {
    setThemeState((prev) => {
      if (prev === next) return prev;
      localStorageService.set(storageKeys.theme, next);
      return next;
    });
    setIsSystem(false);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, setTheme, toggleTheme, hydrateTheme, isSystem }),
    [theme, setTheme, toggleTheme, hydrateTheme, isSystem],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used inside a <ThemeProvider>");
  }
  return ctx;
}
