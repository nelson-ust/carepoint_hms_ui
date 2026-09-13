import type { ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { getPortalToken } from "./api/portal.api";

/**
 * Guards patient-portal routes: when no portal token is stored under
 * `carepoint.portal_token`, redirect to /portal/login. Works either as a
 * wrapper (`<ProtectedPortalRoute><PortalLayout/></ProtectedPortalRoute>`)
 * or as a layout route rendering an `<Outlet/>`.
 */
export function ProtectedPortalRoute({ children }: { children?: ReactNode }) {
  const location = useLocation();

  if (!getPortalToken()) {
    return (
      <Navigate
        to="/portal/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  return children ? <>{children}</> : <Outlet />;
}
