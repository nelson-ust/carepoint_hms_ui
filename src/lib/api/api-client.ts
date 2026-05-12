import axios from "axios";
import type { AxiosError } from "axios";
import { env } from "@/config/env";
import { localStorageService, storageKeys } from "@/lib/storage/local-storage";
import { resolveTenantCode } from "@/lib/tenant/tenant-resolver";

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

  // Only resolve from URL/Storage if the header isn't already explicitly
  // provided. This allows overriding or suppressing the header for specific
  // requests like SaaS login.
  const tenantCode = config.headers["X-Tenant-Code"] || resolveTenantCode();

  if (accessToken && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  if (tenantCode) {
    config.headers["X-Tenant-Code"] = tenantCode;
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
  (error: AxiosError) => {
    const status = error?.response?.status;
    const requestUrl = error?.config?.url ?? "";

    if (status === 401 && !isAuthEndpoint(requestUrl)) {
      // Avoid redirect loops if we're already on a public page
      if (typeof window !== "undefined" && !isPublicPath(window.location.pathname)) {
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
        window.location.replace("/login?reason=session_expired");
      }
    }

    return Promise.reject(error);
  },
);
