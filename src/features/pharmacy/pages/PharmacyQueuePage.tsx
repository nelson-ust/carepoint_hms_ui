import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Boxes,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  ListChecks,
  PackageCheck,
  Pill,
  RotateCcw,
  Save,
  X,
} from "lucide-react";
import {
  DxBadge,
  DxButton,
  DxConfirm,
  DxForm,
  DxGrid,
  DxGroupBox,
  DxInput,
  DxKpi,
  DxMessage,
  DxPage,
  DxPageHeader,
  DxPanel,
  DxPopup,
  DxProps,
  DxSearchBox,
  DxSelect,
  DxStatusBadge,
  DxStatusBar,
  DxStatusItem,
  DxTabs,
  DxTextarea,
  DxToolbar,
  DxToolbarGroup,
  DxToolbarLabel,
  DxToolbarSeparator,
  DxToolbarSpacer,
  apiErrorMessage,
  formatDate,
  formatDateTime,
  humanize,
  type DxGridColumn,
} from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import { routes } from "@/config/routes";
import { createDispense, type CreateDispenseItemPayload } from "@/features/dispenses/api/dispenses.api";
import { listStockItems, listStores, type StockItem } from "@/features/inventory/api/inventory.api";
import {
  PRESCRIPTION_STATUSES,
  cancelPrescription,
  type Prescription,
  type PrescriptionItem,
} from "@/features/prescriptions/api/prescriptions.api";
import { getStaff, staffDisplayName, type Staff } from "@/features/staff/api/staff.api";
import { advanceVisit } from "@/features/visits/api/visits.api";
import {
  asPrescriptionFromWorklist,
  asStockAlertArray,
  getPharmacyStockAlerts,
  getPharmacyWorklist,
  type StockAlert,
} from "../api/pharmacy.api";
import {
  canDispensePrescription,
  defaultStaffIdFor,
  defaultStockItemFor,
  drugLabel,
  isExpired,
  isNoFlowStepsError,
  isPending,
  isToday,
  matchesSearch,
  patientNameOf,
  prescriptionItems,
  prescriptionStatus,
  regimenOf,
  staffNameById,
  stockItemOptionLabel,
  stockItemsForLine,
  totalOnHand,
} from "../lib/pharmacy-helpers";

// ============================================================
// Local types
// ============================================================

type Tab = "WORKLIST" | "ALERTS";

/** Per prescription-line editable state in the dispense form. */
type LineState = { qty: string; stockItemId: string };

type Handoff = { prescriptionId: number; visitId: number; patientName: string };

const STATUS_FILTER_OPTIONS = PRESCRIPTION_STATUSES.map((s) => ({ value: s, label: humanize(s) }));

const ALERT_TONE: Record<string, "warning" | "danger"> = {
  LOW_STOCK: "warning",
  EXPIRING: "warning",
  EXPIRED: "danger",
  OUT_OF_STOCK: "danger",
};

function buildLineState(items: PrescriptionItem[], stockItems: StockItem[], storeId: string): Record<number, LineState> {
  const out: Record<number, LineState> = {};
  items.forEach((it) => {
    const def = defaultStockItemFor(stockItems, it.drug_id, storeId);
    out[it.id] = { qty: String(it.quantity ?? 0), stockItemId: def ? String(def.id) : "" };
  });
  return out;
}

// ============================================================
// Page
// ============================================================

/**
 * Pharmacy worklist. Prescriptions arrive here from consultation; the
 * pharmacist checks stock, dispenses (store, batch/expiry, quantity) with
 * counselling, then completes the pharmacy step so the visit moves on to
 * billing (or closes when pharmacy is the last stop).
 */
export function PharmacyQueuePage(props: { visitId?: number; embedded?: boolean } = {}) {
  const embedded = props.embedded ?? false;
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const focusVisitId = useMemo(() => {
    if (props.visitId != null) return props.visitId;
    const n = Number(searchParams.get("visit"));
    return Number.isInteger(n) && n > 0 ? n : null;
  }, [searchParams, props.visitId]);

  // ---------- UI state ----------
  const [tab, setTab] = useState<Tab>("WORKLIST");
  const [search, setSearch] = useState("");
  const [storeId, setStoreId] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedSnapshot, setSelectedSnapshot] = useState<Prescription | null>(null);

  // Dispense form
  const [staffOverride, setStaffOverride] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<Record<number, LineState>>({});
  const [formError, setFormError] = useState<string | null>(null);

  // Cancel popup
  const [cancelTarget, setCancelTarget] = useState<Prescription | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  // Hand-off after dispensing
  const [handoff, setHandoff] = useState<Handoff | null>(null);
  const [advanceOpen, setAdvanceOpen] = useState(false);

  // ---------- Data ----------
  const worklistQuery = useQuery({
    queryKey: ["pharmacy", "worklist"],
    queryFn: getPharmacyWorklist,
    refetchInterval: 60_000,
  });
  const alertsQuery = useQuery({ queryKey: ["pharmacy", "stock-alerts"], queryFn: getPharmacyStockAlerts });
  const storesQuery = useQuery({ queryKey: ["inventory", "stores", "all"], queryFn: () => listStores({ skip: 0, limit: 200 }) });
  const stockQuery = useQuery({ queryKey: ["inventory", "items", "all"], queryFn: () => listStockItems({ skip: 0, limit: 500 }) });
  const staffQuery = useQuery({ queryKey: ["staff", "all", 200], queryFn: () => getStaff(0, 200) });

  const prescriptions: Prescription[] = useMemo(() => {
    const raw = worklistQuery.data?.items;
    const rows = Array.isArray(raw) ? raw : [];
    return rows.map((r) => asPrescriptionFromWorklist(r)).filter((x): x is Prescription => !!x);
  }, [worklistQuery.data]);
  const alerts: StockAlert[] = useMemo(() => asStockAlertArray(alertsQuery.data?.items), [alertsQuery.data]);
  const stores = storesQuery.data?.items ?? [];
  const stockItems: StockItem[] = stockQuery.data?.items ?? [];
  const staffList: Staff[] = useMemo(() => (Array.isArray(staffQuery.data) ? staffQuery.data : []), [staffQuery.data]);

  const defaultStaffId = useMemo(() => defaultStaffIdFor(staffList), [staffList]);
  const staffId = staffOverride ?? (defaultStaffId != null ? String(defaultStaffId) : "");

  const visible = useMemo(
    () => prescriptions.filter((p) => (focusVisitId == null || p.visit_id === focusVisitId) && matchesSearch(p, search)),
    [prescriptions, focusVisitId, search],
  );

  // The selected prescription follows the live list, but survives a refetch
  // that drops it from the worklist (e.g. right after it was dispensed).
  const selected = useMemo(
    () => (selectedId == null ? null : prescriptions.find((p) => p.id === selectedId) ?? selectedSnapshot),
    [selectedId, prescriptions, selectedSnapshot],
  );
  const selectedItems = useMemo(() => prescriptionItems(selected), [selected]);
  const canDispense = !!selected && canDispensePrescription(selected);

  const stats = useMemo(() => {
    const pending = prescriptions.filter(isPending);
    const active = pending.filter((p) => prescriptionStatus(p) === "ACTIVE").length;
    const dispensedToday = prescriptions.filter((p) => prescriptionStatus(p) === "DISPENSED" && isToday(p.updated_at)).length;
    const lowStock = alerts.filter((a) => a.alert_type === "LOW_STOCK" || a.alert_type === "OUT_OF_STOCK").length;
    return { total: prescriptions.length, pending: pending.length, active, partial: pending.length - active, dispensedToday, alerts: alerts.length, lowStock };
  }, [prescriptions, alerts]);

  const refreshAll = () => {
    worklistQuery.refetch();
    alertsQuery.refetch();
    stockQuery.refetch();
  };

  // ---------- Handlers ----------
  const openPrescription = (p: Prescription) => {
    // Re-clicking the open row keeps any quantities already edited.
    if (p.id === selectedId) return;
    setSelectedId(p.id);
    setSelectedSnapshot(p);
    setLines(buildLineState(prescriptionItems(p), stockItems, storeId));
    setNote("");
    setFormError(null);
    if (handoff && handoff.prescriptionId !== p.id) setHandoff(null);
  };

  const closePanel = () => {
    setSelectedId(null);
    setSelectedSnapshot(null);
    setHandoff(null);
    setFormError(null);
  };

  const changeStore = (next: string) => {
    setStoreId(next);
    // Re-pick default batches for the open prescription in the new store.
    if (selected) {
      setLines((prev) => {
        const out: Record<number, LineState> = {};
        prescriptionItems(selected).forEach((it) => {
          const def = defaultStockItemFor(stockItems, it.drug_id, next);
          out[it.id] = { qty: prev[it.id]?.qty ?? String(it.quantity ?? 0), stockItemId: def ? String(def.id) : "" };
        });
        return out;
      });
    }
  };

  const setLine = (itemId: number, patch: Partial<LineState>) =>
    setLines((prev) => {
      const current: LineState = prev[itemId] ?? { qty: "0", stockItemId: "" };
      return { ...prev, [itemId]: { ...current, ...patch } };
    });

  const clearFocus = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("visit");
    setSearchParams(next, { replace: true });
  };

  // ---------- Mutations ----------
  const dispenseMutation = useMutation({
    mutationFn: async (p: Prescription) => {
      const items: CreateDispenseItemPayload[] = [];
      for (const it of prescriptionItems(p)) {
        const ls = lines[it.id];
        const qty = Number(ls?.qty ?? "0");
        if (!Number.isFinite(qty) || qty <= 0) continue;
        items.push({
          prescription_item_id: it.id,
          drug_id: it.drug_id,
          stock_item_id: ls?.stockItemId ? Number(ls.stockItemId) : undefined,
          quantity_dispensed: qty,
          unit_price: it.unit_price,
        });
      }
      return createDispense({
        prescription_id: p.id,
        dispensed_by_staff_id: Number(staffId),
        note: note.trim() || undefined,
        items,
        store_id: storeId ? Number(storeId) : undefined,
      });
    },
    onSuccess: (res, p) => {
      qc.invalidateQueries({ queryKey: ["pharmacy"] });
      qc.invalidateQueries({ queryKey: ["inventory", "items"] });
      toast.success("Medication dispensed", res.message || `${patientNameOf(p)} — ${p.prescription_no}`);
      setFormError(null);
      if (p.visit_id && !embedded) setHandoff({ prescriptionId: p.id, visitId: p.visit_id, patientName: patientNameOf(p) });
    },
    onError: (err) => {
      const msg = apiErrorMessage(err, "Failed to dispense.");
      setFormError(msg);
      toast.error("Could not dispense", msg);
    },
  });

  const submitDispense = () => {
    if (!selected) return;
    if (!staffId) {
      setFormError("Pick the dispensing pharmacist.");
      return;
    }
    const anyQty = selectedItems.some((it) => Number(lines[it.id]?.qty ?? "0") > 0);
    if (!anyQty) {
      setFormError("Enter a quantity for at least one item.");
      return;
    }
    setFormError(null);
    dispenseMutation.mutate(selected);
  };

  const cancelMutation = useMutation({
    mutationFn: (p: Prescription) => cancelPrescription(p.id, { reason: cancelReason.trim() }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["pharmacy", "worklist"] });
      if (selectedId === res.prescription.id) setSelectedSnapshot(res.prescription);
      toast.success("Prescription cancelled", res.message || res.prescription.prescription_no);
      setCancelTarget(null);
      setCancelReason("");
    },
    onError: (err) => toast.error("Could not cancel prescription", apiErrorMessage(err, "Failed to cancel prescription.")),
  });

  const advanceMutation = useMutation({
    mutationFn: (visitId: number) => advanceVisit(visitId, { action: "complete", notes: "Medication dispensed." }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["visits"] });
      qc.invalidateQueries({ queryKey: ["queue"] });
      const status = String(res.visit?.status ?? "").toUpperCase();
      const nextSdp = res.visit?.current_service_delivery_point?.name;
      toast.success(
        "Pharmacy step completed",
        status === "COMPLETED" || !nextSdp ? "Visit completed." : `${handoff?.patientName ?? "Patient"} routed to ${nextSdp}.`,
      );
      setHandoff(null);
      navigate(routes.queues);
    },
    onError: (err) => {
      const msg = apiErrorMessage(err);
      if (isNoFlowStepsError(msg)) {
        toast.warning("No care pathway on this visit", "Route the patient manually from the Queue page.");
        return;
      }
      toast.error("Could not complete the pharmacy step", msg);
    },
  });

  const busy = dispenseMutation.isPending;

  // ---------- Worklist grid ----------
  const columns: DxGridColumn<Prescription>[] = [
    {
      key: "patient",
      header: "Patient",
      minWidth: 180,
      sortable: true,
      filter: true,
      accessor: (p) => patientNameOf(p),
      render: (p) => (
        <div className="min-w-0">
          <div className="dx-strong truncate">{patientNameOf(p)}</div>
          <div className="dx-faint truncate text-[11px]">
            {p.visit?.visit_code ? <span className="dx-mono">{p.visit.visit_code}</span> : "No visit code"}
          </div>
        </div>
      ),
    },
    {
      key: "hospital_number",
      header: "Hospital no.",
      width: 130,
      filter: true,
      accessor: (p) => p.visit?.patient?.hospital_number ?? "",
      render: (p) => <span className="dx-mono">{p.visit?.patient?.hospital_number ?? "—"}</span>,
    },
    {
      key: "prescription_no",
      header: "Prescription",
      width: 150,
      sortable: true,
      filter: true,
      render: (p) => <span className="dx-mono">{p.prescription_no}</span>,
    },
    {
      key: "prescribed_at",
      header: "Prescribed",
      width: 150,
      sortable: true,
      accessor: (p) => p.prescribed_at || p.created_at,
      render: (p) => <span className="dx-mono">{formatDateTime(p.prescribed_at || p.created_at)}</span>,
    },
    {
      key: "items",
      header: "Items",
      width: 70,
      align: "center",
      sortable: true,
      accessor: (p) => prescriptionItems(p).length,
      render: (p) => <span className="dx-num">{prescriptionItems(p).length}</span>,
    },
    {
      key: "prescriber",
      header: "Prescriber",
      minWidth: 140,
      filter: true,
      accessor: (p) => staffNameById(staffList, p.prescribed_by_staff_id),
      render: (p) => staffNameById(staffList, p.prescribed_by_staff_id),
    },
    {
      key: "status",
      header: "Status",
      width: 150,
      sortable: true,
      filter: { options: STATUS_FILTER_OPTIONS },
      accessor: (p) => prescriptionStatus(p),
      render: (p) => <DxStatusBadge status={prescriptionStatus(p)} />,
    },
    {
      key: "actions",
      header: "",
      width: 150,
      align: "right",
      render: (p) =>
        canDispensePrescription(p) ? (
          <span className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <DxButton size="sm" variant="primary" leftIcon={<Pill />} onClick={() => openPrescription(p)}>
              Dispense
            </DxButton>
            <DxButton
              size="sm"
              variant="outline-danger"
              icon
              title="Cancel prescription"
              onClick={() => {
                setCancelTarget(p);
                setCancelReason("");
              }}
            >
              <X />
            </DxButton>
          </span>
        ) : (
          <span className="dx-faint">—</span>
        ),
    },
  ];

  // ---------- Prescription lines grid (inside the detail panel) ----------
  const lineColumns: DxGridColumn<PrescriptionItem>[] = [
    {
      key: "drug",
      header: "Drug / regimen",
      minWidth: 170,
      wrap: true,
      render: (it) => (
        <div className="min-w-0">
          <div className="dx-strong">{drugLabel(it)}</div>
          <div className="dx-muted text-[11px]">{regimenOf(it)}</div>
          {it.instructions ? <div className="dx-faint text-[11px] italic">{it.instructions}</div> : null}
        </div>
      ),
    },
    {
      key: "quantity",
      header: "Qty Rx",
      width: 64,
      align: "center",
      render: (it) => <span className="dx-num">{it.quantity}</span>,
    },
    {
      key: "stock",
      header: "Stock item · batch · expiry",
      minWidth: 220,
      wrap: true,
      render: (it) => {
        const options = stockItemsForLine(stockItems, it.drug_id, storeId);
        const ls = lines[it.id];
        const chosen = options.find((s) => String(s.id) === ls?.stockItemId);
        if (!options.length) {
          return <DxBadge tone="danger">No stock{storeId ? " in store" : ""}</DxBadge>;
        }
        if (!canDispense) {
          return <span className="dx-muted text-[11.5px]">{totalOnHand(options)} on hand across {options.length} batch{options.length === 1 ? "" : "es"}</span>;
        }
        return (
          <DxSelect
            editorSize="sm"
            aria-label={`Stock item for ${drugLabel(it)}`}
            value={ls?.stockItemId ?? ""}
            onChange={(e) => setLine(it.id, { stockItemId: e.target.value })}
            disabled={busy}
            placeholder="— Not linked to a batch —"
            options={options.map((s) => ({ value: String(s.id), label: stockItemOptionLabel(s) }))}
            error={chosen && isExpired(chosen.expiry_date) ? "Selected batch has expired." : undefined}
          />
        );
      },
    },
    {
      key: "on_hand",
      header: "On hand",
      width: 76,
      align: "center",
      render: (it) => {
        const options = stockItemsForLine(stockItems, it.drug_id, storeId);
        const chosen = options.find((s) => String(s.id) === lines[it.id]?.stockItemId);
        const onHand = chosen ? chosen.quantity_on_hand ?? 0 : totalOnHand(options);
        const want = Number(lines[it.id]?.qty ?? it.quantity ?? 0);
        return <DxBadge tone={onHand <= 0 ? "danger" : want > onHand ? "warning" : "success"}>{onHand}</DxBadge>;
      },
    },
    {
      key: "expiry",
      header: "Expiry",
      width: 100,
      render: (it) => {
        const chosen = stockItemsForLine(stockItems, it.drug_id, storeId).find((s) => String(s.id) === lines[it.id]?.stockItemId);
        if (!chosen?.expiry_date) return <span className="dx-faint">—</span>;
        return (
          <span className={isExpired(chosen.expiry_date) ? "text-[var(--dx-danger)] dx-mono" : "dx-mono"}>{formatDate(chosen.expiry_date)}</span>
        );
      },
    },
    {
      key: "dispense_qty",
      header: "Dispense",
      width: 90,
      align: "center",
      render: (it) =>
        canDispense ? (
          <DxInput
            type="number"
            step="any"
            min={0}
            editorSize="sm"
            mono
            aria-label={`Quantity to dispense for ${drugLabel(it)}`}
            className="text-center"
            value={lines[it.id]?.qty ?? "0"}
            onChange={(e) => setLine(it.id, { qty: e.target.value })}
            disabled={busy}
          />
        ) : (
          <span className="dx-faint">—</span>
        ),
    },
  ];

  // ---------- Stock alerts grid ----------
  const alertColumns: DxGridColumn<StockAlert>[] = [
    {
      key: "item",
      header: "Stock item",
      minWidth: 200,
      sortable: true,
      filter: true,
      accessor: (a) => a.stock_item?.item_name ?? `Stock item #${a.stock_item_id}`,
      render: (a) => (
        <div className="min-w-0">
          <div className="dx-strong truncate">{a.stock_item?.item_name ?? `Stock item #${a.stock_item_id}`}</div>
          {a.stock_item?.batch_no ? <div className="dx-faint text-[11px]">Batch {a.stock_item.batch_no}</div> : null}
        </div>
      ),
    },
    {
      key: "store",
      header: "Store",
      minWidth: 140,
      sortable: true,
      filter: true,
      accessor: (a) => a.store_name ?? a.stock_item?.store?.name ?? "",
      render: (a) => a.store_name ?? a.stock_item?.store?.name ?? "—",
    },
    {
      key: "alert_type",
      header: "Alert",
      width: 130,
      sortable: true,
      filter: {
        options: ["LOW_STOCK", "OUT_OF_STOCK", "EXPIRING", "EXPIRED"].map((v) => ({ value: v, label: humanize(v) })),
      },
      render: (a) => <DxBadge tone={ALERT_TONE[a.alert_type] ?? "warning"}>{humanize(a.alert_type)}</DxBadge>,
    },
    { key: "quantity_on_hand", header: "On hand", width: 90, align: "right", sortable: true, render: (a) => <span className="dx-num">{a.quantity_on_hand ?? a.stock_item?.quantity_on_hand ?? "—"}</span> },
    { key: "reorder_level", header: "Reorder at", width: 90, align: "right", sortable: true, render: (a) => <span className="dx-num">{a.reorder_level ?? a.stock_item?.reorder_level ?? "—"}</span> },
    {
      key: "expiry_date",
      header: "Expiry",
      width: 120,
      sortable: true,
      accessor: (a) => a.expiry_date ?? a.stock_item?.expiry_date ?? "",
      render: (a) => {
        const d = a.expiry_date ?? a.stock_item?.expiry_date;
        if (!d) return <span className="dx-faint">—</span>;
        return (
          <span className={isExpired(d) ? "dx-mono text-[var(--dx-danger)]" : "dx-mono"}>
            {formatDate(d)}
            {a.days_to_expiry != null ? <span className="dx-faint"> · {a.days_to_expiry}d</span> : null}
          </span>
        );
      },
    },
  ];

  const storeOptions = stores.map((s) => ({ value: String(s.id), label: `${s.name} (${s.code})` }));
  const focusedCount = focusVisitId == null ? null : prescriptions.filter((p) => p.visit_id === focusVisitId).length;
  const selectedStore = stores.find((s) => String(s.id) === storeId);

  // ---------- Render ----------
  const showHandoff = !!selected && !!handoff && handoff.prescriptionId === selected.id;

  const body = (
    <>
      {!embedded && (
      <DxPageHeader
        crumbs={[{ label: "Queues", to: routes.queues }, { label: "Pharmacy" }]}
        title="Pharmacy — dispensing"
        subtitle="Verify electronic prescriptions, check stock by batch and expiry, dispense with counselling, then hand the patient on to billing."
        actions={
          <>
            <DxButton leftIcon={<Boxes />} onClick={() => navigate(routes.inventoryItems)}>
              Stock
            </DxButton>
            <DxButton leftIcon={<Pill />} onClick={() => navigate(routes.drugs)}>
              Drugs catalogue
            </DxButton>
            <DxButton leftIcon={<RotateCcw className={worklistQuery.isFetching ? "animate-spin" : undefined} />} onClick={refreshAll}>
              Refresh
            </DxButton>
          </>
        }
      />
      )}

      {!embedded && focusVisitId != null ? (
        <DxMessage
          tone="info"
          title={`Showing prescriptions for visit #${focusVisitId}`}
          action={
            <DxButton size="sm" onClick={clearFocus} leftIcon={<X />}>
              Show all
            </DxButton>
          }
        >
          {worklistQuery.isLoading
            ? "Loading the worklist…"
            : focusedCount
              ? `${focusedCount} prescription${focusedCount === 1 ? "" : "s"} on the worklist for this visit.`
              : "No prescriptions for this visit are on the worklist — it may already be dispensed, or nothing was prescribed."}
        </DxMessage>
      ) : null}

      {!embedded && (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DxKpi
          icon={ClipboardList}
          label="Pending dispense"
          value={stats.pending}
          sub={`${stats.active} active · ${stats.partial} partially dispensed`}
          tone="warning"
          isLoading={worklistQuery.isLoading}
          onClick={() => setTab("WORKLIST")}
        />
        <DxKpi icon={PackageCheck} label="Dispensed today" value={stats.dispensedToday} tone="success" isLoading={worklistQuery.isLoading} />
        <DxKpi
          icon={AlertTriangle}
          label="Stock alerts"
          value={stats.alerts}
          sub={`${stats.lowStock} low / out of stock`}
          tone={stats.alerts ? "danger" : "neutral"}
          isLoading={alertsQuery.isLoading}
          onClick={() => setTab("ALERTS")}
        />
        <DxKpi icon={ListChecks} label="In worklist" value={stats.total} tone="accent" isLoading={worklistQuery.isLoading} />
      </div>
      )}

      {!embedded && (
      <DxTabs<Tab>
        value={tab}
        onChange={setTab}
        items={[
          { key: "WORKLIST", label: "Prescriptions", icon: <ListChecks className="h-3.5 w-3.5" />, count: prescriptions.length },
          { key: "ALERTS", label: "Stock alerts", icon: <AlertTriangle className="h-3.5 w-3.5" />, count: alerts.length },
        ]}
      />
      )}

      {tab === "WORKLIST" ? (
        <div className="grid gap-4 xl:grid-cols-12">
          <div className={selected ? "xl:col-span-7" : "xl:col-span-12"}>
            {!embedded && (
            <DxToolbar attached>
              <DxSearchBox onSearch={setSearch} placeholder="Search patient, hospital no., prescription, visit…" className="w-72" />
              <DxToolbarSeparator />
              <DxToolbarGroup>
                <DxToolbarLabel>Dispensing store</DxToolbarLabel>
                <DxSelect
                  editorSize="sm"
                  aria-label="Dispensing store"
                  value={storeId}
                  onChange={(e) => changeStore(e.target.value)}
                  placeholder="All stores"
                  options={storeOptions}
                  className="w-56"
                />
              </DxToolbarGroup>
              <DxToolbarSpacer />
              <DxButton size="sm" variant="text" icon title="Refresh worklist" onClick={() => worklistQuery.refetch()}>
                <RotateCcw className={worklistQuery.isFetching ? "animate-spin" : undefined} />
              </DxButton>
            </DxToolbar>
            )}
            <DxGrid
              attached
              filterRow
              columns={columns}
              data={visible}
              rowKey={(p) => p.id}
              isLoading={worklistQuery.isLoading}
              error={worklistQuery.isError ? apiErrorMessage(worklistQuery.error, "Unable to load pharmacy worklist.") : null}
              onRetry={() => worklistQuery.refetch()}
              onRowClick={openPrescription}
              selectedKey={selectedId}
              empty={{
                icon: Pill,
                title: prescriptions.length === 0 ? "No prescriptions in the worklist" : "No prescriptions match",
                description:
                  prescriptions.length === 0
                    ? "All caught up — incoming prescriptions will appear here."
                    : focusVisitId != null
                      ? "Nothing on the worklist for the focused visit."
                      : "Try a different search term.",
                action:
                  focusVisitId != null && prescriptions.length > 0 ? (
                    <DxButton size="sm" onClick={clearFocus}>
                      Show all prescriptions
                    </DxButton>
                  ) : undefined,
              }}
            />
          </div>

          {selected ? (
            <DxPanel
              className="xl:col-span-5"
              title={`Prescription ${selected.prescription_no}`}
              icon={<Pill />}
              description={patientNameOf(selected)}
              actions={
                <>
                  <DxStatusBadge status={prescriptionStatus(selected)} />
                  <DxButton size="sm" variant="text" icon title="Close" onClick={closePanel}>
                    <X />
                  </DxButton>
                </>
              }
              footer={
                canDispense ? (
                  <div className="flex items-center justify-end gap-2">
                    <DxButton onClick={closePanel} disabled={busy}>
                      Close
                    </DxButton>
                    <DxButton
                      variant="outline-danger"
                      disabled={busy}
                      onClick={() => {
                        setCancelTarget(selected);
                        setCancelReason("");
                      }}
                    >
                      Cancel prescription
                    </DxButton>
                    <DxButton variant="primary" leftIcon={<Save />} isLoading={busy} onClick={submitDispense}>
                      Dispense
                    </DxButton>
                  </div>
                ) : undefined
              }
            >
              <div className="space-y-4">
                <DxProps
                  tight
                  items={[
                    { label: "Patient", value: <span className="dx-strong">{patientNameOf(selected)}</span> },
                    { label: "Hospital no.", value: <span className="dx-mono">{selected.visit?.patient?.hospital_number ?? "—"}</span> },
                    {
                      label: "Visit",
                      value: selected.visit_id ? (
                        <Link
                          to={routes.visitDetail.replace(":visitId", String(selected.visit_id))}
                          className="inline-flex items-center gap-1 text-[var(--dx-accent)] hover:underline dx-mono"
                        >
                          {selected.visit?.visit_code ?? `#${selected.visit_id}`}
                          <ExternalLink className="h-3 w-3" aria-hidden />
                        </Link>
                      ) : (
                        "—"
                      ),
                    },
                    { label: "Prescribed", value: formatDateTime(selected.prescribed_at || selected.created_at) },
                    { label: "Prescriber", value: staffNameById(staffList, selected.prescribed_by_staff_id) },
                    { label: "Prescriber's note", value: selected.note ? <span className="italic">{selected.note}</span> : "—" },
                  ]}
                />

                {!embedded && showHandoff ? (
                  <DxMessage tone="success" title="Dispensed — hand the patient on">
                    <p>
                      Counsel the patient, then complete the pharmacy step so {handoff?.patientName ?? "the patient"} is queued at the next
                      service point (usually billing) or the visit is closed.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <DxButton
                        size="sm"
                        variant="primary"
                        rightIcon={<ArrowRight />}
                        isLoading={advanceMutation.isPending}
                        onClick={() => setAdvanceOpen(true)}
                      >
                        Complete pharmacy step &amp; route
                      </DxButton>
                      <DxButton size="sm" leftIcon={<ArrowLeft />} onClick={() => navigate(routes.queues)} disabled={advanceMutation.isPending}>
                        Back to queue
                      </DxButton>
                    </div>
                  </DxMessage>
                ) : null}

                {formError ? (
                  <DxMessage tone="danger" title="Cannot dispense">
                    {formError}
                  </DxMessage>
                ) : null}

                {!canDispense && !showHandoff ? (
                  <DxMessage tone="info">
                    This prescription is {humanize(prescriptionStatus(selected)).toLowerCase()}; there is nothing left to dispense.
                  </DxMessage>
                ) : null}

                <DxGrid
                  columns={lineColumns}
                  data={selectedItems}
                  rowKey={(it) => it.id}
                  striped={false}
                  isLoading={stockQuery.isLoading && selectedItems.length > 0}
                  empty={{ title: "No items on this prescription" }}
                  summary={{
                    drug: <span className="dx-muted">{selectedItems.length} line{selectedItems.length === 1 ? "" : "s"}</span>,
                    quantity: <span className="dx-num">{selectedItems.reduce((s, it) => s + (it.quantity ?? 0), 0)}</span>,
                    dispense_qty: canDispense ? (
                      <span className="dx-num">{selectedItems.reduce((s, it) => s + (Number(lines[it.id]?.qty) || 0), 0)}</span>
                    ) : null,
                  }}
                />

                {canDispense ? (
                  <DxGroupBox caption="Dispense">
                    <DxForm cols={2}>
                      <DxSelect
                        label="Pharmacy store"
                        hint={selectedStore ? selectedStore.location_description || selectedStore.code : "Stock is drawn from the selected store."}
                        value={storeId}
                        onChange={(e) => changeStore(e.target.value)}
                        placeholder="— No store linkage —"
                        options={storeOptions}
                        disabled={busy}
                      />
                      <DxSelect
                        label="Dispensed by"
                        required
                        value={staffId}
                        onChange={(e) => setStaffOverride(e.target.value)}
                        placeholder="Pick pharmacist…"
                        options={staffList.map((s) => ({ value: String(s.id), label: staffDisplayName(s) }))}
                        disabled={busy}
                        error={formError && !staffId ? "Required" : undefined}
                      />
                      <DxTextarea
                        label="Counselling note (optional)"
                        fieldClassName="dx-col-span-full"
                        rows={2}
                        placeholder="Counselling given, substitution rationale, partial-supply reason…"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        disabled={busy}
                      />
                    </DxForm>
                  </DxGroupBox>
                ) : null}
              </div>
            </DxPanel>
          ) : null}
        </div>
      ) : (
        <DxPanel
          title="Stock alerts"
          icon={<AlertTriangle />}
          description="Low or exhausted stock and batches that are expiring or expired."
          flush
          actions={
            <>
              <DxButton size="sm" onClick={() => navigate(routes.inventoryItems)} leftIcon={<Boxes />}>
                Manage stock
              </DxButton>
              <DxButton size="sm" variant="text" icon title="Refresh alerts" onClick={() => alertsQuery.refetch()}>
                <RotateCcw className={alertsQuery.isFetching ? "animate-spin" : undefined} />
              </DxButton>
            </>
          }
        >
          <DxGrid
            borderless
            filterRow
            columns={alertColumns}
            data={alerts}
            rowKey={(a, i) => `${a.stock_item_id}-${a.alert_type}-${i}`}
            isLoading={alertsQuery.isLoading}
            error={alertsQuery.isError ? apiErrorMessage(alertsQuery.error, "Unable to load stock alerts.") : null}
            onRetry={() => alertsQuery.refetch()}
            empty={{ icon: CheckCircle2, title: "No stock alerts", description: "All stock levels are healthy and nothing is expiring soon." }}
          />
        </DxPanel>
      )}

      <DxStatusBar>
        <DxStatusItem>
          Worklist: <b>{prescriptions.length}</b>
          {visible.length !== prescriptions.length ? <span className="dx-faint"> ({visible.length} shown)</span> : null}
        </DxStatusItem>
        <DxStatusItem>
          Pending: <b>{stats.pending}</b>
        </DxStatusItem>
        <DxStatusItem>
          Store: <b>{selectedStore?.name ?? "All stores"}</b>
        </DxStatusItem>
        <DxStatusItem>
          Dispensing as: <b>{staffNameById(staffList, staffId ? Number(staffId) : null)}</b>
        </DxStatusItem>
        <span className="ml-auto">Pharmacy is usually the last clinical stop before billing closes the visit.</span>
      </DxStatusBar>

      {/* Cancel prescription */}
      <DxPopup
        isOpen={!!cancelTarget}
        onClose={() => !cancelMutation.isPending && setCancelTarget(null)}
        title="Cancel prescription"
        size="sm"
        locked={cancelMutation.isPending}
        footer={
          <>
            <DxButton onClick={() => setCancelTarget(null)} disabled={cancelMutation.isPending}>
              Close
            </DxButton>
            <DxButton
              variant="danger"
              disabled={!cancelReason.trim()}
              isLoading={cancelMutation.isPending}
              onClick={() => cancelTarget && cancelMutation.mutate(cancelTarget)}
            >
              Cancel prescription
            </DxButton>
          </>
        }
      >
        {cancelTarget ? (
          <div className="space-y-3">
            <DxProps
              tight
              items={[
                { label: "Prescription", value: <span className="dx-mono">{cancelTarget.prescription_no}</span> },
                { label: "Patient", value: patientNameOf(cancelTarget) },
                { label: "Items", value: prescriptionItems(cancelTarget).length },
              ]}
            />
            <DxTextarea
              label="Reason"
              required
              rows={3}
              placeholder="Why is this prescription being cancelled?"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              disabled={cancelMutation.isPending}
            />
          </div>
        ) : null}
      </DxPopup>

      {/* Complete the pharmacy step on the visit pathway */}
      {!embedded && (
      <DxConfirm
        isOpen={advanceOpen}
        onClose={() => setAdvanceOpen(false)}
        tone="primary"
        title="Complete pharmacy step"
        confirmLabel="Complete & route"
        description={
          <>
            This closes the pharmacy stage for <b className="dx-strong">{handoff?.patientName ?? "the patient"}</b> and queues them at the next
            service point on their pathway — or completes the visit when pharmacy was the last stop.
          </>
        }
        onConfirm={async () => {
          if (handoff) await advanceMutation.mutateAsync(handoff.visitId).catch(() => undefined);
        }}
      />
      )}
    </>
  );

  return embedded ? <div className="space-y-4">{body}</div> : <DxPage>{body}</DxPage>;
}
