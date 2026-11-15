import { useMemo, useState, type MouseEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Ban,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Droplets,
  Edit3,
  ExternalLink,
  FileText,
  FlaskConical,
  Layers,
  PlayCircle,
  RotateCcw,
  Search,
  TestTube2,
} from "lucide-react";
import {
  DxBadge,
  DxButton,
  DxForm,
  DxGrid,
  DxInput,
  DxKpi,
  DxMessage,
  DxPage,
  DxPageHeader,
  DxPager,
  DxPanel,
  DxPopup,
  DxProps,
  DxSearchBox,
  DxSelect,
  DxStatusBadge,
  DxStatusBar,
  DxStatusItem,
  DxTextarea,
  DxToolbar,
  DxToolbarGroup,
  DxToolbarLabel,
  DxToolbarSeparator,
  DxToolbarSpacer,
  apiErrorMessage,
  formatDateTime,
  formatTime,
  type DxGridColumn,
} from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import { routes } from "@/config/routes";
import { getStaff, staffDisplayName, type Staff } from "@/features/staff/api/staff.api";
import {
  cancelLabOrder,
  cancelLabOrderItem,
  collectSpecimen,
  listLabOrdersForVisit,
  listLabWorklist,
  startProcessing,
  type LabOrder,
} from "../api/lab-orders.api";
import { listLabTests } from "../api/lab-tests.api";
import {
  ORDER_STATUS_FILTERS,
  ORDER_STATUS_GRID_OPTIONS,
  canCollectItem,
  canStartItem,
  catalogTestOf,
  collectedAtOf,
  currentStaffId,
  flagFromResult,
  hospitalNumberOf,
  inDateRange,
  isClosedStatus,
  isCollectedOrder,
  isPendingOrder,
  isResultReady,
  isResultStage,
  isToday,
  itemsOf,
  normStatus,
  orderMatchesSearch,
  orderMatchesStatus,
  orderedAtOf,
  patientNameOf,
  sortOrdersDesc,
  staffLabel,
  testCodeOf,
  testNameOf,
  toTestMap,
  type WorklistItem,
  type WorklistOrder,
} from "../lib/lab-worklist";

const PAGE_SIZE = 25;
const WORKLIST_KEY = ["lab", "worklist"] as const;

type CollectForm = { specimen_id: string; collected_by_staff_id: string; note: string };
type CollectErrors = Partial<Record<keyof CollectForm, string>>;

type Popup =
  | { kind: "collect"; order: WorklistOrder; item: WorklistItem }
  | { kind: "cancel-item"; order: WorklistOrder; item: WorklistItem }
  | { kind: "cancel-order"; order: WorklistOrder }
  | null;

const stop = (e: MouseEvent) => e.stopPropagation();

/**
 * Laboratory worklist. Orders raised by clinicians land here; the scientist
 * logs the sample (Collect), starts the analytical phase and hands the item to
 * the results queue for entry, verification and release.
 */
export function LabOrdersPage(props: { visitId?: number; embedded?: boolean } = {}) {
  const embedded = props.embedded ?? false;
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const visitParam = Number(searchParams.get("visit"));
  const paramVisitId = Number.isFinite(visitParam) && visitParam > 0 ? visitParam : null;
  const visitId = props.visitId ?? paramVisitId;

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [popup, setPopup] = useState<Popup>(null);
  const [collectForm, setCollectForm] = useState<CollectForm>({ specimen_id: "", collected_by_staff_id: "", note: "" });
  const [collectErrors, setCollectErrors] = useState<CollectErrors>({});
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);

  // ---------- Data ----------
  const worklistQuery = useQuery({
    queryKey: [...WORKLIST_KEY, visitId ? { visitId } : { statusFilter, page }],
    queryFn: () =>
      visitId
        ? listLabOrdersForVisit(visitId)
        : listLabWorklist({ skip: (page - 1) * PAGE_SIZE, limit: PAGE_SIZE, status: statusFilter || undefined }),
    placeholderData: (prev) => prev,
  });
  const staffQuery = useQuery({ queryKey: ["staff", "list", 200], queryFn: () => getStaff(0, 200), staleTime: 5 * 60_000 });
  const testsQuery = useQuery({ queryKey: ["lab", "tests", "all"], queryFn: () => listLabTests({ limit: 200 }), staleTime: 5 * 60_000 });

  const staffList = useMemo<Staff[]>(() => staffQuery.data ?? [], [staffQuery.data]);
  const tests = useMemo(() => toTestMap(testsQuery.data?.items), [testsQuery.data]);
  const defaultStaffId = useMemo(() => currentStaffId(staffList), [staffList]);

  const orders = useMemo(
    () => sortOrdersDesc((worklistQuery.data?.items ?? []) as WorklistOrder[]),
    [worklistQuery.data],
  );
  const total = worklistQuery.data?.meta?.total ?? worklistQuery.data?.count ?? orders.length;
  const totalPages = visitId ? 1 : Math.max(1, Math.ceil(total / PAGE_SIZE));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter(
      (o) => orderMatchesStatus(o, statusFilter) && inDateRange(orderedAtOf(o), dateFrom, dateTo) && orderMatchesSearch(o, q, tests),
    );
  }, [orders, statusFilter, dateFrom, dateTo, search, tests]);

  const selectedOrder = useMemo(() => {
    const explicit = selectedId != null ? filtered.find((o) => o.id === selectedId) : undefined;
    if (explicit) return explicit;
    return visitId && filtered.length === 1 ? filtered[0] : null;
  }, [filtered, selectedId, visitId]);

  const stats = useMemo(() => {
    let pending = 0;
    let collected = 0;
    let resultReady = 0;
    let completedToday = 0;
    for (const o of orders) {
      if (isPendingOrder(o.status)) pending++;
      else if (isCollectedOrder(o.status)) collected++;
      if (isResultReady(o.status) || itemsOf(o).some((i) => isResultReady(i.status))) resultReady++;
      if (normStatus(o.status) === "COMPLETED" && isToday(o.updated_at)) completedToday++;
    }
    return { pending, collected, resultReady, completedToday };
  }, [orders]);

  // ---------- Cache helpers ----------
  const applyOrder = (updated: LabOrder) => {
    qc.setQueriesData<{ items?: LabOrder[] }>({ queryKey: WORKLIST_KEY }, (old) =>
      old?.items ? { ...old, items: old.items.map((o) => (o.id === updated.id ? updated : o)) } : old,
    );
    qc.invalidateQueries({ queryKey: WORKLIST_KEY });
  };

  // ---------- Mutations ----------
  const startMutation = useMutation({
    mutationFn: (item: WorklistItem) => startProcessing(item.id),
    onSuccess: (res) => {
      applyOrder(res.lab_order);
      toast.success("Processing started", res.message);
    },
    onError: (err) => toast.error("Could not start processing", apiErrorMessage(err)),
  });

  const collectMutation = useMutation({
    mutationFn: (item: WorklistItem) =>
      collectSpecimen(item.id, {
        specimen_id: collectForm.specimen_id.trim(),
        collected_by_staff_id: Number(collectForm.collected_by_staff_id),
        note: collectForm.note.trim() || undefined,
      }),
    onSuccess: (res) => {
      applyOrder(res.lab_order);
      toast.success("Specimen collected", res.message);
      setPopup(null);
    },
    onError: (err) => toast.error("Could not log the specimen", apiErrorMessage(err)),
  });

  const cancelItemMutation = useMutation({
    mutationFn: (item: WorklistItem) => cancelLabOrderItem(item.id, { reason: reason.trim() }),
    onSuccess: (res) => {
      applyOrder(res.lab_order);
      toast.success("Test item cancelled", res.message);
      setPopup(null);
    },
    onError: (err) => toast.error("Could not cancel the item", apiErrorMessage(err)),
  });

  const cancelOrderMutation = useMutation({
    mutationFn: (order: WorklistOrder) => cancelLabOrder(order.id, { reason: reason.trim() }),
    onSuccess: (res) => {
      applyOrder(res.lab_order);
      toast.success("Order cancelled", res.message);
      setPopup(null);
    },
    onError: (err) => toast.error("Could not cancel the order", apiErrorMessage(err)),
  });

  const popupBusy = collectMutation.isPending || cancelItemMutation.isPending || cancelOrderMutation.isPending;

  // ---------- Handlers ----------
  const openCollect = (order: WorklistOrder, item: WorklistItem) => {
    setCollectForm({ specimen_id: "", collected_by_staff_id: defaultStaffId != null ? String(defaultStaffId) : "", note: "" });
    setCollectErrors({});
    setPopup({ kind: "collect", order, item });
  };
  const openCancelItem = (order: WorklistOrder, item: WorklistItem) => {
    setReason("");
    setReasonError(null);
    setPopup({ kind: "cancel-item", order, item });
  };
  const openCancelOrder = (order: WorklistOrder) => {
    setReason("");
    setReasonError(null);
    setPopup({ kind: "cancel-order", order });
  };
  const closePopup = () => {
    if (!popupBusy) setPopup(null);
  };

  const submitCollect = () => {
    if (popup?.kind !== "collect") return;
    const errs: CollectErrors = {};
    if (!collectForm.specimen_id.trim()) errs.specimen_id = "Specimen ID is required.";
    if (!collectForm.collected_by_staff_id) errs.collected_by_staff_id = "Select the staff member collecting the specimen.";
    setCollectErrors(errs);
    if (Object.keys(errs).length) return;
    collectMutation.mutate(popup.item);
  };

  const submitCancel = () => {
    if (!popup || popup.kind === "collect") return;
    if (!reason.trim()) {
      setReasonError(popup.kind === "cancel-order" ? "A reason is required to cancel the order." : "A reason is required to cancel an item.");
      return;
    }
    setReasonError(null);
    if (popup.kind === "cancel-item") cancelItemMutation.mutate(popup.item);
    else cancelOrderMutation.mutate(popup.order);
  };

  const openResults = (item: WorklistItem) =>
    navigate(
      { pathname: routes.labResults, search: visitId ? `?visit=${visitId}` : "" },
      { state: { focusItemId: item.id } },
    );

  const clearVisitFocus = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("visit");
    setSearchParams(next, { replace: true });
    setSelectedId(null);
  };

  const changeStatus = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };

  // ---------- Grids ----------
  const orderColumns: DxGridColumn<WorklistOrder>[] = [
    {
      key: "order_no",
      header: "Order",
      width: 190,
      sortable: true,
      filter: true,
      render: (o) => (
        <div className="min-w-0">
          <div className="dx-mono dx-strong truncate">{o.order_no}</div>
          <div className="dx-faint text-[11px]">#{o.id}</div>
        </div>
      ),
    },
    {
      key: "patient",
      header: "Patient",
      minWidth: 180,
      sortable: true,
      filter: true,
      accessor: (o) => patientNameOf(o),
      render: (o) => {
        const name = patientNameOf(o);
        const hn = hospitalNumberOf(o);
        return (
          <div className="min-w-0">
            <div className="dx-strong truncate">{name || <span className="dx-faint">Unknown patient</span>}</div>
            {hn ? <div className="dx-mono dx-faint text-[11px]">{hn}</div> : null}
          </div>
        );
      },
    },
    {
      key: "visit",
      header: "Visit",
      width: 150,
      accessor: (o) => o.visit?.visit_code ?? String(o.visit_id),
      filter: true,
      render: (o) => (
        <Link
          to={routes.visitDetail.replace(":visitId", String(o.visit_id))}
          onClick={stop}
          className="dx-link dx-mono inline-flex items-center gap-1"
        >
          {o.visit?.visit_code ?? `Visit #${o.visit_id}`}
          <ExternalLink className="h-3 w-3" aria-hidden />
        </Link>
      ),
    },
    {
      key: "items",
      header: "Tests",
      width: 110,
      align: "center",
      accessor: (o) => itemsOf(o).length,
      sortable: true,
      render: (o) => {
        const items = itemsOf(o);
        const done = items.filter((i) => normStatus(i.status) === "COMPLETED").length;
        return (
          <span className="dx-num">
            {done}/{items.length}
          </span>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      width: 150,
      sortable: true,
      filter: { options: ORDER_STATUS_GRID_OPTIONS },
      accessor: (o) => normStatus(o.status),
      render: (o) => <DxStatusBadge status={o.status} />,
    },
    {
      key: "ordered_at",
      header: "Ordered",
      width: 150,
      sortable: true,
      accessor: (o) => orderedAtOf(o),
      render: (o) => <span className="dx-mono">{formatDateTime(orderedAtOf(o))}</span>,
    },
    {
      key: "actions",
      header: "",
      width: 56,
      align: "right",
      render: (o) =>
        !isClosedStatus(o.status) ? (
          <DxButton
            size="sm"
            variant="text"
            icon
            title="Cancel order"
            onClick={(e) => {
              stop(e);
              openCancelOrder(o);
            }}
          >
            <Ban />
          </DxButton>
        ) : null,
    },
  ];

  const itemColumns: DxGridColumn<WorklistItem>[] = [
    {
      key: "test",
      header: "Test",
      minWidth: 180,
      sortable: true,
      accessor: (i) => testNameOf(i, tests),
      render: (i) => {
        const code = testCodeOf(i, tests);
        return (
          <div className="min-w-0">
            <div className="dx-strong truncate">{testNameOf(i, tests)}</div>
            {code ? <div className="dx-mono dx-faint text-[11px]">{code}</div> : null}
          </div>
        );
      },
    },
    {
      key: "specimen",
      header: "Specimen",
      width: 170,
      accessor: (i) => i.specimen_id ?? "",
      render: (i) => {
        const type = catalogTestOf(i, tests)?.sample_type;
        return (
          <div className="min-w-0">
            <div className="dx-mono truncate">{i.specimen_id || <span className="dx-faint">not collected</span>}</div>
            {type ? <div className="dx-faint text-[11px] truncate">{type}</div> : null}
          </div>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      width: 140,
      sortable: true,
      accessor: (i) => normStatus(i.status),
      render: (i) => <DxStatusBadge status={i.status} />,
    },
    {
      key: "collected_at",
      header: "Collected",
      width: 140,
      sortable: true,
      accessor: (i) => collectedAtOf(i) ?? "",
      render: (i) => <span className="dx-mono">{formatDateTime(collectedAtOf(i))}</span>,
    },
    {
      key: "result",
      header: "Result",
      width: 110,
      align: "right",
      render: (i) => (i.result?.result_value ? <span className="dx-mono dx-strong">{i.result.result_value}</span> : <span className="dx-faint">—</span>),
    },
    {
      key: "unit",
      header: "Unit",
      width: 90,
      render: (i) => i.result?.unit_of_measure || catalogTestOf(i, tests)?.unit_of_measure || <span className="dx-faint">—</span>,
    },
    {
      key: "reference_range",
      header: "Reference",
      width: 130,
      render: (i) => <span className="dx-mono">{i.result?.reference_range || catalogTestOf(i, tests)?.reference_range || "—"}</span>,
    },
    {
      key: "flag",
      header: "Flag",
      width: 80,
      align: "center",
      render: (i) => {
        const flag = flagFromResult(i.result);
        return flag ? <DxBadge tone="danger">{flag}</DxBadge> : <span className="dx-faint">—</span>;
      },
    },
    {
      key: "actions",
      header: "Actions",
      width: 260,
      align: "right",
      render: (i) => {
        if (!selectedOrder) return null;
        const status = normStatus(i.status);
        const closed = isClosedStatus(status);
        const resultLabel = isResultReady(status) ? "Verify & Release" : "Enter results";
        return (
          <div className="flex flex-wrap items-center justify-end gap-1">
            {canCollectItem(status) ? (
              <DxButton size="sm" variant="primary" leftIcon={<Droplets />} onClick={() => openCollect(selectedOrder, i)}>
                Collect
              </DxButton>
            ) : null}
            {canStartItem(status) ? (
              <DxButton
                size="sm"
                variant="primary"
                leftIcon={<PlayCircle />}
                isLoading={startMutation.isPending && startMutation.variables?.id === i.id}
                disabled={startMutation.isPending}
                onClick={() => startMutation.mutate(i)}
              >
                Start processing
              </DxButton>
            ) : null}
            {!embedded && isResultStage(status) && status !== "COMPLETED" ? (
              <DxButton size="sm" variant={isResultReady(status) ? "primary" : "default"} leftIcon={isResultReady(status) ? <ClipboardCheck /> : <Edit3 />} onClick={() => openResults(i)}>
                {resultLabel}
              </DxButton>
            ) : null}
            {!embedded && status === "COMPLETED" ? (
              <DxButton size="sm" variant="text" leftIcon={<FileText />} onClick={() => openResults(i)}>
                View result
              </DxButton>
            ) : null}
            {!closed ? (
              <DxButton size="sm" variant="text" icon title="Cancel item" onClick={() => openCancelItem(selectedOrder, i)}>
                <Ban />
              </DxButton>
            ) : null}
          </div>
        );
      },
    },
  ];

  // ---------- Render ----------
  const loadError = worklistQuery.isError ? apiErrorMessage(worklistQuery.error, "Unable to load lab worklist.") : null;
  const selectedItems = selectedOrder ? itemsOf(selectedOrder) : [];

  const body = (
    <>
      {!embedded && (
      <DxPageHeader
        crumbs={[{ label: "Laboratory", to: routes.laboratory }, { label: "Worklist" }]}
        title="Laboratory worklist"
        subtitle="Collect specimens, run tests and route results back to the clinician."
        actions={
          <>
            <DxButton leftIcon={<FileText />} onClick={() => navigate(routes.labResults)}>
              Results queue
            </DxButton>
            <DxButton leftIcon={<Search />} onClick={() => navigate(routes.labTracker)}>
              Result tracker
            </DxButton>
            <DxButton leftIcon={<Layers />} onClick={() => navigate(routes.labTests)}>
              Tests catalogue
            </DxButton>
          </>
        }
      >
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <DxKpi label="Pending collection" value={stats.pending} icon={Clock} tone="warning" isLoading={worklistQuery.isLoading} sub="orders awaiting a specimen" />
          <DxKpi label="Collected / in progress" value={stats.collected} icon={Activity} tone="info" isLoading={worklistQuery.isLoading} sub="in the analytical phase" />
          <DxKpi label="Result ready" value={stats.resultReady} icon={ClipboardCheck} tone="accent" isLoading={worklistQuery.isLoading} sub="verified, awaiting release" />
          <DxKpi label="Completed today" value={stats.completedToday} icon={CheckCircle2} tone="success" isLoading={worklistQuery.isLoading} sub={`${total} order${total === 1 ? "" : "s"} in view`} />
        </div>
      </DxPageHeader>
      )}

      {!embedded && visitId ? (
        <DxMessage
          tone="info"
          action={
            <DxButton size="sm" onClick={clearVisitFocus}>
              Show all
            </DxButton>
          }
        >
          Showing orders for visit <b className="dx-mono">#{visitId}</b>
          {filtered[0]?.visit?.visit_code ? <> ({filtered[0].visit.visit_code})</> : null}. Clear the focus to see the whole worklist.
        </DxMessage>
      ) : null}

      <div>
        {!embedded && (
        <DxToolbar attached>
          <DxSearchBox onSearch={setSearch} placeholder="Order #, patient, hospital no., test, specimen…" className="w-80" />
          <DxToolbarSeparator />
          <DxSelect editorSize="sm" aria-label="Order status" value={statusFilter} onChange={(e) => changeStatus(e.target.value)} options={ORDER_STATUS_FILTERS} className="w-44" />
          <DxToolbarSeparator />
          <DxToolbarGroup>
            <DxToolbarLabel>Ordered</DxToolbarLabel>
            <DxInput type="date" editorSize="sm" aria-label="Ordered from" value={dateFrom} max={dateTo || undefined} onChange={(e) => setDateFrom(e.target.value)} className="w-36" />
            <DxToolbarLabel>to</DxToolbarLabel>
            <DxInput type="date" editorSize="sm" aria-label="Ordered to" value={dateTo} min={dateFrom || undefined} onChange={(e) => setDateTo(e.target.value)} className="w-36" />
            {dateFrom || dateTo ? (
              <DxButton
                size="sm"
                variant="text"
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                }}
              >
                Clear
              </DxButton>
            ) : null}
          </DxToolbarGroup>
          <DxToolbarSeparator />
          <DxButton size="sm" variant="text" leftIcon={<RotateCcw className={worklistQuery.isFetching ? "animate-spin" : undefined} />} onClick={() => worklistQuery.refetch()}>
            Refresh
          </DxButton>
          <DxToolbarSpacer />
          <DxButton
            variant="primary"
            leftIcon={<FileText />}
            disabled={!selectedOrder || !selectedItems.some((i) => isResultStage(i.status) && normStatus(i.status) !== "COMPLETED")}
            onClick={() => {
              const target = selectedItems.find((i) => isResultStage(i.status) && normStatus(i.status) !== "COMPLETED");
              if (target) openResults(target);
            }}
          >
            Open in results queue
          </DxButton>
        </DxToolbar>
        )}
        <DxGrid
          attached
          filterRow
          columns={orderColumns}
          data={filtered}
          rowKey={(o) => o.id}
          isLoading={worklistQuery.isLoading}
          error={loadError}
          onRetry={() => worklistQuery.refetch()}
          onRowClick={(o) => setSelectedId(o.id)}
          selectedKey={selectedOrder?.id ?? null}
          empty={{
            icon: FlaskConical,
            title: orders.length === 0 ? "The worklist is empty" : "No orders match your filters",
            description:
              orders.length === 0
                ? visitId
                  ? "This visit has no laboratory orders yet."
                  : "Lab orders raised by clinicians will appear here."
                : "Adjust the status, date or search filters.",
          }}
          footer={
            <DxPager
              page={visitId ? 1 : page}
              totalPages={totalPages}
              totalItems={total}
              pageSize={PAGE_SIZE}
              onPageChange={(p) => {
                setPage(p);
                setSelectedId(null);
              }}
            />
          }
        />
      </div>

      {selectedOrder ? (
        <DxPanel
          title={
            <span className="inline-flex items-center gap-2">
              Order <span className="dx-mono">{selectedOrder.order_no}</span>
              <DxStatusBadge status={selectedOrder.status} />
            </span>
          }
          icon={<FlaskConical />}
          description={`${selectedItems.length} test${selectedItems.length === 1 ? "" : "s"} · ordered ${formatDateTime(orderedAtOf(selectedOrder))}`}
          flush
          actions={
            <>
              {!isClosedStatus(selectedOrder.status) ? (
                <DxButton size="sm" variant="outline-danger" leftIcon={<Ban />} onClick={() => openCancelOrder(selectedOrder)}>
                  Cancel order
                </DxButton>
              ) : null}
              <DxButton size="sm" variant="text" onClick={() => setSelectedId(null)}>
                Close
              </DxButton>
            </>
          }
        >
          <div className="grid gap-0 xl:grid-cols-12">
            <div className="border-b border-[var(--dx-border)] p-4 xl:col-span-3 xl:border-b-0 xl:border-r">
              <DxProps
                tight
                items={[
                  { label: "Patient", value: patientNameOf(selectedOrder) || "—" },
                  { label: "Hospital no.", value: hospitalNumberOf(selectedOrder) ? <span className="dx-mono">{hospitalNumberOf(selectedOrder)}</span> : "—" },
                  {
                    label: "Visit",
                    value: (
                      <Link to={routes.visitDetail.replace(":visitId", String(selectedOrder.visit_id))} className="dx-link dx-mono">
                        {selectedOrder.visit?.visit_code ?? `#${selectedOrder.visit_id}`}
                      </Link>
                    ),
                  },
                  { label: "Ordered", value: formatDateTime(orderedAtOf(selectedOrder)) },
                  { label: "Clinical note", value: selectedOrder.clinical_note ? <span className="whitespace-pre-wrap">{selectedOrder.clinical_note}</span> : <span className="dx-faint">None</span> },
                ]}
              />
            </div>
            <div className="xl:col-span-9">
              <DxGrid
                borderless
                columns={itemColumns}
                data={selectedItems}
                rowKey={(i) => i.id}
                striped
                empty={{ icon: TestTube2, title: "No items on this order" }}
              />
            </div>
          </div>
        </DxPanel>
      ) : (
        <DxMessage tone="info">Select an order to see its tests, log specimens and hand items to the results queue.</DxMessage>
      )}

      <DxStatusBar>
        <DxStatusItem>
          Showing <b>{filtered.length}</b> of <b>{orders.length}</b> loaded · <b>{total}</b> total
        </DxStatusItem>
        {selectedOrder ? (
          <DxStatusItem>
            Selected: <b className="dx-mono">{selectedOrder.order_no}</b>
          </DxStatusItem>
        ) : null}
        <span className="ml-auto inline-flex items-center gap-1.5">
          <Clock className="h-3 w-3" aria-hidden />
          {worklistQuery.isFetching ? "Refreshing…" : `Updated ${formatTime(worklistQuery.dataUpdatedAt ? new Date(worklistQuery.dataUpdatedAt).toISOString() : null)}`}
        </span>
      </DxStatusBar>

      {/* Collect specimen */}
      <DxPopup
        isOpen={popup?.kind === "collect"}
        onClose={closePopup}
        title="Collect specimen"
        size="md"
        locked={collectMutation.isPending}
        footer={
          <>
            <DxButton onClick={closePopup} disabled={collectMutation.isPending}>
              Cancel
            </DxButton>
            <DxButton variant="primary" leftIcon={<Droplets />} isLoading={collectMutation.isPending} onClick={submitCollect}>
              Mark collected
            </DxButton>
          </>
        }
      >
        {popup?.kind === "collect" ? (
          <div className="space-y-4">
            <DxProps
              tight
              items={[
                { label: "Order", value: <span className="dx-mono">{popup.order.order_no}</span> },
                { label: "Patient", value: patientNameOf(popup.order) || "—" },
                {
                  label: "Test",
                  value: (
                    <>
                      {testNameOf(popup.item, tests)}
                      {catalogTestOf(popup.item, tests)?.sample_type ? <span className="dx-faint"> · {catalogTestOf(popup.item, tests)?.sample_type}</span> : null}
                    </>
                  ),
                },
              ]}
            />
            <DxForm cols={2}>
              <DxInput
                label="Specimen ID"
                required
                mono
                autoFocus
                placeholder="LAB-2026-04-001"
                value={collectForm.specimen_id}
                onChange={(e) => setCollectForm((f) => ({ ...f, specimen_id: e.target.value.toUpperCase() }))}
                error={collectErrors.specimen_id}
                disabled={collectMutation.isPending}
              />
              <DxSelect
                label="Collected by"
                required
                placeholder="Select collector…"
                value={collectForm.collected_by_staff_id}
                onChange={(e) => setCollectForm((f) => ({ ...f, collected_by_staff_id: e.target.value }))}
                options={staffList.map((s) => ({ value: String(s.id), label: staffLabel(s, staffDisplayName(s)) }))}
                error={collectErrors.collected_by_staff_id}
                disabled={collectMutation.isPending}
              />
              <DxTextarea
                label="Note (optional)"
                fieldClassName="dx-col-span-full"
                rows={3}
                placeholder="Pre-analytical notes, sample condition, container type…"
                value={collectForm.note}
                onChange={(e) => setCollectForm((f) => ({ ...f, note: e.target.value }))}
                disabled={collectMutation.isPending}
              />
            </DxForm>
          </div>
        ) : null}
      </DxPopup>

      {/* Cancel item / order (reason required) */}
      <DxPopup
        isOpen={popup?.kind === "cancel-item" || popup?.kind === "cancel-order"}
        onClose={closePopup}
        title={popup?.kind === "cancel-order" ? "Cancel lab order" : "Cancel test item"}
        size="sm"
        locked={cancelItemMutation.isPending || cancelOrderMutation.isPending}
        footer={
          <>
            <DxButton onClick={closePopup} disabled={cancelItemMutation.isPending || cancelOrderMutation.isPending}>
              Keep
            </DxButton>
            <DxButton variant="danger" leftIcon={<Ban />} isLoading={cancelItemMutation.isPending || cancelOrderMutation.isPending} onClick={submitCancel}>
              {popup?.kind === "cancel-order" ? "Cancel order" : "Cancel item"}
            </DxButton>
          </>
        }
      >
        {popup && popup.kind !== "collect" ? (
          <div className="space-y-4">
            <DxMessage tone="warning">
              {popup.kind === "cancel-order" ? (
                <>
                  All open items on <b className="dx-mono">{popup.order.order_no}</b> will be cancelled. This cannot be undone.
                </>
              ) : (
                <>
                  <b>{testNameOf(popup.item, tests)}</b> will be removed from <b className="dx-mono">{popup.order.order_no}</b>. This cannot be undone.
                </>
              )}
            </DxMessage>
            <DxTextarea
              label="Reason"
              required
              autoFocus
              rows={3}
              placeholder={popup.kind === "cancel-order" ? "Why is this entire order being cancelled?" : "Why is this test item being cancelled?"}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              error={reasonError}
            />
          </div>
        ) : null}
      </DxPopup>
    </>
  );

  return embedded ? <div className="space-y-4">{body}</div> : <DxPage>{body}</DxPage>;
}
