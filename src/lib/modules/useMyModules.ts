import { useQuery } from "@tanstack/react-query";
import { listMyTenantModules } from "@/features/tenant-modules/api/tenant-modules.api";
import { localStorageService, storageKeys } from "@/lib/storage/local-storage";

/**
 * Subscription-aware module access for the CURRENT tenant user.
 *
 * Wraps `GET /tenant-modules/me/list` (plan defaults + per-tenant overrides →
 * `effective` flag per module code). Used to gate the sidebar and routes so
 * tenants only see the modules they subscribed for.
 *
 * Fail-open by design: while loading or if the endpoint errors we do NOT lock
 * users out of navigation — gating only engages on a definitive answer.
 */
export function useMyModules() {
  const token = localStorageService.get(storageKeys.accessToken);
  const userStr = localStorageService.get(storageKeys.user);
  let isSaaSAdmin = false;
  let userId: number | string = "anon";
  try {
    const u = userStr ? JSON.parse(userStr) : null;
    isSaaSAdmin = !!u?.is_saas_admin || u?.username === "superadmin@carepointhms.com";
    if (u?.id != null) userId = u.id;
  } catch {
    /* ignore */
  }

  const query = useQuery({
    // Per-user key so module access never bleeds across accounts.
    queryKey: ["tenant-modules", "me", userId],
    queryFn: listMyTenantModules,
    enabled: !!token && !isSaaSAdmin,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const known = query.isSuccess && Array.isArray(query.data) && query.data.length > 0;
  const enabledCodes = new Set<string>(
    known
      ? (query.data ?? [])
          .filter((m) => m.effective && m.code)
          .map((m) => String(m.code).toLowerCase())
      : []
  );

  /** True when this module should be visible/usable for the current user. */
  const isEnabled = (moduleCode?: string): boolean => {
    if (!moduleCode) return true;          // ungated (core) module
    if (isSaaSAdmin) return true;          // platform admins see everything
    if (!known) return true;               // fail open while loading / on error
    return enabledCodes.has(moduleCode.toLowerCase());
  };

  return { ...query, isSaaSAdmin, known, enabledCodes, isEnabled };
}
