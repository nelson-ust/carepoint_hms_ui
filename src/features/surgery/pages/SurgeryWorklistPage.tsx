import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  CalendarClock,
  Plus,
  Scissors,
  Stethoscope,
  Building2,
  Boxes,
  ClipboardList,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { MetricCard } from "@/components/charts/MetricCard";
import { cn } from "@/lib/utils/cn";
import { routes } from "@/config/routes";
import { getPatients, type Patient } from "@/features/patients/api/patients.api";
import { useSurgicalWorklist, useProcedures, useTheatres } from "../hooks/use-surgery";
import { caseStatusLabel, fmtDateTime, type SurgicalCase } from "../api/surgery.api";
import { BookCaseModal } from "../components/BookCaseModal";

const STATUS_TINT: Record<string, string> = {
  BOOKED: "soft-info",
  CONFIRMED: "soft-info",
  PRE_OP: "soft-warning",
  IN_THEATRE: "soft-warning",
  PROCEDURE_STARTED: "soft-warning",
  PROCEDURE_ENDED: "soft-warning",
  POST_OP: "soft-success",
  COMPLETED: "soft-success",
  CANCELLED: "soft-danger",
  POSTPONED: "secondary",
};

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
    const active = cases.filter(
      (c) => !["COMPLETED", "CANCELLED", "POSTPONED"].includes(String(c.status)),
    );
    const inTheatre = cases.filter((c) =>
      ["IN_THEATRE", "PROCEDURE_STARTED", "PROCEDURE_ENDED"].includes(String(c.status)),
    );
    const emergencies = active.filter((c) => c.is_emergency);
    return { active: active.length, inTheatre: inTheatre.length, emergencies: emergencies.length };
  }, [cases]);

  const openCase = (c: SurgicalCase) => navigate(routes.surgeryCase.replace(":caseId", String(c.id)));

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      <PageHeader
        title="Surgery Worklist"
        description="Theatre schedule and live case tracking across the surgical lifecycle."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" leftIcon={<Building2 className="h-4 w-4" />} onClick={() => navigate(routes.theatres)}>
              Theatres
            </Button>
            <Button variant="secondary" size="sm" leftIcon={<ClipboardList className="h-4 w-4" />} onClick={() => navigate(routes.surgicalProcedures)}>
              Catalog
            </Button>
            <Button variant="secondary" size="sm" leftIcon={<Boxes className="h-4 w-4" />} onClick={() => navigate(routes.instrumentSets)}>
              Instruments
            </Button>
            <Button size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setBookOpen(true)}>
              Book Case
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 sm:grid-cols-3">
        <MetricCard label="Active Cases" value={metrics.active} icon={Activity} tone="primary" isLoading={worklist.isLoading} />
        <MetricCard label="In Theatre" value={metrics.inTheatre} icon={Scissors} tone="cyan" isLoading={worklist.isLoading} />
        <MetricCard label="Emergencies" value={metrics.emergencies} icon={AlertTriangle} tone="rose" isLoading={worklist.isLoading} />
      </div>

      <Card>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Select label="Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} options={STATUS_FILTERS} />
          <Select label="Theatre" value={theatreFilter} onChange={(e) => setTheatreFilter(e.target.value)}>
            <option value="">All theatres</option>
            {(theatresQuery.data?.items ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
          <div className="flex items-end">
            <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-secondary-200 px-4 py-3 dark:border-white/10">
              <input
                type="checkbox"
                className="h-5 w-5 rounded accent-rose-600"
                checked={emergencyOnly}
                onChange={(e) => setEmergencyOnly(e.target.checked)}
              />
              <span className="text-sm font-bold text-secondary-900 dark:text-secondary-100">Emergencies only</span>
            </label>
          </div>
        </div>
      </Card>

      <Card padding="none">
        <CardHeader className="px-6 pt-6" title="Cases" description="Click a case to open its theatre record." />
        {worklist.isLoading ? (
          <div className="space-y-3 px-6 pb-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : worklist.isError ? (
          <div className="px-6 pb-8">
            <EmptyState icon={Scissors} title="Couldn't load the worklist" description="The surgical worklist failed to load." action={<Button size="sm" variant="secondary" onClick={() => worklist.refetch()}>Retry</Button>} />
          </div>
        ) : cases.length === 0 ? (
          <div className="px-6 pb-8">
            <EmptyState icon={Scissors} title="No cases" description="No surgical cases match these filters. Book a case to get started." action={<Button size="sm" onClick={() => setBookOpen(true)} leftIcon={<Plus className="h-4 w-4" />}>Book Case</Button>} />
          </div>
        ) : (
          <div className="overflow-x-auto px-6 pb-6">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="text-left text-[10px] font-black uppercase tracking-[0.15em] text-secondary-400">
                  <th className="px-3 py-2">Case</th>
                  <th className="px-3 py-2">Patient</th>
                  <th className="px-3 py-2">Procedure</th>
                  <th className="px-3 py-2">Theatre</th>
                  <th className="px-3 py-2">Scheduled</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {cases.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => openCase(c)}
                    className="cursor-pointer border-t border-secondary-100 transition-colors hover:bg-secondary-50 dark:border-white/5 dark:hover:bg-white/5"
                  >
                    <td className="px-3 py-3">
                      <span className="flex items-center gap-2 font-black text-secondary-900 dark:text-secondary-100">
                        {c.case_no}
                        {c.is_emergency && <Badge variant="soft-danger">EMG</Badge>}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-secondary-700 dark:text-secondary-300">
                      {patientMap.get(c.patient_id) ?? `Patient #${c.patient_id}`}
                    </td>
                    <td className="px-3 py-3 text-secondary-700 dark:text-secondary-300">
                      {procedureMap.get(c.procedure_catalog_id) ?? `#${c.procedure_catalog_id}`}
                    </td>
                    <td className="px-3 py-3 text-secondary-500">
                      {c.operating_theatre_id ? theatreMap.get(c.operating_theatre_id) ?? `#${c.operating_theatre_id}` : "—"}
                    </td>
                    <td className="px-3 py-3 text-secondary-500">{fmtDateTime(c.scheduled_start_at)}</td>
                    <td className="px-3 py-3">
                      <Badge variant={(STATUS_TINT[String(c.status)] as any) ?? "secondary"}>
                        {caseStatusLabel(String(c.status))}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Stethoscope className={cn("ml-auto h-4 w-4 text-secondary-300")} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <BookCaseModal
        isOpen={bookOpen}
        onClose={() => setBookOpen(false)}
        onBooked={(c) => openCase(c)}
      />
    </div>
  );
}
