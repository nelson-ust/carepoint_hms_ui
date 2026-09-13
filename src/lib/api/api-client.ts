import axios from "axios";
import type { AxiosError } from "axios";
import { env } from "@/config/env";
import { localStorageService, storageKeys } from "@/lib/storage/local-storage";
import { resolveTenantCode } from "@/lib/tenant/tenant-resolver";
import { loginRouteForCurrentUser } from "@/lib/auth/current-user";

export const apiClient = axios.create({
  baseURL: env.apiBaseUrl,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

// =====================================================================
// Request interceptor — auth + tenant headers
// =====================================================================

apiClient.interceptors.request.use((config) => {
  const accessToken = localStorageService.get(storageKeys.accessToken);

  if (accessToken && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  // Tenant header rules:
  //  - If the caller set X-Tenant-Code explicitly, respect it verbatim.
  //    An explicit EMPTY value means "platform/SaaS request — send no tenant
  //    header at all" (an empty string is falsy, so a naive `||` fallback
  //    here previously re-attached the stored/default tenant and broke the
  //    platform admin login).
  //  - Otherwise auto-resolve from the subdomain / localStorage / env default.
  const hasExplicitTenant = config.headers.has
    ? config.headers.has("X-Tenant-Code")
    : "X-Tenant-Code" in config.headers;

  if (hasExplicitTenant) {
    const explicit = config.headers.get
      ? config.headers.get("X-Tenant-Code")
      : (config.headers as Record<string, unknown>)["X-Tenant-Code"];
    if (!explicit || String(explicit).trim() === "") {
      config.headers.delete
        ? config.headers.delete("X-Tenant-Code")
        : delete (config.headers as Record<string, unknown>)["X-Tenant-Code"];
    }
  } else {
    const tenantCode = resolveTenantCode();
    if (tenantCode) {
      config.headers["X-Tenant-Code"] = tenantCode;
    }
  }

  return config;
});

// =====================================================================
// Response interceptor — global 401 handler
// =====================================================================
//
// When the backend returns 401 on a normally-authenticated request, the
// access token is either missing, expired, or rejected. We:
//   1. Clear local auth state so we don't keep sending the bad token
//   2. Bounce the user to the login page (preserving the path they were on)
//   3. Skip this behaviour for the login endpoint itself (so a wrong-password
//      attempt shows the inline form error, not a redirect loop)
//
// The redirect uses `window.location.assign` (rather than React Router's
// navigate) because the interceptor lives outside the router tree.

const AUTH_ENDPOINT_PATTERNS = [
  /\/auth\/login$/,
  /\/auth\/refresh$/,
  /\/auth\/two-factor/,
];

function isAuthEndpoint(url: string | undefined): boolean {
  if (!url) return false;
  return AUTH_ENDPOINT_PATTERNS.some((re) => re.test(url));
}

function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname.startsWith("/portal") ||
    pathname.startsWith("/invitations/accept") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/saas/login") ||
    pathname.startsWith("/register-hospital") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/two-factor")
  );
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const status = error?.response?.status;
    const config = error?.config as
      | (typeof error.config & { _portalRetry?: boolean })
      | undefined;
    const requestUrl = config?.url ?? "";

    // ---------------------------------------------------------------
    // Patient portal: silent token refresh
    // ---------------------------------------------------------------
    // The portal keeps its own short-lived access token. On a 401 we attempt
    // one silent refresh (using the stored portal refresh token) and replay the
    // request; only if that fails do we send the patient back to portal login.
    // This runs BEFORE the generic branch below, which intentionally ignores
    // /portal paths (they are "public" for the staff redirect logic).
    if (
      status === 401 &&
      requestUrl.startsWith("/portal") &&
      config &&
      !config._portalRetry
    ) {
      config._portalRetry = true;
      try {
        const portal = await import("@/features/patient-portal/api/portal.api");
        const refreshed = await portal.refreshPortalToken();
        if (refreshed) {
          const token = portal.getPortalToken();
          const headers = config.headers as any;
          if (headers && typeof headers.set === "function") {
            headers.set("Authorization", `Bearer ${token}`);
          } else {
            config.headers = { ...(headers ?? {}), Authorization: `Bearer ${token}` } as any;
          }
          return apiClient(config);
        }
        portal.clearPortalSession();
      } catch {
        /* fall through to redirect */
      }
      if (typeof window !== "undefined") {
        window.location.replace("/portal/login?reason=session_expired");
      }
      return Promise.reject(error);
    }

    if (status === 401 && !isAuthEndpoint(requestUrl)) {
      // Avoid redirect loops if we're already on a public page
      if (typeof window !== "undefined" && !isPublicPath(window.location.pathname)) {
        // Resolve the correct login BEFORE clearing auth — a platform (SaaS)
        // admin must return to /saas/login, not the tenant /login (where they
        // can't sign in, which looked like "SaaS pages won't load").
        const loginRoute = loginRouteForCurrentUser();

        // Clear any cached auth so we don't keep retrying with the bad token
        localStorageService.clearAuth();

        // Remember where the user was so we can bring them back after login
        try {
          window.sessionStorage.setItem(
            "carepoint.return_to",
            window.location.pathname + window.location.search,
          );
        } catch {
          /* ignore quota / privacy errors */
        }

        // Use replace so the broken page doesn't sit in browser history
        window.location.replace(`${loginRoute}?reason=session_expired`);
      }
    }

    return Promise.reject(error);
  },
);
