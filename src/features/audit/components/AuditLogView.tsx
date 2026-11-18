import { useState } from "react";
import { Search, RotateCcw, ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { format } from "date-fns";
import {
  DxPage,
  DxPageHeader,
  DxPanel,
  DxGrid,
  DxBadge,
  DxButton,
  DxInput,
  DxSelect,
  DxPopup,
  type DxGridColumn,
  type DxBadgeTone,
} from "@/components/dx";
import type { AuditLog, SaaSAuditLog, AuditListResponse, AuditQuery } from "../api/audit.api";

type AnyLog = AuditLog & Partial<SaaSAuditLog>;

const ACTION_OPTIONS = [
  { value: "", label: "All actions" },
  { value: "CREATE", label: "Create" },
  { value: "UPDATE", label: "Update" },
  { value: "DELETE", label: "Delete" },
  { value: "LOGIN", label: "Login" },
  { value: "LOGOUT", label: "Logout" },
  { value: "LOGIN_FAILED", label: "Login failed" },
];

const PAGE_SIZES = [
  { value: "25", label: "25 / page" },
  { value: "50", label: "50 / page" },
  { value: "100", label: "100 / page" },
];

function actionTone(action: string): DxBadgeTone {
  switch ((action || "").toUpperCase()) {
    case "CREATE": return "success";
    case "UPDATE": return "info";
    case "DELETE": return "danger";
    case "LOGIN": return "accent";
    case "LOGOUT": return "neutral";
    case "LOGIN_FAILED": return "warning";
    default: return "neutral";
  }
}

function fmt(v?: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : format(d, "MMM d, yyyy HH:mm:ss");
}

export interface AuditLogViewProps {
  crumbs: { label: string }[];
  title: string;
  subtitle: string;
  variant: "tenant" | "saas";
  data?: AuditListResponse<AnyLog>;
  isLoading: boolean;
  isFetching: boolean;
  query: AuditQuery;
  setQuery: (q: AuditQuery) => void;
}

export function AuditLogView({ crumbs, title, subtitle, variant, data, isLoading, isFetching, query, setQuery }: AuditLogViewProps) {
  const [searchText, setSearchText] = useState(query.q ?? "");
  const [detail, setDetail] = useState<AnyLog | null>(null);

  const limit = query.limit ?? 50;
  const offset = query.offset ?? 0;
  const total = data?.total ?? 0;
  const rows = data?.items ?? [];
  const pageStart = total === 0 ? 0 : offset + 1;
  const pageEnd = Math.min(offset + limit, total);

  const applySearch = () => setQuery({ ...query, q: searchText.trim() || undefined, offset: 0 });

  const columns: DxGridColumn<AnyLog>[] = [
    { key: "created_at", header: "When", width: 180, render: (r) => <span className="text-[var(--dx-text-muted)]">{fmt(r.created_at)}</span> },
    { key: "action", header: "Action", width: 130, render: (r) => <DxBadge tone={actionTone(r.action)}>{r.action.replace(/_/g, " ")}</DxBadge> },
    { key: "entity_name", header: "Entity", render: (r) => <span className="font-semibold text-[var(--dx-text)]">{r.entity_name}{r.entity_id ? ` #${r.entity_id}` : ""}</span> },
    { key: "actor", header: "Actor", render: (r) => r.actor_label || (r.actor_type === "SAAS_ADMIN" ? "SaaS admin" : "—") },
    ...(variant === "saas"
      ? [{ key: "tenant", header: "Tenant", render: (r: AnyLog) => r.target_tenant_code || "—" } as DxGridColumn<AnyLog>]
      : []),
    { key: "method", header: "Method", width: 110, render: (r) => (
      <span className="dx-mono text-[11px] text-[var(--dx-text-muted)]">
        {r.http_method || "—"}{r.status_code ? ` ${r.status_code}` : ""}
      </span>
    ) },
    { key: "ip", header: "IP", width: 130, render: (r) => <span className="dx-mono text-[11px] text-[var(--dx-text-muted)]">{r.ip_address || "—"}</span> },
    { key: "view", header: "", width: 48, align: "center", render: (r) => (
      <DxButton icon size="sm" variant="text" title="Details" onClick={(e) => { e.stopPropagation(); setDetail(r); }}>
        <Eye />
      </DxButton>
    ) },
  ];

  return (
    <DxPage>
      <DxPageHeader crumbs={crumbs} title={title} subtitle={subtitle} />

      <DxPanel>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <DxInput
              label="Search"
              placeholder="Action, entity, actor, IP or path"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") applySearch(); }}
              leftIcon={<Search className="h-4 w-4" />}
            />
          </div>
          <div className="w-44">
            <DxSelect
              label="Action"
              value={query.action ?? ""}
              onChange={(e) => setQuery({ ...query, action: e.target.value || undefined, offset: 0 })}
              options={ACTION_OPTIONS}
            />
          </div>
          <div className="w-44">
            <DxInput
              label="From"
              type="date"
              value={(query.date_from ?? "").slice(0, 10)}
              onChange={(e) => setQuery({ ...query, date_from: e.target.value || undefined, offset: 0 })}
            />
          </div>
          <div className="w-44">
            <DxInput
              label="To"
              type="date"
              value={(query.date_to ?? "").slice(0, 10)}
              onChange={(e) => setQuery({ ...query, date_to: e.target.value ? `${e.target.value}T23:59:59` : undefined, offset: 0 })}
            />
          </div>
          <div className="w-36">
            <DxSelect
              label="Page size"
              value={String(limit)}
              onChange={(e) => setQuery({ ...query, limit: Number(e.target.value), offset: 0 })}
              options={PAGE_SIZES}
            />
          </div>
          <DxButton variant="default" leftIcon={<Search className="h-4 w-4" />} onClick={applySearch}>
            Search
          </DxButton>
          <DxButton
            icon
            variant="text"
            title="Reset filters"
            onClick={() => { setSearchText(""); setQuery({ limit, offset: 0 }); }}
          >
            <RotateCcw />
          </DxButton>
        </div>
      </DxPanel>

      <DxPanel flush>
        <DxGrid<AnyLog>
          columns={columns}
          data={rows}
          rowKey={(r) => r.id}
          isLoading={isLoading}
          onRowClick={(r) => setDetail(r)}
          empty={{ icon: Search, title: "No audit entries", description: "No activity matches these filters yet." }}
        />
      </DxPanel>

      {/* Pagination */}
      <div className="flex items-center justify-between px-1 text-[12px] text-[var(--dx-text-muted)]">
        <span>{total === 0 ? "No records" : `Showing ${pageStart}–${pageEnd} of ${total}`}{isFetching ? " · updating…" : ""}</span>
        <div className="flex items-center gap-2">
          <DxButton size="sm" variant="default" leftIcon={<ChevronLeft className="h-4 w-4" />} disabled={offset <= 0} onClick={() => setQuery({ ...query, offset: Math.max(0, offset - limit) })}>
            Prev
          </DxButton>
          <DxButton size="sm" variant="default" rightIcon={<ChevronRight className="h-4 w-4" />} disabled={pageEnd >= total} onClick={() => setQuery({ ...query, offset: offset + limit })}>
            Next
          </DxButton>
        </div>
      </div>

      {/* Detail popup */}
      <DxPopup
        isOpen={detail !== null}
        onClose={() => setDetail(null)}
        title={detail ? `${detail.action.replace(/_/g, " ")} · ${detail.entity_name}` : "Audit entry"}
        size="lg"
        footer={<DxButton variant="default" onClick={() => setDetail(null)}>Close</DxButton>}
      >
        {detail ? (
          <div className="space-y-4 text-[13px]">
            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
              <Field label="When" value={fmt(detail.created_at)} />
              <Field label="Actor" value={detail.actor_label || "—"} />
              <Field label="Actor type" value={detail.actor_type || "—"} />
              {variant === "saas" ? <Field label="Tenant" value={detail.target_tenant_code || "—"} /> : <Field label="Actor ID" value={detail.actor_user_id ? `#${detail.actor_user_id}` : "—"} />}
              <Field label="Method" value={`${detail.http_method || "—"}${detail.status_code ? ` · ${detail.status_code}` : ""}`} />
              <Field label="IP address" value={detail.ip_address || "—"} />
              <Field label="Request ID" value={detail.request_id || "—"} mono />
              <Field label="Path" value={detail.path || "—"} mono />
            </div>
            {detail.user_agent ? <Field label="User agent" value={detail.user_agent} /> : null}
            {detail.before_data ? <JsonBlock label="Before" value={detail.before_data} /> : null}
            {detail.after_data ? <JsonBlock label="After" value={detail.after_data} /> : null}
            {detail.extra_metadata ? <JsonBlock label="Metadata" value={detail.extra_metadata} /> : null}
          </div>
        ) : null}
      </DxPopup>
    </DxPage>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--dx-text-muted)]">{label}</p>
      <p className={`mt-0.5 break-words text-[var(--dx-text)] ${mono ? "dx-mono text-[11px]" : ""}`}>{value}</p>
    </div>
  );
}

function JsonBlock({ label, value }: { label: string; value: Record<string, unknown> }) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-[var(--dx-text-muted)]">{label}</p>
      <pre className="dx-mono max-h-56 overflow-auto rounded-md border border-[var(--dx-border)] bg-[var(--dx-surface-alt)] p-3 text-[11px] text-[var(--dx-text)]">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
