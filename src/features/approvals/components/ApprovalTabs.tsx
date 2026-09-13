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
    <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl bg-white/40 border border-secondary-400/40 w-fit dark:bg-secondary-950/40 dark:border-white/10">
      {tabs.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end}
          className={({ isActive }) => cn(
            "flex items-center gap-2 px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all",
            isActive ? "bg-secondary-900 text-white shadow-lg" : "text-secondary-500 hover:text-secondary-900 dark:hover:text-secondary-100")}>
          <Icon className="h-4 w-4" /> {label}
        </NavLink>
      ))}
    </div>
  );
}
