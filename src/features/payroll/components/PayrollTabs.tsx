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
 * Shared sub-navigation across the payroll area — a flat DevExpress-style
 * tab strip with an accent underline on the active screen, so every payroll
 * page reads as one console.
 */
export function PayrollTabs() {
  return (
    <div className="w-full overflow-x-auto border-b border-[var(--dx-border)]">
      <div className="flex min-w-max items-center gap-1">
        {tabs.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-[12px] font-semibold transition-colors",
                isActive
                  ? "border-[var(--dx-accent)] text-[var(--dx-accent)]"
                  : "border-transparent text-[var(--dx-text-muted)] hover:text-[var(--dx-text)]",
              )
            }
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </NavLink>
        ))}
      </div>
    </div>
  );
}
