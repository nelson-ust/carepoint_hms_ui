import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FlaskConical, Plus, RotateCcw } from "lucide-react";
import {
  DxBadge,
  DxButton,
  DxGrid,
  DxMessage,
  DxPanel,
  DxPopup,
  DxSearchBox,
  DxSelect,
  DxStatusBadge,
  DxTextarea,
  DxToolbar,
  DxToolbarLabel,
  DxToolbarSpacer,
  apiErrorMessage,
  formatDateTime,
  formatNaira,
  type DxGridColumn,
} from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiClient } from "@/lib/api/api-client";
import {
  createLabOrder,
  listLabOrdersForVisit,
  type LabOrder,
  type LabOrderItem,
} from "@/features/laboratory/api/lab-orders.api";
import { listLabTests, type LabTest } from "@/features/laboratory/api/lab-tests.api";
import { isAbnormal } from "../lib/lab-results";

const PRIORITIES = ["ROUTINE", "URGENT", "EMERGENCY"] as const;
type Priority = (typeof PRIORITIES)[number];

function itemsOf(order: LabOrder): LabOrderItem[] {
  return Array.isArray(order.items) ? order.items : [];
}

function orderPriority(order: LabOrder): Priority | null {
  const note = order.clinical_note ?? "";
  if (note.startsWith("[EMERGENCY]")) return "EMERGENCY";
  if (note.startsWith("[URGENT]")) return "URGENT";
  return null;
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

type OrdersResponse = { items?: LabOrder[] } | LabOrder[] | undefined;
type TestsResponse = { items?: LabTest[] } | LabTest[] | undefined;

const asOrders = (data: OrdersResponse): LabOrder[] => (Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : []);
const asTests = (data: TestsResponse): LabTest[] => (Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : []);

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
  const [priority, setPriority] = useState<Priority>("ROUTINE");
  const [note, setNote] = useState("");
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const ordersQuery = useQuery({
    queryKey: ["lab-orders", "visit", visitId],
    queryFn: () => listLabOrdersForVisit(visitId),
    refetchInterval: 60_000,
  });
  const testsQuery = useQuery({
    queryKey: ["lab-tests", "active"],
    queryFn: () => listLabTests({ limit: 500 }),
    enabled: orderOpen,
  });

  const orders = useMemo(() => asOrders(ordersQuery.data as OrdersResponse), [ordersQuery.data]);
  const tests = useMemo(() => asTests(testsQuery.data as TestsResponse), [testsQuery.data]);

  const filteredTests = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tests.filter(
      (t) => t.is_active !== false && (!q || `${t.name} ${t.code} ${t.sample_type ?? ""}`.toLowerCase().includes(q)),
    );
  }, [tests, search]);

  const sampleTypes = useMemo(
    () => [...new Set(tests.map((t) => t.sample_type?.trim() || "Other"))].sort((a, b) => a.localeCompare(b)),
    [tests],
  );

  const submit = useMutation({
    mutationFn: () =>
      createLabOrder({
        visit_id: visitId,
        consultation_id: consultationId ?? undefined,
        clinical_note: `[${priority}]` + (note.trim() ? ` ${note.trim()}` : ""),
        items: [...selected.values()].map((t) => ({
          lab_test_id: t.id,
          unit_price: t.default_price,
        })),
        auto_capture_charge: true,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lab-orders", "visit", visitId] });
      queryClient.invalidateQueries({ queryKey: ["visits", visitId, "timeline"] });
      toast.success("Investigations requested", "The laboratory has been queued and charges captured on the visit bill.");
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

  const selectedTotal = [...selected.values()].reduce((sum, t) => sum + Number(t.default_price ?? 0), 0);

  // ---------- Columns ----------
  const itemColumns: DxGridColumn<LabOrderItem>[] = [
    { key: "test", header: "Investigation", wrap: true, render: (item) => <span className="font-medium">{item.lab_test?.name ?? `Test #${item.lab_test_id}`}</span> },
    {
      key: "result",
      header: "Result",
      width: 180,
      render: (item) => {
        const result = item.result;
        if (!result?.released_at) return <DxStatusBadge status={item.status} />;
        const rr = result.reference_range || item.lab_test?.reference_range;
        const abnormal = isAbnormal(result.result_value, rr);
        return (
          <span className="inline-flex items-center gap-2">
            <span className={abnormal ? "dx-mono font-semibold text-[var(--dx-danger)]" : "dx-mono font-semibold"}>
              {result.result_value || result.result_text || "—"}
              {result.unit_of_measure ? ` ${result.unit_of_measure}` : ""}
            </span>
            {abnormal ? <DxBadge tone="danger">Abnormal</DxBadge> : null}
          </span>
        );
      },
    },
    {
      key: "range",
      header: "Reference",
      width: 130,
      render: (item) => {
        const rr = item.result?.reference_range || item.lab_test?.reference_range;
        return rr ? <span className="dx-muted dx-mono">{rr}</span> : <span className="dx-faint">—</span>;
      },
    },
    {
      key: "released",
      header: "Released",
      width: 130,
      render: (item) => (item.result?.released_at ? <span className="dx-mono">{formatDateTime(item.result.released_at)}</span> : <span className="dx-faint">pending</span>),
    },
  ];

  const testColumns: DxGridColumn<LabTest>[] = [
    {
      key: "pick",
      header: "",
      width: 36,
      align: "center",
      render: (t) => (
        <input
          type="checkbox"
          className="h-[15px] w-[15px] accent-[var(--dx-accent)]"
          aria-label={`Select ${t.name}`}
          checked={selected.has(t.id)}
          onChange={() => toggleTest(t)}
          onClick={(e) => e.stopPropagation()}
        />
      ),
    },
    {
      key: "name",
      header: "Test",
      sortable: true,
      wrap: true,
      render: (t) => (
        <div className="min-w-0">
          <div className="font-medium">{t.name}</div>
          <div className="dx-muted text-[11.5px]">
            <span className="dx-mono">{t.code}</span>
            {t.reference_range ? ` · Ref ${t.reference_range}` : ""}
          </div>
        </div>
      ),
    },
    {
      key: "sample_type",
      header: "Specimen",
      width: 130,
      sortable: true,
      accessor: (t) => t.sample_type?.trim() || "Other",
      filter: { options: sampleTypes.map((s) => ({ value: s, label: s })) },
      render: (t) => t.sample_type?.trim() || "Other",
    },
    {
      key: "default_price",
      header: "Price",
      width: 110,
      align: "right",
      sortable: true,
      render: (t) => (t.default_price != null ? <span className="dx-num">{formatNaira(t.default_price)}</span> : <span className="dx-faint">—</span>),
    },
  ];

  return (
    <DxPanel
      title="Laboratory"
      icon={<FlaskConical />}
      description="Order and review investigations without leaving the encounter."
      flush={orders.length === 0}
      actions={
        <>
          <DxButton size="sm" variant="text" icon title="Refresh" onClick={() => ordersQuery.refetch()}>
            <RotateCcw className={ordersQuery.isFetching ? "animate-spin" : undefined} />
          </DxButton>
          <DxButton
            size="sm"
            variant="primary"
            leftIcon={<Plus />}
            disabled={disabled || !consultationId}
            onClick={() => setOrderOpen(true)}
            title={!consultationId ? "Start a consultation first" : undefined}
          >
            Order investigations
          </DxButton>
        </>
      }
    >
      {ordersQuery.isError ? (
        <div className="p-3">
          <DxMessage
            tone="danger"
            action={
              <DxButton size="sm" onClick={() => ordersQuery.refetch()} leftIcon={<RotateCcw />}>
                Retry
              </DxButton>
            }
          >
            {apiErrorMessage(ordersQuery.error, "Unable to load laboratory orders.")}
          </DxMessage>
        </div>
      ) : ordersQuery.isLoading ? (
        <div className="space-y-2 p-3">
          <div className="dx-skeleton h-3.5 w-2/3" />
          <div className="dx-skeleton h-3.5 w-1/2" />
        </div>
      ) : orders.length === 0 ? (
        <div className="dx-grid-state">
          <FlaskConical aria-hidden />
          <p className="dx-grid-state-title">No investigations requested during this visit yet</p>
          {!consultationId ? <p>Start a consultation to order investigations.</p> : null}
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const items = itemsOf(order);
            const anyReleased = items.some((i) => i.result?.released_at);
            const prio = orderPriority(order);
            return (
              <section key={order.id} className="dx-panel">
                <header className="dx-panel-header">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="dx-mono font-semibold">{order.order_no}</span>
                    <DxStatusBadge status={order.status} />
                    {prio ? <DxBadge tone={prio === "EMERGENCY" ? "danger" : "warning"}>{prio}</DxBadge> : null}
                    <span className="dx-muted text-[11.5px]">{formatDateTime(order.ordered_at)}</span>
                  </div>
                  {anyReleased ? (
                    <DxButton size="sm" variant="text" isLoading={downloadingId === order.id} leftIcon={<Download />} onClick={() => download(order)}>
                      Report PDF
                    </DxButton>
                  ) : null}
                </header>
                <DxGrid columns={itemColumns} data={items} rowKey={(i) => i.id} borderless striped={false} empty={{ title: "No items" }} />
              </section>
            );
          })}
        </div>
      )}

      {/* ---- Order popup ---- */}
      <DxPopup
        isOpen={orderOpen}
        onClose={() => !submit.isPending && setOrderOpen(false)}
        title="Order laboratory investigations"
        size="lg"
        locked={submit.isPending}
        footer={
          <>
            <span className="dx-muted mr-auto text-[12px]">
              <b className="dx-strong">{selected.size}</b> test{selected.size === 1 ? "" : "s"} selected
              {selectedTotal > 0 ? <> · {formatNaira(selectedTotal)}</> : null}
            </span>
            <DxButton onClick={() => setOrderOpen(false)} disabled={submit.isPending}>
              Cancel
            </DxButton>
            <DxButton variant="primary" isLoading={submit.isPending} disabled={selected.size === 0} onClick={() => submit.mutate()}>
              Submit request
            </DxButton>
          </>
        }
      >
        <div className="space-y-3">
          <DxMessage tone="info">Charges are captured on the visit bill automatically and the lab is queued instantly.</DxMessage>
          <DxToolbar attached>
            <DxSearchBox onSearch={setSearch} placeholder="Search tests by name, code or specimen…" className="w-72" size="sm" />
            <DxToolbarSpacer />
            <DxToolbarLabel>Priority</DxToolbarLabel>
            <DxSelect
              editorSize="sm"
              aria-label="Priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
              options={PRIORITIES.map((p) => ({ value: p, label: p }))}
              className="w-36"
            />
          </DxToolbar>
          <DxGrid
            attached
            columns={testColumns}
            data={filteredTests}
            rowKey={(t) => t.id}
            isLoading={testsQuery.isLoading}
            error={testsQuery.isError ? apiErrorMessage(testsQuery.error, "Could not load the test catalogue.") : null}
            onRetry={() => testsQuery.refetch()}
            onRowClick={toggleTest}
            rowClassName={(t) => (selected.has(t.id) ? "dx-row-selected" : undefined)}
            filterRow
            maxHeight={300}
            empty={{ title: "No tests match" }}
          />
          <DxTextarea
            label="Clinical indication / notes for the laboratory scientist"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </DxPopup>
    </DxPanel>
  );
}
