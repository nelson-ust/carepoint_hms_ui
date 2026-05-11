import { Outlet } from "react-router-dom";
import { Sidebar } from "@/components/navigation/Sidebar";
import { Topbar } from "@/components/navigation/Topbar";

export function DashboardLayout() {
  return (
    <div className="min-h-screen bg-brand-gray selection:bg-primary-100 selection:text-primary-900">
      <Sidebar />
      <div className="lg:pl-72 flex flex-col min-h-screen">
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

