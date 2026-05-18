import { PageHeader } from "@/components/layout/PageHeader";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  Boxes,
  Building2,
  CheckCircle2,
  Edit3,
  Hash,
  History,
  MapPin,
  Package,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  createStore,
  deleteStore,
  listStores,
  updateStore,
} from "../api/inventory.api";
import type {
  CreateStorePayload,
  Store,
  UpdateStorePayload,
} from "../api/inventory.api";

type StoreForm = {
  name: string;
  code: string;
  location_description: string;
  description: string;
};

const emptyForm: StoreForm = {
  name: "",
  code: "",
  location_description: "",
  description: "",
};

export function StoresPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<
    { tone: "success" | "error"; message: string } | null
  >(null);
  const [search, setSearch] = useState("");

  const [modal, setModal] = useState<{ open: boolean; editing: Store | null }>({
    open: false,
    editing: null,
  });
  const [form, setForm] = useState<StoreForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [confirmDelete, setConfirmDelete] = useState<Store | null>(null);
  const [deleting, setDeleting] = useState(false);

  const showFeedback = (tone: "success" | "error", message: string) => {
    setFeedback({ tone, message });
    window.setTimeout(() => setFeedback(null), 3500);
  };

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await listStores({ skip: 0, limit: 200 });
      setStores(res.items ?? []);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Unable to load stores.");
    } finally {
      setIsLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return stores;
    return stores.filter(
      (s) =>
        s.name?.toLowerCase().includes(q) ||
        s.code?.toLowerCase().includes(q) ||
        s.location_description?.toLowerCase().includes(q),
    );
  }, [stores, search]);

  const openCreate = () => {
    setModal({ open: true, editing: null });
    setForm(emptyForm);
    setSaveError(null);
  };
  const openEdit = (s: Store) => {
    setModal({ open: true, editing: s });
    setForm({
      name: s.name ?? "",
      code: s.code ?? "",
      location_description: s.location_description ?? "",
      description: s.description ?? "",
    });
    setSaveError(null);
  };
  const close = () => {
    if (saving) return;
    setModal({ open: false, editing: null });
  };
  const handleSave = async () => {
    if (!form.name.trim() || !form.code.trim()) {
      setSaveError("Name and code are required.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      if (modal.editing) {
        const payload: UpdateStorePayload = {
          name: form.name.trim(),
          location_description: form.location_description.trim() || undefined,
          description: form.description.trim() || undefined,
        };
        const res = await updateStore(modal.editing.id, payload);
        setStores((prev) =>
          [...prev.filter((s) => s.id !== res.store.id), res.store].sort((a, b) =>
            a.name.localeCompare(b.name),
          ),
        );
      } else {
        const payload: CreateStorePayload = {
          name: form.name.trim(),
          code: form.code.trim().toUpperCase(),
          location_description: form.location_description.trim() || undefined,
          description: form.description.trim() || undefined,
        };
        const res = await createStore(payload);
        setStores((prev) =>
          [...prev, res.store].sort((a, b) => a.name.localeCompare(b.name)),
        );
      }
      showFeedback("success", "Store saved.");
      setModal({ open: false, editing: null });
    } catch (err: any) {
      setSaveError(err?.response?.data?.message || "Failed to save store.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await deleteStore(confirmDelete.id);
      setStores((prev) => prev.filter((s) => s.id !== confirmDelete.id));
      showFeedback("success", "Store deleted.");
      setConfirmDelete(null);
    } catch (err: any) {
      showFeedback("error", err?.response?.data?.message || "Failed to delete store.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-10 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <PageHeader
          title="Inventory Stores"
          description="Configure each pharmacy bay, ward store, and central warehouse where stock lives."
        />
        <div className="flex items-center gap-3">
          <Link
            to="/inventory/items"
            className="btn-secondary gap-2 px-5 py-3 rounded-2xl bg-white/80 border-secondary-400"
          >
            <Boxes className="h-4 w-4" />
            <span className="text-sm font-bold">Stock Items</span>
          </Link>
          <Link
            to="/inventory/movements"
            className="btn-secondary gap-2 px-5 py-3 rounded-2xl bg-white/80 border-secondary-400"
          >
            <History className="h-4 w-4" />
            <span className="text-sm font-bold">Movements</span>
          </Link>
          <button
            onClick={load}
            className="btn-secondary p-4 rounded-2xl bg-white/80 border-secondary-400 hover:rotate-180 transition-transform duration-500"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={openCreate}
            className="btn-primary gap-3 py-3 px-8 shadow-xl shadow-primary-500/20"
          >
            <Plus className="h-5 w-5" />
            <span className="font-bold">New Store</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`px-6 py-4 rounded-2xl border flex items-center gap-3 shadow-lg animate-fade-in ${feedback.tone === "success"
              ? "bg-emerald-50 text-emerald-700 border-emerald-100"
              : "bg-rose-50 text-rose-700 border-rose-100"
            }`}
        >
          {feedback.tone === "success" ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : (
            <AlertCircle className="h-5 w-5" />
          )}
          <span className="text-sm font-bold">{feedback.message}</span>
        </div>
      )}

      {/* Search */}
      <div className="glass-card rounded-[2rem] p-4 bg-white/40 backdrop-blur-md">
        <div className="relative">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-secondary-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, code, or location..."
            className="w-full bg-white/50 border-none rounded-2xl pl-14 pr-6 py-4 text-sm focus:ring-2 focus:ring-primary-500/50 transition-all font-medium"
          />
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass-card rounded-[2rem] h-44 animate-pulse bg-white/40" />
          ))}
        </div>
      ) : error ? (
        <div className="glass-card rounded-[2.5rem] p-16 text-center max-w-md mx-auto">
          <AlertCircle className="h-12 w-12 mx-auto text-rose-500/50 mb-4" />
          <p className="text-secondary-600 font-bold mb-4">{error}</p>
          <button onClick={load} className="btn-primary py-3 px-8">
            Try Again
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card rounded-[2.5rem] p-16 text-center max-w-md mx-auto">
          <div className="h-20 w-20 bg-secondary-50 rounded-3xl flex items-center justify-center mx-auto mb-4">
            <Package className="h-10 w-10 text-secondary-200" />
          </div>
          <h4 className="text-xl font-bold text-secondary-900">No Stores</h4>
          <p className="text-sm text-secondary-500 mt-2">
            {stores.length === 0
              ? "Create your first stockroom to start tracking inventory."
              : "No stores match your search."}
          </p>
          <button onClick={openCreate} className="btn-primary mt-5 inline-flex items-center gap-2 px-8 py-3">
            <Plus className="h-4 w-4" />
            <span>Add Store</span>
          </button>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => (
            <div
              key={s.id}
              className="glass-card rounded-[2rem] p-7 bg-white border border-secondary-400 hover:border-primary-300 hover:shadow-xl hover:shadow-primary-500/5 transition-all"
            >
              <div className="flex items-start justify-between mb-5">
                <div className="h-14 w-14 rounded-[1.25rem] bg-slate-900 text-white flex items-center justify-center shadow-md">
                  <Package className="h-7 w-7" />
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEdit(s)}
                    className="p-2 rounded-xl hover:bg-secondary-100 text-secondary-500"
                    title="Edit"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setConfirmDelete(s)}
                    className="p-2 rounded-xl hover:bg-rose-50 text-rose-500"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <h3 className="text-lg font-black text-secondary-900 mb-2">{s.name}</h3>
              <span className="inline-flex items-center gap-1 bg-secondary-100 text-secondary-600 px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold mb-4">
                <Hash className="h-2.5 w-2.5" />
                {s.code}
              </span>
              {s.location_description && (
                <p className="text-xs font-bold text-secondary-500 flex items-start gap-2 mb-2">
                  <MapPin className="h-3 w-3 mt-0.5 shrink-0 text-amber-500" />
                  {s.location_description}
                </p>
              )}
              {s.description && (
                <p className="text-xs text-secondary-500 leading-relaxed line-clamp-3">
                  {s.description}
                </p>
              )}
              <div className="mt-5 pt-4 border-t border-secondary-400 flex gap-2">
                <Link
                  to={`/inventory/items?store=${s.id}`}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-secondary-50 hover:bg-secondary-100 text-secondary-600 text-[10px] font-bold uppercase tracking-widest transition-all"
                >
                  <Boxes className="h-3.5 w-3.5" />
                  Items
                </Link>
                <Link
                  to={`/inventory/movements?store=${s.id}`}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-secondary-50 hover:bg-secondary-100 text-secondary-600 text-[10px] font-bold uppercase tracking-widest transition-all"
                >
                  <History className="h-3.5 w-3.5" />
                  Movements
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modal.open && (
        <ModalShell
          title={modal.editing ? "Edit Store" : "New Store"}
          subtitle="Configure A Stockroom"
          onClose={close}
          icon={modal.editing ? Edit3 : Plus}
        >
          {saveError && (
            <div className="mb-5 p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl flex items-center gap-3">
              <AlertCircle className="h-5 w-5" />
              <span className="text-sm font-bold">{saveError}</span>
            </div>
          )}
          <div className="space-y-5">
            <FieldRow
              label="Name *"
              value={form.name}
              onChange={(v) => setForm({ ...form, name: v })}
              placeholder="Main Pharmacy Store"
            />
            <FieldRow
              label="Code *"
              value={form.code}
              onChange={(v) => setForm({ ...form, code: v.toUpperCase() })}
              placeholder="PHM-MAIN"
              mono
              disabled={!!modal.editing}
              hint={modal.editing ? "Code cannot be changed after creation" : undefined}
            />
            <FieldRow
              label="Location"
              value={form.location_description}
              onChange={(v) => setForm({ ...form, location_description: v })}
              placeholder="Block B, Ground Floor, Room 4"
            />
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500">
                Description
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What this store is used for..."
                className="input-field h-24 bg-secondary-50 border-secondary-400 w-full resize-none py-3"
              />
            </div>
          </div>
          <div className="pt-6 flex gap-4">
            <button onClick={close} disabled={saving} className="flex-1 btn-secondary py-4 rounded-2xl font-bold">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-[2] btn-primary py-4 rounded-2xl font-black tracking-tight shadow-xl shadow-primary-500/20 flex items-center justify-center gap-3 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : modal.editing ? "Save Changes" : "Create Store"}
            </button>
          </div>
        </ModalShell>
      )}

      {confirmDelete && (
        <ModalShell
          title="Delete Store"
          subtitle="This Cannot Be Undone"
          onClose={() => !deleting && setConfirmDelete(null)}
          icon={Trash2}
          tone="rose"
        >
          <p className="text-sm text-secondary-600 leading-relaxed mb-6">
            Delete store{" "}
            <strong className="text-secondary-900">{confirmDelete.name}</strong> ({confirmDelete.code})?
            Stock items and movement history tied to this store will be affected.
          </p>
          <div className="flex gap-4">
            <button
              onClick={() => setConfirmDelete(null)}
              disabled={deleting}
              className="flex-1 btn-secondary py-4 rounded-2xl font-bold"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex-[2] py-4 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-black tracking-tight shadow-xl shadow-rose-500/20 flex items-center justify-center gap-3 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              {deleting ? "Deleting..." : "Delete Store"}
            </button>
          </div>
        </ModalShell>
      )}
    </div>
  );
}

function FieldRow({
  label,
  value,
  onChange,
  placeholder,
  mono,
  disabled,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`input-field h-12 bg-secondary-50 border-secondary-400 w-full ${mono ? "font-mono" : ""
          } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
      />
      {hint && (
        <p className="text-[9px] font-bold uppercase tracking-widest text-secondary-400">{hint}</p>
      )}
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
  icon: typeof Building2;
  tone?: "primary" | "rose";
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-6 animate-fade-in">
      <div className="bg-white rounded-[2.5rem] p-10 max-w-xl w-full shadow-2xl relative animate-slide-up max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-3 hover:bg-secondary-50 rounded-2xl transition-all"
        >
          <X className="h-5 w-5 text-secondary-400" />
        </button>
        <div className="flex items-center gap-5 mb-8">
          <div
            className={`h-14 w-14 rounded-2xl text-white flex items-center justify-center shadow-xl ${tone === "rose"
                ? "bg-rose-500 shadow-rose-500/20"
                : "bg-primary-600 shadow-primary-500/20"
              }`}
          >
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
