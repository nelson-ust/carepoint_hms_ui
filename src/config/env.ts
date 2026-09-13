export const env = {
  appName: import.meta.env.VITE_APP_NAME ?? "Carepoint HMS",
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8005/api/v1",
  defaultTenantCode: import.meta.env.VITE_DEFAULT_TENANT_CODE ?? "",
  enableApiMocking: import.meta.env.VITE_ENABLE_API_MOCKING === "true",
  /** "saas" (default) or "dedicated" — single-hospital install: platform
   * (SaaS) modules are hidden and licence notices are shown. The backend
   * enforces the same via DEPLOYMENT_MODE; this flag only adapts the UI. */
  deploymentMode: (import.meta.env.VITE_DEPLOYMENT_MODE ?? "saas") as "saas" | "dedicated",
} as const;

export const isDedicatedDeployment = env.deploymentMode === "dedicated";
