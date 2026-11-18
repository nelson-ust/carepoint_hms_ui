import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  Plus,
  Scissors,
  Building2,
  Boxes,
  ClipboardList,
} from "lucide-react";
import {
  DxPage, DxPageHeader, DxKpi, DxGrid, DxBadge, DxButton, DxSelect, DxCheckbox,
  type DxGridColumn, type DxBadgeTone,
} from "@/components/dx";
import { routes } from "@/config/routes";
import { getPatients, type Patient } from "@/features/patients/api/patients.api";
import { useSurgicalWorklist, useProcedures, useTheatres } from "../hooks/use-surgery";
import { caseStatusLabel, fmtDateTime, type SurgicalCase } from "../api/surgery.api";
import { BookCaseModal } from "../components/BookCaseModal";

function statusTone(status: string): DxBadgeTone {
  switch (status) {
    case "BOOKED":
    case "CONFIRMED":
      return "info";
    case "PRE_OP":
    case "IN_THEATRE":
    case "PROCEDURE_STARTED":
    case "PROCEDURE_ENDED":
      return "warning";
    case "POST_OP":
    case "COMPLETED":
      return "success";
    case "CANCELLED":
      return "danger";
    default:
      return "neutral";
  }
}

const STATUS_FILTERS = [
  { value: "", label: "Open worklist" },
  { value: "BOOKED", label: "Booked" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "PRE_OP", label: "Pre-op" },
  { value: "IN_THEATRE", label: "In theatre" },
  { value: "PROCEDURE_STARTED", label: "Procedure started" },
  { value: "POST_OP", label: "Post-op" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

export function SurgeryWorklistPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState("");
  const [theatreFilter, setTheatreFilter] = useState("");
  const [emergencyOnly, setEmergencyOnly] = useState(false);
  const [bookOpen, setBookOpen] = useState(false);

  const worklist = useSurgicalWorklist({
    statuses: statusFilter ? [statusFilter] : undefined,
    operating_theatre_id: theatreFilter ? Number(theatreFilter) : undefined,
    emergency_only: emergencyOnly || undefined,
  });
  const proceduresQuery = useProcedures();
  const theatresQuery = useTheatres();
  const patientsQuery = useQuery({
    queryKey: ["patients", "name-map", "surgery"],
    queryFn: () => getPatients(0, 1000),
    staleTime: 5 * 60 * 1000,
  });

  const procedureMap = useMemo(() => {
    const m = new Map<number, string>();
    for (const p of proceduresQuery.data?.items ?? []) m.set(p.id, p.name);
    return m;
  }, [proceduresQuery.data]);
  const theatreMap = useMemo(() => {
    const m = new Map<number, string>();
    for (const t of theatresQuery.data?.items ?? []) m.set(t.id, t.name);
    return m;
  }, [theatresQuery.data]);
  const patientMap = useMemo(() => {
    const m = new Map<number, string>();
    const list = (patientsQuery.data?.items ?? []) as Patient[];
    for (const p of list) m.set(p.id, `${p.first_name} ${p.last_name}`);
    return m;
  }, [patientsQuery.data]);

  const cases = worklist.data?.items ?? [];

  const metrics = useMemo(() => {
    const active = cases.filter((c) => !["COMPLETED", "CANCELLED", "POSTPONED"].includes(String(c.status)));
    const inTheatre = cases.filter((c) => ["IN_THEATRE", "PROCEDURE_STARTED", "PROCEDURE_ENDED"].includes(String(c.status)));
    const emergencies = active.filter((c) => c.is_emergency);
    return { active: active.length, inTheatre: inTheatre.length, emergencies: emergencies.length };
  }, [cases]);

  const openCase = (c: SurgicalCase) => navigate(routes.surgeryCase.replace(":caseId", String(c.id)));

  const columns: DxGridColumn<SurgicalCase>[] = [
    {
      key: "case_no",
      header: "Case",
      render: (c) => (
        <span className="flex items-center gap-2 text-[13px] font-semibold text-[var(--dx-text)]">
          {c.case_no}
          {c.is_emergency ? <DxBadge tone="danger">EMG</DxBadge> : null}
        </span>
      ),
    },
    { key: "patient", header: "Patient", render: (c) => <span className="text-[13px] text-[var(--dx-text)]">{patientMap.get(c.patient_id) ?? `Patient #${c.patient_id}`}</span> },
    { key: "procedure", header: "Procedure", render: (c) => <span className="text-[13px] text-[var(--dx-text)]">{procedureMap.get(c.procedure_catalog_id) ?? `#${c.procedure_catalog_id}`}</span> },
    { key: "theatre", header: "Theatre", render: (c) => <span className="text-[13px] text-[var(--dx-text-muted)]">{c.operating_theatre_id ? theatreMap.get(c.operating_theatre_id) ?? `#${c.operating_theatre_id}` : "—"}</span> },
    { key: "scheduled", header: "Scheduled", render: (c) => <span className="text-[13px] text-[var(--dx-text-muted)]">{fmtDateTime(c.scheduled_start_at)}</span> },
    { key: "status", header: "Status", align: "center", render: (c) => <DxBadge tone={statusTone(String(c.status))}>{caseStatusLabel(String(c.status))}</DxBadge> },
  ];

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Surgery" }, { label: "Worklist" }]}
        title="Surgery Worklist"
        subtitle="Theatre schedule and live case tracking across the surgical lifecycle."
        actions={
          <>
            <DxButton leftIcon={<Building2 className="h-4 w-4" />} onClick={() => navigate(routes.theatres)}>Theatres</DxButton>
            <DxButton leftIcon={<ClipboardList className="h-4 w-4" />} onClick={() => navigate(routes.surgicalProcedures)}>Catalog</DxButton>
            <DxButton leftIcon={<Boxes className="h-4 w-4" />} onClick={() => navigate(routes.instrumentSets)}>Instruments</DxButton>
            <DxButton variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setBookOpen(true)}>Book case</DxButton>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <DxKpi label="Active cases" value={metrics.active} icon={Activity} tone="accent" isLoading={worklist.isLoading} />
        <DxKpi label="In theatre" value={metrics.inTheatre} icon={Scissors} tone="info" isLoading={worklist.isLoading} />
        <DxKpi label="Emergencies" value={metrics.emergencies} icon={AlertTriangle} tone="danger" isLoading={worklist.isLoading} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <DxSelect label="Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} options={STATUS_FILTERS} />
        <DxSelect label="Theatre" value={theatreFilter} onChange={(e) => setTheatreFilter(e.target.value)}
          options={[{ value: "", label: "All theatres" }, ...(theatresQuery.data?.items ?? []).map((t) => ({ value: String(t.id), label: t.name }))]} />
        <div className="flex items-end pb-1">
          <DxCheckbox label="Emergencies only" checked={emergencyOnly} onChange={(e) => setEmergencyOnly(e.target.checked)} />
        </div>
      </div>

      <DxGrid<SurgicalCase>
        columns={columns}
        data={cases}
        rowKey={(c) => c.id}
        isLoading={worklist.isLoading}
        error={worklist.isError ? "The surgical worklist failed to load." : null}
        onRetry={() => worklist.refetch()}
        onRowClick={openCase}
        empty={{ icon: Scissors, title: "No cases", description: "No surgical cases match these filters. Book a case to get started." }}
      />

      <BookCaseModal isOpen={bookOpen} onClose={() => setBookOpen(false)} onBooked={(c) => openCase(c)} />
    </DxPage>
  );
}
