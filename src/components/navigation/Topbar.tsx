import { resolveTenantCode } from "@/lib/tenant/tenant-resolver";
import { Search, Bell, Menu, HelpCircle, LayoutGrid, Sun, Moon } from "lucide-react";
import { useTheme } from "@/lib/theme/ThemeProvider";

export function Topbar() {
  const tenant = resolveTenantCode();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <header className="sticky top-0 z-20 border-b border-secondary-200 bg-white/80 backdrop-blur-xl dark:bg-secondary-900/70 dark:border-white/10">
      <div className="flex h-18 items-center justify-between px-6">
        {/* Left: Mobile Menu & Search */}
        <div className="flex items-center gap-6 flex-1">
          <button className="lg:hidden p-2 hover:bg-secondary-100 rounded-xl transition-colors dark:hover:bg-white/5">
            <Menu className="h-6 w-6 text-secondary-600 dark:text-secondary-300" />
          </button>

          <div className="hidden md:flex relative max-w-md w-full group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary-400 group-focus-within:text-primary-500 transition-colors" />
            <input
              type="text"
              placeholder="Search patients, files, or records..."
              className="w-full bg-secondary-50 border-transparent focus:bg-white focus:border-primary-500/20 focus:ring-4 focus:ring-primary-500/5 rounded-2xl py-2.5 pl-11 pr-4 text-sm transition-all dark:bg-secondary-800 dark:focus:bg-secondary-900 dark:text-secondary-100 dark:placeholder:text-secondary-500"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded-md border border-secondary-200 bg-white text-[10px] font-bold text-secondary-400 dark:bg-secondary-900 dark:border-white/10 dark:text-secondary-500">
              ⌘K
            </div>
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
                className={`h-5 w-5 transition-all duration-300 ${
                  isDark ? "scale-0 rotate-90 opacity-0" : "scale-100 rotate-0 opacity-100"
                }`}
              />
              <Moon
                className={`h-5 w-5 absolute inset-0 m-auto transition-all duration-300 ${
                  isDark ? "scale-100 rotate-0 opacity-100" : "scale-0 -rotate-90 opacity-0"
                }`}
              />
            </button>
            <button className="p-2.5 text-secondary-500 hover:text-primary-600 hover:bg-primary-50 rounded-xl transition-all relative dark:text-secondary-300 dark:hover:bg-white/5 dark:hover:text-primary-300">
              <Bell className="h-5 w-5" />
              <span className="absolute top-2.5 right-2.5 h-2 w-2 bg-rose-500 rounded-full border-2 border-white dark:border-secondary-900" />
            </button>
            <button className="p-2.5 text-secondary-500 hover:text-secondary-900 hover:bg-secondary-100 rounded-xl transition-all dark:text-secondary-300 dark:hover:bg-white/5 dark:hover:text-secondary-100">
              <HelpCircle className="h-5 w-5" />
            </button>
            <button className="p-2.5 text-secondary-500 hover:text-secondary-900 hover:bg-secondary-100 rounded-xl transition-all dark:text-secondary-300 dark:hover:bg-white/5 dark:hover:text-secondary-100">
              <LayoutGrid className="h-5 w-5" />
            </button>
          </div>

          <div className="h-10 w-10 ml-2 rounded-2xl bg-secondary-900 ring-4 ring-secondary-900/5 flex items-center justify-center text-white text-xs font-bold shadow-lg shadow-secondary-900/10 dark:bg-primary-500 dark:ring-primary-500/15">
            NA
          </div>
        </div>
      </div>
    </header>
  );
}
