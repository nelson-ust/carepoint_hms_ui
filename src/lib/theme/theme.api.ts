import { apiClient } from "@/lib/api/api-client";
import { localStorageService, storageKeys } from "@/lib/storage/local-storage";
import type { Theme } from "./ThemeProvider";

/**
 * Persist the user's theme choice to their profile (cross-device).
 *
 * Fire-and-forget: the local theme has already been applied and cached, so a
 * network hiccup or a non-tenant session (e.g. a SaaS admin whose token isn't
 * valid on the tenant profile endpoint) must never surface an error to the
 * user. We only attempt it when a session token is present.
 */
export function persistThemePreference(theme: Theme): void {
  const token = localStorageService.get(storageKeys.accessToken);
  if (!token) return;

  apiClient
    .put("/users/me/theme", { theme })
    .then(() => {
      // Keep the cached user object in sync so a re-read reflects the choice.
      try {
        const raw = localStorageService.get(storageKeys.user);
        if (raw) {
          const user = JSON.parse(raw);
          user.theme_preference = theme;
          localStorageService.set(storageKeys.user, JSON.stringify(user));
        }
      } catch {
        /* ignore malformed cache */
      }
    })
    .catch(() => {
      /* best-effort — local theme still applies */
    });
}

/** Read the theme the server saved on the logged-in user's profile, if any. */
export function readStoredUserTheme(): Theme | null {
  try {
    const raw = localStorageService.get(storageKeys.user);
    if (!raw) return null;
    const value = JSON.parse(raw)?.theme_preference;
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}
