import { useCallback, useMemo, useState, type MouseEvent } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  Beaker,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Edit3,
  ExternalLink,
  FlaskConical,
  Layers,
  Download,
  RotateCcw,
  Send,
  TestTube2,
} from "lucide-react";
import {
  DxBadge,
  DxButton,
  DxCheckbox,
  DxConfirm,
  DxForm,
  DxGrid,
  DxGroupBox,
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
  formatDateTime,
  formatTime,
  statusTone,
  type DxGridColumn,
} from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import { routes } from "@/config/routes";
import { getStaff, staffDisplayName, type Staff } from "@/features/staff/api/staff.api";
import {
  listActiveServiceDeliveryPoints,
  type ServiceDeliveryPoint,
} from "@/features/service-delivery-points/api/service-delivery-points.api";
import { downloadLabReport, listLabOrdersForVisit, listLabWorklist, type LabOrder } from "../api/lab-orders.api";
import {
  cancelLabResult,
  enterLabResult,
  getLabResultByItem,
  releaseLabResult,
  updateLabResult,
  verifyLabResult,
  type LabResult,
} from "../api/lab-results.api";
import { listLabTests } from "../api/lab-tests.api";
import {
  BUCKET_LABEL,
  BUCKET_STATUS,
  RESULT_TABS,
  applyGridFilters,
  buildResultRows,
  catalogTestOf,
  collectedAtOf,
  currentStaffId,
  flagFromResult,
  hospitalNumberOf,
  inDateRange,
  isRealResult,
  isResultStage,
  isToday,
  itemsOf,
  paginate,
  patientNameOf,
  resultFlag,
  rowMatchesSearch,
  staffLabel,
  testCodeOf,
  testNameOf,
  toTestMap,
  type ResultBucket,
  type ResultRow,
  type ResultTab,
  type WorklistOrder,
} from "../lib/lab-worklist";

const PAGE_SIZE = 25;
const WORKLIST_KEY = ["lab", "worklist"] as const;
const byItemKey = (itemId: number) => ["lab", "result", "by-item", itemId] as const;

type EntryForm = {
  result_value: string;
  result_text: string;
  unit_of_measure: string;
  reference_range: string;
  interpretation: string;
  entered_by_staff_id: string;
};
const EMPTY_ENTRY: EntryForm = { result_value: "", result_text: "", unit_of_measure: "", reference_range: "", interpretation: "", entered_by_staff_id: "" };
type EntryErrors = Partial<Record<keyof EntryForm, string>>;

type VerifyForm = { verified_by_staff_id: string; verification_note: string };
type ReleaseForm = { release_note: string; notify_clinician: boolean; route_to_service_delivery_point_id: string };

type Popup = { kind: "enter" | "update" | "verify" | "release"; row: ResultRow } | null;

const stop = (e: MouseEvent) => e.stopPropagation();

function BucketBadge({ bucket }: { bucket: ResultBucket }) {
  return (
    <DxBadge tone={statusTone(BUCKET_STATUS[bucket])} dot>
      {BUCKET_LABEL[bucket]}
    </DxBadge>
  );
}

function FlagBadge({ flag }: { flag: "High" | "Low" | null }) {
  return flag ? <DxBadge tone="danger">{flag}</DxBadge> : <span className="dx-faint">—</span>;
}

/**
 * Laboratory results queue. Each processed order item moves through
 * entry → verification (second scientist) → release back to the clinician.
 */
export function LabResultsPage(props: { visitId?: number; embedded?: boolean } = {}) {
  const embedded = props.embedded ?? false;
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const focusItemId = (location.state as { focusItemId?: number } | null)?.focusItemId ?? null;
  const visitParam = Number(searchParams.get("visit"));
  const paramVisitId = Number.isFinite(visitParam) && visitParam > 0 ? visitParam : null;
  const visitId = props.visitId ?? paramVisitId;

  const [tab, setTab] = useState<ResultTab>(embedded || focusItemId ? "ALL" : "PENDING_ENTRY");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [gridFilters, setGridFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [selectedKey, setSelectedKey] = useState<number | null>(focusItemId);

  const [popup, setPopup] = useState<Popup>(null);
  const [cancelRow, setCancelRow] = useState<ResultRow | null>(null);
  const [entryForm, setEntryForm] = useState<EntryForm>(EMPTY_ENTRY);
  const [entryErrors, setEntryErrors] = useState<EntryErrors>({});
  const [verifyForm, setVerifyForm] = useState<VerifyForm>({ verified_by_staff_id: "", verification_note: "" });
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [releaseForm, setReleaseForm] = useState<ReleaseForm>({ release_note: "", notify_clinician: true, route_to_service_delivery_point_id: "" });

  // ---------- Data ----------
  const worklistQuery = useQuery({
    queryKey: [...WORKLIST_KEY, "results", visitId ?? "all"],
    queryFn: () => (visitId ? listLabOrdersForVisit(visitId) : listLabWorklist({ skip: 0, limit: 200 })),
    placeholderData: (prev) => prev,
  });
  const staffQuery = useQuery({ queryKey: ["staff", "list", 200], queryFn: () => getStaff(0, 200), staleTime: 5 * 60_000 });
  const testsQuery = useQuery({ queryKey: ["lab", "tests", "all"], queryFn: () => listLabTests({ limit: 200 }), staleTime: 5 * 60_000 });
  const sdpQuery = useQuery({
    queryKey: ["service-delivery-points", "active", 200],
    queryFn: () => listActiveServiceDeliveryPoints({ skip: 0, limit: 200 }),
    staleTime: 5 * 60_000,
  });

  const staffList = useMemo<Staff[]>(() => staffQuery.data ?? [], [staffQuery.data]);
  const staffById = useMemo(() => new Map(staffList.map((s) => [s.id, s])), [staffList]);
  const defaultStaffId = useMemo(() => currentStaffId(staffList), [staffList]);
  const tests = useMemo(() => toTestMap(testsQuery.data?.items), [testsQuery.data]);
  const sdps: ServiceDeliveryPoint[] = sdpQuery.data?.items ?? [];

  const orders = useMemo(() => (worklistQuery.data?.items ?? []) as WorklistOrder[], [worklistQuery.data]);

  // The worklist does not embed result records; look them up per item in the
  // analytical phase so entered/verified/released states are accurate.
  const lookupItemIds = useMemo(
    () => orders.flatMap((o) => itemsOf(o)).filter((i) => isResultStage(i.status) && !isRealResult(i.result)).map((i) => i.id),
    [orders],
  );
  const combineLookups = useCallback(
    (results: { data?: LabResult; isPending: boolean }[]) => ({
      map: new Map<number, LabResult | null>(results.map((r, idx) => [lookupItemIds[idx], r.data ?? null])),
      pending: results.some((r) => r.isPending),
    }),
    [lookupItemIds],
  );
  const resultLookups = useQueries({
    queries: lookupItemIds.map((id) => ({
      queryKey: byItemKey(id),
      queryFn: () => getLabResultByItem(id),
      staleTime: 60_000,
    })),
    combine: combineLookups,
  });

  const rows = useMemo(() => buildResultRows(orders, resultLookups.map), [orders, resultLookups.map]);

  const counts = useMemo(() => {
    const map: Record<ResultBucket, number> = { PENDING_ENTRY: 0, ENTERED: 0, VERIFIED: 0, RELEASED: 0, CANCELLED: 0 };
    let releasedToday = 0;
    for (const r of rows) {
      map[r.bucket]++;
      if (r.bucket === "RELEASED" && isToday(r.result?.released_at ?? r.activityAt)) releasedToday++;
    }
    return { ...map, releasedToday };
  }, [rows]);

  const gridAccessors = useMemo(
    () => ({
      test: (r: ResultRow) => testNameOf(r.item, tests),
      patient: (r: ResultRow) => patientNameOf(r.order),
      order: (r: ResultRow) => r.order.order_no,
      specimen: (r: ResultRow) => r.item.specimen_id ?? "",
      bucket: (r: ResultRow) => r.bucket,
    }),
    [tests],
  );

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = rows.filter((r) => (tab === "ALL" || r.bucket === tab) && inDateRange(r.activityAt, dateFrom, dateTo) && rowMatchesSearch(r, q, tests));
    return applyGridFilters(base, gridFilters, gridAccessors, new Set(["bucket"]));
  }, [rows, tab, search, dateFrom, dateTo, tests, gridFilters, gridAccessors]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = useMemo(() => paginate(filteredRows, currentPage, PAGE_SIZE), [filteredRows, currentPage]);

  const selectedRow = useMemo(() => rows.find((r) => r.key === selectedKey) ?? null, [rows, selectedKey]);

  // ---------- Cache helpers ----------
  const applyResult = (itemId: number, result: LabResult) => {
    qc.setQueryData(byItemKey(itemId), result);
    qc.setQueriesData<{ items?: LabOrder[] }>({ queryKey: WORKLIST_KEY }, (old) =>
      old?.items
        ? {
            ...old,
            items: old.items.map((o) => {
              const items = itemsOf(o as WorklistOrder);
              if (!items.some((i) => i.id === itemId)) return o;
              return { ...o, items: items.map((i) => (i.id === itemId ? { ...i, result } : i)) } as LabOrder;
            }),
          }
        : old,
    );
    qc.invalidateQueries({ queryKey: WORKLIST_KEY });
  };

  // ---------- Mutations ----------
  const enterMutation = useMutation({
    mutationFn: (row: ResultRow) =>
      enterLabResult({
        lab_order_item_id: row.item.id,
        entered_by_staff_id: Number(entryForm.entered_by_staff_id),
        result_value: entryForm.result_value.trim() || undefined,
        result_text: entryForm.result_text.trim() || undefined,
        unit_of_measure: entryForm.unit_of_measure.trim() || undefined,
        reference_range: entryForm.reference_range.trim() || undefined,
        interpretation: entryForm.interpretation.trim() || undefined,
      }),
    onSuccess: (res, row) => {
      applyResult(row.item.id, res.result);
      toast.success("Result entered", res.message);
      setPopup(null);
    },
    onError: (err) => toast.error("Could not save the result", apiErrorMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: (row: ResultRow) =>
      updateLabResult(row.result!.id, {
        result_value: entryForm.result_value.trim() || undefined,
        result_text: entryForm.result_text.trim() || undefined,
        unit_of_measure: entryForm.unit_of_measure.trim() || undefined,
        reference_range: entryForm.reference_range.trim() || undefined,
        interpretation: entryForm.interpretation.trim() || undefined,
      }),
    onSuccess: (res, row) => {
      applyResult(row.item.id, res.result);
      toast.success("Result updated", res.message);
      setPopup(null);
    },
    onError: (err) => toast.error("Could not update the result", apiErrorMessage(err)),
  });

  const verifyMutation = useMutation({
    mutationFn: (row: ResultRow) =>
      verifyLabResult(row.result!.id, {
        verified_by_staff_id: Number(verifyForm.verified_by_staff_id),
        verification_note: verifyForm.verification_note.trim() || undefined,
      }),
    onSuccess: (res, row) => {
      applyResult(row.item.id, res.result);
      toast.success("Result verified", res.message);
      setPopup(null);
    },
    onError: (err) => toast.error("Could not verify the result", apiErrorMessage(err)),
  });

  const releaseMutation = useMutation({
    mutationFn: (row: ResultRow) =>
      releaseLabResult(row.result!.id, {
        release_note: releaseForm.release_note.trim() || undefined,
        notify_clinician: releaseForm.notify_clinician,
        route_to_service_delivery_point_id: releaseForm.route_to_service_delivery_point_id ? Number(releaseForm.route_to_service_delivery_point_id) : undefined,
      }),
    onSuccess: (res, row) => {
      applyResult(row.item.id, res.result);
      toast.success("Result released", res.message);
      setPopup(null);
    },
    onError: (err) => toast.error("Could not release the result", apiErrorMessage(err)),
  });

  const cancelMutation = useMutation({
    mutationFn: (row: ResultRow) => cancelLabResult(row.result!.id),
    onSuccess: (res, row) => {
      applyResult(row.item.id, res.result);
      toast.success("Result cancelled", res.message);
    },
    onError: (err) => toast.error("Could not cancel the result", apiErrorMessage(err)),
  });

  const popupBusy = enterMutation.isPending || updateMutation.isPending || verifyMutation.isPending || releaseMutation.isPending;

  // ---------- Handlers ----------
  const openEnter = (row: ResultRow) => {
    const test = catalogTestOf(row.item, tests);
    setEntryForm({
      ...EMPTY_ENTRY,
      entered_by_staff_id: defaultStaffId != null ? String(defaultStaffId) : "",
      unit_of_measure: test?.unit_of_measure ?? "",
      reference_range: test?.reference_range ?? "",
    });
    setEntryErrors({});
    setPopup({ kind: "enter", row });
  };
  const openUpdate = (row: ResultRow) => {
    if (!row.result) return;
    setEntryForm({
      result_value: row.result.result_value ?? "",
      result_text: row.result.result_text ?? "",
      unit_of_measure: row.result.unit_of_measure ?? "",
      reference_range: row.result.reference_range ?? "",
      interpretation: row.result.interpretation ?? "",
      entered_by_staff_id: row.result.entered_by_staff_id != null ? String(row.result.entered_by_staff_id) : "",
    });
    setEntryErrors({});
    setPopup({ kind: "update", row });
  };
  const openVerify = (row: ResultRow) => {
    if (!row.result) return;
    setVerifyForm({ verified_by_staff_id: defaultStaffId != null ? String(defaultStaffId) : "", verification_note: "" });
    setVerifyError(null);
    setPopup({ kind: "verify", row });
  };
  const openRelease = (row: ResultRow) => {
    if (!row.result) return;
    setReleaseForm({ release_note: "", notify_clinician: true, route_to_service_delivery_point_id: "" });
    setPopup({ kind: "release", row });
  };
  const closePopup = () => {
    if (!popupBusy) setPopup(null);
  };

  const submitPopup = () => {
    if (!popup) return;
    const { kind, row } = popup;
    if (kind === "enter" || kind === "update") {
      const errs: EntryErrors = {};
      if (kind === "enter" && !entryForm.entered_by_staff_id) errs.entered_by_staff_id = "Pick the staff member entering the result.";
      if (!entryForm.result_value.trim() && !entryForm.result_text.trim()) errs.result_value = "Provide a result value or descriptive text.";
      setEntryErrors(errs);
      if (Object.keys(errs).length) return;
      if (kind === "enter") enterMutation.mutate(row);
      else updateMutation.mutate(row);
      return;
    }
    if (kind === "verify") {
      if (!verifyForm.verified_by_staff_id) {
        setVerifyError("Pick the verifier.");
        return;
      }
      setVerifyError(null);
      verifyMutation.mutate(row);
      return;
    }
    releaseMutation.mutate(row);
  };

  const clearVisitFocus = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("visit");
    setSearchParams(next, { replace: true });
  };

  const changeTab = (next: ResultTab) => {
    setTab(next);
    setPage(1);
  };

  const rowActions = (row: ResultRow, compact: boolean) => {
    const size = compact ? "sm" : "md";
    const hasResult = !!row.result;
    return (
      <div className={compact ? "flex flex-wrap items-center justify-end gap-1" : "flex flex-wrap items-center gap-2"} onClick={compact ? stop : undefined}>
        {row.bucket === "PENDING_ENTRY" ? (
          <DxButton size={size} variant="primary" leftIcon={<Edit3 />} onClick={() => openEnter(row)}>
            Enter result
          </DxButton>
        ) : null}
        {row.bucket === "ENTERED" ? (
          <>
            <DxButton size={size} leftIcon={<Edit3 />} disabled={!hasResult} onClick={() => openUpdate(row)}>
              Update
            </DxButton>
            <DxButton size={size} variant="primary" leftIcon={<ClipboardCheck />} disabled={!hasResult} onClick={() => openVerify(row)}>
              Verify
            </DxButton>
          </>
        ) : null}
        {row.bucket === "VERIFIED" ? (
          <>
            <DxButton size={size} leftIcon={<Edit3 />} disabled={!hasResult} onClick={() => openUpdate(row)}>
              Edit
            </DxButton>
            <DxButton size={size} variant="primary" leftIcon={<Send />} disabled={!hasResult} onClick={() => openRelease(row)}>
              Release
            </DxButton>
          </>
        ) : null}
        {row.bucket === "RELEASED" ? (
          <>
            <span className="inline-flex items-center gap-1 text-[var(--dx-success)]">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Released
            </span>
            <DxButton
              size={size}
              variant={compact ? "text" : "primary"}
              leftIcon={<Download />}
              title="Download the branded PDF report (hospital logo + signatory)"
              onClick={() => downloadLabReport(row.order.id, row.order.order_no)}
            >
              {compact ? undefined : "Download report"}
            </DxButton>
          </>
        ) : null}
        {hasResult && row.bucket !== "RELEASED" && row.bucket !== "CANCELLED" ? (
          <DxButton size={size} variant={compact ? "text" : "outline-danger"} icon={compact} title="Cancel result" leftIcon={compact ? undefined : <Ban />} onClick={() => setCancelRow(row)}>
            {compact ? <Ban /> : "Cancel result"}
          </DxButton>
        ) : null}
      </div>
    );
  };

  // ---------- Grid ----------
  const columns: DxGridColumn<ResultRow>[] = [
    {
      key: "test",
      header: "Test",
      minWidth: 170,
      sortable: true,
      filter: true,
      accessor: gridAccessors.test,
      render: (r) => {
        const code = testCodeOf(r.item, tests);
        return (
          <div className="min-w-0">
            <div className="dx-strong truncate">{testNameOf(r.item, tests)}</div>
            {code ? <div className="dx-mono dx-faint text-[11px]">{code}</div> : null}
          </div>
        );
      },
    },
    {
      key: "patient",
      header: "Patient",
      minWidth: 160,
      sortable: true,
      filter: true,
      accessor: gridAccessors.patient,
      render: (r) => {
        const hn = hospitalNumberOf(r.order);
        return (
          <div className="min-w-0">
            <div className="dx-strong truncate">{patientNameOf(r.order) || <span className="dx-faint">Unknown patient</span>}</div>
            {hn ? <div className="dx-mono dx-faint text-[11px]">{hn}</div> : null}
          </div>
        );
      },
    },
    {
      key: "order",
      header: "Order",
      width: 180,
      sortable: true,
      filter: true,
      accessor: gridAccessors.order,
      render: (r) => (
        <div className="min-w-0">
          <div className="dx-mono truncate">{r.order.order_no}</div>
          <Link to={routes.visitDetail.replace(":visitId", String(r.order.visit_id))} onClick={stop} className="dx-link dx-mono inline-flex items-center gap-1 text-[11px]">
            {r.order.visit?.visit_code ?? `Visit #${r.order.visit_id}`}
            <ExternalLink className="h-3 w-3" aria-hidden />
          </Link>
        </div>
      ),
    },
    {
      key: "specimen",
      header: "Specimen",
      width: 140,
      filter: true,
      accessor: gridAccessors.specimen,
      render: (r) => <span className="dx-mono">{r.item.specimen_id || <span className="dx-faint">—</span>}</span>,
    },
    {
      key: "bucket",
      header: "Stage",
      width: 170,
      sortable: true,
      filter: { options: RESULT_TABS.filter((t) => t.key !== "ALL").map((t) => ({ value: t.key, label: t.label })) },
      accessor: gridAccessors.bucket,
      render: (r) => <BucketBadge bucket={r.bucket} />,
    },
    {
      key: "value",
      header: "Result",
      width: 100,
      align: "right",
      accessor: (r) => r.result?.result_value ?? "",
      render: (r) => (r.result?.result_value ? <span className="dx-mono dx-strong">{r.result.result_value}</span> : <span className="dx-faint">—</span>),
    },
    { key: "unit", header: "Unit", width: 80, render: (r) => r.result?.unit_of_measure || <span className="dx-faint">—</span> },
    {
      key: "reference",
      header: "Reference",
      width: 120,
      render: (r) => <span className="dx-mono">{r.result?.reference_range || catalogTestOf(r.item, tests)?.reference_range || "—"}</span>,
    },
    { key: "flag", header: "Flag", width: 70, align: "center", render: (r) => <FlagBadge flag={flagFromResult(r.result)} /> },
    {
      key: "activityAt",
      header: "Last activity",
      width: 150,
      sortable: true,
      accessor: (r) => r.activityAt,
      render: (r) => <span className="dx-mono">{formatDateTime(r.activityAt)}</span>,
    },
    { key: "actions", header: "Actions", width: 230, align: "right", render: (r) => rowActions(r, true) },
  ];

  // ---------- Render ----------
  const loadError = worklistQuery.isError ? apiErrorMessage(worklistQuery.error, "Unable to load results queue.") : null;
  const liveFlag = resultFlag(entryForm.result_value, entryForm.reference_range);
  const popupRow = popup?.row ?? null;
  const popupResult = popupRow?.result ?? null;
  const enteredBy = selectedRow?.result?.entered_by_staff_id != null ? staffById.get(selectedRow.result.entered_by_staff_id) : undefined;
  const verifiedBy = selectedRow?.result?.verified_by_staff_id != null ? staffById.get(selectedRow.result.verified_by_staff_id) : undefined;

  const resultSummary = (row: ResultRow) => (
    <DxProps
      tight
      items={[
        { label: "Test", value: testNameOf(row.item, tests) },
        { label: "Patient", value: patientNameOf(row.order) || "—" },
        { label: "Order", value: <span className="dx-mono">{row.order.order_no}</span> },
        { label: "Specimen", value: row.item.specimen_id ? <span className="dx-mono">{row.item.specimen_id}</span> : "—" },
        ...(row.result
          ? [
              {
                label: "Result",
                value: (
                  <span className="inline-flex items-center gap-2">
                    <span className="dx-mono dx-strong">{row.result.result_value || "—"}</span>
                    {row.result.unit_of_measure ? <span className="dx-muted">{row.result.unit_of_measure}</span> : null}
                    <FlagBadge flag={flagFromResult(row.result)} />
                  </span>
                ),
              },
              { label: "Reference", value: <span className="dx-mono">{row.result.reference_range || "—"}</span> },
              { label: "Entered", value: formatDateTime(row.result.entered_at) },
            ]
          : []),
      ]}
    />
  );

  const body = (
    <>
      {!embedded && (
      <DxPageHeader
        crumbs={[{ label: "Laboratory", to: routes.laboratory }, { label: "Results queue" }]}
        title="Laboratory results queue"
        subtitle="Enter each result against its reference range, verify with a second scientist, then release to the clinician."
        actions={
          <>
            <DxButton leftIcon={<FlaskConical />} onClick={() => navigate({ pathname: routes.labOrders, search: visitId ? `?visit=${visitId}` : "" })}>
              Worklist
            </DxButton>
            <DxButton leftIcon={<Layers />} onClick={() => navigate(routes.labTests)}>
              Tests catalogue
            </DxButton>
          </>
        }
      >
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <DxKpi label="Pending entry" value={counts.PENDING_ENTRY} icon={Edit3} tone="warning" isLoading={worklistQuery.isLoading} sub="processed, no result yet" onClick={() => changeTab("PENDING_ENTRY")} />
          <DxKpi label="Awaiting verification" value={counts.ENTERED} icon={ClipboardCheck} tone="info" isLoading={worklistQuery.isLoading} sub="entered by first scientist" onClick={() => changeTab("ENTERED")} />
          <DxKpi label="Awaiting release" value={counts.VERIFIED} icon={Send} tone="accent" isLoading={worklistQuery.isLoading} sub="verified, not yet released" onClick={() => changeTab("VERIFIED")} />
          <DxKpi label="Released today" value={counts.releasedToday} icon={CheckCircle2} tone="success" isLoading={worklistQuery.isLoading} sub={`${counts.RELEASED} released in view`} onClick={() => changeTab("RELEASED")} />
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
          Showing results for visit <b className="dx-mono">#{visitId}</b>
          {orders[0]?.visit?.visit_code ? <> ({orders[0].visit.visit_code})</> : null}. Clear the focus to see the whole queue.
        </DxMessage>
      ) : null}

      <div>
        <DxTabs
          items={RESULT_TABS.map((t) => ({ key: t.key, label: t.label, count: t.key === "ALL" ? rows.length : counts[t.key] }))}
          value={tab}
          onChange={changeTab}
        />
        {!embedded && (
        <DxToolbar attached>
          <DxSearchBox onSearch={setSearch} placeholder="Patient, order #, test, specimen, value…" className="w-80" />
          <DxToolbarSeparator />
          <DxToolbarGroup>
            <DxToolbarLabel>Activity</DxToolbarLabel>
            <DxInput type="date" editorSize="sm" aria-label="Activity from" value={dateFrom} max={dateTo || undefined} onChange={(e) => setDateFrom(e.target.value)} className="w-36" />
            <DxToolbarLabel>to</DxToolbarLabel>
            <DxInput type="date" editorSize="sm" aria-label="Activity to" value={dateTo} min={dateFrom || undefined} onChange={(e) => setDateTo(e.target.value)} className="w-36" />
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
          {selectedRow ? rowActions(selectedRow, true) : null}
        </DxToolbar>
        )}
        <DxGrid
          attached
          filterRow
          columns={columns}
          data={pageRows}
          rowKey={(r) => r.key}
          filters={gridFilters}
          onFiltersChange={(f) => {
            setGridFilters(f);
            setPage(1);
          }}
          isLoading={worklistQuery.isLoading}
          error={loadError}
          onRetry={() => worklistQuery.refetch()}
          onRowClick={(r) => setSelectedKey(r.key)}
          selectedKey={selectedRow?.key ?? null}
          empty={{
            icon: Beaker,
            title: rows.length === 0 ? "Nothing to enter yet" : `Nothing in “${tab === "ALL" ? "All" : BUCKET_LABEL[tab]}”`,
            description:
              rows.length === 0
                ? "Once specimens are processed on the worklist, results appear here for entry, verification and release."
                : "Try another stage, clear the filters or widen the date range.",
          }}
          footer={<DxPager page={currentPage} totalPages={totalPages} totalItems={filteredRows.length} pageSize={PAGE_SIZE} onPageChange={setPage} />}
        />
      </div>

      {selectedRow ? (
        <DxPanel
          title={
            <span className="inline-flex items-center gap-2">
              {testNameOf(selectedRow.item, tests)}
              <BucketBadge bucket={selectedRow.bucket} />
            </span>
          }
          icon={<TestTube2 />}
          description={`${selectedRow.order.order_no} · ${patientNameOf(selectedRow.order) || "Unknown patient"}`}
          actions={
            <DxButton size="sm" variant="text" onClick={() => setSelectedKey(null)}>
              Close
            </DxButton>
          }
          footer={rowActions(selectedRow, false)}
        >
          <div className="grid gap-4 xl:grid-cols-12">
            <div className="xl:col-span-5">
              <DxProps
                tight
                items={[
                  { label: "Patient", value: patientNameOf(selectedRow.order) || "—" },
                  { label: "Hospital no.", value: hospitalNumberOf(selectedRow.order) ? <span className="dx-mono">{hospitalNumberOf(selectedRow.order)}</span> : "—" },
                  {
                    label: "Visit",
                    value: (
                      <Link to={routes.visitDetail.replace(":visitId", String(selectedRow.order.visit_id))} className="dx-link dx-mono">
                        {selectedRow.order.visit?.visit_code ?? `#${selectedRow.order.visit_id}`}
                      </Link>
                    ),
                  },
                  { label: "Specimen", value: selectedRow.item.specimen_id ? <span className="dx-mono">{selectedRow.item.specimen_id}</span> : "—" },
                  { label: "Collected", value: formatDateTime(collectedAtOf(selectedRow.item)) },
                  { label: "Processing started", value: formatDateTime(selectedRow.item.processing_started_at) },
                  { label: "Clinical note", value: selectedRow.order.clinical_note ? <span className="whitespace-pre-wrap">{selectedRow.order.clinical_note}</span> : <span className="dx-faint">None</span> },
                ]}
              />
            </div>
            <div className="xl:col-span-7">
              {selectedRow.result ? (
                <div className="space-y-4">
                  <DxGroupBox caption="Result">
                    <div className="flex flex-wrap items-baseline gap-3">
                      <span className="dx-mono text-[22px] font-semibold text-[var(--dx-text)]">{selectedRow.result.result_value || "—"}</span>
                      {selectedRow.result.unit_of_measure ? <span className="dx-muted">{selectedRow.result.unit_of_measure}</span> : null}
                      <FlagBadge flag={flagFromResult(selectedRow.result)} />
                      <span className="dx-faint text-[11.5px]">
                        Reference: <span className="dx-mono">{selectedRow.result.reference_range || "—"}</span>
                      </span>
                    </div>
                    {selectedRow.result.result_text ? <p className="mt-2 whitespace-pre-wrap text-[12.5px]">{selectedRow.result.result_text}</p> : null}
                  </DxGroupBox>
                  <DxGroupBox caption="Clinical impression">
                    <p className="whitespace-pre-wrap text-[12.5px]">{selectedRow.result.interpretation || <span className="dx-faint">No interpretation recorded.</span>}</p>
                  </DxGroupBox>
                  <DxProps
                    tight
                    items={[
                      { label: "Entered", value: selectedRow.result.entered_at ? `${formatDateTime(selectedRow.result.entered_at)}${enteredBy ? ` · ${staffDisplayName(enteredBy)}` : ""}` : "—" },
                      { label: "Verified", value: selectedRow.result.verified_at ? `${formatDateTime(selectedRow.result.verified_at)}${verifiedBy ? ` · ${staffDisplayName(verifiedBy)}` : ""}` : "—" },
                      { label: "Released", value: formatDateTime(selectedRow.result.released_at) },
                    ]}
                  />
                </div>
              ) : (
                <DxMessage tone={selectedRow.bucket === "PENDING_ENTRY" ? "warning" : "info"}>
                  {selectedRow.bucket === "PENDING_ENTRY"
                    ? "No result has been entered for this item yet."
                    : resultLookups.pending
                      ? "Loading the result record…"
                      : "The result record could not be loaded for this item."}
                </DxMessage>
              )}
            </div>
          </div>
        </DxPanel>
      ) : (
        <DxMessage tone="info">Select a row to review the result, its reference range and audit trail.</DxMessage>
      )}

      <DxStatusBar>
        <DxStatusItem>
          <b>{filteredRows.length}</b> of <b>{rows.length}</b> items · <b>{orders.length}</b> orders loaded
        </DxStatusItem>
        <DxStatusItem>
          Cancelled: <b>{counts.CANCELLED}</b>
        </DxStatusItem>
        {resultLookups.pending ? <DxStatusItem>Resolving result records…</DxStatusItem> : null}
        <span className="ml-auto inline-flex items-center gap-1.5">
          <Clock className="h-3 w-3" aria-hidden />
          {worklistQuery.isFetching ? "Refreshing…" : `Updated ${formatTime(worklistQuery.dataUpdatedAt ? new Date(worklistQuery.dataUpdatedAt).toISOString() : null)}`}
        </span>
      </DxStatusBar>

      {/* Enter / update */}
      <DxPopup
        isOpen={popup?.kind === "enter" || popup?.kind === "update"}
        onClose={closePopup}
        title={popup?.kind === "update" ? "Update result" : "Enter result"}
        size="lg"
        locked={enterMutation.isPending || updateMutation.isPending}
        footer={
          <>
            <DxButton onClick={closePopup} disabled={enterMutation.isPending || updateMutation.isPending}>
              Cancel
            </DxButton>
            <DxButton variant="primary" leftIcon={<Edit3 />} isLoading={enterMutation.isPending || updateMutation.isPending} onClick={submitPopup}>
              {popup?.kind === "update" ? "Save changes" : "Save result"}
            </DxButton>
          </>
        }
      >
        {popupRow && (popup?.kind === "enter" || popup?.kind === "update") ? (
          <div className="space-y-4">
            {resultSummary({ ...popupRow, result: undefined })}
            <DxForm cols={2}>
              {popup.kind === "enter" ? (
                <DxSelect
                  label="Entered by"
                  required
                  fieldClassName="dx-col-span-full"
                  placeholder="Select staff…"
                  value={entryForm.entered_by_staff_id}
                  onChange={(e) => setEntryForm((f) => ({ ...f, entered_by_staff_id: e.target.value }))}
                  options={staffList.map((s) => ({ value: String(s.id), label: staffLabel(s, staffDisplayName(s)) }))}
                  error={entryErrors.entered_by_staff_id}
                  disabled={popupBusy}
                />
              ) : null}
              <DxInput
                label={
                  <span className="inline-flex items-center gap-1.5">
                    Result value
                    {liveFlag ? <DxBadge tone="danger">{liveFlag}</DxBadge> : null}
                  </span>
                }
                mono
                autoFocus
                inputMode="decimal"
                placeholder="e.g. 13.5"
                unit={entryForm.unit_of_measure.trim() || undefined}
                hint={entryForm.reference_range.trim() ? `Reference range: ${entryForm.reference_range.trim()}` : "No reference range on file for this analyte."}
                value={entryForm.result_value}
                onChange={(e) => setEntryForm((f) => ({ ...f, result_value: e.target.value }))}
                error={entryErrors.result_value}
                disabled={popupBusy}
              />
              <DxInput
                label="Unit"
                placeholder="g/dL"
                value={entryForm.unit_of_measure}
                onChange={(e) => setEntryForm((f) => ({ ...f, unit_of_measure: e.target.value }))}
                disabled={popupBusy}
              />
              <DxInput
                label="Reference range"
                mono
                placeholder="12-16"
                hint="Values outside this range are flagged High / Low."
                value={entryForm.reference_range}
                onChange={(e) => setEntryForm((f) => ({ ...f, reference_range: e.target.value }))}
                disabled={popupBusy}
              />
              <DxTextarea
                label="Result description / narrative"
                fieldClassName="dx-col-span-full"
                rows={2}
                placeholder="Free-text findings, especially for non-numeric results…"
                value={entryForm.result_text}
                onChange={(e) => setEntryForm((f) => ({ ...f, result_text: e.target.value }))}
                disabled={popupBusy}
              />
              <DxTextarea
                label="Clinical impression"
                fieldClassName="dx-col-span-full"
                rows={2}
                placeholder="Interpretation, flagged anomalies, repeat indication…"
                value={entryForm.interpretation}
                onChange={(e) => setEntryForm((f) => ({ ...f, interpretation: e.target.value }))}
                disabled={popupBusy}
              />
            </DxForm>
          </div>
        ) : null}
      </DxPopup>

      {/* Verify */}
      <DxPopup
        isOpen={popup?.kind === "verify"}
        onClose={closePopup}
        title="Verify result"
        size="md"
        locked={verifyMutation.isPending}
        footer={
          <>
            <DxButton onClick={closePopup} disabled={verifyMutation.isPending}>
              Cancel
            </DxButton>
            <DxButton variant="primary" leftIcon={<ClipboardCheck />} isLoading={verifyMutation.isPending} onClick={submitPopup}>
              Verify
            </DxButton>
          </>
        }
      >
        {popupRow && popup?.kind === "verify" ? (
          <div className="space-y-4">
            {resultSummary(popupRow)}
            {popupResult?.interpretation ? (
              <DxMessage tone="info" title="Clinical impression">
                {popupResult.interpretation}
              </DxMessage>
            ) : null}
            <DxForm cols={1}>
              <DxSelect
                label="Verified by"
                required
                placeholder="Select verifier…"
                value={verifyForm.verified_by_staff_id}
                onChange={(e) => setVerifyForm((f) => ({ ...f, verified_by_staff_id: e.target.value }))}
                options={staffList.map((s) => ({ value: String(s.id), label: staffLabel(s, staffDisplayName(s)) }))}
                error={verifyError}
                hint={popupResult?.entered_by_staff_id != null && String(popupResult.entered_by_staff_id) === verifyForm.verified_by_staff_id ? "Same scientist who entered the result — a second scientist should verify." : undefined}
                disabled={verifyMutation.isPending}
              />
              <DxTextarea
                label="Verification note (optional)"
                rows={3}
                placeholder="Quality check notes, repeat indication, etc."
                value={verifyForm.verification_note}
                onChange={(e) => setVerifyForm((f) => ({ ...f, verification_note: e.target.value }))}
                disabled={verifyMutation.isPending}
              />
            </DxForm>
          </div>
        ) : null}
      </DxPopup>

      {/* Release */}
      <DxPopup
        isOpen={popup?.kind === "release"}
        onClose={closePopup}
        title="Release result"
        size="md"
        locked={releaseMutation.isPending}
        footer={
          <>
            <DxButton onClick={closePopup} disabled={releaseMutation.isPending}>
              Cancel
            </DxButton>
            <DxButton variant="primary" leftIcon={<Send />} isLoading={releaseMutation.isPending} onClick={submitPopup}>
              Release to clinician
            </DxButton>
          </>
        }
      >
        {popupRow && popup?.kind === "release" ? (
          <div className="space-y-4">
            {resultSummary(popupRow)}
            <DxForm cols={1}>
              <DxCheckbox
                label="Notify clinician"
                description="Send a push and an in-app alert when released."
                checked={releaseForm.notify_clinician}
                onChange={(e) => setReleaseForm((f) => ({ ...f, notify_clinician: e.target.checked }))}
                disabled={releaseMutation.isPending}
              />
              <DxSelect
                label="Route visit to service point (optional)"
                value={releaseForm.route_to_service_delivery_point_id}
                onChange={(e) => setReleaseForm((f) => ({ ...f, route_to_service_delivery_point_id: e.target.value }))}
                options={[{ value: "", label: "No routing — keep the visit at its current service point" }, ...sdps.map((s) => ({ value: String(s.id), label: `${s.name} (${s.code})` }))]}
                disabled={releaseMutation.isPending}
              />
              <DxTextarea
                label="Release note (optional)"
                rows={3}
                placeholder="Hand-off note for the clinician…"
                value={releaseForm.release_note}
                onChange={(e) => setReleaseForm((f) => ({ ...f, release_note: e.target.value }))}
                disabled={releaseMutation.isPending}
              />
            </DxForm>
          </div>
        ) : null}
      </DxPopup>

      {/* Cancel result */}
      <DxConfirm
        isOpen={cancelRow != null}
        onClose={() => setCancelRow(null)}
        title="Cancel this result?"
        description={
          cancelRow ? (
            <>
              The result for <b>{testNameOf(cancelRow.item, tests)}</b> on <b className="dx-mono">{cancelRow.order.order_no}</b> will be withdrawn and will not be released to the clinician. The order item will need to be re-processed if required.
            </>
          ) : null
        }
        confirmLabel="Cancel result"
        cancelLabel="Keep result"
        onConfirm={async () => {
          if (!cancelRow) return;
          try {
            await cancelMutation.mutateAsync(cancelRow);
          } catch {
            // surfaced via the mutation's onError toast
          }
        }}
      />
    </>
  );

  return embedded ? <div className="space-y-4">{body}</div> : <DxPage>{body}</DxPage>;
}
