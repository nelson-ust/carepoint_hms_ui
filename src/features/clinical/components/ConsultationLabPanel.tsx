import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FlaskConical, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiClient } from "@/lib/api/api-client";
import { apiErrorMessage } from "@/lib/api/api-error";
import {
  createLabOrder,
  listLabOrdersForVisit,
  type LabOrder,
  type LabOrderItem,
} from "@/features/laboratory/api/lab-orders.api";
import { listLabTests, type LabTest } from "@/features/laboratory/api/lab-tests.api";

const PRIORITIES = ["ROUTINE", "URGENT", "EMERGENCY"] as const;

/** Best-effort abnormal flag: numeric result vs a "low - high" range. */
export function isAbnormal(value?: string | null, range?: string | null): boolean {
  if (!value || !range) return false;
  const v = parseFloat(String(value).replace(/[^\d.\-]/g, ""));
  if (Number.isNaN(v)) return false;
  const m = String(range).match(/(-?\d+(?:\.\d+)?)\s*[-–]\s*(-?\d+(?:\.\d+)?)/);
  if (!m) return false;
  const low = parseFloat(m[1]);
  const high = parseFloat(m[2]);
  if (Number.isNaN(low) || Number.isNaN(high)) return false;
  return v < low || v > high;
}

function fmtWhen(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

const ITEM_STATUS_VARIANT: Record<string, any> = {
  ORDERED: "soft-warning", COLLECTED: "soft-info", IN_PROGRESS: "soft-info",
  COMPLETED: "soft-success", CANCELLED: "secondary",
};

function itemsOf(order: LabOrder): LabOrderItem[] {
  return Array.isArray(order.items) ? order.items : [];
}

async function downloadOrderReport(orderId: number, orderNo: string): Promise<void> {
  const response = await apiClient.get(`/lab/results/orders/${orderId}/report.pdf`, {
    responseType: "blob",
  });
  const url = URL.createObjectURL(response.data as Blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `lab-report-${orderNo}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/**
 * Laboratory panel inside the consultation workspace: order investigations
 * without leaving the encounter, watch each request move through the lab
 * lifecycle, and review released results inline with abnormal values
 * highlighted — the "second consultation" happens in the same context.
 */
export function ConsultationLabPanel({
  visitId,
  consultationId,
  disabled,
}: {
  visitId: number;
  consultationId: number | null;
  disabled?: boolean;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [orderOpen, setOrderOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Map<number, LabTest>>(new Map());
  const [priority, setPriority] = useState<(typeof PRIORITIES)[number]>("ROUTINE");
  const [note, setNote] = useState("");
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const ordersQuery = useQuery({
    queryKey: ["lab-orders", "visit", visitId],
    queryFn: () => listLabOrdersForVisit(visitId),
    refetchInterval: 30_000,
  });
  const testsQuery = useQuery({
    queryKey: ["lab-tests", "active"],
    queryFn: () => listLabTests({ limit: 500 }),
    enabled: orderOpen,
  });

  const orders: LabOrder[] = Array.isArray((ordersQuery.data as any)?.items)
    ? (ordersQuery.data as any).items
    : Array.isArray(ordersQuery.data)
      ? (ordersQuery.data as unknown as LabOrder[])
      : [];
  const tests: LabTest[] = (testsQuery.data as any)?.items ?? testsQuery.data ?? [];

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = (Array.isArray(tests) ? tests : []).filter(
      (t) => t.is_active !== false &&
        (!q || `${t.name} ${t.code} ${t.sample_type ?? ""}`.toLowerCase().includes(q)),
    );
    const bySample = new Map<string, LabTest[]>();
    for (const t of filtered) {
      const key = t.sample_type?.trim() || "Other";
      bySample.set(key, [...(bySample.get(key) ?? []), t]);
    }
    return [...bySample.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [tests, search]);

  const submit = useMutation({
    mutationFn: () =>
      createLabOrder({
        visit_id: visitId,
        consultation_id: consultationId ?? undefined,
        clinical_note:
          `[${priority}]` + (note.trim() ? ` ${note.trim()}` : ""),
        items: [...selected.values()].map((t) => ({
          lab_test_id: t.id,
          unit_price: t.default_price,
        })),
        auto_capture_charge: true,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lab-orders", "visit", visitId] });
      queryClient.invalidateQueries({ queryKey: ["visits", visitId, "timeline"] });
      toast.success(
        "Investigations requested",
        "The laboratory has been queued and charges captured on the visit bill.",
      );
      setOrderOpen(false);
      setSelected(new Map());
      setNote("");
      setPriority("ROUTINE");
    },
    onError: (err) => toast.error("Couldn't create request", apiErrorMessage(err)),
  });

  const toggleTest = (t: LabTest) =>
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(t.id)) next.delete(t.id);
      else next.set(t.id, t);
      return next;
    });

  const download = async (order: LabOrder) => {
    setDownloadingId(order.id);
    try {
      await downloadOrderReport(order.id, order.order_no);
    } catch (err) {
      toast.error("Couldn't download report", apiErrorMessage(err));
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="glass-card rounded p-8 border border-secondary-400 bg-white/80 shadow-premium">
      <div className="flex items-center justify-between border-b border-secondary-400 pb-5 mb-6">
        <div className="flex items-center gap-4">
          <div className="h-11 w-11 rounded bg-violet-600 text-white flex items-center justify-center shadow-xl">
            <FlaskConical className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-black font-display tracking-tight">Laboratory</h3>
            <p className="text-secondary-400 font-bold text-[10px] uppercase tracking-[0.25em]">
              Order & review without leaving the encounter
            </p>
          </div>
        </div>
        <Button size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />}
          disabled={disabled || !consultationId}
          onClick={() => setOrderOpen(true)}
          title={!consultationId ? "Start a consultation first" : undefined}>
          Order Investigations
        </Button>
      </div>

      {ordersQuery.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" />
        </div>
      ) : orders.length === 0 ? (
        <p className="py-6 text-center text-sm font-bold text-secondary-400">
          No investigations requested during this visit yet.
        </p>
      ) : (
        <div className="space-y-5">
          {orders.map((order) => {
            const items = itemsOf(order);
            const released = items.filter((i) => i.result?.released_at);
            const anyReleased = released.length > 0;
            return (
              <div key={order.id} className="rounded-2xl border border-secondary-200 overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 bg-secondary-50/70 px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <span className="data-mono text-xs font-black text-secondary-900">{order.order_no}</span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-secondary-400">
                      {fmtWhen(order.ordered_at)}
                    </span>
                    {order.clinical_note?.startsWith("[URGENT]") && <Badge variant="soft-warning">URGENT</Badge>}
                    {order.clinical_note?.startsWith("[EMERGENCY]") && <Badge variant="soft-danger">EMERGENCY</Badge>}
                  </div>
                  {anyReleased && (
                    <Button size="sm" variant="ghost" isLoading={downloadingId === order.id}
                      leftIcon={<Download className="h-3.5 w-3.5" />}
                      onClick={() => download(order)}>
                      Report PDF
                    </Button>
                  )}
                </div>
                <div className="divide-y divide-secondary-100">
                  {items.map((item) => {
                    const result = item.result;
                    const rr = result?.reference_range || item.lab_test?.reference_range;
                    const abnormal = isAbnormal(result?.result_value, rr);
                    return (
                      <div key={item.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5">
                        <span className="min-w-[10rem] flex-1 text-sm font-bold text-secondary-800">
                          {item.lab_test?.name ?? `Test #${item.lab_test_id}`}
                        </span>
                        {result?.released_at ? (
                          <>
                            <span className={`data-mono text-sm font-black ${abnormal ? "text-rose-600" : "text-secondary-900"}`}>
                              {result.result_value || result.result_text || "—"}
                              {result.unit_of_measure ? ` ${result.unit_of_measure}` : ""}
                            </span>
                            {abnormal && <Badge variant="soft-danger">ABNORMAL</Badge>}
                            <span className="text-[11px] text-secondary-400">
                              Ref: {rr || "—"}
                            </span>
                          </>
                        ) : (
                          <Badge variant={ITEM_STATUS_VARIANT[item.status] ?? "secondary"}>
                            {item.status.replace(/_/g, " ")}
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ---- Order modal ---- */}
      {orderOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-secondary-950/50 p-4 backdrop-blur-sm"
          role="dialog" aria-modal="true">
          <div className="w-full max-w-2xl max-h-[88vh] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl dark:bg-secondary-900">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h4 className="text-lg font-black text-secondary-900 dark:text-white">Order Laboratory Investigations</h4>
                <p className="text-xs text-secondary-400">
                  Charges are captured on the visit bill automatically and the lab is queued instantly.
                </p>
              </div>
              <button onClick={() => setOrderOpen(false)} className="rounded-xl p-2 hover:bg-secondary-100">
                <X className="h-4 w-4 text-secondary-400" />
              </button>
            </div>

            <div className="mb-3 flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[14rem]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary-400" />
                <input value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search tests by name, code or specimen…"
                  className="input-field pl-10" />
              </div>
              <select value={priority} onChange={(e) => setPriority(e.target.value as any)}
                className="input-field w-40">
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div className="mb-3 max-h-64 overflow-y-auto rounded-2xl border border-secondary-100">
              {testsQuery.isLoading ? (
                <div className="p-4 space-y-2"><Skeleton className="h-6 w-full" /><Skeleton className="h-6 w-2/3" /></div>
              ) : grouped.length === 0 ? (
                <p className="p-4 text-xs text-secondary-400">No tests match.</p>
              ) : grouped.map(([sample, list]) => (
                <div key={sample}>
                  <p className="sticky top-0 bg-secondary-50 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-secondary-400">
                    {sample}
                  </p>
                  {list.map((t) => (
                    <label key={t.id}
                      className="flex cursor-pointer items-center gap-3 px-4 py-2 hover:bg-primary-50/40">
                      <input type="checkbox" checked={selected.has(t.id)}
                        onChange={() => toggleTest(t)}
                        className="h-4 w-4 rounded accent-primary-600" />
                      <span className="flex-1">
                        <span className="block text-sm font-semibold text-secondary-800">{t.name}</span>
                        <span className="block text-[10px] text-secondary-400">
                          {t.code}{t.reference_range ? ` · Ref ${t.reference_range}` : ""}
                        </span>
                      </span>
                      {t.default_price != null && (
                        <span className="data-mono text-xs text-secondary-500">
                          {Number(t.default_price).toLocaleString()}
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              ))}
            </div>

            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
              placeholder="Clinical indication / notes for the laboratory scientist…"
              className="input-field mb-4 w-full" />

            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-secondary-500">
                {selected.size} test{selected.size === 1 ? "" : "s"} selected
              </p>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setOrderOpen(false)}
                  disabled={submit.isPending}>Cancel</Button>
                <Button size="sm" isLoading={submit.isPending} disabled={selected.size === 0}
                  onClick={() => submit.mutate()}>
                  Submit Request
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
