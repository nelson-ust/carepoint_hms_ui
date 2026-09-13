import { apiClient } from "@/lib/api/api-client";

// =====================================================================
// Types — mirror the backend schemas:
// - MyProfileReadSchema / MyProfileUpdateSchema  (user_profile_routes.py)
// - ChangePasswordSchema / TwoFactorSetupSchema  (auth_schemas.py)
// - UserSessionLiteSchema                        (user_schema.py)
// =====================================================================

export type ProfileRole = {
  id?: number;
  name?: string;
  code?: string;
  [key: string]: unknown;
};

export type MyProfile = {
  id: number;
  username: string;
  email: string;
  phone_number?: string | null;
  first_name: string;
  last_name: string;
  middle_name?: string | null;
  profile_photo_url?: string | null;
  profile_photo_display_url?: string | null;
  signature_url?: string | null;
  signature_display_url?: string | null;
  job_title?: string | null;
  department_id?: number | null;
  facility_id?: number | null;
  employment_status?: string | null;
  bio?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  is_email_verified: boolean;
  is_phone_verified: boolean;
  is_two_factor_enabled: boolean;
  theme_preference?: "light" | "dark";
  profile_completion: number;
  last_login_at?: string | null;
  roles: ProfileRole[];
};

export type MyProfileUpdatePayload = {
  first_name?: string;
  last_name?: string;
  middle_name?: string;
  phone_number?: string;
  bio?: string;
  date_of_birth?: string;
  gender?: string;
  job_title?: string;
};

export type ChangePasswordPayload = {
  current_password: string;
  new_password: string;
  confirm_new_password: string;
};

export type TwoFactorSetupPayload = {
  enable_two_factor: boolean;
  method: string;
  enable_email?: boolean;
  enable_sms?: boolean;
  enable_whatsapp?: boolean;
  enable_authenticator?: boolean;
};

export type TwoFactorSetupResult = {
  success: boolean;
  message: string;
  two_factor_enabled: boolean;
  method?: string | null;
  setup_secret?: string | null;
  provisioning_uri?: string | null;
  qr_code_data?: string | null;
};

export type UserSession = {
  id: number;
  session_token_jti: string;
  refresh_token_jti?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  login_at: string;
  expires_at?: string | null;
  revoked_at?: string | null;
  is_current: boolean;
};

export type ActionResult = {
  success: boolean;
  message: string;
};

// =====================================================================
// Normalization — endpoints return either the bare resource or a
// `{ success, message, ... }` envelope; flatten both here.
// =====================================================================

function normalizeProfile(data: unknown): MyProfile {
  const record = data as Record<string, unknown>;
  if (record && typeof record === "object" && "user" in record && record.user) {
    return record.user as MyProfile;
  }
  return record as unknown as MyProfile;
}

// =====================================================================
// My profile — /users/me (user_profile_routes.py)
// =====================================================================

export async function getMyProfile(): Promise<MyProfile> {
  const response = await apiClient.get("/users/me");
  return normalizeProfile(response.data);
}

export async function updateMyProfile(payload: MyProfileUpdatePayload): Promise<MyProfile> {
  const response = await apiClient.put("/users/me", payload);
  return normalizeProfile(response.data);
}

export async function uploadMyProfilePhoto(file: File): Promise<MyProfile> {
  const form = new FormData();
  form.append("file", file);
  const response = await apiClient.post("/users/me/photo", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

export async function uploadMySignature(file: File): Promise<MyProfile> {
  const form = new FormData();
  form.append("file", file);
  const response = await apiClient.post("/users/me/signature", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

export async function removeMySignature(): Promise<MyProfile> {
  const response = await apiClient.delete("/users/me/signature");
  return response.data;
}

export async function removeMyProfilePhoto(): Promise<MyProfile> {
  const response = await apiClient.delete("/users/me/photo");
  return normalizeProfile(response.data);
}

// =====================================================================
// Security — /auth (auth_routes.py)
// =====================================================================

export async function changeMyPassword(payload: ChangePasswordPayload): Promise<ActionResult> {
  const response = await apiClient.post("/auth/change-password", payload);
  const data = response.data as Partial<ActionResult>;
  return {
    success: data.success ?? true,
    message: data.message ?? "Password changed successfully.",
  };
}

export async function setupTwoFactor(payload: TwoFactorSetupPayload): Promise<TwoFactorSetupResult> {
  const response = await apiClient.post("/auth/two-factor/setup", payload);
  const data = response.data as Partial<TwoFactorSetupResult>;
  return {
    success: data.success ?? true,
    message: data.message ?? "Two-factor settings updated.",
    two_factor_enabled: data.two_factor_enabled ?? payload.enable_two_factor,
    method: data.method ?? null,
    setup_secret: data.setup_secret ?? null,
    provisioning_uri: data.provisioning_uri ?? null,
    qr_code_data: data.qr_code_data ?? null,
  };
}

// =====================================================================
// Sessions — /users/{id}/sessions (user_routes.py, admin-gated).
// The backend has no self-service sessions endpoint, so we call the
// admin surface with the caller's own id; non-admins receive a 403 and
// the UI degrades gracefully.
// =====================================================================

export async function listUserSessions(userId: number): Promise<UserSession[]> {
  const response = await apiClient.get(`/users/${userId}/sessions`);
  const data = response.data as { sessions?: UserSession[] } | UserSession[];
  if (Array.isArray(data)) return data;
  return data.sessions ?? [];
}

export async function revokeAllUserSessions(userId: number): Promise<ActionResult> {
  const response = await apiClient.post(`/users/${userId}/revoke-sessions`);
  const data = response.data as Partial<ActionResult>;
  return {
    success: data.success ?? true,
    message: data.message ?? "Sessions revoked.",
  };
}

// =====================================================================
// Shared helpers
// =====================================================================

/** Best-effort extraction of a human message from a FastAPI error response. */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  const data = (error as { response?: { data?: { detail?: unknown; message?: unknown } } })
    ?.response?.data;
  if (typeof data?.message === "string") return data.message;
  if (typeof data?.detail === "string") return data.detail;
  const nested = data?.detail as { message?: unknown } | undefined;
  if (nested && typeof nested.message === "string") return nested.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function getInitials(profile: Pick<MyProfile, "first_name" | "last_name" | "username">): string {
  const first = profile.first_name?.trim()?.[0] ?? "";
  const last = profile.last_name?.trim()?.[0] ?? "";
  const initials = `${first}${last}`.toUpperCase();
  return initials || profile.username?.slice(0, 2).toUpperCase() || "?";
}
