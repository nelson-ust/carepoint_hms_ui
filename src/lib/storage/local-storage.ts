import Cookies from "js-cookie";

export const storageKeys = {
  accessToken: "carepoint.access_token",
  refreshToken: "carepoint.refresh_token",
  tenantCode: "carepoint.tenant_code",
  user: "carepoint.user",
  theme: "carepoint.theme",
} as const;

/**
 * Enhanced storage service that synchronizes between localStorage and Cookies.
 * This provides redundancy and ensures auth tokens are available to both
 * client-side scripts and (optionally) the backend via headers.
 */
export const localStorageService = {
  get(key: string): string | null {
    // 1. Try localStorage first
    const local = window.localStorage.getItem(key);
    if (local) return local;

    // 2. Fallback to Cookies
    const cookie = Cookies.get(key);
    if (cookie) {
      // Re-sync to localStorage if found in cookie
      window.localStorage.setItem(key, cookie);
      return cookie;
    }

    return null;
  },

  set(key: string, value: string, options?: Cookies.CookieAttributes): void {
    // 1. Persist to localStorage
    window.localStorage.setItem(key, value);

    // 2. Persist to Cookies (secure by default if on HTTPS)
    const cookieOptions: Cookies.CookieAttributes = {
      expires: 7, // Default 7 days
      path: "/",
      sameSite: "Lax",
      secure: window.location.protocol === "https:",
      ...options,
    };
    Cookies.set(key, value, cookieOptions);
  },

  remove(key: string): void {
    window.localStorage.removeItem(key);
    Cookies.remove(key, { path: "/" });
  },

  clearAuth(): void {
    this.remove(storageKeys.accessToken);
    this.remove(storageKeys.refreshToken);
    this.remove(storageKeys.user);
    // Tenant code and theme are usually preserved during logout
  },
};
