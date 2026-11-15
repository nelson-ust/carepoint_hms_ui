import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "@/components/navigation/Sidebar";
import { Topbar } from "@/components/navigation/Topbar";
import { ModuleLocked } from "@/components/layout/ModuleLocked";
import { OfflineBanner } from "@/components/layout/OfflineBanner";
import { useUI } from "@/app/providers/UIProvider";
import { useMyModules } from "@/lib/modules/useMyModules";
import { moduleForPath } from "@/config/module-registry";
import { ThemeSync } from "@/lib/theme/ThemeSync";
import { isDedicatedDeployment } from "@/config/env";
import { useDeploymentInfo } from "@/lib/deployment/useDeploymentInfo";

/**
 * Application shell — flat enterprise chrome (DevExpress-inspired): a
 * fixed-width navigation rail on the left, a slim command bar on top and a
 * neutral canvas for page content. Every module renders inside this frame.
 */
export function DashboardLayout() {
  const { isSidebarCollapsed, sidebarWidth } = useUI();
  const location = useLocation();
  const { isEnabled, known, isSaaSAdmin } = useMyModules();
  const deployment = useDeploymentInfo();

  // Subscription gate: when we definitively know the tenant's modules and the
  // current route belongs to a module outside the plan, show the locked state
  // instead of the page. SaaS admins and ungated (core) routes always pass.
  // Dedicated installs have no subscription plan — nothing is ever locked;
  // access is governed by the annual licence (banner below + backend gate).
  const requiredModule = moduleForPath(location.pathname);
  const locked =
    !isDedicatedDeployment && !isSaaSAdmin && known && requiredModule !== null && !isEnabled(requiredModule);
  const licenseNotice = deployment.data?.license?.message ?? null;
  const licenseUrgent = Boolean(deployment.data?.license?.in_grace || deployment.data?.license?.blocked);

  return (
    <div className="dx dx-shell min-h-screen transition-colors duration-200">
      <ThemeSync />
      <Sidebar />
      <div
        className="flex min-h-screen flex-col transition-[padding] duration-200 lg:pl-[var(--app-sidebar-w)] print:!pl-0"
        style={{ ["--app-sidebar-w" as string]: `${isSidebarCollapsed ? 64 : sidebarWidth}px` }}
      >
        <Topbar />
        <main className="flex-1 overflow-x-hidden p-4 md:p-6 print:p-0">
          <div className="mx-auto max-w-[1600px]">
            <OfflineBanner />
            {licenseNotice && (
              <div
                role="status"
                className={`dx-msg mb-4 ${licenseUrgent ? "dx-msg-danger" : "dx-msg-warning"}`}
              >
                <span className="font-medium">{licenseNotice}</span>
              </div>
            )}
            {locked ? <ModuleLocked moduleName={requiredModule as string} /> : <Outlet />}
          </div>
        </main>

        <footer className="dx-footer px-6 py-2.5 text-center print:hidden">
          Carepoint HMS © 2026 · Enterprise Health Management Systems
        </footer>
      </div>
    </div>
  );
}
