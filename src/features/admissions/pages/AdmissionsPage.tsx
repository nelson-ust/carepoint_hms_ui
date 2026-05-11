import { PageHeader } from "@/components/layout/PageHeader";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowRightLeft,
  Bed as BedIcon,
  CalendarClock,
  CheckCircle2,
  Clock,
  Coins,
  Edit3,
  ExternalLink,
  Filter,
  Hospital,
  ListChecks,
  LogIn,
  RefreshCw,
  Save,
  Search,
  Sliders,
  User,
  X,
} from "lucide-react";
import {
  ADMISSION_STATUSES,
  admitPatient,
  captureBedDayCharges,
  convertVisitToAdmission,
  listAdmissions,
  transferAdmissionBed,
  updateAdmissionStatus,
} from "../api/admissions.api";
import type {
  Admission,
  AdmitPatientPayload,
  ConvertVisitToAdmissionPayload,
} from "../api/admissions.api";
import { listWards } from "../api/wards.api";
import type { Ward } from "../api/wards.api";
import { listBeds } from "../api/beds.api";
import type { Bed } from "../api/beds.api";
import { searchPatients } from "@/features/patients/api/patients.api";
import type { Patient } from "@/features/patients/api/patients.api";
import { getStaff, staffDisplayName } from "@/features/staff/api/staff.api";
import type { Staff } from "@/features/staff/api/staff.api";
import { localStorageService, storageKeys } from "@/lib/storage/local-storage";

const statusStyles: Record<string, string> = {
  ADMITTED: "bg-primary-50 text-primary-600 border-primary-100",
  ON_LEAVE: "bg-amber-50 text-amber-600 border-amber-100",
  TRANSFERRED: "bg-secondary-100 text-secondary-600 border-secondary-200",
  AWAITING_DISCHARGE: "bg-amber-50 text-amber-600 border-amber-100",
  DISCHARGED: "bg-emerald-50 text-emerald-600 border-emerald-100",
  CANCELLED: "bg-rose-50 text-rose-600 border-rose-100",
};

const STATUS_FILTERS = [
  { value: "", label: "All Statuses" },
  ...ADMISSION_STATUSES.map((s) => ({ value: s, label: s.replace("_", " ") })),
];

function formatDateTime(value?: string) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("en-GB", {
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

function readStoredUserId(): number | null {
  try {
    const raw = localStorageService.get(storageKeys.user);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return typeof parsed?.id === "number" ? parsed.id : null;
  } catch {
    return null;
  }
}

type ActionKind = "admit" | "from-visit" | "transfer" | "status" | "bed-days" | null;

// ------------- Form types -------------

type AdmitForm = {
  patient_id: number | null;
  patient_label: string;
  visit_id: string;
  ward_id: string;
  bed_id: string;
  admitting_staff_id: number | null;
  admission_reason: string;
  admitted_at: string; // local datetime input
  expected_discharge_at: string;
  capture_first_bed_day_charge: boolean;
};

const emptyAdmitForm: AdmitForm = {
  patient_id: null,
  patient_label: "",
  visit_id: "",
  ward_id: "",
  bed_id: "",
  admitting_staff_id: null,
  admission_reason: "",
  admitted_at: "",
  expected_discharge_at: "",
  capture_first_bed_day_charge: true,
};

type FromVisitForm = {
  visit_id: string;
  ward_id: string;
  bed_id: string;
  admitting_staff_id: number | null;
  admission_reason: string;
  expected_discharge_at: string;
  capture_first_bed_day_charge: boolean;
  route_to_service_delivery_point_id: string;
};

const emptyFromVisitForm: FromVisitForm = {
  visit_id: "",
  ward_id: "",
  bed_id: "",
  admitting_staff_id: null,
  admission_reason: "",
  expected_discharge_at: "",
  capture_first_bed_day_charge: true,
  route_to_service_delivery_point_id: "",
};

type TransferForm = {
  new_ward_id: string;
  new_bed_id: string;
  reason: string;
};

const emptyTransferForm: TransferForm = {
  new_ward_id: "",
  new_bed_id: "",
  reason: "",
};

type StatusForm = {
  new_status: string;
  reason: string;
};

const emptyStatusForm: StatusForm = { new_status: "ADMITTED", reason: "" };

type BedDaysForm = {
  through_date: string;
};

// ------------- Page -------------

export function AdmissionsPage() {
  const [admissions, setAdmissions] = useState<Admission[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<
    { tone: "success" | "error"; message: string } | null
  >(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [wardFilter, setWardFilter] = useState("");

  // Action state
  const [actionKind, setActionKind] = useState<ActionKind>(null);
  const [actionTarget, setActionTarget] = useState<Admission | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Modal forms
  const [admitForm, setAdmitForm] = useState<AdmitForm>(emptyAdmitForm);
  const [fromVisitForm, setFromVisitForm] = useState<FromVisitForm>(emptyFromVisitForm);
  const [transferForm, setTransferForm] = useState<TransferForm>(emptyTransferForm);
  const [statusForm, setStatusForm] = useState<StatusForm>(emptyStatusForm);
  const [bedDaysForm, setBedDaysForm] = useState<BedDaysForm>({
    through_date: new Date().toISOString().slice(0, 10),
  });
  const [bedDaysReceipt, setBedDaysReceipt] = useState<{
    charges_captured: number;
    total_amount_captured: number;
    captured_through: string;
  } | null>(null);

  // Patient search (admit modal)
  const [patientQuery, setPatientQuery] = useState("");
  const [patientResults, setPatientResults] = useState<Patient[]>([]);
  const [searchingPatients, setSearchingPatients] = useState(false);

  const showFeedback = (tone: "success" | "error", message: string) => {
    setFeedback({ tone, message });
    window.setTimeout(() => setFeedback(null), 3500);
  };

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [admRes, wardsRes, bedsRes, staffRes] = await Promise.all([
        listAdmissions({
          skip: 0,
          limit: 200,
          status: statusFilter || undefined,
        }),
        listWards({ skip: 0, limit: 200 }).catch(() => null),
        listBeds({ skip: 0, limit: 500 }).catch(() => null),
        getStaff(0, 200).catch(() => [] as Staff[]),
      ]);
      setAdmissions(admRes.items ?? []);
      setWards(wardsRes?.items ?? []);
      setBeds(bedsRes?.items ?? []);
      setStaffList(Array.isArray(staffRes) ? staffRes : []);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Unable to load admissions.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  // Default the admitting staff to the logged-in user
  useEffect(() => {
    const userId = readStoredUserId();
    if (userId == null) return;
    const match = staffList.find((s) => s.user_id === userId);
    if (!match) return;
    setAdmitForm((prev) =>
      prev.admitting_staff_id == null ? { ...prev, admitting_staff_id: match.id } : prev,
    );
    setFromVisitForm((prev) =>
      prev.admitting_staff_id == null ? { ...prev, admitting_staff_id: match.id } : prev,
    );
  }, [staffList]);

  // Debounced patient search for admit modal
  useEffect(() => {
    if (patientQuery.trim().length < 2) {
      setPatientResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      setSearchingPatients(true);
      try {
        const res = await searchPatients(patientQuery.trim());
        setPatientResults((res as any).items ?? []);
      } catch {
        setPatientResults([]);
      } finally {
        setSearchingPatients(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [patientQuery]);

  const filteredAdmissions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return admissions.filter((a) => {
      if (wardFilter && String(a.ward_id) !== wardFilter) return false;
      if (!q) return true;
      return (
        a.admission_no?.toLowerCase().includes(q) ||
        a.admission_reason?.toLowerCase().includes(q) ||
        a.patient?.first_name?.toLowerCase().includes(q) ||
        a.patient?.last_name?.toLowerCase().includes(q) ||
        a.patient?.hospital_number?.toLowerCase().includes(q)
      );
    });
  }, [admissions, search, wardFilter]);

  const stats = useMemo(() => {
    const total = admissions.length;
    const admitted = admissions.filter((a) => a.admission_status === "ADMITTED").length;
    const awaitingDischarge = admissions.filter(
      (a) => a.admission_status === "AWAITING_DISCHARGE",
    ).length;
    const discharged = admissions.filter((a) => a.admission_status === "DISCHARGED").length;
    return { total, admitted, awaitingDischarge, discharged };
  }, [admissions]);

  const wardName = (id: number) =>
    wards.find((w) => w.id === id)?.name ?? `Ward #${id}`;
  const bedNumber = (id: number) =>
    beds.find((b) => b.id === id)?.bed_no ?? `Bed #${id}`;

  // ----- Open modals -----
  const openAdmit = () => {
    setActionKind("admit");
    setActionTarget(null);
    setAdmitForm({ ...emptyAdmitForm, admitting_staff_id: admitForm.admitting_staff_id });
    setPatientQuery("");
    setPatientResults([]);
    setActionError(null);
  };

  const openFromVisit = () => {
    setActionKind("from-visit");
    setActionTarget(null);
    setFromVisitForm({
      ...emptyFromVisitForm,
      admitting_staff_id: fromVisitForm.admitting_staff_id,
    });
    setActionError(null);
  };

  const openTransfer = (a: Admission) => {
    setActionKind("transfer");
    setActionTarget(a);
    setTransferForm({
      new_ward_id: String(a.ward_id),
      new_bed_id: "",
      reason: "",
    });
    setActionError(null);
  };

  const openStatus = (a: Admission) => {
    setActionKind("status");
    setActionTarget(a);
    setStatusForm({
      new_status:
        a.admission_status === "ADMITTED" ? "AWAITING_DISCHARGE" : "DISCHARGED",
      reason: "",
    });
    setActionError(null);
  };

  const openBedDays = (a: Admission) => {
    setActionKind("bed-days");
    setActionTarget(a);
    setBedDaysForm({ through_date: new Date().toISOString().slice(0, 10) });
    setBedDaysReceipt(null);
    setActionError(null);
  };

  const closeAction = () => {
    if (actionPending) return;
    setActionKind(null);
    setActionTarget(null);
    setActionError(null);
    setBedDaysReceipt(null);
  };

  // ----- Apply update -----
  const replaceAdmission = (next: Admission) => {
    setAdmissions((prev) => {
      const others = prev.filter((a) => a.id !== next.id);
      return [next, ...others].sort(
        (a, b) =>
          new Date(b.admitted_at || b.created_at).getTime() -
          new Date(a.admitted_at || a.created_at).getTime(),
      );
    });
  };

  // ----- Submit handlers -----
  const handleAdmit = async () => {
    if (!admitForm.patient_id) {
      setActionError("Pick a patient first.");
      return;
    }
    if (!admitForm.ward_id || !admitForm.bed_id) {
      setActionError("Pick a ward and bed.");
      return;
    }
    setActionPending(true);
    setActionError(null);
    try {
      const payload: AdmitPatientPayload = {
        patient_id: admitForm.patient_id,
        visit_id: admitForm.visit_id ? Number(admitForm.visit_id) : undefined,
        ward_id: Number(admitForm.ward_id),
        bed_id: Number(admitForm.bed_id),
        admitting_staff_id: admitForm.admitting_staff_id ?? undefined,
        admission_reason: admitForm.admission_reason.trim() || undefined,
        admitted_at: admitForm.admitted_at
          ? new Date(admitForm.admitted_at).toISOString()
          : undefined,
        expected_discharge_at: admitForm.expected_discharge_at
          ? new Date(admitForm.expected_discharge_at).toISOString()
          : undefined,
        capture_first_bed_day_charge: admitForm.capture_first_bed_day_charge,
      };
      const res = await admitPatient(payload);
      replaceAdmission(res.admission);
      showFeedback("success", res.message || "Patient admitted.");
      closeAction();
    } catch (err: any) {
      setActionError(err?.response?.data?.message || "Failed to admit patient.");
    } finally {
      setActionPending(false);
    }
  };

  const handleFromVisit = async () => {
    if (!fromVisitForm.visit_id) {
      setActionError("Provide a visit ID.");
      return;
    }
    if (!fromVisitForm.ward_id || !fromVisitForm.bed_id) {
      setActionError("Pick a ward and bed.");
      return;
    }
    setActionPending(true);
    setActionError(null);
    try {
      const payload: ConvertVisitToAdmissionPayload = {
        visit_id: Number(fromVisitForm.visit_id),
        ward_id: Number(fromVisitForm.ward_id),
        bed_id: Number(fromVisitForm.bed_id),
        admitting_staff_id: fromVisitForm.admitting_staff_id ?? undefined,
        admission_reason: fromVisitForm.admission_reason.trim() || undefined,
        expected_discharge_at: fromVisitForm.expected_discharge_at
          ? new Date(fromVisitForm.expected_discharge_at).toISOString()
          : undefined,
        capture_first_bed_day_charge: fromVisitForm.capture_first_bed_day_charge,
        route_to_service_delivery_point_id: fromVisitForm.route_to_service_delivery_point_id
          ? Number(fromVisitForm.route_to_service_delivery_point_id)
          : undefined,
      };
      const res = await convertVisitToAdmission(payload);
      replaceAdmission(res.admission);
      showFeedback("success", res.message || "Visit converted to admission.");
      closeAction();
    } catch (err: any) {
      setActionError(err?.response?.data?.message || "Failed to convert visit.");
    } finally {
      setActionPending(false);
    }
  };

  const handleTransfer = async () => {
    if (!actionTarget) return;
    if (!transferForm.new_bed_id) {
      setActionError("Pick the destination bed.");
      return;
    }
    setActionPending(true);
    setActionError(null);
    try {
      const res = await transferAdmissionBed(actionTarget.id, {
        new_bed_id: Number(transferForm.new_bed_id),
        new_ward_id: transferForm.new_ward_id ? Number(transferForm.new_ward_id) : undefined,
        reason: transferForm.reason.trim() || undefined,
      });
      replaceAdmission(res.admission);
      showFeedback("success", res.message || "Admission transferred.");
      closeAction();
    } catch (err: any) {
      setActionError(err?.response?.data?.message || "Failed to transfer admission.");
    } finally {
      setActionPending(false);
    }
  };

  const handleStatus = async () => {
    if (!actionTarget) return;
    if (!statusForm.new_status) {
      setActionError("Pick a status.");
      return;
    }
    setActionPending(true);
    setActionError(null);
    try {
      const res = await updateAdmissionStatus(actionTarget.id, {
        new_status: statusForm.new_status,
        reason: statusForm.reason.trim() || undefined,
      });
      replaceAdmission(res.admission);
      showFeedback("success", res.message || "Admission status updated.");
      closeAction();
    } catch (err: any) {
      setActionError(err?.response?.data?.message || "Failed to update status.");
    } finally {
      setActionPending(false);
    }
  };

  const handleBedDays = async () => {
    if (!actionTarget) return;
    if (!bedDaysForm.through_date) {
      setActionError("Pick a through-date.");
      return;
    }
    setActionPending(true);
    setActionError(null);
    try {
      const res = await captureBedDayCharges(actionTarget.id, {
        through_date: new Date(bedDaysForm.through_date).toISOString(),
      });
      setBedDaysReceipt({
        charges_captured: res.charges_captured,
        total_amount_captured: res.total_amount_captured,
        captured_through: res.captured_through,
      });
      showFeedback("success", res.message || "Bed-day charges captured.");
    } catch (err: any) {
      setActionError(err?.response?.data?.message || "Failed to capture charges.");
    } finally {
      setActionPending(false);
    }
  };

  // ----- Render -----
  return (
    <div className="space-y-10 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <PageHeader
          title="Admissions & Wards"
          description="Track every inpatient — admission, ward transfers, status changes, and bed-day billing."
        />
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={load}
            className="btn-secondary p-4 rounded-2xl bg-white/80 border-secondary-100 hover:rotate-180 transition-transform duration-500"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={openFromVisit}
            className="btn-secondary gap-2 px-5 py-3 rounded-2xl bg-white/80 border-secondary-100"
          >
            <ArrowRightLeft className="h-4 w-4" />
            <span className="text-sm font-bold">From Visit</span>
          </button>
          <button
            onClick={openAdmit}
            className="btn-primary gap-3 py-3 px-7 shadow-xl shadow-primary-500/20"
          >
            <LogIn className="h-5 w-5" />
            <span className="font-bold">Admit Patient</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`px-6 py-4 rounded-2xl border flex items-center gap-3 shadow-lg animate-fade-in ${
            feedback.tone === "success"
              ? "bg-emerald-50 text-emerald-700 border-emerald-100"
              : "bg-rose-50 text-rose-700 border-rose-100"
          }`}
        >
          {feedback.tone === "success" ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
          <span className="text-sm font-bold">{feedback.message}</span>
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard icon={ListChecks} label="Total" value={stats.total} tone="primary" />
        <StatCard icon={BedIcon} label="Admitted" value={stats.admitted} tone="primary" />
        <StatCard icon={Clock} label="Awaiting Discharge" value={stats.awaitingDischarge} tone="amber" />
        <StatCard icon={CheckCircle2} label="Discharged" value={stats.discharged} tone="emerald" />
      </div>

      {/* Filters */}
      <div className="glass-card rounded-[2rem] p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center bg-white/40 backdrop-blur-md">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-secondary-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by admission #, patient name, hospital number, reason..."
            className="w-full bg-white/50 border-none rounded-2xl pl-14 pr-6 py-4 text-sm focus:ring-2 focus:ring-primary-500/50 transition-all font-medium"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary-400 pointer-events-none" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="appearance-none bg-white/80 border border-secondary-100 rounded-2xl pl-11 pr-8 py-4 text-xs font-bold uppercase tracking-widest text-secondary-700 focus:ring-2 focus:ring-primary-500/40"
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        {wards.length > 0 && (
          <div className="relative">
            <Hospital className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary-400 pointer-events-none" />
            <select
              value={wardFilter}
              onChange={(e) => setWardFilter(e.target.value)}
              className="appearance-none bg-white/80 border border-secondary-100 rounded-2xl pl-11 pr-8 py-4 text-xs font-bold uppercase tracking-widest text-secondary-700 focus:ring-2 focus:ring-primary-500/40"
            >
              <option value="">All Wards</option>
              {wards.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name ?? `Ward #${w.id}`}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="glass-card rounded-[2.5rem] overflow-hidden border border-secondary-100/50 shadow-premium bg-white/40">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-secondary-900/5">
                <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500">Admission</th>
                <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500">Patient</th>
                <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500">Ward / Bed</th>
                <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500">Status</th>
                <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500">Admitted</th>
                <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-100/50">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className="px-8 py-6">
                      <div className="h-14 bg-secondary-100/30 rounded-2xl" />
                    </td>
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center">
                    <AlertCircle className="h-12 w-12 mx-auto text-rose-500/50 mb-4" />
                    <p className="text-secondary-600 font-bold">{error}</p>
                    <button onClick={load} className="btn-primary mt-4 py-3 px-8">
                      Try Again
                    </button>
                  </td>
                </tr>
              ) : filteredAdmissions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-8 py-32 text-center">
                    <div className="h-20 w-20 bg-secondary-50 rounded-3xl flex items-center justify-center mx-auto mb-4">
                      <BedIcon className="h-10 w-10 text-secondary-200" />
                    </div>
                    <h4 className="text-xl font-bold text-secondary-900">No Admissions</h4>
                    <p className="text-sm text-secondary-500 mt-2">
                      {admissions.length === 0
                        ? "Admit the first patient to start the inpatient ledger."
                        : "No admissions match your filters."}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredAdmissions.map((a) => {
                  const statusKey = (a.admission_status || "ADMITTED").toUpperCase();
                  const statusClass = statusStyles[statusKey] ?? statusStyles.ADMITTED;
                  const isClosed = ["DISCHARGED", "CANCELLED"].includes(statusKey);
                  return (
                    <tr key={a.id} className="hover:bg-primary-50/30 transition-all">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                          <div className="h-11 w-11 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-md">
                            <BedIcon className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-[11px] font-mono font-bold text-secondary-900 uppercase tracking-tight">
                              {a.admission_no}
                            </p>
                            <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest mt-0.5">
                              #{a.id}
                              {a.visit_id && (
                                <>
                                  {" · "}
                                  <Link
                                    to={`/visits/${a.visit_id}`}
                                    className="hover:text-primary-500 inline-flex items-center gap-0.5"
                                  >
                                    Visit #{a.visit_id}
                                    <ExternalLink className="h-2.5 w-2.5" />
                                  </Link>
                                </>
                              )}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        {a.patient ? (
                          <div className="flex items-center gap-2">
                            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-white flex items-center justify-center text-[10px] font-black shadow-md">
                              {(a.patient.first_name?.[0] ?? "?")}
                              {(a.patient.last_name?.[0] ?? "?")}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-secondary-900 truncate">
                                {a.patient.first_name} {a.patient.last_name}
                              </p>
                              <p className="text-[10px] font-mono font-bold text-secondary-400 uppercase tracking-tighter mt-0.5">
                                {a.patient.hospital_number}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-secondary-700">
                            <User className="h-3 w-3" />
                            Patient #{a.patient_id}
                          </span>
                        )}
                      </td>
                      <td className="px-8 py-6">
                        <div className="space-y-1">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-secondary-100 text-secondary-600 text-[10px] font-bold uppercase tracking-widest">
                            <Hospital className="h-3 w-3" />
                            {wardName(a.ward_id)}
                          </span>
                          <p className="text-[10px] font-mono font-bold text-secondary-500">
                            <BedIcon className="h-2.5 w-2.5 inline mr-1" />
                            {bedNumber(a.bed_id)}
                          </p>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span
                          className={`inline-flex px-3 py-1.5 rounded-xl border text-[10px] font-bold uppercase tracking-widest ${statusClass}`}
                        >
                          {statusKey.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-secondary-600">
                          <Clock className="h-3 w-3 text-secondary-400" />
                          {formatDateTime(a.admitted_at || a.created_at)}
                        </div>
                        {a.expected_discharge_at && !a.actual_discharge_at && (
                          <p className="text-[10px] font-bold text-amber-600 mt-1 flex items-center gap-1">
                            <CalendarClock className="h-2.5 w-2.5" />
                            Exp. {formatDateTime(a.expected_discharge_at)}
                          </p>
                        )}
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {!isClosed && (
                            <>
                              <button
                                onClick={() => openTransfer(a)}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-bold uppercase tracking-widest shadow-md"
                                title="Transfer Bed"
                              >
                                <ArrowRightLeft className="h-3 w-3" />
                                Transfer
                              </button>
                              <button
                                onClick={() => openStatus(a)}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-[10px] font-bold uppercase tracking-widest shadow-md"
                                title="Update Status"
                              >
                                <Sliders className="h-3 w-3" />
                                Status
                              </button>
                              <button
                                onClick={() => openBedDays(a)}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-bold uppercase tracking-widest shadow-md"
                                title="Capture Bed-Day Charges"
                              >
                                <Coins className="h-3 w-3" />
                                Bed-Days
                              </button>
                            </>
                          )}
                          {isClosed && (
                            <button
                              onClick={() => openBedDays(a)}
                              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary-100 hover:bg-secondary-200 text-secondary-700 text-[10px] font-bold uppercase tracking-widest"
                              title="Bed-Days"
                            >
                              <Coins className="h-3 w-3" />
                              Bed-Days
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODALS */}
      {actionKind === "admit" && (
        <ModalShell
          title="Admit Patient"
          subtitle="Open A New Inpatient Stay"
          onClose={closeAction}
          icon={LogIn}
        >
          {actionError && (
            <ErrorBanner message={actionError} />
          )}
          <div className="space-y-5">
            {/* Patient picker */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500">
                Patient *
              </label>
              {admitForm.patient_id ? (
                <div className="flex items-center justify-between p-4 rounded-2xl bg-primary-50 border border-primary-100">
                  <div className="flex items-center gap-3">
                    <User className="h-4 w-4 text-primary-600" />
                    <p className="text-sm font-bold text-secondary-900">
                      {admitForm.patient_label}
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      setAdmitForm({ ...admitForm, patient_id: null, patient_label: "" })
                    }
                    className="p-1.5 rounded-lg hover:bg-white text-secondary-500"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={patientQuery}
                    onChange={(e) => setPatientQuery(e.target.value)}
                    placeholder="Search by name or hospital number..."
                    className="input-field h-12 bg-secondary-50 border-secondary-100 w-full"
                  />
                  {searchingPatients && (
                    <p className="text-[10px] font-bold uppercase tracking-widest text-secondary-400">
                      Searching...
                    </p>
                  )}
                  {patientResults.length > 0 && (
                    <div className="max-h-48 overflow-y-auto rounded-xl border border-secondary-100 bg-white divide-y divide-secondary-100">
                      {patientResults.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => {
                            setAdmitForm({
                              ...admitForm,
                              patient_id: p.id,
                              patient_label: `${p.first_name} ${p.last_name} · ${p.hospital_number}`,
                            });
                            setPatientQuery("");
                            setPatientResults([]);
                          }}
                          className="w-full text-left p-3 hover:bg-primary-50/40 transition-colors"
                        >
                          <p className="text-sm font-bold text-secondary-900">
                            {p.first_name} {p.last_name}
                          </p>
                          <p className="text-[10px] font-mono font-bold text-secondary-400 uppercase">
                            {p.hospital_number}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <FieldLabel label="Visit ID (Optional)">
                <input
                  type="number"
                  value={admitForm.visit_id}
                  onChange={(e) => setAdmitForm({ ...admitForm, visit_id: e.target.value })}
                  placeholder="e.g. 12"
                  className="input-field h-12 bg-secondary-50 border-secondary-100 w-full font-mono"
                />
              </FieldLabel>
              <StaffPicker
                label="Admitting Staff"
                value={admitForm.admitting_staff_id}
                onChange={(v) => setAdmitForm({ ...admitForm, admitting_staff_id: v })}
                staffList={staffList}
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <WardPicker
                label="Ward *"
                value={admitForm.ward_id}
                wards={wards}
                onChange={(v) => setAdmitForm({ ...admitForm, ward_id: v, bed_id: "" })}
              />
              <BedPicker
                label="Bed *"
                value={admitForm.bed_id}
                wardId={admitForm.ward_id}
                beds={beds}
                onChange={(v) => setAdmitForm({ ...admitForm, bed_id: v })}
              />
            </div>

            <FieldLabel label="Admission Reason">
              <textarea
                value={admitForm.admission_reason}
                onChange={(e) =>
                  setAdmitForm({ ...admitForm, admission_reason: e.target.value })
                }
                placeholder="Clinical reason for admission..."
                className="input-field h-20 bg-secondary-50 border-secondary-100 w-full resize-none py-3"
              />
            </FieldLabel>

            <div className="grid sm:grid-cols-2 gap-4">
              <FieldLabel label="Admitted At">
                <input
                  type="datetime-local"
                  value={admitForm.admitted_at}
                  onChange={(e) =>
                    setAdmitForm({ ...admitForm, admitted_at: e.target.value })
                  }
                  className="input-field h-12 bg-secondary-50 border-secondary-100 w-full font-mono text-xs"
                />
              </FieldLabel>
              <FieldLabel label="Expected Discharge">
                <input
                  type="datetime-local"
                  value={admitForm.expected_discharge_at}
                  onChange={(e) =>
                    setAdmitForm({ ...admitForm, expected_discharge_at: e.target.value })
                  }
                  className="input-field h-12 bg-secondary-50 border-secondary-100 w-full font-mono text-xs"
                />
              </FieldLabel>
            </div>

            <ToggleSwitch
              label="Capture First Bed-Day Charge"
              hint="Auto-bill the first bed-day immediately"
              value={admitForm.capture_first_bed_day_charge}
              onChange={(v) =>
                setAdmitForm({ ...admitForm, capture_first_bed_day_charge: v })
              }
            />
          </div>

          <ModalActions
            onClose={closeAction}
            onSubmit={handleAdmit}
            pending={actionPending}
            submitLabel="Admit Patient"
            submitIcon={LogIn}
          />
        </ModalShell>
      )}

      {actionKind === "from-visit" && (
        <ModalShell
          title="Convert Visit to Admission"
          subtitle="Promote An Outpatient Visit Into Inpatient Care"
          onClose={closeAction}
          icon={ArrowRightLeft}
        >
          {actionError && <ErrorBanner message={actionError} />}
          <div className="space-y-5">
            <FieldLabel label="Visit ID *">
              <input
                type="number"
                value={fromVisitForm.visit_id}
                onChange={(e) =>
                  setFromVisitForm({ ...fromVisitForm, visit_id: e.target.value })
                }
                placeholder="e.g. 1245"
                className="input-field h-12 bg-secondary-50 border-secondary-100 w-full font-mono"
              />
            </FieldLabel>
            <div className="grid sm:grid-cols-2 gap-4">
              <WardPicker
                label="Ward *"
                value={fromVisitForm.ward_id}
                wards={wards}
                onChange={(v) =>
                  setFromVisitForm({ ...fromVisitForm, ward_id: v, bed_id: "" })
                }
              />
              <BedPicker
                label="Bed *"
                value={fromVisitForm.bed_id}
                wardId={fromVisitForm.ward_id}
                beds={beds}
                onChange={(v) => setFromVisitForm({ ...fromVisitForm, bed_id: v })}
              />
            </div>
            <StaffPicker
              label="Admitting Staff"
              value={fromVisitForm.admitting_staff_id}
              onChange={(v) =>
                setFromVisitForm({ ...fromVisitForm, admitting_staff_id: v })
              }
              staffList={staffList}
            />
            <FieldLabel label="Admission Reason">
              <textarea
                value={fromVisitForm.admission_reason}
                onChange={(e) =>
                  setFromVisitForm({ ...fromVisitForm, admission_reason: e.target.value })
                }
                placeholder="Reason for converting this visit..."
                className="input-field h-20 bg-secondary-50 border-secondary-100 w-full resize-none py-3"
              />
            </FieldLabel>
            <FieldLabel label="Expected Discharge">
              <input
                type="datetime-local"
                value={fromVisitForm.expected_discharge_at}
                onChange={(e) =>
                  setFromVisitForm({
                    ...fromVisitForm,
                    expected_discharge_at: e.target.value,
                  })
                }
                className="input-field h-12 bg-secondary-50 border-secondary-100 w-full font-mono text-xs"
              />
            </FieldLabel>
            <FieldLabel label="Route To Service Point ID (Optional)">
              <input
                type="number"
                value={fromVisitForm.route_to_service_delivery_point_id}
                onChange={(e) =>
                  setFromVisitForm({
                    ...fromVisitForm,
                    route_to_service_delivery_point_id: e.target.value,
                  })
                }
                placeholder="SDP id"
                className="input-field h-12 bg-secondary-50 border-secondary-100 w-full font-mono"
              />
            </FieldLabel>
            <ToggleSwitch
              label="Capture First Bed-Day Charge"
              hint="Auto-bill the first bed-day immediately"
              value={fromVisitForm.capture_first_bed_day_charge}
              onChange={(v) =>
                setFromVisitForm({ ...fromVisitForm, capture_first_bed_day_charge: v })
              }
            />
          </div>
          <ModalActions
            onClose={closeAction}
            onSubmit={handleFromVisit}
            pending={actionPending}
            submitLabel="Convert to Admission"
            submitIcon={ArrowRightLeft}
          />
        </ModalShell>
      )}

      {actionKind === "transfer" && actionTarget && (
        <ModalShell
          title="Transfer Bed"
          subtitle="Move The Patient To A New Bed Or Ward"
          onClose={closeAction}
          icon={ArrowRightLeft}
          tone="amber"
        >
          {actionError && <ErrorBanner message={actionError} />}
          <ContextStrip admission={actionTarget} wardName={wardName} bedNumber={bedNumber} />
          <div className="space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <WardPicker
                label="New Ward (Optional)"
                value={transferForm.new_ward_id}
                wards={wards}
                onChange={(v) =>
                  setTransferForm({ ...transferForm, new_ward_id: v, new_bed_id: "" })
                }
              />
              <BedPicker
                label="New Bed *"
                value={transferForm.new_bed_id}
                wardId={transferForm.new_ward_id}
                beds={beds}
                excludeBedId={actionTarget.bed_id}
                onChange={(v) => setTransferForm({ ...transferForm, new_bed_id: v })}
              />
            </div>
            <FieldLabel label="Reason">
              <textarea
                value={transferForm.reason}
                onChange={(e) =>
                  setTransferForm({ ...transferForm, reason: e.target.value })
                }
                placeholder="Why is this patient being moved?"
                className="input-field h-20 bg-secondary-50 border-secondary-100 w-full resize-none py-3"
              />
            </FieldLabel>
          </div>
          <ModalActions
            onClose={closeAction}
            onSubmit={handleTransfer}
            pending={actionPending}
            submitLabel="Transfer"
            submitIcon={ArrowRightLeft}
            tone="amber"
          />
        </ModalShell>
      )}

      {actionKind === "status" && actionTarget && (
        <ModalShell
          title="Update Admission Status"
          subtitle="Move The Stay Through Its Lifecycle"
          onClose={closeAction}
          icon={Sliders}
        >
          {actionError && <ErrorBanner message={actionError} />}
          <ContextStrip admission={actionTarget} wardName={wardName} bedNumber={bedNumber} />
          <div className="space-y-5">
            <FieldLabel label="New Status *">
              <div className="grid grid-cols-2 gap-2">
                {ADMISSION_STATUSES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatusForm({ ...statusForm, new_status: s })}
                    className={`p-3 rounded-xl border-2 text-[10px] font-bold uppercase tracking-widest transition-all ${
                      statusForm.new_status === s
                        ? "bg-primary-500 text-white border-primary-500 shadow-md"
                        : "bg-white border-secondary-100 text-secondary-600 hover:border-primary-300"
                    }`}
                  >
                    {s.replace("_", " ")}
                  </button>
                ))}
              </div>
            </FieldLabel>
            <FieldLabel label="Reason">
              <textarea
                value={statusForm.reason}
                onChange={(e) => setStatusForm({ ...statusForm, reason: e.target.value })}
                placeholder="Note for the audit log..."
                className="input-field h-20 bg-secondary-50 border-secondary-100 w-full resize-none py-3"
              />
            </FieldLabel>
          </div>
          <ModalActions
            onClose={closeAction}
            onSubmit={handleStatus}
            pending={actionPending}
            submitLabel="Update Status"
            submitIcon={Edit3}
          />
        </ModalShell>
      )}

      {actionKind === "bed-days" && actionTarget && (
        <ModalShell
          title="Capture Bed-Day Charges"
          subtitle="Auto-Bill Bed-Days Up To A Date"
          onClose={closeAction}
          icon={Coins}
          tone="emerald"
        >
          {actionError && <ErrorBanner message={actionError} />}
          <ContextStrip admission={actionTarget} wardName={wardName} bedNumber={bedNumber} />
          <div className="space-y-5">
            <FieldLabel label="Capture Through Date *">
              <input
                type="date"
                value={bedDaysForm.through_date}
                onChange={(e) =>
                  setBedDaysForm({ ...bedDaysForm, through_date: e.target.value })
                }
                className="input-field h-12 bg-secondary-50 border-secondary-100 w-full font-mono"
              />
            </FieldLabel>
            {bedDaysReceipt && (
              <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-5">
                <div className="flex items-center gap-3 text-emerald-700 mb-3">
                  <CheckCircle2 className="h-5 w-5" />
                  <p className="text-sm font-bold">Captured</p>
                </div>
                <dl className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <dt className="text-[10px] font-bold uppercase tracking-widest text-emerald-600/80">
                      Days
                    </dt>
                    <dd className="text-2xl font-black text-emerald-700">
                      {bedDaysReceipt.charges_captured}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-bold uppercase tracking-widest text-emerald-600/80">
                      Total
                    </dt>
                    <dd className="text-2xl font-black text-emerald-700 font-mono">
                      {new Intl.NumberFormat("en-NG", {
                        style: "currency",
                        currency: "NGN",
                        maximumFractionDigits: 2,
                      }).format(bedDaysReceipt.total_amount_captured)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-bold uppercase tracking-widest text-emerald-600/80">
                      Through
                    </dt>
                    <dd className="text-xs font-mono font-bold text-emerald-700">
                      {new Date(bedDaysReceipt.captured_through).toLocaleDateString()}
                    </dd>
                  </div>
                </dl>
              </div>
            )}
          </div>
          <ModalActions
            onClose={closeAction}
            onSubmit={handleBedDays}
            pending={actionPending}
            submitLabel="Capture Charges"
            submitIcon={Coins}
            tone="emerald"
          />
        </ModalShell>
      )}
    </div>
  );
}

// =====================================================================
// Sub-components
// =====================================================================

function ContextStrip({
  admission,
  wardName,
  bedNumber,
}: {
  admission: Admission;
  wardName: (id: number) => string;
  bedNumber: (id: number) => string;
}) {
  return (
    <div className="mb-6 p-4 rounded-2xl bg-secondary-50 border border-secondary-100">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <BedIcon className="h-4 w-4 text-secondary-500" />
          <div>
            <p className="text-[10px] font-mono font-bold text-secondary-400 uppercase">
              {admission.admission_no}
            </p>
            {admission.patient && (
              <p className="text-sm font-bold text-secondary-900 mt-0.5">
                {admission.patient.first_name} {admission.patient.last_name}
              </p>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase tracking-widest text-secondary-400">
            Currently
          </p>
          <p className="text-xs font-mono font-bold text-secondary-700 mt-0.5">
            {wardName(admission.ward_id)} · {bedNumber(admission.bed_id)}
          </p>
        </div>
      </div>
    </div>
  );
}

function FieldLabel({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500">
        {label}
      </label>
      {children}
    </div>
  );
}

function WardPicker({
  label,
  value,
  wards,
  onChange,
}: {
  label: string;
  value: string;
  wards: Ward[];
  onChange: (v: string) => void;
}) {
  return (
    <FieldLabel label={label}>
      {wards.length > 0 ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input-field h-12 bg-secondary-50 border-secondary-100 w-full"
        >
          <option value="">Pick a ward...</option>
          {wards.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name ?? `Ward #${w.id}`}
            </option>
          ))}
        </select>
      ) : (
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Ward ID"
          className="input-field h-12 bg-secondary-50 border-secondary-100 w-full font-mono"
        />
      )}
    </FieldLabel>
  );
}

function BedPicker({
  label,
  value,
  wardId,
  beds,
  excludeBedId,
  onChange,
}: {
  label: string;
  value: string;
  wardId: string;
  beds: Bed[];
  excludeBedId?: number;
  onChange: (v: string) => void;
}) {
  const filtered = beds.filter((b) => {
    if (excludeBedId != null && b.id === excludeBedId) return false;
    if (wardId && b.ward_id !== Number(wardId)) return false;
    if (b.bed_status && b.bed_status !== "AVAILABLE" && b.id !== Number(value)) return false;
    return true;
  });

  return (
    <FieldLabel label={label}>
      {beds.length > 0 ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input-field h-12 bg-secondary-50 border-secondary-100 w-full"
        >
          <option value="">Pick a bed...</option>
          {filtered.map((b) => (
            <option key={b.id} value={b.id}>
              {b.bed_no ?? `Bed #${b.id}`}
              {b.bed_status ? ` · ${b.bed_status}` : ""}
            </option>
          ))}
        </select>
      ) : (
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Bed ID"
          className="input-field h-12 bg-secondary-50 border-secondary-100 w-full font-mono"
        />
      )}
    </FieldLabel>
  );
}

function StaffPicker({
  label,
  value,
  staffList,
  onChange,
}: {
  label: string;
  value: number | null;
  staffList: Staff[];
  onChange: (v: number | null) => void;
}) {
  return (
    <FieldLabel label={label}>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        className="input-field h-12 bg-secondary-50 border-secondary-100 w-full"
      >
        <option value="">— None —</option>
        {staffList.map((s) => (
          <option key={s.id} value={s.id}>
            {staffDisplayName(s)}
            {s.designation ? ` · ${s.designation}` : ""}
          </option>
        ))}
      </select>
    </FieldLabel>
  );
}

function ToggleSwitch({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${
        value
          ? "bg-emerald-50 border-emerald-200 text-emerald-700"
          : "bg-secondary-50 border-secondary-100 text-secondary-500"
      }`}
    >
      <div className="text-left flex items-center gap-3">
        <Coins className={`h-4 w-4 ${value ? "text-emerald-600" : "text-secondary-400"}`} />
        <div>
          <p className="text-xs font-bold uppercase tracking-widest">{label}</p>
          <p className="text-[10px] font-bold opacity-70 mt-0.5">{hint}</p>
        </div>
      </div>
      <div
        className={`h-6 w-12 rounded-full p-0.5 transition-all ${
          value ? "bg-emerald-500" : "bg-secondary-200"
        }`}
      >
        <div
          className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${
            value ? "translate-x-6" : ""
          }`}
        />
      </div>
    </button>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mb-5 p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl flex items-center gap-3">
      <AlertCircle className="h-5 w-5" />
      <span className="text-sm font-bold">{message}</span>
    </div>
  );
}

function ModalActions({
  onClose,
  onSubmit,
  pending,
  submitLabel,
  submitIcon: Icon,
  tone = "primary",
}: {
  onClose: () => void;
  onSubmit: () => void;
  pending: boolean;
  submitLabel: string;
  submitIcon: typeof Save;
  tone?: "primary" | "amber" | "emerald" | "rose";
}) {
  const cls =
    tone === "amber"
      ? "bg-amber-500 hover:bg-amber-600 shadow-amber-500/20"
      : tone === "emerald"
        ? "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20"
        : tone === "rose"
          ? "bg-rose-500 hover:bg-rose-600 shadow-rose-500/20"
          : "bg-primary-500 hover:bg-primary-600 shadow-primary-500/20";
  return (
    <div className="pt-6 flex gap-4">
      <button
        onClick={onClose}
        disabled={pending}
        className="flex-1 btn-secondary py-4 rounded-2xl font-bold disabled:opacity-50"
      >
        Cancel
      </button>
      <button
        onClick={onSubmit}
        disabled={pending}
        className={`flex-[2] py-4 rounded-2xl text-white font-black tracking-tight shadow-xl flex items-center justify-center gap-3 disabled:opacity-50 ${cls}`}
      >
        <Icon className="h-4 w-4" />
        {pending ? "Working..." : submitLabel}
      </button>
    </div>
  );
}

function ModalShell({
  title,
  subtitle,
  onClose,
  children,
  icon: Icon,
  tone = "primary",
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
  icon: typeof LogIn;
  tone?: "primary" | "amber" | "emerald" | "rose";
}) {
  const cls =
    tone === "amber"
      ? "bg-amber-500 shadow-amber-500/20"
      : tone === "emerald"
        ? "bg-emerald-500 shadow-emerald-500/20"
        : tone === "rose"
          ? "bg-rose-500 shadow-rose-500/20"
          : "bg-primary-600 shadow-primary-500/20";
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-6 animate-fade-in">
      <div className="bg-white rounded-[2.5rem] p-10 max-w-2xl w-full shadow-2xl relative animate-slide-up max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-3 hover:bg-secondary-50 rounded-2xl transition-all"
        >
          <X className="h-5 w-5 text-secondary-400" />
        </button>
        <div className="flex items-center gap-5 mb-8">
          <div className={`h-14 w-14 rounded-2xl text-white flex items-center justify-center shadow-xl ${cls}`}>
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-xl font-black font-display tracking-tight">{title}</h3>
            <p className="text-secondary-400 font-bold text-[10px] uppercase tracking-[0.2em] mt-1">
              {subtitle}
            </p>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

type StatTone = "primary" | "emerald" | "amber" | "rose";
const statToneStyles: Record<StatTone, string> = {
  primary: "bg-primary-50 text-primary-600 border-primary-100",
  emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
  amber: "bg-amber-50 text-amber-600 border-amber-100",
  rose: "bg-rose-50 text-rose-600 border-rose-100",
};
function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof BedIcon;
  label: string;
  value: number;
  tone: StatTone;
}) {
  return (
    <div className={`glass-card rounded-[2rem] p-6 border ${statToneStyles[tone]} bg-white/60 backdrop-blur-md`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">{label}</span>
        <Icon className="h-5 w-5" />
      </div>
      <div className="text-3xl font-black tracking-tight">{value}</div>
    </div>
  );
}

