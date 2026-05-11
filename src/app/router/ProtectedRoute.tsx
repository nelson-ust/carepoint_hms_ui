import { Navigate, Outlet } from "react-router-dom";
import { routes } from "@/config/routes";
import { localStorageService, storageKeys } from "@/lib/storage/local-storage";

export function ProtectedRoute() {
  const accessToken = localStorageService.get(storageKeys.accessToken);

  if (!accessToken) {
    return <Navigate to={routes.login} replace />;
  }

  return <Outlet />;
}
