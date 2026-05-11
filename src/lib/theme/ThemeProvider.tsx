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
};

export function ThemeProvider({ children, defaultTheme }: ThemeProviderProps) {
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

  const setTheme = useCallback((next: Theme) => {
    localStorageService.set(storageKeys.theme, next);
    setIsSystem(false);
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      localStorageService.set(storageKeys.theme, next);
      return next;
    });
    setIsSystem(false);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, setTheme, toggleTheme, isSystem }),
    [theme, setTheme, toggleTheme, isSystem],
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
