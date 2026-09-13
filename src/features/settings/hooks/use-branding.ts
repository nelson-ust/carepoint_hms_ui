import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getTenantSettings,
  updateTenantBranding,
  uploadTenantLogo,
  type UpdateBrandingPayload,
} from "../api/branding.api";

export const brandingKeys = {
  settings: ["tenant", "settings"] as const,
};

/**
 * Read the current tenant's settings (branding included).
 *
 * `enabled` lets callers (e.g. the sidebar) skip the fetch for contexts that
 * have no tenant settings, such as the SaaS platform admin.
 */
export function useTenantSettings(enabled = true) {
  return useQuery({
    queryKey: brandingKeys.settings,
    queryFn: getTenantSettings,
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

export function useUploadTenantLogo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadTenantLogo(file),
    onSuccess: (data) => {
      queryClient.setQueryData(brandingKeys.settings, data);
      queryClient.invalidateQueries({ queryKey: brandingKeys.settings });
    },
  });
}

export function useUpdateTenantBranding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateBrandingPayload) => updateTenantBranding(payload),
    onSuccess: (data) => {
      queryClient.setQueryData(brandingKeys.settings, data);
    },
  });
}
