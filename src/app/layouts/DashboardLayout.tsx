import { Outlet } from "react-router-dom";
import { Sidebar } from "@/components/navigation/Sidebar";
import { Topbar } from "@/components/navigation/Topbar";
import { useUI } from "@/app/providers/UIProvider";

export function DashboardLayout() {
  const { isSidebarCollapsed } = useUI();

  return (
    <div className="min-h-screen bg-brand-gray selection:bg-primary-100 selection:text-primary-900 dark:bg-secondary-950 transition-colors duration-500">
      <Sidebar />
      <div className={`flex flex-col min-h-screen transition-all duration-300 ${isSidebarCollapsed ? "lg:pl-24" : "lg:pl-72"}`}>
        <Topbar />
        <main className="flex-1 p-6 md:p-10 animate-fade-in overflow-x-hidden">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
        
        <footer className="px-6 py-6 border-t border-secondary-200 bg-white/50 text-center">
          <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-secondary-400">
            Carepoint HMS © 2026 • Enterprise Health Management Systems
          </p>
        </footer>
      </div>
    </div>
  );
}

