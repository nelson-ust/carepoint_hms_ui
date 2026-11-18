import { env } from "@/config/env";
import { localStorageService, storageKeys } from "@/lib/storage/local-storage";

/**
 * Dynamically resolves the tenant code from the URL subdomain.
 * Examples:
 * - stnicholas.localhost:3000 -> stnicholas
 * - app.carepoint.com -> app
 * - localhost:3000 -> null (SaaS User)
 */
export function resolveTenantCode(): string | null {
  const hostname = window.location.hostname;
  const parts = hostname.split(".");

  // 1. Check for subdomain (e.g., stnicholas.localhost or stnicholas.carepoint.com)
  // We expect at least 2 parts for a subdomain on localhost (tenant.localhost)
  // or at least 3 parts for a standard domain (tenant.example.com)
  if (parts.length >= 2) {
    const firstPart = parts[0].toLowerCase();
    
    // Exclude common non-tenant subdomains
    const excludedSubdomains = ["www", "localhost", "127", "0", "app", "api", "admin"];
    
    if (!excludedSubdomains.includes(firstPart)) {
      return firstPart.toUpperCase(); // Backend seems to prefer uppercase (e.g. STNICHOLAS)
    }
  }

  // 2. Explicit tenant_code in the URL query string. Password-reset links
  //    emailed to tenant users look like
  //    "/reset-password?token=...&tenant_code=STNICHOLAS" and are opened on a
  //    bare domain (no subdomain), so without this the tenant context is lost
  //    and the reset is treated as a SaaS request.
  try {
    const qsTenant = new URLSearchParams(window.location.search).get("tenant_code");
    if (qsTenant && qsTenant.trim()) {
      return qsTenant.trim().toUpperCase();
    }
  } catch {
    // window.location.search unavailable in this context — ignore.
  }

  // 3. Fallback to stored tenant if no subdomain is present
  const storedTenant = localStorageService.get(storageKeys.tenantCode);
  if (storedTenant) {
    return storedTenant;
  }

  // 4. Last fallback to env default
  return env.defaultTenantCode || null;
}

