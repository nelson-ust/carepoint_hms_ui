import { NavLink } from "react-router-dom";
import { Banknote, Building2, Puzzle, Tags, Wallet } from "lucide-react";
import { routes } from "@/config/routes";
import { cn } from "@/lib/utils/cn";

const tabs = [
  { to: routes.payroll, label: "Payroll Runs", icon: Banknote, end: true },
  { to: routes.payrollSalary, label: "Salary Mapping", icon: Wallet, end: false },
  { to: routes.payrollComponents, label: "Pay Components", icon: Puzzle, end: false },
  { to: routes.payrollPensionProviders, label: "Pension Providers", icon: Building2, end: false },
  { to: routes.payrollLookups, label: "Lookups", icon: Tags, end: false },
];

/**
 * Shared sub-navigation across the payroll area — a "command rail":
 * dark glass strip with a scanline sheen, gradient-glow active pill and a
 * live status dot, so every payroll screen reads as one console.
 */
export function PayrollTabs() {
  return (
    <div className="relative w-fit max-w-full overflow-x-auto rounded-2xl p-[1px] bg-gradient-to-r from-primary-500/60 via-cyan-400/40 to-primary-500/60 shadow-[0_0_24px_-8px_rgba(6,182,212,0.45)]">
      <div className="relative flex items-center gap-1 rounded-2xl bg-secondary-950/95 px-1.5 py-1.5 backdrop-blur-xl">
        {/* scanline sheen */}
        <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[linear-gradient(115deg,transparent_20%,rgba(255,255,255,0.06)_40%,transparent_60%)]" />
        {tabs.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "relative flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.18em] transition-all duration-200",
                isActive
                  ? "bg-gradient-to-r from-primary-500 to-cyan-500 text-white shadow-[0_0_18px_-2px_rgba(6,182,212,0.7)]"
                  : "text-secondary-400 hover:text-white hover:bg-white/5",
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon className="h-3.5 w-3.5" />
                {label}
                {isActive && (
                  <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_6px_2px_rgba(255,255,255,0.6)] animate-pulse" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </div>
  );
}
