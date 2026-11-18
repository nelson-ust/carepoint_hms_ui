import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Inbox, CheckSquare, FileText, CheckCircle2, Clock, Undo2, PencilLine, BadgeCheck } from "lucide-react";
import {
  DxPage,
  DxPageHeader,
  DxPanel,
  DxKpi,
  DxTabs,
  DxGrid,
  DxBadge,
  DxSkeleton,
  type DxGridColumn,
  type DxBadgeTone,
} from "@/components/dx";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { getStoredUser } from "@/lib/auth/current-user";
import { ApprovalTabs } from "../components/ApprovalTabs";
import { useMyPendingApprovals, useMyApprovalRequests, useApprovalRequests } from "../hooks/use-approvals";
import type { ApprovalRequest, ApprovalRequestStatus } from "../api/approvals.api";

const statusTone: Record<ApprovalRequestStatus, DxBadgeTone> = {
  DRAFT: "neutral", PENDING: "warning", IN_PROGRESS: "info",
  APPROVED: "success", REJECTED: "danger", CANCELLED: "neutral",
  RETURNED: "warning", EXPIRED: "danger",
};

type Tab = "pending" | "mine" | "all";
type KpiTone = "danger" | "success" | "info" | "warning" | "accent" | "neutral";

function fmt(v?: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

// ── Category palette (validated: light + dark, CVD band legal with the
//    named legends / axis labels / 2px gaps used below) ────────────────
type CatKey = "toApprove" | "completed" | "inProgress" | "returned" | "actioned" | "draft";
const CATEGORIES: { key: CatKey; label: string; short: string; icon: any; tone: KpiTone; light: string; dark: string }[] = [
  { key: "toApprove",  label: "Requests to Approve",  short: "To Approve",  icon: BadgeCheck,   tone: "danger",  light: "#E11D48", dark: "#FB7185" },
  { key: "completed",  label: "Completed Requests",   short: "Completed",   icon: CheckCircle2, tone: "success", light: "#059669", dark: "#34D399" },
  { key: "inProgress", label: "Requests in Progress", short: "In Progress", icon: Clock,        tone: "info",    light: "#3B82F6", dark: "#60A5FA" },
  { key: "returned",   label: "Returned Requests",    short: "Returned",    icon: Undo2,        tone: "warning", light: "#D97706", dark: "#FBBF24" },
  { key: "actioned",   label: "Actioned Requests",    short: "Actioned",    icon: CheckSquare,  tone: "accent",  light: "#C026D3", dark: "#F0ABFC" },
  { key: "draft",      label: "Draft Requests",       short: "Draft",       icon: PencilLine,   tone: "neutral", light: "#64748B", dark: "#94A3B8" },
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

  const registryTabs = [
    { key: "pending" as Tab, label: "Awaiting me", icon: <CheckSquare className="h-4 w-4" />, count: pending.data?.length ?? null },
    { key: "mine" as Tab, label: "My requests", icon: <FileText className="h-4 w-4" />, count: mine.data?.length ?? null },
    { key: "all" as Tab, label: "All", icon: <Inbox className="h-4 w-4" />, count: null },
  ];

  const columns: DxGridColumn<ApprovalRequest>[] = [
    { key: "title", header: "Request", render: (r) => <span className="font-semibold text-[var(--dx-text)]">{r.title}</span> },
    { key: "type", header: "Type", render: (r) => <span className="dx-mono text-[11px] text-[var(--dx-text-muted)]">{r.request_type_code}</span> },
    { key: "requester", header: "Requester", render: (r) => r.requester_name || `#${r.requester_user_id}` },
    { key: "step", header: "Current step", render: (r) => r.current_step_name || "—" },
    { key: "submitted", header: "Submitted", render: (r) => <span className="text-[var(--dx-text-muted)]">{fmt(r.submitted_at)}</span> },
    { key: "status", header: "Status", render: (r) => <DxBadge tone={statusTone[r.status]}>{r.status.replace("_", " ")}</DxBadge> },
  ];

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Approvals" }, { label: "Requests" }]}
        title="All Requests"
        subtitle="Your approvals, your requests, and everything you've actioned."
      />
      <ApprovalTabs />

      {/* ── KPI tiles ── */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {CATEGORIES.map((c) => (
          <DxKpi
            key={c.key}
            label={c.label}
            value={stats[c.key]}
            icon={c.icon}
            tone={c.tone}
            isLoading={statsLoading}
            sub={!statsLoading && stats[c.key] === 0 ? "Nothing here" : undefined}
          />
        ))}
      </div>

      {/* ── Charts ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <DxPanel title="Requests Distribution">
          {statsLoading ? (
            <DxSkeleton className="h-44 w-full" />
          ) : total === 0 ? (
            <p className="py-14 text-center text-sm text-[var(--dx-text-muted)]">No requests yet — activity will appear here.</p>
          ) : (
            <div className="flex flex-wrap items-center gap-8">
              <PieChart isDark={isDark} slices={nonZero.map((c) => ({ key: c.key, value: stats[c.key], color: isDark ? c.dark : c.light }))} />
              <ul className="min-w-[14rem] flex-1 space-y-3">
                {nonZero.map((c) => (
                  <li key={c.key} className="flex items-center gap-3">
                    <span className="h-3 w-3 shrink-0 rounded" style={{ backgroundColor: isDark ? c.dark : c.light }} />
                    <span className="flex-1 text-sm text-[var(--dx-text)]">{c.label}</span>
                    <span className="text-sm font-bold text-[var(--dx-text)]">{stats[c.key]}</span>
                    <span className="w-10 text-right text-xs font-semibold text-[var(--dx-text-muted)]">{Math.round((stats[c.key] / total) * 100)}%</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </DxPanel>

        <DxPanel title="Requests Breakdown">
          {statsLoading ? (
            <DxSkeleton className="h-44 w-full" />
          ) : (
            <div className="flex h-48 items-end justify-around gap-3 border-b border-[var(--dx-border)] pb-0">
              {CATEGORIES.map((c) => {
                const v = stats[c.key];
                const h = v === 0 ? 0 : Math.max(10, Math.round((v / maxVal) * 150));
                return (
                  <div key={c.key} className="flex h-full w-full max-w-[64px] flex-col items-center justify-end gap-1.5" title={`${c.label}: ${v}`}>
                    {v > 0 && <span className="text-xs font-bold text-[var(--dx-text)]">{v}</span>}
                    <div className="w-8 rounded-t" style={{ height: `${h}px`, backgroundColor: v === 0 ? "transparent" : (isDark ? c.dark : c.light) }} />
                    <span className="pb-2 text-center text-[8px] font-bold uppercase tracking-widest leading-tight text-[var(--dx-text-muted)]">{c.short}</span>
                  </div>
                );
              })}
            </div>
          )}
        </DxPanel>
      </div>

      {/* ── Request registry ── */}
      <DxTabs items={registryTabs} value={tab} onChange={setTab} />

      <DxPanel flush>
        <DxGrid<ApprovalRequest>
          columns={columns}
          data={rows}
          rowKey={(r) => r.id}
          isLoading={loading}
          onRowClick={(r) => navigate(`/approvals/requests/${r.id}`)}
          empty={{
            icon: Inbox,
            title: tab === "pending" ? "Nothing awaiting you" : "No requests",
            description: tab === "pending" ? "You're all caught up." : "Requests will appear here.",
          }}
        />
      </DxPanel>
    </DxPage>
  );
}
