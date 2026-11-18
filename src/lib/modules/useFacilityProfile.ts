import { useQuery } from "@tanstack/react-query";
import { getMyFacilityProfile, type FacilityProfileCode } from "@/features/tenant-modules/api/tenant-modules.api";
import { localStorageService, storageKeys } from "@/lib/storage/local-storage";
import { routes } from "@/config/routes";

/**
 * The current tenant's facility profile (vertical) — drives native UX such as
 * the workspace name in the sidebar and the default landing page.
 *
 * Wraps `GET /tenant-modules/me/profile`. Fail-safe: while loading or on error
 * it reports the full "HOSPITAL" profile, so the integrated-hospital behaviour
 * is always the default and nothing is hidden unexpectedly.
 */

const HOME_ROUTE: Record<FacilityProfileCode, string> = {
  HOSPITAL: routes.dashboard,
  DENTAL: routes.dentalWorklist,
  EYE: routes.eyeClinic,
  PHARMACY: routes.pharmacy,
};

const WORKSPACE_NAME: Record<FacilityProfileCode, string> = {
  HOSPITAL: "Hospital Workspace",
  DENTAL: "Dental Clinic",
  EYE: "Eye Clinic",
  PHARMACY: "Pharmacy",
};

export function useFacilityProfile() {
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
    queryKey: ["facility-profile", "me", userId],
    queryFn: getMyFacilityProfile,
    enabled: !!token && !isSaaSAdmin,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const code: FacilityProfileCode = query.data?.code ?? "HOSPITAL";
  const isStandalone = code !== "HOSPITAL";

  return {
    ...query,
    code,
    isStandalone,
    /** Use the server-provided names when available, else the local fallback. */
    workspaceName: query.data?.workspace_name ?? WORKSPACE_NAME[code],
    label: query.data?.label ?? WORKSPACE_NAME[code],
    homeRoute: HOME_ROUTE[code] ?? routes.dashboard,
  };
}
