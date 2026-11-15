import { useMemo, useState, type MouseEvent } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ClipboardList, Download, ExternalLink, FileText, FlaskConical, RotateCcw, Search } from "lucide-react";
import {
  DxButton,
  DxGrid,
  DxKpi,
  DxMessage,
  DxPage,
  DxPageHeader,
  DxPanel,
  DxSearchBox,
  DxSelect,
  DxStatusBadge,
  DxStatusBar,
  DxStatusItem,
  DxToolbar,
  DxToolbarSeparator,
  DxToolbarSpacer,
  apiErrorMessage,
  formatDateTime,
  type DxGridColumn,
} from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import { routes } from "@/config/routes";
import { downloadLabReport, trackLabOrders, type LabTrackItem, type LabTrackRow } from "../api/lab-orders.api";
import { TRACK_STATUS_OPTIONS, normStatus } from "../lib/lab-worklist";

const stop = (e: MouseEvent) => e.stopPropagation();

/**
 * Hospital-wide Lab Result Tracker.
 *
 * Any authorised staff member — doctor, receptionist, nurse or laboratory
 * scientist — can look up laboratory orders across visits by order number,
 * patient name or hospital number, watch each test move through the lab
 * lifecycle, and download the branded report the moment results are released.
 */
export function LabResultTrackerPage() {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [downloading, setDownloading] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const trackQuery = useQuery({
    queryKey: ["lab-track", query, status],
    queryFn: () => trackLabOrders({ query, status, limit: 100 }),
    placeholderData: (prev) => prev,
  });
  const { isFetching, refetch } = trackQuery;

  const rows: LabTrackRow[] = useMemo(() => trackQuery.data?.items ?? [], [trackQuery.data]);
  const selected = useMemo(() => rows.find((r) => r.order_id === selectedId) ?? null, [rows, selectedId]);

  const stats = useMemo(() => {
    let reports = 0;
    let inProgress = 0;
    let released = 0;
    for (const r of rows) {
      if (r.report_available) reports++;
      if (!/(COMPLETED|CANCELLED)/.test(normStatus(r.status))) inProgress++;
      released += r.items.filter((i) => normStatus(i.result_status) === "RELEASED").length;
    }
    return { reports, inProgress, released };
  }, [rows]);

  const handleDownload = async (row: LabTrackRow) => {
    setDownloading(row.order_id);
    try {
      await downloadLabReport(row.order_id, row.order_no);
    } catch {
      toast.error("Report unavailable", "The report can be downloaded once the laboratory releases results for this order.");
    } finally {
      setDownloading(null);
    }
  };

  const columns: DxGridColumn<LabTrackRow>[] = [
    {
      key: "order_no",
      header: "Order",
      width: 190,
      sortable: true,
      filter: true,
      render: (r) => <span className="dx-mono dx-strong">{r.order_no}</span>,
    },
    {
      key: "patient_name",
      header: "Patient",
      minWidth: 180,
      sortable: true,
      filter: true,
      render: (r) => (
        <div className="min-w-0">
          <div className="dx-strong truncate">{r.patient_name || <span className="dx-faint">Unknown patient</span>}</div>
          {r.hospital_number ? <div className="dx-mono dx-faint text-[11px]">{r.hospital_number}</div> : null}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: 150,
      sortable: true,
      filter: { options: TRACK_STATUS_OPTIONS.filter((o) => o.value) },
      accessor: (r) => normStatus(r.status),
      render: (r) => <DxStatusBadge status={r.status} />,
    },
    {
      key: "items",
      header: "Tests",
      width: 100,
      align: "center",
      sortable: true,
      accessor: (r) => r.items.length,
      render: (r) => {
        const released = r.items.filter((i) => normStatus(i.result_status) === "RELEASED").length;
        return (
          <span className="dx-num">
            {released}/{r.items.length}
          </span>
        );
      },
    },
    {
      key: "ordered_at",
      header: "Ordered",
      width: 150,
      sortable: true,
      accessor: (r) => r.ordered_at ?? "",
      render: (r) => <span className="dx-mono">{formatDateTime(r.ordered_at)}</span>,
    },
    {
      key: "report",
      header: "Report",
      width: 120,
      align: "center",
      accessor: (r) => (r.report_available ? "yes" : "no"),
      filter: {
        options: [
          { value: "yes", label: "Available" },
          { value: "no", label: "Not yet" },
        ],
      },
      render: (r) =>
        r.report_available ? (
          <span className="inline-flex items-center gap-1 text-[var(--dx-success)]">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Available
          </span>
        ) : (
          <span className="dx-faint">Not yet</span>
        ),
    },
    {
      key: "actions",
      header: "",
      width: 200,
      align: "right",
      render: (r) => (
        <div className="flex items-center justify-end gap-1" onClick={stop}>
          {r.visit_id ? (
            <Link to={routes.visitDetail.replace(":visitId", String(r.visit_id))} className="dx-btn dx-btn-sm dx-btn-text">
              <FileText aria-hidden />
              Visit
            </Link>
          ) : null}
          <DxButton
            size="sm"
            variant={r.report_available ? "primary" : "default"}
            leftIcon={<Download />}
            disabled={!r.report_available || downloading === r.order_id}
            isLoading={downloading === r.order_id}
            title={r.report_available ? "Download the branded lab report (PDF)" : "Report becomes available once results are released"}
            onClick={() => handleDownload(r)}
          >
            {downloading === r.order_id ? "Preparing…" : "Report"}
          </DxButton>
        </div>
      ),
    },
  ];

  const itemColumns: DxGridColumn<LabTrackItem>[] = [
    { key: "test", header: "Test", minWidth: 200, sortable: true, render: (i) => <span className="dx-strong">{i.test}</span> },
    {
      key: "item_status",
      header: "Order stage",
      width: 160,
      sortable: true,
      accessor: (i) => normStatus(i.item_status),
      render: (i) => <DxStatusBadge status={i.item_status} />,
    },
    {
      key: "result_status",
      header: "Result",
      width: 150,
      sortable: true,
      accessor: (i) => normStatus(i.result_status),
      render: (i) => <DxStatusBadge status={i.result_status} />,
    },
    {
      key: "released_at",
      header: "Released",
      width: 160,
      sortable: true,
      accessor: (i) => i.released_at ?? "",
      render: (i) => <span className="dx-mono">{formatDateTime(i.released_at)}</span>,
    },
  ];

  const loadError = trackQuery.isError ? apiErrorMessage(trackQuery.error, "Unable to search lab orders.") : null;

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Laboratory", to: routes.laboratory }, { label: "Result tracker" }]}
        title="Lab result tracker"
        subtitle="Track laboratory orders across the hospital and download released reports."
        actions={
          <Link to={routes.labOrders} className="dx-btn">
            <FlaskConical aria-hidden />
            Laboratory worklist
          </Link>
        }
      >
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <DxKpi label="Orders found" value={rows.length} icon={Search} tone="accent" isLoading={trackQuery.isLoading} sub={trackQuery.data ? `of ${trackQuery.data.total} matching` : undefined} />
          <DxKpi label="Still in the lab" value={stats.inProgress} icon={FlaskConical} tone="info" isLoading={trackQuery.isLoading} sub="not completed or cancelled" />
          <DxKpi label="Released results" value={stats.released} icon={CheckCircle2} tone="success" isLoading={trackQuery.isLoading} sub="tests released to clinicians" />
          <DxKpi label="Reports available" value={stats.reports} icon={Download} tone="warning" isLoading={trackQuery.isLoading} sub="branded PDF ready" />
        </div>
      </DxPageHeader>

      <div>
        <DxToolbar attached>
          <DxSearchBox onSearch={setQuery} placeholder="Order number, patient name or hospital number…" className="w-96" />
          <DxToolbarSeparator />
          <DxSelect editorSize="sm" aria-label="Order status" value={status} onChange={(e) => setStatus(e.target.value)} options={TRACK_STATUS_OPTIONS} className="w-44" />
          <DxToolbarSpacer />
          <DxButton size="sm" variant="text" leftIcon={<RotateCcw className={isFetching ? "animate-spin" : undefined} />} onClick={() => refetch()} disabled={isFetching}>
            Refresh
          </DxButton>
        </DxToolbar>
        <DxGrid
          attached
          filterRow
          columns={columns}
          data={rows}
          rowKey={(r) => r.order_id}
          isLoading={trackQuery.isLoading}
          error={loadError}
          onRetry={() => refetch()}
          onRowClick={(r) => setSelectedId(r.order_id)}
          selectedKey={selected?.order_id ?? null}
          empty={{ icon: ClipboardList, title: "No lab orders found", description: "Try a different order number, patient name or hospital number." }}
        />
      </div>

      {selected ? (
        <DxPanel
          title={
            <span className="inline-flex items-center gap-2">
              <span className="dx-mono">{selected.order_no}</span>
              <DxStatusBadge status={selected.status} />
            </span>
          }
          icon={<ClipboardList />}
          description={`${selected.patient_name}${selected.hospital_number ? ` · ${selected.hospital_number}` : ""} · ordered ${formatDateTime(selected.ordered_at)}`}
          flush
          actions={
            <>
              {selected.visit_id ? (
                <Link to={routes.visitDetail.replace(":visitId", String(selected.visit_id))} className="dx-btn dx-btn-sm">
                  <ExternalLink aria-hidden />
                  Open visit
                </Link>
              ) : null}
              <DxButton
                size="sm"
                variant={selected.report_available ? "primary" : "default"}
                leftIcon={<Download />}
                disabled={!selected.report_available || downloading === selected.order_id}
                isLoading={downloading === selected.order_id}
                onClick={() => handleDownload(selected)}
              >
                Download report
              </DxButton>
              <DxButton size="sm" variant="text" onClick={() => setSelectedId(null)}>
                Close
              </DxButton>
            </>
          }
        >
          <DxGrid borderless columns={itemColumns} data={selected.items} rowKey={(i) => i.item_id} empty={{ title: "No tests on this order" }} />
        </DxPanel>
      ) : (
        <DxMessage tone="info">Select an order to see each test's stage, result status and release time.</DxMessage>
      )}

      <DxStatusBar>
        <DxStatusItem>
          <b>{rows.length}</b> order{rows.length === 1 ? "" : "s"} shown
          {trackQuery.data && trackQuery.data.total > rows.length ? ` of ${trackQuery.data.total} (showing the first ${rows.length})` : ""}
        </DxStatusItem>
        <span className="ml-auto">{isFetching ? "Searching…" : "Reports become downloadable once the laboratory releases results."}</span>
      </DxStatusBar>
    </DxPage>
  );
}
