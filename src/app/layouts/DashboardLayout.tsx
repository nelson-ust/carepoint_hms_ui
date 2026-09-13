import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "@/components/navigation/Sidebar";
import { Topbar } from "@/components/navigation/Topbar";
import { ModuleLocked } from "@/components/layout/ModuleLocked";
import { useUI } from "@/app/providers/UIProvider";
import { useMyModules } from "@/lib/modules/useMyModules";
import { moduleForPath } from "@/config/module-registry";
import { ThemeSync } from "@/lib/theme/ThemeSync";
import { isDedicatedDeployment } from "@/config/env";
import { useDeploymentInfo } from "@/lib/deployment/useDeploymentInfo";

export function DashboardLayout() {
  const { isSidebarCollapsed } = useUI();
  const location = useLocation();
  const { isEnabled, known, isSaaSAdmin } = useMyModules();
  const deployment = useDeploymentInfo();

  // Subscription gate: when we definitively know the tenant's modules and the
  // current route belongs to a module outside the plan, show the locked state
  // instead of the page. SaaS admins and ungated (core) routes always pass.
  // Dedicated installs have no subscription plan — nothing is ever locked;
  // access is governed by the annual licence (banner below + backend gate).
  const requiredModule = moduleForPath(location.pathname);
  const locked = !isDedicatedDeployment && !isSaaSAdmin && known &&
    requiredModule !== null && !isEnabled(requiredModule);
  const licenseNotice = deployment.data?.license?.message ?? null;
  const licenseUrgent = Boolean(deployment.data?.license?.in_grace || deployment.data?.license?.blocked);

  return (
    <div className="min-h-screen ambient-bg bg-brand-gray selection:bg-primary-100 selection:text-primary-900 dark:bg-secondary-950 transition-colors duration-500">
      <ThemeSync />
      <Sidebar />
      <div className={`flex flex-col min-h-screen transition-all duration-300 ${isSidebarCollapsed ? "lg:pl-24" : "lg:pl-72"} print:!pl-0`}>
        <Topbar />
        <main className="flex-1 p-6 md:p-10 animate-fade-in overflow-x-hidden print:p-0">
          <div className="mx-auto max-w-7xl">
            {licenseNotice && (
              <div
                role="status"
                className={`mb-6 rounded-xl border px-4 py-3 text-sm font-medium ${
                  licenseUrgent
                    ? "border-danger-300 bg-danger-50 text-danger-800"
                    : "border-warning-300 bg-warning-50 text-warning-800"
                }`}
              >
                {licenseNotice}
              </div>
            )}
            {locked ? <ModuleLocked moduleName={requiredModule as string} /> : <Outlet />}
          </div>
        </main>

        <footer className="px-6 py-6 border-t border-secondary-200/60 dark:border-white/5 bg-white/40 dark:bg-secondary-950/40 backdrop-blur-sm text-center">
          <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-secondary-400">
            Carepoint HMS © 2026 • Enterprise Health Management Systems
          </p>
        </footer>
      </div>
    </div>
  );
}
