import { PageHeader } from "@/components/layout/PageHeader";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Building2,
  CalendarCheck,
  CheckCircle2,
  Edit3,
  Filter,
  Hash,
  MapPin,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  ToggleLeft,
  ToggleRight,
  UserCheck,
  X,
} from "lucide-react";
import {
  createServiceDeliveryPoint,
  deleteServiceDeliveryPoint,
  listActiveServiceDeliveryPoints,
  listServiceDeliveryPoints,
  setServiceDeliveryPointStatus,
  updateServiceDeliveryPoint,
} from "../api/service-delivery-points.api";
import type { CreateServiceDeliveryPointPayload } from "../api/service-delivery-points.api";
import type { ServiceDeliveryPoint } from "@/features/visits/api/visits.api";

const SERVICE_POINT_TYPES = [
  "REGISTRATION",
  "TRIAGE",
  "CONSULTATION",
  "LABORATORY",
  "RADIOLOGY",
  "PHARMACY",
  "BILLING",
  "ADMISSION",
  "OTHER",
];

type FormState = {
  name: string;
  code: string;
  service_point_type: string;
  department_id: string;
  location_description: string;
  queue_prefix: string;
  supports_appointments: boolean;
  supports_walk_in: boolean;
  is_active: boolean;
};

const emptyForm: FormState = {
  name: "",
  code: "",
  service_point_type: SERVICE_POINT_TYPES[0],
  department_id: "",
  location_description: "",
  queue_prefix: "",
  supports_appointments: true,
  supports_walk_in: true,
  is_active: true,
};

function formStateFrom(point: ServiceDeliveryPoint): FormState {
  return {
    name: point.name ?? "",
    code: point.code ?? "",
    service_point_type: point.service_point_type ?? SERVICE_POINT_TYPES[0],
    department_id: point.department_id != null ? String(point.department_id) : "",
    location_description: point.location_description ?? "",
    queue_prefix: point.queue_prefix ?? "",
    supports_appointments: !!point.supports_appointments,
    supports_walk_in: !!point.supports_walk_in,
    is_active: !!point.is_active,
  };
}

function buildPayload(form: FormState): CreateServiceDeliveryPointPayload {
  const departmentId = form.department_id.trim();
  return {
    name: form.name.trim(),
    code: form.code.trim().toUpperCase(),
    service_point_type: form.service_point_type,
    department_id: departmentId === "" ? undefined : Number(departmentId),
    location_description: form.location_description.trim() || undefined,
    queue_prefix: form.queue_prefix.trim().toUpperCase() || undefined,
    supports_appointments: form.supports_appointments,
    supports_walk_in: form.supports_walk_in,
    is_active: form.is_active,
  };
}

export function ServiceDeliveryPointsPage() {
  const [points, setPoints] = useState<ServiceDeliveryPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [activeOnly, setActiveOnly] = useState(false);

  const [isModalOpen, setModalOpen] = useState(false);
  const [editingPoint, setEditingPoint] = useState<ServiceDeliveryPoint | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isSaving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadPoints = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = activeOnly
        ? await listActiveServiceDeliveryPoints({ skip: 0, limit: 200 })
        : await listServiceDeliveryPoints({ skip: 0, limit: 200 });
      setPoints(response.items ?? []);
    } catch (err) {
      console.error("Failed to load service delivery points", err);
      setError("Unable to load service delivery points. Please check your connection.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPoints();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOnly]);

  const filteredPoints = useMemo(() => {
    const query = search.trim().toLowerCase();
    return points.filter((p) => {
      if (typeFilter && p.service_point_type !== typeFilter) return false;
      if (!query) return true;
      return (
        p.name?.toLowerCase().includes(query) ||
        p.code?.toLowerCase().includes(query) ||
        p.location_description?.toLowerCase().includes(query) ||
        p.service_point_type?.toLowerCase().includes(query)
      );
    });
  }, [points, search, typeFilter]);

  const stats = useMemo(() => {
    const total = points.length;
    const active = points.filter((p) => p.is_active).length;
    const supportingAppts = points.filter((p) => p.supports_appointments).length;
    const supportingWalkIn = points.filter((p) => p.supports_walk_in).length;
    return { total, active, supportingAppts, supportingWalkIn };
  }, [points]);

  const openCreate = () => {
    setEditingPoint(null);
    setForm(emptyForm);
    setSaveError(null);
    setModalOpen(true);
  };

  const openEdit = (point: ServiceDeliveryPoint) => {
    setEditingPoint(point);
    setForm(formStateFrom(point));
    setSaveError(null);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.code.trim() || !form.service_point_type) {
      setSaveError("Name, code, and service point type are required.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const payload = buildPayload(form);
      const saved = editingPoint
        ? await updateServiceDeliveryPoint(editingPoint.id, payload)
        : await createServiceDeliveryPoint(payload);
      setPoints((prev) => {
        const next = prev.filter((p) => p.id !== saved.id);
        next.push(saved);
        return next.sort((a, b) => a.name.localeCompare(b.name));
      });
      setModalOpen(false);
    } catch (err: any) {
      setSaveError(err?.response?.data?.message || "Failed to save service delivery point.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (point: ServiceDeliveryPoint) => {
    setTogglingId(point.id);
    try {
      const updated = await setServiceDeliveryPointStatus(point.id, !point.is_active);
      setPoints((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    } catch (err: any) {
      alert(err?.response?.data?.message || "Failed to toggle status.");
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (point: ServiceDeliveryPoint) => {
    if (!confirm(`Delete service point "${point.name}"? This cannot be undone.`)) return;
    setDeletingId(point.id);
    try {
      await deleteServiceDeliveryPoint(point.id);
      setPoints((prev) => prev.filter((p) => p.id !== point.id));
    } catch (err: any) {
      alert(err?.response?.data?.message || "Failed to delete service point.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-10 animate-fade-in pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <PageHeader
          title="Service Delivery Points"
          description="Configure the service points that anchor every queue, appointment, and clinical pathway."
        />
        <div className="flex items-center gap-3">
          <button
            onClick={loadPoints}
            className="btn-secondary p-4 rounded-2xl bg-white/80 border-secondary-100 hover:rotate-180 transition-transform duration-500"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={openCreate}
            className="btn-primary gap-3 py-3 px-8 shadow-xl shadow-primary-500/20"
          >
            <Plus className="h-5 w-5" />
            <span className="font-bold">New Service Point</span>
          </button>
        </div>
      </div>

      {/* Stat Strip */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          icon={Building2}
          label="Total Points"
          value={stats.total}
          tone="primary"
        />
        <StatCard icon={CheckCircle2} label="Active" value={stats.active} tone="emerald" />
        <StatCard
          icon={CalendarCheck}
          label="Appointments"
          value={stats.supportingAppts}
          tone="amber"
        />
        <StatCard
          icon={UserCheck}
          label="Walk-In"
          value={stats.supportingWalkIn}
          tone="rose"
        />
      </div>

      {/* Filter Bar */}
      <div className="glass-card rounded-[2rem] p-4 flex flex-col md:flex-row gap-4 items-stretch md:items-center bg-white/40 backdrop-blur-md">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-secondary-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, code, type, or location..."
            className="w-full bg-white/50 border-none rounded-2xl pl-14 pr-6 py-4 text-sm focus:ring-2 focus:ring-primary-500/50 transition-all font-medium"
          />
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <div className="relative">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary-400 pointer-events-none" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="appearance-none bg-white/80 border border-secondary-100 rounded-2xl pl-11 pr-8 py-4 text-xs font-bold uppercase tracking-widest text-secondary-700 focus:ring-2 focus:ring-primary-500/40"
            >
              <option value="">All Types</option>
              {SERVICE_POINT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() => setActiveOnly((v) => !v)}
            className={`flex items-center gap-2 px-5 py-4 rounded-2xl text-xs font-bold uppercase tracking-widest border transition-all ${
              activeOnly
                ? "bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-500/20"
                : "bg-white/80 text-secondary-600 border-secondary-100"
            }`}
          >
            {activeOnly ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
            <span>Active Only</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card rounded-[2.5rem] overflow-hidden border border-secondary-100/50 shadow-premium bg-white/40">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-secondary-900/5">
                <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500">
                  Service Point
                </th>
                <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500">
                  Code
                </th>
                <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500">
                  Type
                </th>
                <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500">
                  Capabilities
                </th>
                <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500">
                  Status
                </th>
                <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-100/50">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className="px-8 py-8">
                      <div className="h-16 bg-secondary-100/30 rounded-2xl w-full" />
                    </td>
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center">
                    <div className="max-w-xs mx-auto space-y-4">
                      <AlertCircle className="h-12 w-12 mx-auto text-rose-500/50" />
                      <p className="text-secondary-600 font-bold">{error}</p>
                      <button onClick={loadPoints} className="btn-primary w-full py-3">
                        Try Again
                      </button>
                    </div>
                  </td>
                </tr>
              ) : filteredPoints.length > 0 ? (
                filteredPoints.map((point) => (
                  <tr key={point.id} className="hover:bg-primary-50/30 transition-all group">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-md">
                          <Building2 className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-secondary-900">{point.name}</p>
                          <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest mt-0.5 flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {point.location_description || "Unspecified location"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="inline-flex items-center gap-2 bg-secondary-900/5 border border-secondary-900/10 px-3 py-1.5 rounded-xl">
                        <Hash className="h-3 w-3 text-secondary-400" />
                        <span className="text-[11px] font-mono font-bold text-secondary-600 tracking-tight">
                          {point.code}
                        </span>
                      </div>
                      {point.queue_prefix && (
                        <p className="text-[10px] font-bold text-secondary-400 mt-2 uppercase tracking-widest">
                          Q-Prefix · {point.queue_prefix}
                        </p>
                      )}
                    </td>
                    <td className="px-8 py-6">
                      <span className="inline-flex px-3 py-1.5 rounded-xl bg-primary-50 text-primary-600 border border-primary-100 text-[10px] font-bold uppercase tracking-widest">
                        {point.service_point_type}
                      </span>
                      {point.department_id != null && (
                        <p className="text-[10px] font-bold text-secondary-400 mt-2 uppercase tracking-widest">
                          Dept #{point.department_id}
                        </p>
                      )}
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col gap-1.5">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest border w-fit ${
                            point.supports_appointments
                              ? "bg-amber-50 text-amber-600 border-amber-100"
                              : "bg-secondary-50 text-secondary-400 border-secondary-100"
                          }`}
                        >
                          <CalendarCheck className="h-3 w-3" />
                          Appts {point.supports_appointments ? "Yes" : "No"}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest border w-fit ${
                            point.supports_walk_in
                              ? "bg-rose-50 text-rose-600 border-rose-100"
                              : "bg-secondary-50 text-secondary-400 border-secondary-100"
                          }`}
                        >
                          <UserCheck className="h-3 w-3" />
                          Walk-In {point.supports_walk_in ? "Yes" : "No"}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <button
                        onClick={() => handleToggleStatus(point)}
                        disabled={togglingId === point.id}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[10px] font-bold uppercase tracking-widest transition-all disabled:opacity-50 ${
                          point.is_active
                            ? "bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100"
                            : "bg-secondary-100 text-secondary-500 border-secondary-200 hover:bg-secondary-200"
                        }`}
                      >
                        {point.is_active ? (
                          <ToggleRight className="h-3.5 w-3.5" />
                        ) : (
                          <ToggleLeft className="h-3.5 w-3.5" />
                        )}
                        {point.is_active ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(point)}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-primary-700 transition-all shadow-md shadow-primary-500/10"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => handleDelete(point)}
                          disabled={deletingId === point.id}
                          className="p-2.5 hover:bg-rose-50 text-rose-500 rounded-xl transition-all disabled:opacity-30"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-8 py-32 text-center">
                    <div className="max-w-sm mx-auto space-y-6">
                      <div className="h-20 w-20 bg-secondary-50 rounded-3xl flex items-center justify-center mx-auto">
                        <Building2 className="h-10 w-10 text-secondary-200" />
                      </div>
                      <h4 className="text-xl font-bold text-secondary-900">No Service Points</h4>
                      <p className="text-sm text-secondary-500">
                        {points.length === 0
                          ? "Configure your first service delivery point to anchor queues and clinical flows."
                          : "No service points match your filters. Adjust the filters or create a new one."}
                      </p>
                      <button
                        onClick={openCreate}
                        className="btn-primary inline-flex items-center gap-2 px-8 py-3"
                      >
                        <Plus className="h-4 w-4" />
                        <span>Add Service Point</span>
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-6 animate-fade-in">
          <div className="bg-white rounded-[2.5rem] p-10 max-w-2xl w-full shadow-2xl relative animate-slide-up max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-6 right-6 p-3 hover:bg-secondary-50 rounded-2xl transition-all"
            >
              <X className="h-5 w-5 text-secondary-400" />
            </button>
            <div className="flex items-center gap-5 mb-8">
              <div className="h-14 w-14 rounded-2xl bg-primary-600 text-white flex items-center justify-center shadow-xl shadow-primary-500/20">
                {editingPoint ? <Edit3 className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
              </div>
              <div>
                <h3 className="text-xl font-black font-display tracking-tight">
                  {editingPoint ? "Edit Service Point" : "New Service Point"}
                </h3>
                <p className="text-secondary-400 font-bold text-[10px] uppercase tracking-[0.2em] mt-1">
                  {editingPoint
                    ? "Update Service Delivery Configuration"
                    : "Define A New Anchor Of Care"}
                </p>
              </div>
            </div>

            {saveError && (
              <div className="mb-6 p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl flex items-center gap-3">
                <AlertCircle className="h-5 w-5" />
                <span className="text-sm font-bold">{saveError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field
                label="Name"
                required
                value={form.name}
                onChange={(v) => setForm({ ...form, name: v })}
                placeholder="e.g. Triage Bay 1"
              />
              <Field
                label="Code"
                required
                value={form.code}
                onChange={(v) => setForm({ ...form, code: v.toUpperCase() })}
                placeholder="e.g. TRIAGE_01"
                mono
              />
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500">
                  Service Point Type *
                </label>
                <select
                  value={form.service_point_type}
                  onChange={(e) => setForm({ ...form, service_point_type: e.target.value })}
                  className="input-field h-12 bg-secondary-50 border-secondary-100 w-full"
                >
                  {SERVICE_POINT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <Field
                label="Department ID"
                value={form.department_id}
                onChange={(v) => setForm({ ...form, department_id: v })}
                placeholder="e.g. 12"
                type="number"
              />
              <Field
                label="Queue Prefix"
                value={form.queue_prefix}
                onChange={(v) => setForm({ ...form, queue_prefix: v.toUpperCase() })}
                placeholder="e.g. T"
                mono
              />
              <div className="space-y-2 md:col-span-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500">
                  Location Description
                </label>
                <input
                  type="text"
                  value={form.location_description}
                  onChange={(e) =>
                    setForm({ ...form, location_description: e.target.value })
                  }
                  placeholder="Wing B, Ground Floor, Room 12"
                  className="input-field h-12 bg-secondary-50 border-secondary-100 w-full"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <ToggleSwitch
                label="Supports Appointments"
                value={form.supports_appointments}
                onChange={(v) => setForm({ ...form, supports_appointments: v })}
              />
              <ToggleSwitch
                label="Supports Walk-In"
                value={form.supports_walk_in}
                onChange={(v) => setForm({ ...form, supports_walk_in: v })}
              />
              <ToggleSwitch
                label="Active"
                value={form.is_active}
                onChange={(v) => setForm({ ...form, is_active: v })}
              />
            </div>

            <div className="pt-8 flex gap-4">
              <button
                onClick={() => setModalOpen(false)}
                className="flex-1 btn-secondary py-4 rounded-2xl font-bold"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-[2] btn-primary py-4 rounded-2xl font-black tracking-tight shadow-xl shadow-primary-500/20 flex items-center justify-center gap-3 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {isSaving ? "Saving..." : editingPoint ? "Save Changes" : "Create Service Point"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ----- Helpers -----

type StatTone = "primary" | "emerald" | "amber" | "rose";

const statToneStyles: Record<StatTone, string> = {
  primary: "bg-primary-50 text-primary-600 border-primary-100",
  emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
  amber: "bg-amber-50 text-amber-600 border-amber-100",
  rose: "bg-rose-50 text-rose-600 border-rose-100",
};

type StatCardProps = {
  icon: typeof Building2;
  label: string;
  value: number;
  tone: StatTone;
};

function StatCard({ icon: Icon, label, value, tone }: StatCardProps) {
  return (
    <div
      className={`glass-card rounded-[2rem] p-6 border ${statToneStyles[tone]} bg-white/60 backdrop-blur-md`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">{label}</span>
        <Icon className="h-5 w-5" />
      </div>
      <div className="text-3xl font-black tracking-tight">{value}</div>
    </div>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
  mono?: boolean;
};

function Field({ label, value, onChange, placeholder, required, type = "text", mono }: FieldProps) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500">
        {label}
        {required ? " *" : ""}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`input-field h-12 bg-secondary-50 border-secondary-100 w-full ${
          mono ? "font-mono" : ""
        }`}
      />
    </div>
  );
}

type ToggleSwitchProps = {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
};

function ToggleSwitch({ label, value, onChange }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${
        value
          ? "bg-emerald-50 border-emerald-200 text-emerald-700"
          : "bg-secondary-50 border-secondary-100 text-secondary-500"
      }`}
    >
      <span className="text-[11px] font-bold uppercase tracking-widest text-left">{label}</span>
      {value ? (
        <ToggleRight className="h-6 w-6 text-emerald-600" />
      ) : (
        <ToggleLeft className="h-6 w-6 text-secondary-400" />
      )}
    </button>
  );
}
