import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Inbox, CheckSquare, FileText, CheckCircle2, Clock, Undo2, PencilLine, BadgeCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeProps } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils/cn";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { getStoredUser } from "@/lib/auth/current-user";
import { ApprovalTabs } from "../components/ApprovalTabs";
import { useMyPendingApprovals, useMyApprovalRequests, useApprovalRequests } from "../hooks/use-approvals";
import type { ApprovalRequest, ApprovalRequestStatus } from "../api/approvals.api";

const statusVariant: Record<ApprovalRequestStatus, BadgeProps["variant"]> = {
  DRAFT: "secondary", PENDING: "soft-warning", IN_PROGRESS: "soft-info",
  APPROVED: "soft-success", REJECTED: "soft-danger", CANCELLED: "secondary",
  RETURNED: "soft-warning", EXPIRED: "soft-danger",
};

type Tab = "pending" | "mine" | "all";

function fmt(v?: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

// ── Category palette (validated: light + dark, CVD band legal with the
//    named legends / axis labels / 2px gaps used below) ────────────────
type CatKey = "toApprove" | "completed" | "inProgress" | "returned" | "actioned" | "draft";
const CATEGORIES: { key: CatKey; label: string; short: string; icon: any; light: string; dark: string; chip: string }[] = [
  { key: "toApprove",  label: "Requests to Approve",  short: "To Approve",  icon: BadgeCheck,  light: "#E11D48", dark: "#FB7185", chip: "bg-rose-500/10 text-rose-500" },
  { key: "completed",  label: "Completed Requests",   short: "Completed",   icon: CheckCircle2, light: "#059669", dark: "#34D399", chip: "bg-emerald-500/10 text-emerald-600" },
  { key: "inProgress", label: "Requests in Progress", short: "In Progress", icon: Clock,        light: "#3B82F6", dark: "#60A5FA", chip: "bg-blue-500/10 text-blue-500" },
  { key: "returned",   label: "Returned Requests",    short: "Returned",    icon: Undo2,        light: "#D97706", dark: "#FBBF24", chip: "bg-amber-500/10 text-amber-600" },
  { key: "actioned",   label: "Actioned Requests",    short: "Actioned",    icon: CheckSquare,  light: "#C026D3", dark: "#F0ABFC", chip: "bg-fuchsia-500/10 text-fuchsia-600" },
  { key: "draft",      label: "Draft Requests",       short: "Draft",       icon: PencilLine,   light: "#64748B", dark: "#94A3B8", chip: "bg-secondary-500/10 text-secondary-500" },
];

// ── Pie (SVG, 2px surface gaps, no text in series color) ─────────────
function PieChart({ slices, isDark }: { slices: { key: CatKey; value: number; color: string }[]; isDark: boolean }) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (total === 0) return null;
  const R = 80, C = 100;
  let angle = -Math.PI / 2;
  const paths = slices.map((sl) => {
    const frac = sl.value / total;
    const a0 = angle, a1 = angle + frac * 2 * Math.PI;
    angle = a1;
    if (frac >= 0.999) return { ...sl, d: `M ${C} ${C} m -${R},0 a ${R},${R} 0 1,0 ${R * 2},0 a ${R},${R} 0 1,0 -${R * 2},0` };
    const x0 = C + R * Math.cos(a0), y0 = C + R * Math.sin(a0);
    const x1 = C + R * Math.cos(a1), y1 = C + R * Math.sin(a1);
    const large = frac > 0.5 ? 1 : 0;
    return { ...sl, d: `M ${C} ${C} L ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1} Z` };
  });
  const surface = isDark ? "#0f172a" : "#ffffff";
  return (
    <svg viewBox="0 0 200 200" className="h-44 w-44 shrink-0" role="img" aria-label="Requests distribution">
      {paths.map((p) => {
        const cat = CATEGORIES.find((c) => c.key === p.key)!;
        return <path key={p.key} d={p.d} fill={p.color} stroke={surface} strokeWidth="2"><title>{`${cat.label}: ${p.value}`}</title></path>;
      })}
    </svg>
  );
}

export function ApprovalsListPage() {
  const [tab, setTab] = useState<Tab>("pending");
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const pending = useMyPendingApprovals();
  const mine = useMyApprovalRequests();
  const all = useApprovalRequests({ limit: 200 });

  const meId = Number((getStoredUser() as any)?.id) || -1;

  const stats: Record<CatKey, number> = useMemo(() => {
    const m = mine.data ?? [];
    const a = all.data?.items ?? [];
    return {
      toApprove: pending.data?.length ?? 0,
      completed: m.filter((r) => r.status === "APPROVED").length,
      inProgress: m.filter((r) => r.status === "IN_PROGRESS" || r.status === "PENDING").length,
      returned: m.filter((r) => r.status === "RETURNED").length,
      actioned: a.filter((r) =>
        (r.logs ?? []).some((l) => l.actor_user_id === meId && (l.action === "APPROVE" || l.action === "REJECT" || l.action === "RETURN"))
      ).length,
      draft: m.filter((r) => r.status === "DRAFT").length,
    };
  }, [pending.data, mine.data, all.data, meId]);

  const statsLoading = pending.isLoading || mine.isLoading || all.isLoading;
  const total = CATEGORIES.reduce((s, c) => s + stats[c.key], 0);
  const nonZero = CATEGORIES.filter((c) => stats[c.key] > 0);
  const maxVal = Math.max(1, ...CATEGORIES.map((c) => stats[c.key]));

  const { rows, loading } = useMemo(() => {
    if (tab === "pending") return { rows: pending.data ?? [], loading: pending.isLoading };
    if (tab === "mine") return { rows: mine.data ?? [], loading: mine.isLoading };
    return { rows: all.data?.items ?? [], loading: all.isLoading };
  }, [tab, pending.data, pending.isLoading, mine.data, mine.isLoading, all.data, all.isLoading]);

  const tabs: { key: Tab; label: string; icon: any; count?: number }[] = [
    { key: "pending", label: "Awaiting me", icon: CheckSquare, count: pending.data?.length },
    { key: "mine", label: "My requests", icon: FileText, count: mine.data?.length },
    { key: "all", label: "All", icon: Inbox },
  ];

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      <PageHeader title="All Requests" description="Your approvals, your requests, and everything you've actioned." />
      <ApprovalTabs />

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {CATEGORIES.map((c) => (
          <Card key={c.key} variant="panel" className="p-5">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-secondary-400">{c.label}</p>
              <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-xl", c.chip)}>
                <c.icon className="h-4 w-4" />
              </span>
            </div>
            {statsLoading ? (
              <Skeleton className="mt-1 h-8 w-10" />
            ) : (
              <p className="mt-1 text-3xl font-black tracking-tight text-secondary-900 dark:text-secondary-100">{stats[c.key]}</p>
            )}
            <p className="mt-1 text-xs text-secondary-400">{stats[c.key] === 0 ? "Nothing here" : " "}</p>
          </Card>
        ))}
      </div>

      {/* ── Charts ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card variant="panel" className="p-6">
          <p className="mb-5 text-[10px] font-black uppercase tracking-[0.18em] text-secondary-500">Requests Distribution</p>
          {statsLoading ? (
            <Skeleton className="h-44 w-full" />
          ) : total === 0 ? (
            <p className="py-14 text-center text-sm text-secondary-400">No requests yet — activity will appear here.</p>
          ) : (
            <div className="flex flex-wrap items-center gap-8">
              <PieChart isDark={isDark} slices={nonZero.map((c) => ({ key: c.key, value: stats[c.key], color: isDark ? c.dark : c.light }))} />
              <ul className="min-w-[14rem] flex-1 space-y-3">
                {nonZero.map((c) => (
                  <li key={c.key} className="flex items-center gap-3">
                    <span className="h-3 w-3 shrink-0 rounded" style={{ backgroundColor: isDark ? c.dark : c.light }} />
                    <span className="flex-1 text-sm text-secondary-700 dark:text-secondary-300">{c.label}</span>
                    <span className="text-sm font-black text-secondary-900 dark:text-secondary-100">{stats[c.key]}</span>
                    <span className="w-10 text-right text-xs font-bold text-secondary-400">{Math.round((stats[c.key] / total) * 100)}%</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        <Card variant="panel" className="p-6">
          <p className="mb-5 text-[10px] font-black uppercase tracking-[0.18em] text-secondary-500">Requests Breakdown</p>
          {statsLoading ? (
            <Skeleton className="h-44 w-full" />
          ) : (
            <div className="flex h-48 items-end justify-around gap-3 border-b border-secondary-100 pb-0 dark:border-white/10">
              {CATEGORIES.map((c) => {
                const v = stats[c.key];
                const h = v === 0 ? 0 : Math.max(10, Math.round((v / maxVal) * 150));
                return (
                  <div key={c.key} className="flex h-full w-full max-w-[64px] flex-col items-center justify-end gap-1.5" title={`${c.label}: ${v}`}>
                    {v > 0 && <span className="text-xs font-black text-secondary-700 dark:text-secondary-200">{v}</span>}
                    <div className="w-8 rounded-t" style={{ height: `${h}px`, backgroundColor: v === 0 ? "transparent" : (isDark ? c.dark : c.light) }} />
                    <span className="pb-2 text-center text-[8px] font-bold uppercase tracking-widest leading-tight text-secondary-400">{c.short}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* ── Request registry ── */}
      <div className="flex flex-wrap items-center gap-2">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn("flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-widest transition-all",
              tab === t.key ? "bg-primary-500/10 text-primary-600 shadow-glow-sm" : "text-secondary-500 hover:text-secondary-900")}>
            <t.icon className="h-4 w-4" /> {t.label}
            {typeof t.count === "number" && t.count > 0 && (
              <span className="ml-1 rounded-full bg-primary-500 px-2 text-[10px] text-white">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      <Card variant="panel" className="p-6">
        {loading ? (
          <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
        ) : rows.length === 0 ? (
          <EmptyState icon={Inbox} title={tab === "pending" ? "Nothing awaiting you" : "No requests"} description={tab === "pending" ? "You're all caught up." : "Requests will appear here."} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] font-black uppercase tracking-widest text-secondary-400 border-b border-secondary-100">
                  <th className="py-3 pr-4">Request</th>
                  <th className="py-3 pr-4">Type</th>
                  <th className="py-3 pr-4">Requester</th>
                  <th className="py-3 pr-4">Current step</th>
                  <th className="py-3 pr-4">Submitted</th>
                  <th className="py-3 pr-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r: ApprovalRequest) => (
                  <tr key={r.id} onClick={() => navigate(`/approvals/requests/${r.id}`)} className="border-b border-secondary-100/60 hover:bg-white/60 cursor-pointer">
                    <td className="py-3 pr-4 font-semibold text-secondary-900 max-w-xs truncate">{r.title}</td>
                    <td className="py-3 pr-4 text-secondary-500 text-xs">{r.request_type_code}</td>
                    <td className="py-3 pr-4 text-secondary-500">{r.requester_name || `#${r.requester_user_id}`}</td>
                    <td className="py-3 pr-4 text-secondary-500">{r.current_step_name || "—"}</td>
                    <td className="py-3 pr-4 text-secondary-400 text-xs">{fmt(r.submitted_at)}</td>
                    <td className="py-3 pr-4"><Badge variant={statusVariant[r.status]}>{r.status.replace("_", " ")}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
