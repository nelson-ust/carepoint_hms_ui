import { NavLink } from "react-router-dom";
import { Inbox, GitBranch } from "lucide-react";
import { routes } from "@/config/routes";
import { cn } from "@/lib/utils/cn";

const tabs = [
  { to: routes.approvals, label: "Requests", icon: Inbox, end: true },
  { to: routes.approvalFlows, label: "Flows & Types", icon: GitBranch, end: false },
];

export function ApprovalTabs() {
  return (
    <div className="dx flex w-fit flex-wrap items-center gap-1 rounded-md border border-[var(--dx-border)] bg-[var(--dx-surface)] p-1">
      {tabs.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-2 rounded px-4 py-2 text-[12px] font-semibold transition-colors",
              isActive
                ? "bg-[var(--dx-accent)] text-white"
                : "text-[var(--dx-text-muted)] hover:bg-[var(--dx-surface-alt)] hover:text-[var(--dx-text)]",
            )
          }
        >
          <Icon className="h-4 w-4" /> {label}
        </NavLink>
      ))}
    </div>
  );
}
