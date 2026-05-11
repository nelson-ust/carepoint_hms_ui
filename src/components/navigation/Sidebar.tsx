import { NavLink } from "react-router-dom";
import { appModules } from "@/config/module-registry";
import { ShieldCheck, ChevronRight, LogOut, Settings as SettingsIcon, User } from "lucide-react";
import { localStorageService } from "@/lib/storage/local-storage";
import { useNavigate } from "react-router-dom";
import { routes } from "@/config/routes";

export function Sidebar() {
  const navigate = useNavigate();
  const categories = ["Core", "Clinical", "Financial", "Administrative", "SaaS"] as const;

  const handleLogout = () => {
    localStorageService.clearAuth();
    navigate(routes.login);
  };

  return (
    <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-72 lg:flex-col bg-secondary-900 border-r border-white/5">
      {/* Brand Logo */}
      <div className="px-8 py-10 flex items-center gap-3">
        <div className="h-12 w-12 rounded-2xl bg-primary-500 flex items-center justify-center shadow-lg shadow-primary-500/20 ring-4 ring-primary-500/10">
          <ShieldCheck className="h-7 w-7 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight leading-tight">Carepoint</h1>
          <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-primary-400">HMS Suite</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-4 pb-4 space-y-8 scrollbar-hide">
        {categories.map((category) => {
          const modules = appModules.filter((m) => m.category === category);
          if (modules.length === 0) return null;

          return (
            <div key={category} className="space-y-2">
              <h2 className="px-4 text-[11px] font-bold uppercase tracking-[0.15em] text-secondary-500">
                {category}
              </h2>
              <div className="space-y-1">
                {modules.map((module) => (
                  <NavLink
                    key={module.code}
                    to={module.path}
                    className={({ isActive }) =>
                      `sidebar-link group ${
                        isActive 
                          ? "bg-primary-500 text-white shadow-lg shadow-primary-500/20" 
                          : "text-secondary-400 hover:bg-white/5 hover:text-white"
                      }`
                    }
                  >
                    <module.icon className="h-5 w-5 shrink-0 transition-transform group-hover:scale-110" />
                    <span className="flex-1">{module.label}</span>
                    <ChevronRight className={`h-4 w-4 transition-all ${
                      ({ isActive }: any) => isActive ? "opacity-100" : "opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0"
                    }`} />
                  </NavLink>
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Footer / User Profile */}
      <div className="p-4 mt-auto border-t border-white/5 space-y-4 bg-secondary-950/30">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="h-10 w-10 rounded-xl bg-secondary-800 flex items-center justify-center text-secondary-400 border border-white/10">
            <User className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate">Dr. Nelson Attah</p>
            <p className="text-xs text-secondary-500 truncate font-medium">Chief Medical Officer</p>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          <button className="flex items-center justify-center gap-2 rounded-xl bg-white/5 py-2.5 text-xs font-bold text-secondary-300 hover:bg-white/10 hover:text-white transition-all">
            <SettingsIcon className="h-4 w-4" />
            <span>Setup</span>
          </button>
          <button 
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 rounded-xl bg-rose-500/10 py-2.5 text-xs font-bold text-rose-400 hover:bg-rose-500/20 transition-all"
          >
            <LogOut className="h-4 w-4" />
            <span>Exit</span>
          </button>
        </div>
      </div>
    </aside>
  );
}


