import { Navigate } from "react-router-dom";
import { routes } from "@/config/routes";
import { localStorageService, storageKeys } from "@/lib/storage/local-storage";

export function DashboardRedirect() {
  const userStr = localStorageService.get(storageKeys.user);
  const user = userStr ? JSON.parse(userStr) : null;
  
  // Logic to identify SaaS Admin
  const isSaaSAdmin = user?.username === "superadmin@carepointhms.com" || user?.is_saas_admin;

  if (isSaaSAdmin) {
    return <Navigate to={routes.saasDashboard} replace />;
  }

  return <Navigate to={routes.dashboard} replace />;
}
