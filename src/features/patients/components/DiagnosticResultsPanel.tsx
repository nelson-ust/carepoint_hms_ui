import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, FlaskConical, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { apiClient } from "@/lib/api/api-client";
import { apiErrorMessage } from "@/lib/api/api-error";
import { isAbnormal } from "@/features/clinical/components/ConsultationLabPanel";
import type { BaselineProfile } from "./BaselineProfileCard";

type DiagnosticRow = {
  test: string;
  code?: string | null;
  result: string;
  unit?: string | null;
  reference_range?: string | null;
  interpretation?: string | null;
  released_at?: string | null;
  verified?: boolean;
};

type DiagnosticOrder = {
  order_id: number;
  order_no: string;
  visit_id?: number | null;
  visit_number?: string | null;
  ordered_at?: string | null;
  results: DiagnosticRow[];
};

type DiagnosticsResponse = {
  patient_id: number;
  baseline: BaselineProfile;
  lab_history: DiagnosticOrder[];
};

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Reusable inline diagnostic results viewer — embeddable on any clinical
 * screen (consultation, patient record, referral review, admission, ward).
 * Baseline indicators sit above the chronological, collapsible history of
 * released laboratory results; abnormal values are flagged; each block links
 * back to its originating request.
 */
export function DiagnosticResultsPanel({
  patientId,
  defaultOpenCount = 1,
  className = "",
}: {
  patientId: number;
  /** How many most-recent result groups start expanded. */
  defaultOpenCount?: number;
  className?: string;
}) {
  const [openIds, setOpenIds] = useState<Set<number> | null>(null);
  const diagnostics = useQuery({
    queryKey: ["patients", patientId, "diagnostics"],
    queryFn: async () =>
      (await apiClient.get<DiagnosticsResponse>(`/patients/${patientId}/diagnostics`)).data,
    refetchInterval: 120_000,
  });

  const orders = diagnostics.data?.lab_history ?? [];
  const baseline = diagnostics.data?.baseline;

  const effectiveOpen = useMemo(() => {
    if (openIds) return openIds;
    return new Set(orders.slice(0, defaultOpenCount).map((o) => o.order_id));
  }, [openIds, orders, defaultOpenCount]);

  const toggle = (id: number) =>
    setOpenIds(() => {
      const next = new Set(effectiveOpen);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className={`glass-card rounded p-8 border border-secondary-400 bg-white/80 shadow-premium ${className}`}>
      <div className="flex items-center justify-between border-b border-secondary-400 pb-5 mb-6">
        <div className="flex items-center gap-4">
          <div className="h-11 w-11 rounded bg-gradient-to-br from-violet-600 to-cyan-500 text-white flex items-center justify-center shadow-xl">
            <FlaskConical className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-black font-display tracking-tight">Diagnostic Results</h3>
            <p className="text-secondary-400 font-bold text-[10px] uppercase tracking-[0.25em]">
              Baseline & chronological history
            </p>
          </div>
        </div>
        <span className="px-3 py-1.5 rounded bg-secondary-100 text-secondary-600 text-[10px] font-bold uppercase tracking-widest">
          {orders.length} request{orders.length === 1 ? "" : "s"}
        </span>
      </div>

      {diagnostics.isLoading ? (
        <div className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-2/3" /></div>
      ) : diagnostics.isError ? (
        <p className="text-sm font-semibold text-rose-500">
          {apiErrorMessage(diagnostics.error, "Couldn't load diagnostic results.")}
        </p>
      ) : (
        <div className="space-y-4">
          {/* Baseline indicators — lifelong, distinct from visit results */}
          {baseline && (
            <div className="rounded-2xl border border-primary-500/20 bg-primary-500/5 p-3">
              <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-primary-600">
                Baseline indicators
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="soft-danger">Blood {baseline.blood_group || "—"}{baseline.rhesus_factor ? ` (${baseline.rhesus_factor})` : ""}</Badge>
                <Badge variant="soft-info">Genotype {baseline.genotype || "—"}</Badge>
                {baseline.g6pd_status && <Badge variant="soft-info">G6PD {baseline.g6pd_status}</Badge>}
                {baseline.hepatitis_b_status && <Badge variant="soft-warning">Hep B {baseline.hepatitis_b_status}</Badge>}
                {baseline.hepatitis_c_status && <Badge variant="soft-warning">Hep C {baseline.hepatitis_c_status}</Badge>}
                {baseline.hiv_status && <Badge variant="soft-danger">HIV {baseline.hiv_status}</Badge>}
                {baseline.blood_sugar_baseline && <Badge variant="secondary">Glucose {baseline.blood_sugar_baseline}</Badge>}
              </div>
            </div>
          )}

          {orders.length === 0 ? (
            <p className="py-6 text-center text-sm font-bold text-secondary-400">
              No released laboratory results on record yet.
            </p>
          ) : (
            orders.map((order) => {
              const open = effectiveOpen.has(order.order_id);
              const abnormalCount = order.results.filter((r) =>
                isAbnormal(r.result, r.reference_range)).length;
              return (
                <div key={order.order_id} className="rounded-2xl border border-secondary-200 overflow-hidden">
                  <button type="button" onClick={() => toggle(order.order_id)}
                    className="flex w-full items-center justify-between gap-3 bg-secondary-50/70 px-4 py-2.5 text-left hover:bg-secondary-100/70">
                    <span className="flex items-center gap-3">
                      {open ? <ChevronDown className="h-4 w-4 text-secondary-400" />
                            : <ChevronRight className="h-4 w-4 text-secondary-400" />}
                      <span className="data-mono text-xs font-black text-secondary-900">{order.order_no}</span>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-secondary-400">
                        {fmtDate(order.ordered_at)}{order.visit_number ? ` · ${order.visit_number}` : ""}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      {abnormalCount > 0 && (
                        <Badge variant="soft-danger">{abnormalCount} abnormal</Badge>
                      )}
                      <Badge variant="secondary">{order.results.length} tests</Badge>
                    </span>
                  </button>
                  {open && (
                    <div className="divide-y divide-secondary-100">
                      {order.results.map((r, i) => {
                        const abnormal = isAbnormal(r.result, r.reference_range);
                        return (
                          <div key={i} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5">
                            <span className="min-w-[9rem] flex-1 text-sm font-bold text-secondary-800">{r.test}</span>
                            <span className={`data-mono text-sm font-black ${abnormal ? "text-rose-600" : "text-secondary-900"}`}>
                              {r.result}{r.unit ? ` ${r.unit}` : ""}
                            </span>
                            {abnormal && <Badge variant="soft-danger">ABNORMAL</Badge>}
                            {r.verified && (
                              <span title="Verified result">
                                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                              </span>
                            )}
                            <span className="text-[11px] text-secondary-400">Ref: {r.reference_range || "—"}</span>
                            {r.interpretation && (
                              <p className="w-full text-xs text-secondary-500">{r.interpretation}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
