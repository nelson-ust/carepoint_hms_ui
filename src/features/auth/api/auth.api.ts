import { apiClient } from "@/lib/api/api-client";

// ====================================================================
// Types
// ====================================================================

export type User = {
  id: number;
  tenant_id?: number;
  username: string;
  email: string;
  phone_number?: string;
  first_name: string;
  last_name: string;
  middle_name?: string;
  status: string;
  is_superuser: boolean;
  is_email_verified: boolean;
  is_phone_verified: boolean;
  is_two_factor_enabled: boolean;
  two_factor_method?: string;
  two_factor_email_enabled?: boolean;
  two_factor_sms_enabled?: boolean;
  two_factor_whatsapp_enabled?: boolean;
  two_factor_authenticator_enabled?: boolean;
  roles?: string[] | string;
  created_at?: string;
  updated_at?: string;
};

export type AuthTokens = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  refresh_expires_in: number;
  two_factor_required: boolean;
  two_factor_verified: boolean;
};

export type Session = {
  jti: string;
  issued_at: string;
  expires_at: string;
  two_factor_verified: boolean;
  ip_address?: string;
  user_agent?: string;
};

export type LoginPayload = {
  identifier: string;
  password: string;
  remember_me: boolean;
};

export type LoginResponse = {
  success: boolean;
  message: string;
  user?: User;
  tokens?: AuthTokens;
  // SaaS flat response support
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  admin_id?: number;
  email?: string;
  first_name?: string;
  last_name?: string;
};

export type RefreshTokenPayload = { refresh_token: string };
export type RefreshTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
};

export type ImpersonatePayload = { tenant_code: string };
export type ImpersonateResponse = {
  success: boolean;
  message: string;
  access_token: string;
  refresh_token: string;
  token_type: string;
  tenant_code: string;
  tenant_name: string;
};

export type LogoutPayload = {
  refresh_token: string;
  all_sessions: boolean;
};

export type LogoutResponse = { success: boolean; message: string };

export type GetMeResponse = {
  success: boolean;
  message: string;
  user: User;
  session?: Session;
};

export type ChangePasswordPayload = {
  current_password: string;
  new_password: string;
  confirm_new_password: string;
};

export type ForgotPasswordPayload = { identifier: string };

export type ResetPasswordPayload = {
  reset_token: string;
  new_password: string;
  confirm_new_password: string;
};

export type GenericAuthResponse = { success: boolean; message: string };

export type VerifyOtpPayload = {
  user_id?: number;
  identifier?: string;
  otp_code: string;
  challenge_reference?: string;
  purpose?: string;
};

export type OtpResult = {
  success: boolean;
  message: string;
  verified: boolean;
  user?: User;
  tokens?: AuthTokens;
  // SaaS flat response support
  access_token?: string;
  refresh_token?: string;
  admin_id?: number;
  email?: string;
  first_name?: string;
  last_name?: string;
};

export type ResendOtpPayload = {
  user_id?: number;
  identifier?: string;
  purpose?: string;
  delivery_method?: string;
};

export type ResendOtpResponse = {
  success: boolean;
  message: string;
  challenge_reference: string;
  delivery_method: string;
};

export type SetupTwoFactorPayload = {
  enable_two_factor: boolean;
  method?: string;
  enable_email?: boolean;
  enable_sms?: boolean;
  enable_whatsapp?: boolean;
  enable_authenticator?: boolean;
};

export type SetupTwoFactorResponse = {
  success: boolean;
  message: string;
  two_factor_enabled: boolean;
  method?: string;
  setup_secret?: string;
  provisioning_uri?: string;
  qr_code_data?: string;
};

export type VerifyTwoFactorPayload = {
  user_id?: number;
  identifier?: string;
  otp_code: string;
  method?: string;
  challenge_reference?: string;
};

export type RequestEmailVerificationPayload = {
  user_id?: number;
  email: string;
};

export type ConfirmEmailVerificationPayload = { token: string };

export type RequestPhoneVerificationPayload = {
  user_id?: number;
  phone_number: string;
};

export type ConfirmPhoneVerificationPayload = {
  token?: string;
  otp_code: string;
  challenge_reference?: string;
};

// ====================================================================
// Helpers for tenant-header strategy
// ====================================================================

/**
 * Returns axios request options with an explicit X-Tenant-Code header (or an
 * explicit empty string to *suppress* the auto-injected one for SaaS calls).
 *
 *  - `tenantCode = "STNICHOLAS"` → header sent as `STNICHOLAS`
 *  - `tenantCode = ""`           → header explicitly suppressed (SaaS flow)
 *  - `tenantCode = undefined`    → no override; api-client interceptor decides
 *                                  based on subdomain / localStorage
 */
function tenantHeader(tenantCode?: string) {
  if (tenantCode === undefined) return {};
  return { headers: { "X-Tenant-Code": tenantCode } };
}

// ====================================================================
// Endpoints
// ====================================================================

/**
 * Sign in with username/email + password.
 *
 *  - Tenant users: pass the tenant code (or leave undefined to let the
 *    subdomain resolver pick it up automatically). The X-Tenant-Code header
 *    is required on the backend.
 *  - SaaS administrators: pass `tenantCode = ""` to explicitly send no header
 *    (the api-client would otherwise auto-attach the localStorage / subdomain
 *    value).
 */
export async function login(
  payload: LoginPayload,
  tenantCode?: string,
): Promise<LoginResponse> {
  const response = await apiClient.post<LoginResponse>(
    "/auth/login",
    payload,
    tenantHeader(tenantCode),
  );
  return response.data;
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<RefreshTokenResponse> {
  const response = await apiClient.post<RefreshTokenResponse>("/auth/refresh", {
    refresh_token: refreshToken,
  } satisfies RefreshTokenPayload);
  return response.data;
}

/** SaaS admins use this to issue a tenant-scoped access token for support work. */
export async function impersonateTenant(
  tenantCode: string,
): Promise<ImpersonateResponse> {
  const response = await apiClient.post<ImpersonateResponse>(
    "/auth/impersonate",
    { tenant_code: tenantCode } satisfies ImpersonatePayload,
    // Send the SaaS admin's token without a competing tenant header
    tenantHeader(""),
  );
  return response.data;
}

export async function logout(
  refreshToken: string,
  allSessions = false,
): Promise<LogoutResponse> {
  const response = await apiClient.post<LogoutResponse>("/auth/logout", {
    refresh_token: refreshToken,
    all_sessions: allSessions,
  } satisfies LogoutPayload);
  return response.data;
}

export async function getAuthenticatedUser(): Promise<User> {
  const response = await apiClient.get<GetMeResponse | User>("/auth/me");
  const data = response.data as any;
  // Some deployments return { user: {...} }, others the bare user
  return (data?.user ?? data) as User;
}

export async function getAuthenticatedSession(): Promise<{
  user: User;
  session?: Session;
}> {
  const response = await apiClient.get<GetMeResponse>("/auth/me");
  const data = response.data as any;
  return {
    user: (data?.user ?? data) as User,
    session: data?.session,
  };
}

// ---------- Password lifecycle ----------

export async function changePassword(
  payload: ChangePasswordPayload,
): Promise<GenericAuthResponse> {
  const response = await apiClient.post<GenericAuthResponse>(
    "/auth/change-password",
    payload,
  );
  return response.data;
}

export async function forgotPassword(
  payload: ForgotPasswordPayload,
  tenantCode?: string,
): Promise<GenericAuthResponse> {
  const response = await apiClient.post<GenericAuthResponse>(
    "/auth/forgot-password",
    payload,
    tenantHeader(tenantCode),
  );
  return response.data;
}

export async function resetPassword(
  payload: ResetPasswordPayload,
  tenantCode?: string,
): Promise<GenericAuthResponse> {
  const response = await apiClient.post<GenericAuthResponse>(
    "/auth/reset-password",
    payload,
    tenantHeader(tenantCode),
  );
  return response.data;
}

// ---------- OTP ----------

export async function verifyOtp(
  payload: VerifyOtpPayload,
  tenantCode?: string,
): Promise<OtpResult> {
  const response = await apiClient.post<OtpResult>(
    "/auth/otp/verify",
    payload,
    tenantHeader(tenantCode),
  );
  return response.data;
}

export async function resendOtp(
  payload: ResendOtpPayload,
  tenantCode?: string,
): Promise<ResendOtpResponse> {
  const response = await apiClient.post<ResendOtpResponse>(
    "/auth/otp/resend",
    payload,
    tenantHeader(tenantCode),
  );
  return response.data;
}

// ---------- Two-Factor ----------

export async function setupTwoFactor(
  payload: SetupTwoFactorPayload,
): Promise<SetupTwoFactorResponse> {
  const response = await apiClient.post<SetupTwoFactorResponse>(
    "/auth/two-factor/setup",
    payload,
  );
  return response.data;
}

export async function verifyTwoFactor(
  payload: VerifyTwoFactorPayload,
  tenantCode?: string,
): Promise<OtpResult> {
  const response = await apiClient.post<OtpResult>(
    "/auth/two-factor/verify",
    payload,
    tenantHeader(tenantCode),
  );
  return response.data;
}

// ---------- Email / Phone verification ----------

export async function requestEmailVerification(
  payload: RequestEmailVerificationPayload,
): Promise<ResendOtpResponse> {
  const response = await apiClient.post<ResendOtpResponse>(
    "/auth/email-verification/request",
    payload,
  );
  return response.data;
}

export async function confirmEmailVerification(
  payload: ConfirmEmailVerificationPayload,
): Promise<GenericAuthResponse> {
  const response = await apiClient.post<GenericAuthResponse>(
    "/auth/email-verification/confirm",
    payload,
  );
  return response.data;
}

export async function requestPhoneVerification(
  payload: RequestPhoneVerificationPayload,
): Promise<ResendOtpResponse> {
  const response = await apiClient.post<ResendOtpResponse>(
    "/auth/phone-verification/request",
    payload,
  );
  return response.data;
}

export async function confirmPhoneVerification(
  payload: ConfirmPhoneVerificationPayload,
): Promise<GenericAuthResponse> {
  const response = await apiClient.post<GenericAuthResponse>(
    "/auth/phone-verification/confirm",
    payload,
  );
  return response.data;
}
