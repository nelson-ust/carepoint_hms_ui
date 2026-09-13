import { apiClient } from "@/lib/api/api-client";

/**
 * Tenant settings (branding subset).
 *
 * The backend `TenantSettingReadSchema` carries many more fields; we type the
 * branding-relevant ones the UI actually uses.
 */
export type TenantSettings = {
  logo_url?: string | null;
  primary_color: string;
  secondary_color: string;
  default_currency: string;
  timezone: string;
  date_format: string;
  time_format: string;
};

export type UpdateBrandingPayload = {
  primary_color?: string;
  secondary_color?: string;
};

/** GET /settings — current tenant's settings (auth: staff). */
export async function getTenantSettings(): Promise<TenantSettings> {
  const res = await apiClient.get<TenantSettings>("/settings");
  return res.data;
}

/** POST /settings/logo — upload a new hospital logo (multipart). */
export async function uploadTenantLogo(file: File): Promise<TenantSettings> {
  const form = new FormData();
  form.append("file", file);
  // Set Content-Type explicitly so axios keeps the FormData intact (the
  // apiClient default is application/json, which would serialise it to `{}`).
  const res = await apiClient.post<TenantSettings>("/settings/logo", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

/** PUT /settings — update branding fields (e.g. theme colours). */
export async function updateTenantBranding(
  payload: UpdateBrandingPayload,
): Promise<TenantSettings> {
  const res = await apiClient.put<TenantSettings>("/settings", payload);
  return res.data;
}
