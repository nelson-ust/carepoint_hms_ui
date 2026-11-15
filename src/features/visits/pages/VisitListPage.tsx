import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Clock,
  Eye,
  Flame,
  GitBranch,
  Plus,
  RotateCcw,
  Trash2,
  Users,
} from "lucide-react";
import {
  DxBadge,
  DxButton,
  DxConfirm,
  DxGrid,
  DxInput,
  DxKpi,
  DxPage,
  DxPageHeader,
  DxPager,
  DxSearchBox,
  DxSelect,
  DxStatusBadge,
  DxStatusBar,
  DxStatusItem,
  DxToolbar,
  DxToolbarGroup,
  DxToolbarLabel,
  DxToolbarSeparator,
  DxToolbarSpacer,
  apiErrorMessage,
  formatDateTime,
  humanize,
  type DxGridColumn,
} from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import { routes } from "@/config/routes";
import { getPatientById } from "@/features/patients/api/patients.api";
import type { Patient } from "@/features/patients/api/patients.api";
import { deleteVisit, getVisits } from "../api/visits.api";
import type { Visit, VisitListFilters } from "../api/visits.api";
import { patientDisplayName, visitPriorityTone } from "../lib/clinic-flow";
import { VISIT_PAGE_SIZE, VISIT_PRIORITY_OPTIONS, VISIT_STATUS_OPTIONS, todayIsoDate } from "../lib/visit-options";

type PatientLike = Pick<Patient, "id" | "first_name" | "last_name" | "middle_name" | "hospital_number">;

/**
 * Visit registry — every active and completed encounter, with server-side
 * status / priority / date filters and a local quick search over the page.
 */
export function VisitListPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();

  const [searchParams] = useSearchParams();
  const patientIdFilter = searchParams.get("patient_id");
  const patientId = patientIdFilter ? Number(patientIdFilter) : undefined;

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  // Page is scoped to the patient filter so a URL change lands on page 1.
  const [pageState, setPageState] = useState<{ page: number; scope: string | null }>({ page: 0, scope: patientIdFilter });
  const page = pageState.scope === patientIdFilter ? pageState.page : 0;
  const setPage = (p: number) => setPageState({ page: p, scope: patientIdFilter });
  const [pendingDelete, setPendingDelete] = useState<Visit | null>(null);

  const filters: VisitListFilters = useMemo(
    () => ({
      skip: page * VISIT_PAGE_SIZE,
      limit: VISIT_PAGE_SIZE,
      status: statusFilter || undefined,
      priority: priorityFilter || undefined,
      patient_id: patientId,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    }),
    [page, statusFilter, priorityFilter, patientId, dateFrom, dateTo],
  );

  const visitsQuery = useQuery({
    queryKey: ["visits", "list", filters],
    queryFn: () => getVisits(filters),
  });

  const filteredPatientQuery = useQuery({
    queryKey: ["patients", "detail", patientId],
    queryFn: () => getPatientById(patientId as number),
    enabled: patientId != null && Number.isFinite(patientId),
  });

  // Registry-wide counters (one lightweight request per tile).
  const kpiQuery = useQuery({
    queryKey: ["visits", "kpis", patientId ?? null, todayIsoDate()],
    queryFn: async () => {
      const base: VisitListFilters = { limit: 1, patient_id: patientId };
      const total = (r: Awaited<ReturnType<typeof getVisits>>) => r.meta?.total ?? r.count ?? r.items?.length ?? 0;
      const [active, inProgress, waiting, completedToday, emergency] = await Promise.all([
        getVisits({ ...base, status: "ACTIVE" }),
        getVisits({ ...base, status: "IN_PROGRESS" }),
        getVisits({ ...base, status: "WAITING" }),
        getVisits({ ...base, status: "COMPLETED", date_from: todayIsoDate() }),
        getVisits({ ...base, priority: "EMERGENCY" }),
      ]);
      return {
        active: total(active) + total(inProgress),
        waiting: total(waiting),
        completedToday: total(completedToday),
        emergency: total(emergency),
      };
    },
  });

  const visitItems = visitsQuery.data?.items;
  const visits = useMemo(() => visitItems ?? [], [visitItems]);
  const meta = visitsQuery.data?.meta;

  // Fetch patient summaries the list endpoint did not embed.
  const missingPatientIds = useMemo(
    () => [...new Set(visits.filter((v) => !v.patient).map((v) => v.patient_id))].sort((a, b) => a - b),
    [visits],
  );
  const patientBatchQuery = useQuery({
    queryKey: ["patients", "batch", missingPatientIds],
    queryFn: async () => {
      const results = await Promise.allSettled(missingPatientIds.map((id) => getPatientById(id)));
      const map: Record<number, Patient> = {};
      results.forEach((r) => {
        if (r.status === "fulfilled" && r.value) map[r.value.id] = r.value;
      });
      return map;
    },
    enabled: missingPatientIds.length > 0,
    staleTime: 5 * 60_000,
  });
  const patientBatch = patientBatchQuery.data;
  const patientCache = useMemo<Record<number, Patient>>(() => patientBatch ?? {}, [patientBatch]);
  const patientFor = (v: Visit): PatientLike | undefined => v.patient ?? patientCache[v.patient_id];

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return visits;
    return visits.filter((v) => {
      const p: PatientLike | undefined = v.patient ?? patientCache[v.patient_id];
      const name = p ? patientDisplayName(p).toLowerCase() : "";
      const hosp = p?.hospital_number?.toLowerCase() ?? "";
      const code = (v.visit_code || `VISIT-${v.id}`).toLowerCase();
      return name.includes(q) || hosp.includes(q) || code.includes(q);
    });
  }, [visits, search, patientCache]);

  const deleteMutation = useMutation({
    mutationFn: (visitId: number) => deleteVisit(visitId),
    onSuccess: (_res, visitId) => {
      qc.invalidateQueries({ queryKey: ["visits"] });
      toast.success("Visit deleted", `Visit #${visitId} was removed from the registry.`);
    },
    onError: (err) => toast.error("Could not delete visit", apiErrorMessage(err, "It may have dependent records.")),
  });

  const openVisit = (v: Visit) => navigate(routes.visitDetail.replace(":visitId", String(v.id)));

  const columns: DxGridColumn<Visit>[] = [
    {
      key: "visit_code",
      header: "Visit",
      width: 150,
      sortable: true,
      filter: true,
      accessor: (v) => v.visit_code || `VISIT-${v.id}`,
      render: (v) => <span className="dx-mono dx-strong">{v.visit_code || `VISIT-${v.id}`}</span>,
    },
    {
      key: "patient",
      header: "Patient",
      minWidth: 200,
      sortable: true,
      filter: true,
      accessor: (v) => {
        const p = patientFor(v);
        return p ? `${patientDisplayName(p)} ${p.hospital_number ?? ""}` : `Patient #${v.patient_id}`;
      },
      render: (v) => {
        const p = patientFor(v);
        return p ? (
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate font-medium">{patientDisplayName(p)}</span>
            <span className="dx-mono dx-faint text-[11px]">{p.hospital_number}</span>
          </span>
        ) : (
          <span className="dx-muted">Patient #{v.patient_id}</span>
        );
      },
    },
    {
      key: "check_in_time",
      header: "Checked in",
      width: 150,
      sortable: true,
      accessor: (v) => v.check_in_time ?? v.visit_date,
      render: (v) => <span className="dx-mono">{formatDateTime(v.check_in_time ?? v.visit_date)}</span>,
    },
    {
      key: "priority",
      header: "Priority",
      width: 110,
      sortable: true,
      render: (v) => <DxBadge tone={visitPriorityTone(v.priority)}>{humanize(v.priority || "ROUTINE")}</DxBadge>,
    },
    {
      key: "service_point",
      header: "Current service point",
      minWidth: 170,
      sortable: true,
      filter: true,
      accessor: (v) => (v.current_service_delivery_point ?? v.first_service_delivery_point)?.name ?? "",
      render: (v) => {
        const sdp = v.current_service_delivery_point ?? v.first_service_delivery_point;
        return sdp ? (
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate">{sdp.name}</span>
            <span className="dx-mono dx-faint text-[11px]">{sdp.code}</span>
          </span>
        ) : (
          <span className="dx-faint">Unassigned</span>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      width: 120,
      sortable: true,
      render: (v) => <DxStatusBadge status={v.status || "PENDING"} />,
    },
    {
      key: "actions",
      header: "",
      width: 170,
      align: "right",
      render: (v) => (
        <span className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <DxButton size="sm" leftIcon={<Eye />} onClick={() => openVisit(v)}>
            Open
          </DxButton>
          <DxButton
            size="sm"
            variant="text"
            icon
            title="Re-route"
            onClick={() => navigate(routes.visitReroute.replace(":visitId", String(v.id)))}
          >
            <ArrowRight />
          </DxButton>
          <DxButton
            size="sm"
            variant="text"
            icon
            title="Delete visit"
            className="text-[var(--dx-danger)]"
            disabled={deleteMutation.isPending}
            onClick={() => setPendingDelete(v)}
          >
            <Trash2 />
          </DxButton>
        </span>
      ),
    },
  ];

  const total = meta?.total ?? visits.length;
  const totalPages = meta?.total_pages ?? Math.max(1, Math.ceil(total / VISIT_PAGE_SIZE));
  const filteredPatient = filteredPatientQuery.data;

  return (
    <DxPage>
      <DxPageHeader
        crumbs={filteredPatient ? [{ label: "Patients", to: routes.patients }, { label: patientDisplayName(filteredPatient), to: routes.patientDetail.replace(":patientId", String(filteredPatient.id)) }, { label: "Visits" }] : [{ label: "Visits" }]}
        title={filteredPatient ? `${patientDisplayName(filteredPatient)} — visit history` : "Visit registry"}
        subtitle={
          filteredPatient
            ? `All clinical encounters recorded for ${filteredPatient.hospital_number}.`
            : "Every active and completed encounter across the clinic's service points."
        }
        actions={
          <>
            <DxButton leftIcon={<GitBranch />} onClick={() => navigate(routes.visitFlows)}>
              Pathways
            </DxButton>
            <DxButton variant="primary" leftIcon={<Plus />} onClick={() => navigate(routes.visitInitiate)}>
              New visit
            </DxButton>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DxKpi label="Active visits" value={kpiQuery.data?.active ?? "—"} sub="Active + in progress" icon={Activity} tone="accent" isLoading={kpiQuery.isLoading} onClick={() => { setStatusFilter("ACTIVE"); setPage(0); }} />
        <DxKpi label="Waiting" value={kpiQuery.data?.waiting ?? "—"} sub="Awaiting a service point" icon={Clock} tone="warning" isLoading={kpiQuery.isLoading} onClick={() => { setStatusFilter("WAITING"); setPage(0); }} />
        <DxKpi label="Completed today" value={kpiQuery.data?.completedToday ?? "—"} sub={todayIsoDate()} icon={CheckCircle2} tone="success" isLoading={kpiQuery.isLoading} onClick={() => { setStatusFilter("COMPLETED"); setDateFrom(todayIsoDate()); setPage(0); }} />
        <DxKpi label="Emergency" value={kpiQuery.data?.emergency ?? "—"} sub="Priority: emergency" icon={Flame} tone="danger" isLoading={kpiQuery.isLoading} onClick={() => { setPriorityFilter("EMERGENCY"); setPage(0); }} />
      </div>

      <div>
        <DxToolbar attached>
          <DxSearchBox onSearch={setSearch} placeholder="Search visit code, patient, hospital no.…" className="w-72" />
          <DxToolbarSeparator />
          <DxToolbarGroup>
            <DxSelect
              editorSize="sm"
              aria-label="Status"
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
              placeholder="All statuses"
              options={VISIT_STATUS_OPTIONS}
            />
            <DxSelect
              editorSize="sm"
              aria-label="Priority"
              value={priorityFilter}
              onChange={(e) => { setPriorityFilter(e.target.value); setPage(0); }}
              placeholder="All priorities"
              options={VISIT_PRIORITY_OPTIONS}
            />
          </DxToolbarGroup>
          <DxToolbarSeparator />
          <DxToolbarGroup>
            <DxToolbarLabel>From</DxToolbarLabel>
            <DxInput editorSize="sm" type="date" aria-label="Date from" value={dateFrom} max={dateTo || undefined} onChange={(e) => { setDateFrom(e.target.value); setPage(0); }} className="w-36" />
            <DxToolbarLabel>To</DxToolbarLabel>
            <DxInput editorSize="sm" type="date" aria-label="Date to" value={dateTo} min={dateFrom || undefined} onChange={(e) => { setDateTo(e.target.value); setPage(0); }} className="w-36" />
          </DxToolbarGroup>
          {statusFilter || priorityFilter || dateFrom || dateTo ? (
            <DxButton
              size="sm"
              variant="text"
              onClick={() => { setStatusFilter(""); setPriorityFilter(""); setDateFrom(""); setDateTo(""); setPage(0); }}
            >
              Clear filters
            </DxButton>
          ) : null}
          <DxToolbarSpacer />
          <DxButton
            size="sm"
            leftIcon={<RotateCcw />}
            isLoading={visitsQuery.isFetching && !visitsQuery.isLoading}
            onClick={() => { visitsQuery.refetch(); kpiQuery.refetch(); }}
          >
            Refresh
          </DxButton>
        </DxToolbar>
        <DxGrid<Visit>
          attached
          filterRow
          columns={columns}
          data={rows}
          rowKey={(v) => v.id}
          isLoading={visitsQuery.isLoading}
          error={visitsQuery.isError ? apiErrorMessage(visitsQuery.error, "Unable to reach the visits registry.") : null}
          onRetry={() => visitsQuery.refetch()}
          onRowClick={openVisit}
          rowClassName={(v) =>
            String(v.priority).toUpperCase() === "EMERGENCY" ? "[&>td:first-child]:shadow-[inset_3px_0_0_var(--dx-danger)]" : undefined
          }
          empty={{
            icon: Users,
            title: search ? "No visits match your search" : "No visits found",
            description: search
              ? "Clear the quick search or adjust the filters."
              : "No visits match the current filters. Start a new encounter to begin.",
            action: (
              <DxButton variant="primary" size="sm" leftIcon={<Plus />} onClick={() => navigate(routes.visitInitiate)}>
                New visit
              </DxButton>
            ),
          }}
          footer={
            <DxPager
              page={page + 1}
              totalPages={totalPages}
              totalItems={total}
              pageSize={VISIT_PAGE_SIZE}
              hasNext={meta?.has_next}
              onPageChange={(p) => setPage(p - 1)}
            />
          }
        />
      </div>

      <DxStatusBar>
        <DxStatusItem>
          Showing <b className="dx-strong">{rows.length}</b> of <b className="dx-strong">{total}</b> visits
        </DxStatusItem>
        {search ? <DxStatusItem>Quick search filters the current page only.</DxStatusItem> : null}
        {patientBatchQuery.isFetching ? <DxStatusItem>Resolving patient names…</DxStatusItem> : null}
        <span className="ml-auto">Click a row to open the visit.</span>
      </DxStatusBar>

      <DxConfirm
        isOpen={pendingDelete != null}
        onClose={() => setPendingDelete(null)}
        title="Delete visit"
        description={
          pendingDelete ? (
            <>
              Permanently delete visit <b className="dx-mono dx-strong">{pendingDelete.visit_code || `#${pendingDelete.id}`}</b>
              {" "}for {patientDisplayName(patientFor(pendingDelete))}? This cannot be undone; visits with clinical records may be refused.
            </>
          ) : null
        }
        confirmLabel="Delete visit"
        onConfirm={async () => {
          if (pendingDelete) await deleteMutation.mutateAsync(pendingDelete.id).catch(() => undefined);
        }}
      />
    </DxPage>
  );
}
