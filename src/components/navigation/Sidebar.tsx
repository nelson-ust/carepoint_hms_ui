import { NavLink } from "react-router-dom";
import { appModules } from "@/config/module-registry";
import { ShieldCheck, ChevronRight, LogOut, Settings as SettingsIcon, User } from "lucide-react";
import { localStorageService, storageKeys } from "@/lib/storage/local-storage";
import { useNavigate } from "react-router-dom";
import { routes } from "@/config/routes";
import { useUI } from "@/app/providers/UIProvider";

export function Sidebar() {
  const { isSidebarCollapsed } = useUI();
  const navigate = useNavigate();
  const userStr = localStorageService.get(storageKeys.user);
  const user = userStr ? JSON.parse(userStr) : null;
  const isSaaSAdmin = user?.username === "superadmin@carepointhms.com" || user?.is_saas_admin;
  // const isSaaSAdmin = true;


  const categories = isSaaSAdmin ? (["SaaS"] as const) : (["Core", "Clinical", "Financial", "Administrative"] as const);

  const handleLogout = () => {
    localStorageService.clearAuth();
    navigate(routes.login);
  };

  return (
    <aside className={`hidden lg:fixed lg:inset-y-0 lg:flex lg:flex-col bg-secondary-900 border-r border-white transition-all duration-300 z-50 ${isSidebarCollapsed ? "lg:w-24" : "lg:w-72"}`}>
      {/* Brand Logo */}
      <div className={`px-8 py-10 flex items-center gap-3 ${isSidebarCollapsed ? "justify-center px-0" : ""}`}>
        <div className="h-12 w-12 shrink-0 rounded-2xl bg-primary-500 flex items-center justify-center shadow-lg shadow-primary-500/20 ring-4 ring-primary-500/10">
          <ShieldCheck className="h-7 w-7 text-white" />
        </div>
        {!isSidebarCollapsed && (
          <div className="animate-in fade-in duration-500">
            <h1 className="text-xl font-bold text-white tracking-tight leading-tight">Carepoint</h1>
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-primary-400">
              {isSaaSAdmin ? "Platform Admin" : "HMS Suite"}
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-4 pb-4 space-y-8 scrollbar-hide">
        {categories.map((category) => {
          const modules = appModules.filter((m) => m.category === category);
          if (modules.length === 0) return null;

          return (
            <div key={category} className="space-y-2">
              {!isSidebarCollapsed && (
                <h2 className="px-4 text-[11px] font-bold uppercase tracking-[0.15em] text-secondary-500 animate-in fade-in slide-in-from-left-2">
                  {category}
                </h2>
              )}
              <div className="space-y-1">
                {modules.map((module) => (
                  <NavLink
                    key={module.code}
                    to={module.path}
                    className={({ isActive }) =>
                      `sidebar-link group flex items-center gap-3 transition-all ${isActive
                        ? "bg-primary-500 text-white shadow-lg shadow-primary-500/20"
                        : "text-secondary-400 hover:bg-white/5 hover:text-white"
                      } ${isSidebarCollapsed ? "justify-center px-0 h-12 w-12 mx-auto rounded-2xl" : ""}`
                    }
                    title={isSidebarCollapsed ? module.label : ""}
                  >
                    <module.icon className={`h-5 w-5 shrink-0 transition-transform group-hover:scale-110 ${isSidebarCollapsed ? "" : ""}`} />
                    {!isSidebarCollapsed && <span className="flex-1 animate-in fade-in slide-in-from-left-2">{module.label}</span>}
                    {!isSidebarCollapsed && (
                      <ChevronRight className={`h-4 w-4 transition-all ${({ isActive }: any) => isActive ? "opacity-100" : "opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0"
                        }`} />
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Footer / User Profile */}
      <div className={`p-4 mt-auto border-t border-white/5 space-y-4 bg-secondary-950/30 ${isSidebarCollapsed ? "px-2" : ""}`}>
        <div className={`flex items-center gap-3 px-3 py-2 ${isSidebarCollapsed ? "justify-center px-0" : ""}`}>
          <div className="h-10 w-10 shrink-0 rounded-xl bg-secondary-800 flex items-center justify-center text-secondary-400 border border-white/10">
            <User className="h-5 w-5" />
          </div>
          {!isSidebarCollapsed && (
            <div className="flex-1 min-w-0 animate-in fade-in slide-in-from-left-2">
              <p className="text-sm font-bold text-white truncate">{user?.email || "User"}</p>
              <p className="text-xs text-secondary-500 truncate font-medium">
                {isSaaSAdmin ? "Global SaaS Administrator" : user?.status || "Staff"}
              </p>
            </div>
          )}
        </div>

        <div className={`grid gap-2 ${isSidebarCollapsed ? "grid-cols-1" : "grid-cols-2"}`}>
          <button
            className="flex items-center justify-center gap-2 rounded-xl bg-white/5 py-2.5 text-xs font-bold text-secondary-300 hover:bg-white/10 hover:text-white transition-all"
            title={isSidebarCollapsed ? "System Setup" : ""}
          >
            <SettingsIcon className="h-4 w-4" />
            {!isSidebarCollapsed && <span>Setup</span>}
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 rounded-xl bg-rose-500/10 py-2.5 text-xs font-bold text-rose-400 hover:bg-rose-500/20 transition-all"
            title={isSidebarCollapsed ? "Sign Out" : ""}
          >
            <LogOut className="h-4 w-4" />
            {!isSidebarCollapsed && <span>Exit</span>}
          </button>
        </div>
      </div>
    </aside>
  );
}


