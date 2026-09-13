import { resolveTenantCode } from "@/lib/tenant/tenant-resolver";
import { Search, HelpCircle, LayoutGrid, Sun, Moon, PanelLeftClose, PanelLeft } from "lucide-react";
import { NotificationsBell } from "@/features/notifications/components/NotificationsBell";
import { useNavigate } from "react-router-dom";
import { routes } from "@/config/routes";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useQuery } from "@tanstack/react-query";
import { getMyProfile } from "@/features/users/api/users.api";
import { profileKeys } from "@/features/users/hooks/use-profile";
import { isSaaSAdmin } from "@/lib/auth/current-user";
import { useUI } from "@/app/providers/UIProvider";
import { useLocation } from "react-router-dom";

export function Topbar() {
  const tenant = resolveTenantCode();
  const navigate = useNavigate();
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
  const location = useLocation();
  const isDark = theme === "dark";

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === "/" || path === "/dashboard") return "Operations Overview";

    // Map specific complex paths
    const routeMap: Record<string, string> = {
      "/patients": "Patient Registry",
      "/patients/register": "Patient Admission",
      "/visits": "Clinical Visits",
      "/visits/initiate": "Visit Initiation",
      "/billing": "Revenue Management",
      "/inventory": "Stock Inventory",
      "/staff": "Human Resources",
      "/settings": "System Configuration",
      "/laboratory": "Diagnostic Lab",
      "/pharmacy": "Pharmacy Dispensing",
    };

    if (routeMap[path]) return routeMap[path];

    // Fallback cleaning
    const segment = path.split("/").filter(Boolean).pop() || "";
    return segment
      .split("-")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  return (
    <header className="print:hidden sticky top-0 z-20 border-b border-secondary-200/60 bg-white/70 backdrop-blur-2xl dark:bg-secondary-950/70 dark:border-white/5">
      <div className="flex h-18 items-center justify-between p-6">
        {/* Left: Mobile Menu & Search */}
        <div className="flex items-center gap-4 flex-1">
          <button
            onClick={toggleSidebar}
            className="p-2.5 text-secondary-500 hover:text-primary-600 hover:bg-primary-50 rounded-xl transition-all dark:text-secondary-300 dark:hover:bg-white/5"
            title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isSidebarCollapsed ? <PanelLeft className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </button>

          <div className="hidden xl:flex relative max-w-xs w-full group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary-400 group-focus-within:text-primary-500 transition-colors" />
            <input
              type="text"
              placeholder="Registry Quick Search..."
              className="w-full bg-secondary-50 border-transparent focus:bg-white focus:border-primary-500/20 focus:ring-4 focus:ring-primary-500/5 rounded-2xl py-2 pr-4 pl-11 text-xs transition-all dark:bg-secondary-800 dark:focus:bg-secondary-900 dark:text-secondary-100 dark:placeholder:text-secondary-500"
            />
          </div>
        </div>

        {/* Center: Dynamic Title */}
        <div className="hidden lg:flex flex-1 justify-center">
          <div className="flex flex-col items-center">
            <h2 className="text-sm font-black text-secondary-900 dark:text-white uppercase tracking-[0.2em] animate-in fade-in slide-in-from-top-4 duration-500">
              {getPageTitle()}
            </h2>
            <div className="h-0.5 w-8 bg-primary-500 mt-1 rounded-full shadow-sm shadow-primary-500/50" />
          </div>
        </div>

        {/* Right: Tenant, Notifications, User */}
        <div className="flex items-center gap-4">
          {/* Workspace Switcher / Info */}
          <div className="hidden sm:flex flex-col items-end mr-4 pr-4 border-r border-secondary-200 dark:border-white/10">
            <span className="text-[10px] uppercase tracking-widest font-bold text-secondary-400">
              Active Workspace
            </span>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary-500 animate-pulse" />
              <span className="text-sm font-bold text-secondary-900 dark:text-secondary-100">
                {tenant || "Global Platform"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={toggleTheme}
              aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
              title={isDark ? "Switch to light theme" : "Switch to dark theme"}
              className="relative p-2.5 text-secondary-500 hover:text-primary-600 hover:bg-primary-50 rounded-xl transition-all dark:text-secondary-300 dark:hover:bg-white/5 dark:hover:text-primary-300"
            >
              <Sun
                className={`h-5 w-5 transition-all duration-300 ${isDark ? "scale-0 rotate-90 opacity-0" : "scale-100 rotate-0 opacity-100"
                  }`}
              />
              <Moon
                className={`h-5 w-5 absolute inset-0 m-auto transition-all duration-300 ${isDark ? "scale-100 rotate-0 opacity-100" : "scale-0 -rotate-90 opacity-0"
                  }`}
              />
            </button>
            <NotificationsBell />
            <button className="p-2.5 text-secondary-500 hover:text-secondary-900 hover:bg-secondary-100 rounded-xl transition-all dark:text-secondary-300 dark:hover:bg-white/5 dark:hover:text-secondary-100">
              <HelpCircle className="h-5 w-5" />
            </button>
            <button className="p-2.5 text-secondary-500 hover:text-secondary-900 hover:bg-secondary-100 rounded-xl transition-all dark:text-secondary-300 dark:hover:bg-white/5 dark:hover:text-secondary-100">
              <LayoutGrid className="h-5 w-5" />
            </button>
          </div>

          <button
            onClick={() => navigate(routes.profile)}
            title="My Profile"
            className="h-10 w-10 ml-2 rounded-2xl bg-secondary-900 ring-4 ring-secondary-900/5 flex items-center justify-center text-white text-xs font-bold shadow-lg shadow-secondary-900/10 dark:bg-primary-500 dark:ring-primary-500/15 transition-transform hover:scale-105 overflow-hidden"
          >
            {photoUrl ? (
              <img src={photoUrl} alt="My profile" className="h-full w-full object-cover" />
            ) : (
              initials
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
