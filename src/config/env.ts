export const env = {
  appName: import.meta.env.VITE_APP_NAME ?? "Carepoint HMS",
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8005/api/v1",
  defaultTenantCode: import.meta.env.VITE_DEFAULT_TENANT_CODE ?? "",
  enableApiMocking: import.meta.env.VITE_ENABLE_API_MOCKING === "true",
} as const;
