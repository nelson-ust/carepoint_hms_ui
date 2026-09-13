import { localStorageService, storageKeys } from "@/lib/storage/local-storage";

export type StoredUser = {
  id?: number;
  email?: string;
  username?: string;
  role?: string;
  is_saas_admin?: boolean;
  theme_preference?: "light" | "dark";
  [key: string]: unknown;
} | null;

/** Read the cached signed-in user, or null if absent/corrupt. */
export function getStoredUser(): StoredUser {
  try {
    const raw = localStorageService.get(storageKeys.user);
    return raw ? (JSON.parse(raw) as StoredUser) : null;
  } catch {
    return null;
  }
}

/**
 * Whether the signed-in principal is a platform (SaaS) administrator rather
 * than a tenant user. SaaS admins live in the master DB and must not be sent
 * to the tenant login or made to poll tenant-scoped endpoints.
 */
export function isSaaSAdmin(): boolean {
  const u = getStoredUser();
  if (!u) return false;
  return (
    !!u.is_saas_admin ||
    u.role === "SAAS_ADMIN" ||
    u.username === "superadmin@carepointhms.com"
  );
}

/** The correct login route for the current principal. */
export function loginRouteForCurrentUser(): string {
  if (isSaaSAdmin()) return "/saas/login";
  if (typeof window !== "undefined" && window.location.pathname.startsWith("/saas")) {
    return "/saas/login";
  }
  return "/login";
}
