// carepoint_hms_ui/src/features/visits/pages/VisitListPage.tsx

import { PageHeader } from "@/components/layout/PageHeader";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  Filter,
  Flame,
  GitBranch,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  User,
} from "lucide-react";
import { routes } from "@/config/routes";
import { deleteVisit, getVisits } from "../api/visits.api";
import type { ListMeta, Visit, VisitListFilters } from "../api/visits.api";
import { getPatientById } from "@/features/patients/api/patients.api";
import type { Patient } from "@/features/patients/api/patients.api";

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "WAITING", label: "Waiting" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "ACTIVE", label: "Active" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

const PRIORITY_OPTIONS = [
  { value: "", label: "All Priorities" },
  { value: "ROUTINE", label: "Routine" },
  { value: "URGENT", label: "Urgent" },
  { value: "EMERGENCY", label: "Emergency" },
];

const PAGE_SIZE = 20;

const statusStyles: Record<string, string> = {
  WAITING: "bg-amber-50 text-amber-600 border-amber-100",
  IN_PROGRESS: "bg-primary-50 text-primary-600 border-primary-100",
  ACTIVE: "bg-primary-50 text-primary-600 border-primary-100",
  COMPLETED: "bg-emerald-50 text-emerald-600 border-emerald-100",
  CANCELLED: "bg-rose-50 text-rose-600 border-rose-100",
};

const priorityStyles: Record<string, { className: string; icon: typeof Flame }> = {
  ROUTINE: { className: "bg-emerald-50 text-emerald-600 border-emerald-100", icon: CheckCircle2 },
  URGENT: { className: "bg-amber-50 text-amber-600 border-amber-100", icon: Clock },
  EMERGENCY: { className: "bg-rose-50 text-rose-600 border-rose-100", icon: Flame },
};

function formatDate(value?: string) {
  if (!value) return "—";
  try {
    const date = new Date(value);
    return date.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

export function VisitListPage() {
  const navigate = useNavigate();

  const [visits, setVisits] = useState<Visit[]>([]);
  const [meta, setMeta] = useState<ListMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [searchParams] = useSearchParams();
  const patientIdFilter = searchParams.get("patient_id");
  const [filteredPatient, setFilteredPatient] = useState<Patient | null>(null);
  const [patientCache, setPatientCache] = useState<Record<number, Patient>>({});

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [page, setPage] = useState(0);

  // Debounce search input
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(handle);
  }, [search]);

  // Reset to first page when filters change (Search now filters locally)
  useEffect(() => {
    setPage(0);
  }, [statusFilter, priorityFilter, patientIdFilter]);

  // Load Patient info if filtering
  useEffect(() => {
    if (patientIdFilter) {
      getPatientById(Number(patientIdFilter))
        .then(setFilteredPatient)
        .catch(() => setFilteredPatient(null));
    } else {
      setFilteredPatient(null);
    }
  }, [patientIdFilter]);

  const filters: VisitListFilters = useMemo(
    () => ({
      skip: page * PAGE_SIZE,
      limit: PAGE_SIZE,
      status: statusFilter || undefined,
      priority: priorityFilter || undefined,
      patient_id: patientIdFilter ? Number(patientIdFilter) : undefined,
    }),
    [page, statusFilter, priorityFilter, patientIdFilter],
  );

  const finalVisits = useMemo(() => {
    if (!debouncedSearch) return visits;
    const query = debouncedSearch.toLowerCase();
    return visits.filter((v) => {
      const patient = v.patient || patientCache[v.patient_id];
      const patientName = patient ? `${patient.first_name} ${patient.last_name}`.toLowerCase() : "";
      const hospNum = patient?.hospital_number?.toLowerCase() || "";
      const visitCode = (v.visit_code || `VISIT-${v.id}`).toLowerCase();
      return patientName.includes(query) || hospNum.includes(query) || visitCode.includes(query);
    });
  }, [visits, debouncedSearch, patientCache]);

  const loadVisits = async (filterArgs: VisitListFilters) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await getVisits(filterArgs);
      const items = response.items || [];
      setVisits(items);
      setMeta(response.meta || null);

      // Fetch missing patient names
      const missingPatientIds = [...new Set(
        items
          .filter(v => !v.patient && !patientCache[v.patient_id])
          .map(v => v.patient_id)
      )];

      if (missingPatientIds.length > 0) {
        Promise.all(missingPatientIds.map(id => getPatientById(id)))
          .then(newPatients => {
            setPatientCache(prev => {
              const next = { ...prev };
              newPatients.forEach(p => { if (p) next[p.id] = p; });
              return next;
            });
          })
          .catch(err => console.error("Failed to fetch missing patients", err));
      }
    } catch (err) {
      console.error("Failed to load visits", err);
      setError("Unable to connect to the visits registry. Please check your connection.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadVisits(filters);
  }, [filters]);

  const handleDelete = async (visitId: number) => {
    if (!confirm("Discharge this visit record? This action cannot be undone.")) return;
    setDeletingId(visitId);
    try {
      await deleteVisit(visitId);
      await loadVisits(filters);
    } catch (err) {
      console.error("Failed to delete visit", err);
      alert("Unable to delete visit. It may have dependent records.");
    } finally {
      setDeletingId(null);
    }
  };

  const total = meta?.total ?? visits.length;
  const skip = meta?.skip ?? page * PAGE_SIZE;
  const limit = meta?.limit ?? PAGE_SIZE;
  const showingFrom = visits.length === 0 ? 0 : skip + 1;
  const showingTo = Math.min(skip + limit, total);
  const hasNext = meta?.has_next ?? skip + limit < total;
  const hasPrevious = meta?.has_previous ?? page > 0;

  return (
    <div className="space-y-10 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <PageHeader
          title={filteredPatient ? `${filteredPatient.first_name} ${filteredPatient.last_name}'s Visit History` : "Active Visit Registry"}
          description={filteredPatient ? `Reviewing all clinical encounters and lifecycle data for ${filteredPatient.first_name}.` : "Track every patient lifecycle in motion across your clinical service points."}
        />
        <div className="flex items-center gap-3">
          <Link
            to={routes.visitFlows}
            className="btn-secondary gap-2 px-6 py-3 rounded-2xl bg-white/80 border-secondary-400"
          >
            <GitBranch className="h-4 w-4" />
            <span className="text-sm font-bold">Pathways</span>
          </Link>
          <Link
            to={routes.visitInitiate}
            className="btn-primary gap-3 py-3 px-8 shadow-xl shadow-primary-500/20"
          >
            <Plus className="h-5 w-5" />
            <span className="font-bold">Initiate Visit</span>
          </Link>
        </div>
      </div>

      <div className="grid gap-8">
        {/* Filters Bar */}
        <div className="glass-card rounded-[2rem] p-4 flex flex-col md:flex-row gap-4 items-stretch md:items-center bg-white/40 backdrop-blur-md">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-secondary-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by visit code, patient name, or hospital number..."
              className="w-full bg-white/50 border-none rounded-2xl pl-14 pr-6 py-4 text-sm focus:ring-2 focus:ring-primary-500/50 transition-all font-medium"
            />
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <div className="relative">
              <Filter className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary-400 pointer-events-none" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="appearance-none bg-white/80 border border-secondary-400 rounded-2xl pl-11 pr-8 py-4 text-xs font-bold uppercase tracking-widest text-secondary-700 focus:ring-2 focus:ring-primary-500/40"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="relative">
              <Flame className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary-400 pointer-events-none" />
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="appearance-none bg-white/80 border border-secondary-400 rounded-2xl pl-11 pr-8 py-4 text-xs font-bold uppercase tracking-widest text-secondary-700 focus:ring-2 focus:ring-primary-500/40"
              >
                {PRIORITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={() => loadVisits(filters)}
              className="btn-secondary p-4 rounded-2xl bg-white/80 border-secondary-400 hover:rotate-180 transition-transform duration-500"
              title="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Visits Table */}
        <div className="glass-card rounded-[2.5rem] overflow-hidden border border-secondary-400/50 shadow-premium bg-white/40">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-secondary-900/5">
                  <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500">Visit</th>
                  <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500">Patient</th>
                  <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500">Service Point</th>
                  <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500">Priority</th>
                  <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500">Status</th>
                  <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500">Check-In</th>
                  <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-100/50">
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={7} className="px-8 py-8">
                        <div className="h-16 bg-secondary-100/30 rounded-2xl w-full" />
                      </td>
                    </tr>
                  ))
                ) : error ? (
                  <tr>
                    <td colSpan={7} className="px-8 py-20 text-center">
                      <div className="max-w-xs mx-auto space-y-4">
                        <AlertCircle className="h-12 w-12 mx-auto text-rose-500/50" />
                        <p className="text-secondary-600 font-bold">{error}</p>
                        <button onClick={() => loadVisits(filters)} className="btn-primary w-full py-3">
                          Try Again
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : finalVisits.length > 0 ? (
                  finalVisits.map((visit) => {
                    const priorityKey = (visit.priority || "ROUTINE").toUpperCase();
                    const priorityMeta = priorityStyles[priorityKey] ?? priorityStyles.ROUTINE;
                    const statusKey = (visit.status || "").toUpperCase();
                    const statusClass =
                      statusStyles[statusKey] ?? "bg-secondary-50 text-secondary-600 border-secondary-400";
                    const PriorityIcon = priorityMeta.icon;
                    const sdp = visit.current_service_delivery_point ?? visit.first_service_delivery_point;
                    return (
                      <tr key={visit.id} className="hover:bg-primary-50/30 transition-all group">
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-3">
                            <div className="h-11 w-11 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-md">
                              <Activity className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="text-[11px] font-mono font-bold text-secondary-900 uppercase tracking-tight">
                                {visit.visit_code || `VISIT-${visit.id}`}
                              </p>
                              <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest mt-0.5">
                                #{visit.id}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          {(visit.patient || patientCache[visit.patient_id]) ? (
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-white flex items-center justify-center text-xs font-bold shadow-md shadow-primary-500/20">
                                {((visit.patient?.first_name || patientCache[visit.patient_id]?.first_name)?.[0] ?? "?")}
                                {((visit.patient?.last_name || patientCache[visit.patient_id]?.last_name)?.[0] ?? "?")}
                              </div>
                              <div>
                                <p className="text-sm font-bold text-secondary-900">
                                  {visit.patient?.first_name || patientCache[visit.patient_id]?.first_name} {visit.patient?.last_name || patientCache[visit.patient_id]?.last_name}
                                </p>
                                <p className="text-[10px] font-mono font-bold text-secondary-400 uppercase tracking-tighter mt-0.5">
                                  {visit.patient?.hospital_number || patientCache[visit.patient_id]?.hospital_number}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-secondary-400 text-xs font-bold">
                              <User className="h-4 w-4" />
                              <span>Patient #{visit.patient_id}</span>
                            </div>
                          )}
                        </td>
                        <td className="px-8 py-6">
                          {sdp ? (
                            <div className="flex items-center gap-2 text-xs font-bold text-secondary-700">
                              <Building2 className="h-3.5 w-3.5 text-primary-500" />
                              <div>
                                <p className="text-secondary-900">{sdp.name}</p>
                                <p className="text-[10px] font-mono font-bold text-secondary-400 uppercase mt-0.5">
                                  {sdp.code}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <span className="text-secondary-400 text-[11px] font-bold uppercase tracking-widest">
                              Unassigned
                            </span>
                          )}
                        </td>
                        <td className="px-8 py-6">
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-bold uppercase tracking-widest ${priorityMeta.className}`}
                          >
                            <PriorityIcon className="h-3 w-3" />
                            {priorityKey}
                          </span>
                        </td>
                        <td className="px-8 py-6">
                          <span
                            className={`inline-flex px-3 py-1.5 rounded-xl border text-[10px] font-bold uppercase tracking-widest ${statusClass}`}
                          >
                            {statusKey || "PENDING"}
                          </span>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-2 text-[11px] font-bold text-secondary-600">
                            <Calendar className="h-3.5 w-3.5 text-secondary-400" />
                            <span>{formatDate(visit.check_in_time || visit.visit_date)}</span>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              to={`/visits/${visit.id}`}
                              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-black transition-all shadow-md"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              <span>View</span>
                            </Link>
                            <button
                              onClick={() =>
                                navigate(routes.visitReroute.replace(":visitId", String(visit.id)))
                              }
                              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-primary-700 transition-all shadow-md shadow-primary-500/10"
                            >
                              <ArrowRight className="h-3.5 w-3.5" />
                              <span>Reroute</span>
                            </button>
                            <button
                              onClick={() => handleDelete(visit.id)}
                              disabled={deletingId === visit.id}
                              className="p-2.5 hover:bg-rose-50 text-rose-500 rounded-xl transition-all disabled:opacity-30"
                              title="Delete visit"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="px-8 py-32 text-center">
                      <div className="max-w-sm mx-auto space-y-6">
                        <div className="h-20 w-20 bg-secondary-50 rounded-3xl flex items-center justify-center mx-auto">
                          <Activity className="h-10 w-10 text-secondary-200" />
                        </div>
                        <h4 className="text-xl font-bold text-secondary-900">No Active Visits</h4>
                        <p className="text-sm text-secondary-500">
                          No visits match your current filters. Clear the filters or initiate a new visit
                          to begin a clinical encounter.
                        </p>
                        <Link
                          to={routes.visitInitiate}
                          className="btn-primary inline-flex items-center gap-2 px-8 py-3"
                        >
                          <Plus className="h-4 w-4" />
                          <span>Initiate Visit</span>
                        </Link>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!isLoading && !error && visits.length > 0 && (
            <div className="px-8 py-6 bg-secondary-50/50 border-t border-secondary-400/50 flex flex-col sm:flex-row justify-between items-center gap-4">
              <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-[0.2em]">
                Showing{" "}
                <span className="text-secondary-900">
                  {showingFrom} – {showingTo}
                </span>{" "}
                of {total} Records {debouncedSearch && `(Filtered locally: ${finalVisits.length})`}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={!hasPrevious}
                  className="px-6 py-2 rounded-xl border border-secondary-200 text-[10px] font-bold uppercase tracking-widest hover:bg-white disabled:opacity-30 transition-all"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={!hasNext}
                  className="px-6 py-2 rounded-xl border border-secondary-200 bg-white text-[10px] font-bold uppercase tracking-widest hover:bg-secondary-900 hover:text-white disabled:opacity-30 transition-all"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
