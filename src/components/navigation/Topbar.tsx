import { resolveTenantCode } from "@/lib/tenant/tenant-resolver";
import { Sun, Moon, PanelLeftClose, PanelLeft, Building2 } from "lucide-react";
import { NotificationsBell } from "@/features/notifications/components/NotificationsBell";
import { useNavigate, useLocation } from "react-router-dom";
import { routes } from "@/config/routes";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useQuery } from "@tanstack/react-query";
import { getMyProfile } from "@/features/users/api/users.api";
import { profileKeys } from "@/features/users/hooks/use-profile";
import { isSaaSAdmin } from "@/lib/auth/current-user";
import { useUI } from "@/app/providers/UIProvider";
import { appModules } from "@/config/module-registry";

const ROUTE_TITLES: Record<string, string> = {
  "/": "Operations Overview",
  "/dashboard": "Operations Overview",
  "/patients": "Patient Registry",
  "/patients/register": "Patient Registration",
  "/visits": "Clinical Visits",
  "/visits/initiate": "Visit Initiation",
  "/service-desk": "Service Desk",
  "/queues": "Patient Queue",
  "/billing": "Billing",
  "/inventory": "Stock Inventory",
  "/staff": "Human Resources",
  "/settings": "System Configuration",
  "/laboratory": "Laboratory",
  "/pharmacy": "Pharmacy",
  "/clinical/triage": "Triage",
  "/clinical/consultation": "Consultation",
  "/insurance/eligibility": "Eligibility Confirmation",
};

function pageTitleFor(pathname: string): string {
  if (ROUTE_TITLES[pathname]) return ROUTE_TITLES[pathname];
  // Longest matching prefix in the explicit map (handles /clinical/triage/42).
  const prefix = Object.keys(ROUTE_TITLES)
    .filter((p) => p !== "/" && pathname.startsWith(p + "/"))
    .sort((a, b) => b.length - a.length)[0];
  if (prefix) return ROUTE_TITLES[prefix];
  // Then the module registry.
  const mod = appModules
    .filter((m) => pathname === m.path || pathname.startsWith(m.path + "/"))
    .sort((a, b) => b.path.length - a.path.length)[0];
  if (mod) return mod.label;
  const segment = pathname.split("/").filter(Boolean).pop() || "";
  return segment
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Slim command bar: sidebar toggle, current page title, workspace, theme, alerts, profile. */
export function Topbar() {
  const tenant = resolveTenantCode();
  const navigate = useNavigate();
  const location = useLocation();
  const initials = (() => {
    try {
      const u = JSON.parse(localStorage.getItem("carepoint.user") || "null");
      const name: string = u?.full_name || u?.first_name || u?.email || u?.username || "";
      const parts = String(name).replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
      return (parts.length >= 2 ? parts[0][0] + parts[1][0] : (parts[0] || "U").slice(0, 2)).toUpperCase();
    } catch {
      return "U";
    }
  })();
  // Presigned profile photo — same cache key as the My Profile page, so an
  // upload there refreshes this chip instantly. SaaS admins are master-DB
  // principals with no tenant /users/me, so we skip the fetch for them.
  const myProfile = useQuery({
    queryKey: profileKeys.me(),
    queryFn: getMyProfile,
    enabled: !isSaaSAdmin(),
    staleTime: 5 * 60_000,
    retry: false,
  });
  const photoUrl = myProfile.data?.profile_photo_display_url || null;

  const { theme, toggleTheme } = useTheme();
  const { isSidebarCollapsed, toggleSidebar } = useUI();
  const isDark = theme === "dark";

  return (
    <header className="dx-topbar sticky top-0 z-20 print:hidden">
      <div className="flex h-12 items-center justify-between gap-4 px-3 md:px-4">
        {/* Left: sidebar toggle + page title */}
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={toggleSidebar}
            className="dx-icon-btn"
            title={isSidebarCollapsed ? "Expand navigation" : "Collapse navigation"}
            aria-label={isSidebarCollapsed ? "Expand navigation" : "Collapse navigation"}
          >
            {isSidebarCollapsed ? <PanelLeft /> : <PanelLeftClose />}
          </button>
          <span className="dx-divider hidden h-5 w-px sm:block" aria-hidden />
          <h2 className="dx-topbar-title truncate">{pageTitleFor(location.pathname)}</h2>
        </div>

        {/* Right: workspace, theme, notifications, profile */}
        <div className="flex items-center gap-1">
          <span
            className="dx-badge dx-badge-outline mr-2 hidden h-6 gap-1.5 px-2 sm:inline-flex"
            title="Active workspace"
          >
            <Building2 aria-hidden />
            {tenant || "Global Platform"}
          </span>

          <button
            type="button"
            onClick={toggleTheme}
            aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
            title={isDark ? "Switch to light theme" : "Switch to dark theme"}
            className="dx-icon-btn"
          >
            {isDark ? <Sun /> : <Moon />}
          </button>
          <NotificationsBell />

          <button
            type="button"
            onClick={() => navigate(routes.profile)}
            title="My Profile"
            className="dx-avatar ml-1 overflow-hidden"
          >
            {photoUrl ? <img src={photoUrl} alt="My profile" className="h-full w-full object-cover" /> : initials}
          </button>
        </div>
      </div>
    </header>
  );
}
