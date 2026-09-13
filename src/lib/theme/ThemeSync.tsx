import { useEffect } from "react";
import { useTheme } from "./ThemeProvider";
import { readStoredUserTheme } from "./theme.api";

/**
 * Applies the theme saved on the authenticated user's profile.
 *
 * The login response carries ``theme_preference``, cached in the stored user
 * object. Mounting this inside the authenticated shell means signing in on any
 * device restores that device-independent choice. If the profile has no saved
 * theme yet, the existing local/OS preference is left untouched.
 */
export function ThemeSync() {
  const { hydrateTheme } = useTheme();

  useEffect(() => {
    const serverTheme = readStoredUserTheme();
    if (serverTheme) hydrateTheme(serverTheme);
    // Run once on mount of the authenticated shell (i.e. right after login /
    // on refresh while signed in).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
