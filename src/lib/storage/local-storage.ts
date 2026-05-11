export const storageKeys = {
  accessToken: "carepoint.access_token",
  refreshToken: "carepoint.refresh_token",
  tenantCode: "carepoint.tenant_code",
  user: "carepoint.user",
  theme: "carepoint.theme",
} as const;

export const localStorageService = {
  get(key: string): string | null {
    return window.localStorage.getItem(key);
  },

  set(key: string, value: string): void {
    window.localStorage.setItem(key, value);
  },

  remove(key: string): void {
    window.localStorage.removeItem(key);
  },

  clearAuth(): void {
    window.localStorage.removeItem(storageKeys.accessToken);
    window.localStorage.removeItem(storageKeys.refreshToken);
    window.localStorage.removeItem(storageKeys.user);
  },
};
