import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getMyPermissions } from "@/features/roles/api/roles.api";
import { permissionKeys } from "@/features/roles/hooks/use-roles";
import { localStorageService, storageKeys } from "@/lib/storage/local-storage";

/**
 * Role-based access gate for the CURRENT user.
 *
 * Wraps `GET /permissions/me` (the effective permission codes granted by the
 * user's assigned roles; superusers get the `*` wildcard). Used to decide
 * which menu items / actions a user may see, so the UI only surfaces what the
 * role can actually do — instead of showing everything and failing with
 * "You do not have permission to perform this action".
 *
 * Fail-open by design: while the query is loading or errors we do NOT hide
 * navigation — gating only engages once we have a definitive answer. Security
 * is still enforced server-side on every request; this only shapes the UI.
 */
export function usePermissionGate() {
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
    // Key by the current user so one user never inherits another's cached
    // permissions (which would surface menus their role cannot use).
    queryKey: [...permissionKeys.mine(), userId],
    queryFn: getMyPermissions,
    enabled: !!token && !isSaaSAdmin,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const isSuperuser = !!query.data?.is_superuser;
  const known = query.isSuccess && Array.isArray(query.data?.permissions);
  const codes = useMemo(
    () => new Set<string>((query.data?.permissions ?? []).map((c) => c.toUpperCase())),
    [query.data],
  );
  // Wildcard grant (superusers) short-circuits every check.
  const wildcard = isSuperuser || codes.has("*");

  /**
   * True when the user may see something requiring ANY of `required`.
   * - no requirement → always visible (core / ungated entries)
   * - SaaS / super / wildcard → always visible
   * - still loading or errored → fail open (visible)
   */
  const hasAny = (required?: string[]): boolean => {
    if (!required || required.length === 0) return true;
    if (isSaaSAdmin || wildcard) return true;
    if (!known) return true; // fail open until we have a definitive answer
    return required.some((code) => codes.has(code.toUpperCase()));
  };

  /** True when the user holds a specific permission code. */
  const has = (code: string): boolean => hasAny([code]);

  return { ...query, isSaaSAdmin, isSuperuser, known, codes, hasAny, has };
}
