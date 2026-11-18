import {
  DxPage, DxPageHeader, DxKpi, DxGrid, DxBadge, DxButton, DxPopup,
  DxInput, DxSelect, DxMessage,
  type DxGridColumn, type DxBadgeTone,
} from "@/components/dx";
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
  getActiveAdmissionForPatient,
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
import { getVisits, getServiceDeliveryPoints } from "@/features/visits/api/visits.api";
import type { Visit, ServiceDeliveryPoint } from "@/features/visits/api/visits.api";
import { searchPatients, getPatientById } from "@/features/patients/api/patients.api";
import type { Patient } from "@/features/patients/api/patients.api";
import { getStaff, getCurrentStaff, staffDisplayName } from "@/features/staff/api/staff.api";
import type { Staff } from "@/features/staff/api/staff.api";

const STATUS_FILTERS = [
  { value: "", label: "All Statuses" },
  ...ADMISSION_STATUSES.map((s) => ({ value: s, label: s.replace("_", " ") })),
];

/**
 * Pull the most specific message out of an API error so the UI shows the real
 * cause (backend message / detail / validation) instead of a generic string.
 * Falls back to a network hint when no HTTP response reached the browser.
 */
function extractApiError(err: any, fallback: string): string {
  const res = err?.response;
  if (!res) return err?.message ? `${fallback} (${err.message})` : fallback;
  const data = res.data ?? {};
  const detail = data.detail;
  let msg =
    (typeof data.message === "string" && data.message) ||
    (typeof detail === "string" && detail) ||
    (detail && typeof detail.message === "string" && detail.message) ||
    (Array.isArray(detail)
      ? detail
          .map((d: any) => (typeof d === "string" ? d : d?.msg || d?.message))
          .filter(Boolean)
          .join("; ")
      : "") ||
    "";
  const kind =
    detail && typeof detail === "object" && typeof detail.exception_type === "string"
      ? detail.exception_type
      : "";
  if (!msg) msg = res.status ? `${fallback} (HTTP ${res.status})` : fallback;
  return kind ? `${msg} [${kind}]` : msg;
}

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

/** Visit statuses that can still be linked to / converted into an admission. */
const OPEN_VISIT_STATUSES = new Set(["INITIATED", "IN_PROGRESS", "WAITING", "ON_HOLD"]);
const isOpenVisit = (v: Visit) => OPEN_VISIT_STATUSES.has(String(v.status || "").toUpperCase());

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
  is_emergency: boolean;
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
  is_emergency: false,
  capture_first_bed_day_charge: true,
};

type FromVisitForm = {
  visit_id: string;
  ward_id: string;
  bed_id: string;
  admitting_staff_id: number | null;
  admission_reason: string;
  expected_discharge_at: string;
  is_emergency: boolean;
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
  is_emergency: false,
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
  const [sdps, setSdps] = useState<ServiceDeliveryPoint[]>([]);
  // Open outpatient/ER visits eligible for conversion, + a patient-name cache
  // for their labels. The Admit modal loads the selected patient's own visits.
  const [openVisits, setOpenVisits] = useState<Visit[]>([]);
  const [visitPatients, setVisitPatients] = useState<Record<number, Patient>>({});
  const [patientVisits, setPatientVisits] = useState<Visit[]>([]);
  const [currentStaffId, setCurrentStaffId] = useState<number | null>(null);
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
  const [admitActive, setAdmitActive] = useState<Admission | null>(null);
  const [convertActive, setConvertActive] = useState<Admission | null>(null);

  const showFeedback = (tone: "success" | "error", message: string) => {
    setFeedback({ tone, message });
    window.setTimeout(() => setFeedback(null), 3500);
  };

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [admRes, wardsRes, bedsRes, staffRes, sdpRes, visitsRes] = await Promise.all([
        listAdmissions({
          skip: 0,
          limit: 200,
          status: statusFilter || undefined,
        }),
        listWards({ skip: 0, limit: 200 }).catch(() => null),
        listBeds({ skip: 0, limit: 500 }).catch(() => null),
        getStaff(0, 200).catch(() => [] as Staff[]),
        getServiceDeliveryPoints({ limit: 200 }).catch(() => [] as ServiceDeliveryPoint[]),
        getVisits({ limit: 200 }).catch(() => ({ items: [] as Visit[] })),
      ]);
      setAdmissions(admRes.items ?? []);
      setWards(wardsRes?.items ?? []);
      setBeds(bedsRes?.items ?? []);
      setStaffList(Array.isArray(staffRes) ? staffRes : []);
      setSdps(Array.isArray(sdpRes) ? sdpRes.filter((s) => s.is_active !== false) : []);
      setOpenVisits((visitsRes.items ?? []).filter(isOpenVisit));
    } catch (err: any) {
      setError(extractApiError(err, "Unable to load admissions."));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  // Resolve the logged-in user's staff record and default the admitting staff
  // to them across both admission modals.
  useEffect(() => {
    if (staffList.length === 0) return;
    let cancelled = false;
    getCurrentStaff(staffList).then((me) => {
      if (cancelled || !me) return;
      setCurrentStaffId(me.id);
      setAdmitForm((prev) =>
        prev.admitting_staff_id == null ? { ...prev, admitting_staff_id: me.id } : prev,
      );
      setFromVisitForm((prev) =>
        prev.admitting_staff_id == null ? { ...prev, admitting_staff_id: me.id } : prev,
      );
    });
    return () => {
      cancelled = true;
    };
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

  // Enrich the conversion visit list with patient names (the visit list endpoint
  // doesn't always embed the patient), so the dropdown reads clearly.
  useEffect(() => {
    const missing = Array.from(
      new Set(openVisits.filter((v) => !v.patient).map((v) => v.patient_id)),
    );
    const toFetch = missing.filter((id) => !visitPatients[id]).slice(0, 50);
    if (toFetch.length === 0) return;
    let cancelled = false;
    Promise.all(
      toFetch.map((id) =>
        getPatientById(id)
          .then((p) => [id, p] as const)
          .catch(() => null),
      ),
    ).then((pairs) => {
      if (cancelled) return;
      setVisitPatients((prev) => {
        const next = { ...prev };
        pairs.forEach((pair) => {
          if (pair) next[pair[0]] = pair[1];
        });
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openVisits]);

  // Load the selected patient's own open visits for the (optional) link in the
  // Admit modal.
  useEffect(() => {
    if (!admitForm.patient_id) {
      setPatientVisits([]);
      return;
    }
    let cancelled = false;
    getVisits({ patient_id: admitForm.patient_id, limit: 50 })
      .then((r) => {
        if (!cancelled) setPatientVisits((r.items ?? []).filter(isOpenVisit));
      })
      .catch(() => {
        if (!cancelled) setPatientVisits([]);
      });
    return () => {
      cancelled = true;
    };
  }, [admitForm.patient_id]);

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

  // Label an open visit for the conversion dropdown: code · patient · status.
  const visitOptionLabel = (v: Visit) => {
    const p = v.patient || visitPatients[v.patient_id];
    const name = p
      ? `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || `Patient #${v.patient_id}`
      : `Patient #${v.patient_id}`;
    const code = v.visit_code || `VISIT-${v.id}`;
    return `${code} · ${name} · ${String(v.status || "").replace(/_/g, " ")}`;
  };

  // ----- Open modals -----
  const openAdmit = () => {
    setActionKind("admit");
    setActionTarget(null);
    setAdmitForm({
      ...emptyAdmitForm,
      admitting_staff_id: admitForm.admitting_staff_id ?? currentStaffId,
    });
    setPatientQuery("");
    setPatientResults([]);
    setActionError(null);
  };

  const openFromVisit = () => {
    setActionKind("from-visit");
    setActionTarget(null);
    setFromVisitForm({
      ...emptyFromVisitForm,
      admitting_staff_id: fromVisitForm.admitting_staff_id ?? currentStaffId,
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
  // A patient can hold only one active admission — detect it up front.
  useEffect(() => {
    if (actionKind !== "admit" || !admitForm.patient_id) {
      setAdmitActive(null);
      return;
    }
    let cancelled = false;
    getActiveAdmissionForPatient(admitForm.patient_id)
      .then((a) => { if (!cancelled) setAdmitActive(a); })
      .catch(() => { if (!cancelled) setAdmitActive(null); });
    return () => { cancelled = true; };
  }, [actionKind, admitForm.patient_id]);

  useEffect(() => {
    const vid = fromVisitForm.visit_id;
    if (actionKind !== "from-visit" || !vid) {
      setConvertActive(null);
      return;
    }
    const visit = openVisits.find((v) => String(v.id) === String(vid));
    if (!visit) {
      setConvertActive(null);
      return;
    }
    let cancelled = false;
    getActiveAdmissionForPatient(visit.patient_id)
      .then((a) => { if (!cancelled) setConvertActive(a); })
      .catch(() => { if (!cancelled) setConvertActive(null); });
    return () => { cancelled = true; };
  }, [actionKind, fromVisitForm.visit_id, openVisits]);

  const handleAdmit = async () => {
    if (!admitForm.patient_id) {
      setActionError("Pick a patient first.");
      return;
    }
    if (!admitForm.ward_id || !admitForm.bed_id) {
      setActionError("Pick a ward and bed.");
      return;
    }
    if (admitActive) {
      setActionError(
        `This patient already has an active admission (${admitActive.admission_no}). Discharge or cancel it first.`,
      );
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
        is_emergency: admitForm.is_emergency,
        capture_first_bed_day_charge: admitForm.capture_first_bed_day_charge,
      };
      const res = await admitPatient(payload);
      replaceAdmission(res.admission);
      showFeedback("success", res.message || "Patient admitted.");
      closeAction();
    } catch (err: any) {
      setActionError(extractApiError(err, "Failed to admit patient."));
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
    if (convertActive) {
      setActionError(
        `This patient already has an active admission (${convertActive.admission_no}). Discharge or cancel it first.`,
      );
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
        is_emergency: fromVisitForm.is_emergency,
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
      setActionError(extractApiError(err, "Failed to convert visit."));
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
      setActionError(extractApiError(err, "Failed to transfer admission."));
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
      setActionError(extractApiError(err, "Failed to update status."));
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
      setActionError(extractApiError(err, "Failed to capture charges."));
    } finally {
      setActionPending(false);
    }
  };

  // ----- Render -----
  const statusTone = (key: string): DxBadgeTone => {
    switch (key) {
      case "DISCHARGED":
        return "success";
      case "CANCELLED":
        return "danger";
      case "ON_LEAVE":
      case "AWAITING_DISCHARGE":
        return "warning";
      case "TRANSFERRED":
        return "neutral";
      default:
        return "info";
    }
  };

  const admissionColumns: DxGridColumn<Admission>[] = [
    {
      key: "admission",
      header: "Admission",
      render: (a) => (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--dx-accent)] text-white">
            <BedIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="dx-mono text-[12px] font-semibold text-[var(--dx-text)]">{a.admission_no}</p>
            <p className="text-[11px] text-[var(--dx-text-muted)]">
              #{a.id}
              {a.visit_id ? (
                <>
                  {" · "}
                  <Link to={`/visits/${a.visit_id}`} className="inline-flex items-center gap-0.5 hover:text-[var(--dx-accent)]">
                    Visit #{a.visit_id}
                    <ExternalLink className="h-2.5 w-2.5" />
                  </Link>
                </>
              ) : null}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "patient",
      header: "Patient",
      render: (a) =>
        a.patient ? (
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--dx-accent-soft)] text-[11px] font-bold text-[var(--dx-accent)]">
              {(a.patient.first_name?.[0] ?? "?")}
              {(a.patient.last_name?.[0] ?? "?")}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-[var(--dx-text)]">{a.patient.first_name} {a.patient.last_name}</p>
              <p className="dx-mono text-[11px] text-[var(--dx-text-muted)]">{a.patient.hospital_number}</p>
            </div>
          </div>
        ) : (
          <span className="inline-flex items-center gap-1 text-[13px] text-[var(--dx-text)]"><User className="h-3.5 w-3.5" /> Patient #{a.patient_id}</span>
        ),
    },
    {
      key: "ward_bed",
      header: "Ward / Bed",
      render: (a) => (
        <div className="space-y-1">
          <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--dx-text)]"><Hospital className="h-3 w-3 text-[var(--dx-text-muted)]" /> {wardName(a.ward_id)}</span>
          <p className="dx-mono text-[11px] text-[var(--dx-text-muted)]"><BedIcon className="mr-1 inline h-2.5 w-2.5" />{bedNumber(a.bed_id)}</p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      align: "center",
      render: (a) => {
        const key = (a.admission_status || "ADMITTED").toUpperCase();
        return <DxBadge tone={statusTone(key)}>{key.replace("_", " ")}</DxBadge>;
      },
    },
    {
      key: "admitted",
      header: "Admitted",
      render: (a) => (
        <div>
          <div className="flex items-center gap-1.5 text-[12px] text-[var(--dx-text-muted)]"><Clock className="h-3 w-3" />{formatDateTime(a.admitted_at || a.created_at)}</div>
          {a.expected_discharge_at && !a.actual_discharge_at ? (
            <p className="mt-1 flex items-center gap-1 text-[11px] text-[var(--dx-warning)]"><CalendarClock className="h-2.5 w-2.5" />Exp. {formatDateTime(a.expected_discharge_at)}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (a) => {
        const key = (a.admission_status || "ADMITTED").toUpperCase();
        const isClosed = ["DISCHARGED", "CANCELLED"].includes(key);
        return (
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {!isClosed ? (
              <>
                <DxButton size="sm" leftIcon={<ArrowRightLeft className="h-3.5 w-3.5" />} onClick={() => openTransfer(a)}>Transfer</DxButton>
                <DxButton size="sm" variant="primary" leftIcon={<Sliders className="h-3.5 w-3.5" />} onClick={() => openStatus(a)}>Status</DxButton>
                <DxButton size="sm" leftIcon={<Coins className="h-3.5 w-3.5" />} onClick={() => openBedDays(a)}>Bed-days</DxButton>
              </>
            ) : (
              <DxButton size="sm" variant="text" leftIcon={<Coins className="h-3.5 w-3.5" />} onClick={() => openBedDays(a)}>Bed-days</DxButton>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Admissions" }]}
        title="Admissions & Wards"
        subtitle="Track every inpatient — admission, ward transfers, status changes, and bed-day billing."
        actions={
          <>
            <DxButton icon title="Refresh" onClick={load} isLoading={isLoading}><RefreshCw /></DxButton>
            <DxButton leftIcon={<ArrowRightLeft className="h-4 w-4" />} onClick={openFromVisit}>From visit</DxButton>
            <DxButton variant="primary" leftIcon={<LogIn className="h-4 w-4" />} onClick={openAdmit}>Admit patient</DxButton>
          </>
        }
      />

      {feedback ? <DxMessage tone={feedback.tone === "success" ? "success" : "danger"}>{feedback.message}</DxMessage> : null}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <DxKpi label="Total" value={stats.total} icon={ListChecks} tone="accent" />
        <DxKpi label="Admitted" value={stats.admitted} icon={BedIcon} tone="info" />
        <DxKpi label="Awaiting discharge" value={stats.awaitingDischarge} icon={Clock} tone="warning" />
        <DxKpi label="Discharged" value={stats.discharged} icon={CheckCircle2} tone="success" />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <div className="flex-1">
          <DxInput leftIcon={<Search className="h-3.5 w-3.5" />} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by admission #, patient name, hospital number, reason…" />
        </div>
        <div className="w-full md:w-52">
          <DxSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} options={STATUS_FILTERS} aria-label="Filter by status" />
        </div>
        {wards.length > 0 ? (
          <div className="w-full md:w-52">
            <DxSelect value={wardFilter} onChange={(e) => setWardFilter(e.target.value)} aria-label="Filter by ward"
              options={[{ value: "", label: "All wards" }, ...wards.map((w) => ({ value: String(w.id), label: w.name ?? `Ward #${w.id}` }))]} />
          </div>
        ) : null}
      </div>

      {/* Table */}
      <DxGrid<Admission>
        columns={admissionColumns}
        data={filteredAdmissions}
        rowKey={(a) => a.id}
        isLoading={isLoading}
        error={error}
        onRetry={load}
        empty={{
          icon: BedIcon,
          title: "No admissions",
          description: admissions.length === 0 ? "Admit the first patient to start the inpatient ledger." : "No admissions match your filters.",
        }}
      />

      {/* MODALS */}
      {actionKind === "admit" ? (
        <ModalShell title="Admit patient" subtitle="Open a new inpatient stay" onClose={closeAction} icon={LogIn}>
          {actionError ? <ErrorBanner message={actionError} /> : null}
          <div className="space-y-4">
            {/* Patient picker */}
            <div className="dx-field">
              <label className="dx-field-label">Patient *</label>
              {admitForm.patient_id ? (
                <div className="flex items-center justify-between rounded-md border border-[var(--dx-border)] bg-[var(--dx-surface-sunken)] px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-[var(--dx-accent)]" />
                    <p className="text-[13px] font-semibold text-[var(--dx-text)]">{admitForm.patient_label}</p>
                  </div>
                  <button onClick={() => setAdmitForm({ ...admitForm, patient_id: null, patient_label: "" })} className="rounded p-1 text-[var(--dx-text-muted)] hover:bg-[var(--dx-surface-alt)]">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <input type="text" value={patientQuery} onChange={(e) => setPatientQuery(e.target.value)} placeholder="Search by name or hospital number…" className="dx-editor w-full" />
                  {searchingPatients ? <p className="text-[11px] text-[var(--dx-text-muted)]">Searching…</p> : null}
                  {patientResults.length > 0 ? (
                    <div className="max-h-48 divide-y divide-[var(--dx-border)] overflow-y-auto rounded-md border border-[var(--dx-border)]">
                      {patientResults.map((p) => (
                        <button key={p.id} onClick={() => { setAdmitForm({ ...admitForm, patient_id: p.id, patient_label: `${p.first_name} ${p.last_name} · ${p.hospital_number}` }); setPatientQuery(""); setPatientResults([]); }}
                          className="w-full p-2.5 text-left hover:bg-[var(--dx-surface-alt)]">
                          <p className="text-[13px] font-semibold text-[var(--dx-text)]">{p.first_name} {p.last_name}</p>
                          <p className="dx-mono text-[11px] text-[var(--dx-text-muted)]">{p.hospital_number}</p>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <VisitPicker label="Linked visit (optional)" value={admitForm.visit_id} visits={patientVisits}
                labelFor={(v) => `${v.visit_code || `VISIT-${v.id}`} · ${String(v.status || "").replace(/_/g, " ")}`}
                placeholder={admitForm.patient_id ? "— No linked visit —" : "Select a patient first"} disabled={!admitForm.patient_id}
                emptyHint={admitForm.patient_id && patientVisits.length === 0 ? "This patient has no open visits." : undefined}
                onChange={(v) => setAdmitForm({ ...admitForm, visit_id: v })} />
              <StaffPicker label="Admitting staff" value={admitForm.admitting_staff_id} onChange={(v) => setAdmitForm({ ...admitForm, admitting_staff_id: v })} staffList={staffList} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <WardPicker label="Ward *" value={admitForm.ward_id} wards={wards} onChange={(v) => setAdmitForm({ ...admitForm, ward_id: v, bed_id: "" })} />
              <BedPicker label="Bed *" value={admitForm.bed_id} wardId={admitForm.ward_id} beds={beds} onChange={(v) => setAdmitForm({ ...admitForm, bed_id: v })} />
            </div>

            <FieldLabel label="Admission reason">
              <textarea value={admitForm.admission_reason} onChange={(e) => setAdmitForm({ ...admitForm, admission_reason: e.target.value })} placeholder="Clinical reason for admission…" className="dx-editor w-full" rows={2} />
            </FieldLabel>

            <div className="grid gap-4 sm:grid-cols-2">
              <FieldLabel label="Admitted at">
                <input type="datetime-local" value={admitForm.admitted_at} onChange={(e) => setAdmitForm({ ...admitForm, admitted_at: e.target.value })} className="dx-editor w-full dx-mono" />
              </FieldLabel>
              <FieldLabel label="Expected discharge">
                <input type="datetime-local" value={admitForm.expected_discharge_at} onChange={(e) => setAdmitForm({ ...admitForm, expected_discharge_at: e.target.value })} className="dx-editor w-full dx-mono" />
              </FieldLabel>
            </div>

            <ToggleSwitch label="Emergency admission" hint="Bypass the doctor-recommendation requirement (life-threatening / ER)." value={admitForm.is_emergency} onChange={(v) => setAdmitForm({ ...admitForm, is_emergency: v })} />
            <ToggleSwitch label="Capture first bed-day charge" hint="Auto-bill the first bed-day immediately" value={admitForm.capture_first_bed_day_charge} onChange={(v) => setAdmitForm({ ...admitForm, capture_first_bed_day_charge: v })} />
          </div>

          {admitActive ? (
            <DxMessage tone="warning" className="mt-4">This patient already has an active admission ({admitActive.admission_no}). Discharge or cancel it before admitting again.</DxMessage>
          ) : null}
          <ModalActions onClose={closeAction} onSubmit={handleAdmit} pending={actionPending} submitLabel="Admit patient" submitIcon={LogIn} disabled={!!admitActive} />
        </ModalShell>
      ) : null}

      {actionKind === "from-visit" ? (
        <ModalShell title="Convert visit to admission" subtitle="Promote an outpatient visit into inpatient care" onClose={closeAction} icon={ArrowRightLeft}>
          {actionError ? <ErrorBanner message={actionError} /> : null}
          <div className="space-y-4">
            <VisitPicker label="Visit *" value={fromVisitForm.visit_id} visits={openVisits} labelFor={visitOptionLabel} placeholder="Select an open visit…"
              emptyHint={openVisits.length === 0 ? "No open visits are available to convert." : undefined}
              onChange={(v) => setFromVisitForm({ ...fromVisitForm, visit_id: v })} />
            <div className="grid gap-4 sm:grid-cols-2">
              <WardPicker label="Ward *" value={fromVisitForm.ward_id} wards={wards} onChange={(v) => setFromVisitForm({ ...fromVisitForm, ward_id: v, bed_id: "" })} />
              <BedPicker label="Bed *" value={fromVisitForm.bed_id} wardId={fromVisitForm.ward_id} beds={beds} onChange={(v) => setFromVisitForm({ ...fromVisitForm, bed_id: v })} />
            </div>
            <StaffPicker label="Admitting staff" value={fromVisitForm.admitting_staff_id} onChange={(v) => setFromVisitForm({ ...fromVisitForm, admitting_staff_id: v })} staffList={staffList} />
            <FieldLabel label="Admission reason">
              <textarea value={fromVisitForm.admission_reason} onChange={(e) => setFromVisitForm({ ...fromVisitForm, admission_reason: e.target.value })} placeholder="Reason for converting this visit…" className="dx-editor w-full" rows={2} />
            </FieldLabel>
            <FieldLabel label="Expected discharge">
              <input type="datetime-local" value={fromVisitForm.expected_discharge_at} onChange={(e) => setFromVisitForm({ ...fromVisitForm, expected_discharge_at: e.target.value })} className="dx-editor w-full dx-mono" />
            </FieldLabel>
            <SdpPicker label="Route to service point (optional)" value={fromVisitForm.route_to_service_delivery_point_id} sdps={sdps} onChange={(v) => setFromVisitForm({ ...fromVisitForm, route_to_service_delivery_point_id: v })} />
            <ToggleSwitch label="Emergency admission" hint="Bypass the doctor-recommendation requirement (life-threatening / ER)." value={fromVisitForm.is_emergency} onChange={(v) => setFromVisitForm({ ...fromVisitForm, is_emergency: v })} />
            <ToggleSwitch label="Capture first bed-day charge" hint="Auto-bill the first bed-day immediately" value={fromVisitForm.capture_first_bed_day_charge} onChange={(v) => setFromVisitForm({ ...fromVisitForm, capture_first_bed_day_charge: v })} />
          </div>
          {convertActive ? (
            <DxMessage tone="warning" className="mt-4">This patient already has an active admission ({convertActive.admission_no}). Discharge or cancel it before converting this visit.</DxMessage>
          ) : null}
          <ModalActions onClose={closeAction} onSubmit={handleFromVisit} pending={actionPending} submitLabel="Convert to admission" submitIcon={ArrowRightLeft} disabled={!!convertActive} />
        </ModalShell>
      ) : null}

      {actionKind === "transfer" && actionTarget ? (
        <ModalShell title="Transfer bed" subtitle="Move the patient to a new bed or ward" onClose={closeAction} icon={ArrowRightLeft} tone="amber">
          {actionError ? <ErrorBanner message={actionError} /> : null}
          <ContextStrip admission={actionTarget} wardName={wardName} bedNumber={bedNumber} />
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <WardPicker label="New ward (optional)" value={transferForm.new_ward_id} wards={wards} onChange={(v) => setTransferForm({ ...transferForm, new_ward_id: v, new_bed_id: "" })} />
              <BedPicker label="New bed *" value={transferForm.new_bed_id} wardId={transferForm.new_ward_id} beds={beds} excludeBedId={actionTarget.bed_id} onChange={(v) => setTransferForm({ ...transferForm, new_bed_id: v })} />
            </div>
            <FieldLabel label="Reason">
              <textarea value={transferForm.reason} onChange={(e) => setTransferForm({ ...transferForm, reason: e.target.value })} placeholder="Why is this patient being moved?" className="dx-editor w-full" rows={2} />
            </FieldLabel>
          </div>
          <ModalActions onClose={closeAction} onSubmit={handleTransfer} pending={actionPending} submitLabel="Transfer" submitIcon={ArrowRightLeft} tone="amber" />
        </ModalShell>
      ) : null}

      {actionKind === "status" && actionTarget ? (
        <ModalShell title="Update admission status" subtitle="Move the stay through its lifecycle" onClose={closeAction} icon={Sliders}>
          {actionError ? <ErrorBanner message={actionError} /> : null}
          <ContextStrip admission={actionTarget} wardName={wardName} bedNumber={bedNumber} />
          <div className="space-y-4">
            <FieldLabel label="New status *">
              <div className="grid grid-cols-2 gap-2">
                {ADMISSION_STATUSES.map((s) => {
                  const active = statusForm.new_status === s;
                  return (
                    <button key={s} type="button" onClick={() => setStatusForm({ ...statusForm, new_status: s })}
                      className="rounded-md border px-3 py-2 text-[11px] font-semibold uppercase tracking-wide transition-colors"
                      style={{
                        borderColor: active ? "var(--dx-accent)" : "var(--dx-border)",
                        background: active ? "var(--dx-accent)" : "var(--dx-surface)",
                        color: active ? "#fff" : "var(--dx-text-muted)",
                      }}>
                      {s.replace("_", " ")}
                    </button>
                  );
                })}
              </div>
            </FieldLabel>
            <FieldLabel label="Reason">
              <textarea value={statusForm.reason} onChange={(e) => setStatusForm({ ...statusForm, reason: e.target.value })} placeholder="Note for the audit log…" className="dx-editor w-full" rows={2} />
            </FieldLabel>
          </div>
          <ModalActions onClose={closeAction} onSubmit={handleStatus} pending={actionPending} submitLabel="Update status" submitIcon={Edit3} />
        </ModalShell>
      ) : null}

      {actionKind === "bed-days" && actionTarget ? (
        <ModalShell title="Capture bed-day charges" subtitle="Auto-bill bed-days up to a date" onClose={closeAction} icon={Coins} tone="emerald">
          {actionError ? <ErrorBanner message={actionError} /> : null}
          <ContextStrip admission={actionTarget} wardName={wardName} bedNumber={bedNumber} />
          <div className="space-y-4">
            <FieldLabel label="Capture through date *">
              <input type="date" value={bedDaysForm.through_date} onChange={(e) => setBedDaysForm({ ...bedDaysForm, through_date: e.target.value })} className="dx-editor w-full dx-mono" />
            </FieldLabel>
            {bedDaysReceipt ? (
              <div className="rounded-md border border-[var(--dx-success-soft)] bg-[var(--dx-success-soft)] p-4">
                <div className="mb-3 flex items-center gap-2 text-[var(--dx-success)]"><CheckCircle2 className="h-5 w-5" /><p className="text-[13px] font-semibold">Captured</p></div>
                <dl className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--dx-text-muted)]">Days</dt>
                    <dd className="text-[20px] font-bold text-[var(--dx-text)]">{bedDaysReceipt.charges_captured}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--dx-text-muted)]">Total</dt>
                    <dd className="dx-mono text-[18px] font-bold text-[var(--dx-text)]">{new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 2 }).format(bedDaysReceipt.total_amount_captured)}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--dx-text-muted)]">Through</dt>
                    <dd className="dx-mono text-[12px] font-semibold text-[var(--dx-text)]">{new Date(bedDaysReceipt.captured_through).toLocaleDateString()}</dd>
                  </div>
                </dl>
              </div>
            ) : null}
          </div>
          <ModalActions onClose={closeAction} onSubmit={handleBedDays} pending={actionPending} submitLabel="Capture charges" submitIcon={Coins} tone="emerald" />
        </ModalShell>
      ) : null}
    </DxPage>
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
    <div className="mb-5 rounded-md border border-[var(--dx-border)] bg-[var(--dx-surface-sunken)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <BedIcon className="h-4 w-4 text-[var(--dx-text-muted)]" />
          <div>
            <p className="dx-mono text-[11px] text-[var(--dx-text-muted)]">{admission.admission_no}</p>
            {admission.patient ? <p className="mt-0.5 text-[13px] font-semibold text-[var(--dx-text)]">{admission.patient.first_name} {admission.patient.last_name}</p> : null}
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--dx-text-muted)]">Currently</p>
          <p className="dx-mono mt-0.5 text-[12px] font-semibold text-[var(--dx-text)]">{wardName(admission.ward_id)} · {bedNumber(admission.bed_id)}</p>
        </div>
      </div>
    </div>
  );
}

function FieldLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="dx-field">
      <label className="dx-field-label">{label}</label>
      {children}
    </div>
  );
}

function WardPicker({ label, value, wards, onChange }: { label: string; value: string; wards: Ward[]; onChange: (v: string) => void }) {
  return (
    <FieldLabel label={label}>
      <select value={value} onChange={(e) => onChange(e.target.value)} disabled={wards.length === 0} className="dx-editor w-full disabled:opacity-60">
        <option value="">{wards.length ? "Pick a ward…" : "No wards configured"}</option>
        {wards.map((w) => (
          <option key={w.id} value={w.id}>{w.name ?? `Ward #${w.id}`}{w.ward_type ? ` · ${w.ward_type}` : ""}</option>
        ))}
      </select>
      {wards.length === 0 ? <p className="mt-1 text-[11px] font-medium text-[var(--dx-warning)]">Create wards under Wards &amp; Beds first.</p> : null}
    </FieldLabel>
  );
}

function BedPicker({ label, value, wardId, beds, excludeBedId, onChange }: { label: string; value: string; wardId: string; beds: Bed[]; excludeBedId?: number; onChange: (v: string) => void }) {
  const filtered = beds.filter((b) => {
    if (excludeBedId != null && b.id === excludeBedId) return false;
    if (wardId && b.ward_id !== Number(wardId)) return false;
    if (b.bed_status && b.bed_status !== "AVAILABLE" && b.id !== Number(value)) return false;
    return true;
  });
  const placeholder = !wardId ? "Pick a ward first…" : filtered.length ? "Pick a bed…" : "No available beds in this ward";
  return (
    <FieldLabel label={label}>
      <select value={value} onChange={(e) => onChange(e.target.value)} disabled={!wardId || filtered.length === 0} className="dx-editor w-full disabled:opacity-60">
        <option value="">{placeholder}</option>
        {wardId && filtered.map((b) => (
          <option key={b.id} value={b.id}>{b.bed_no ?? `Bed #${b.id}`}{b.bed_type ? ` · ${b.bed_type}` : ""}{b.bed_status ? ` · ${b.bed_status}` : ""}</option>
        ))}
      </select>
    </FieldLabel>
  );
}

function StaffPicker({ label, value, staffList, onChange }: { label: string; value: number | null; staffList: Staff[]; onChange: (v: number | null) => void }) {
  return (
    <FieldLabel label={label}>
      <select value={value ?? ""} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)} className="dx-editor w-full">
        <option value="">— None —</option>
        {staffList.map((s) => (
          <option key={s.id} value={s.id}>{staffDisplayName(s)}{s.designation ? ` · ${s.designation}` : ""}</option>
        ))}
      </select>
    </FieldLabel>
  );
}

function VisitPicker({ label, value, visits, labelFor, placeholder, emptyHint, disabled, onChange }: { label: string; value: string; visits: Visit[]; labelFor: (v: Visit) => string; placeholder: string; emptyHint?: string; disabled?: boolean; onChange: (v: string) => void }) {
  return (
    <FieldLabel label={label}>
      <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className="dx-editor w-full disabled:opacity-60">
        <option value="">{placeholder}</option>
        {visits.map((v) => (<option key={v.id} value={v.id}>{labelFor(v)}</option>))}
      </select>
      {emptyHint ? <p className="mt-1 text-[11px] font-medium text-[var(--dx-warning)]">{emptyHint}</p> : null}
    </FieldLabel>
  );
}

function SdpPicker({ label, value, sdps, onChange }: { label: string; value: string; sdps: ServiceDeliveryPoint[]; onChange: (v: string) => void }) {
  return (
    <FieldLabel label={label}>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="dx-editor w-full">
        <option value="">— None —</option>
        {sdps.map((s) => (<option key={s.id} value={s.id}>{s.name}{s.code ? ` (${s.code})` : ""}</option>))}
      </select>
    </FieldLabel>
  );
}

function ToggleSwitch({ label, hint, value, onChange }: { label: string; hint: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!value)}
      className="flex w-full items-center justify-between rounded-md border px-4 py-3 text-left transition-colors"
      style={{
        borderColor: value ? "var(--dx-accent)" : "var(--dx-border)",
        background: value ? "var(--dx-accent-soft)" : "var(--dx-surface)",
      }}>
      <div className="flex items-center gap-3">
        <Coins className="h-4 w-4" style={{ color: value ? "var(--dx-accent)" : "var(--dx-text-muted)" }} />
        <div>
          <p className="text-[12px] font-semibold text-[var(--dx-text)]">{label}</p>
          <p className="mt-0.5 text-[11px] text-[var(--dx-text-muted)]">{hint}</p>
        </div>
      </div>
      <span className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors" style={{ background: value ? "var(--dx-accent)" : "var(--dx-border-strong)" }}>
        <span className="h-5 w-5 rounded-full bg-white shadow transition-transform" style={{ transform: value ? "translateX(20px)" : "translateX(0)" }} />
      </span>
    </button>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return <DxMessage tone="danger" className="mb-4">{message}</DxMessage>;
}

function ModalActions({
  onClose,
  onSubmit,
  pending,
  submitLabel,
  submitIcon: Icon,
  tone = "primary",
  disabled = false,
}: {
  onClose: () => void;
  onSubmit: () => void;
  pending: boolean;
  submitLabel: string;
  submitIcon: typeof Save;
  tone?: "primary" | "amber" | "emerald" | "rose";
  disabled?: boolean;
}) {
  const variant = tone === "rose" ? "danger" : "primary";
  return (
    <div className="mt-6 flex justify-end gap-2 border-t border-[var(--dx-border)] pt-4">
      <DxButton onClick={onClose} disabled={pending}>Cancel</DxButton>
      <DxButton variant={variant} isLoading={pending} disabled={disabled} leftIcon={<Icon className="h-4 w-4" />} onClick={onSubmit}>{submitLabel}</DxButton>
    </div>
  );
}

function ModalShell({
  title,
  subtitle,
  onClose,
  children,
  icon: Icon,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
  icon: typeof LogIn;
  tone?: "primary" | "amber" | "emerald" | "rose";
}) {
  return (
    <DxPopup
      isOpen
      onClose={onClose}
      size="lg"
      title={
        <span className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--dx-accent-soft)] text-[var(--dx-accent)]"><Icon className="h-5 w-5" /></span>
          <span className="flex flex-col">
            <span className="text-[15px] font-bold text-[var(--dx-text)]">{title}</span>
            <span className="text-[11px] font-normal text-[var(--dx-text-muted)]">{subtitle}</span>
          </span>
        </span>
      }
    >
      {children}
    </DxPopup>
  );
}

