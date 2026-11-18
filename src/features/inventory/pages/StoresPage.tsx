import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Boxes,
  Edit3,
  Hash,
  History,
  MapPin,
  Package,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import {
  DxPage, DxPageHeader, DxPanel, DxButton, DxInput, DxTextarea, DxPopup, DxMessage,
} from "@/components/dx";
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
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [search, setSearch] = useState("");

  const [modal, setModal] = useState<{ open: boolean; editing: Store | null }>({ open: false, editing: null });
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
          [...prev.filter((s) => s.id !== res.store.id), res.store].sort((a, b) => a.name.localeCompare(b.name)),
        );
      } else {
        const payload: CreateStorePayload = {
          name: form.name.trim(),
          code: form.code.trim().toUpperCase(),
          location_description: form.location_description.trim() || undefined,
          description: form.description.trim() || undefined,
        };
        const res = await createStore(payload);
        setStores((prev) => [...prev, res.store].sort((a, b) => a.name.localeCompare(b.name)));
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
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Inventory" }, { label: "Stores" }]}
        title="Inventory Stores"
        subtitle="Configure each pharmacy bay, ward store, and central warehouse where stock lives."
        actions={
          <>
            <Link to="/inventory/items" className="dx-btn dx-btn-sm"><Boxes className="h-4 w-4" /> Stock Items</Link>
            <Link to="/inventory/movements" className="dx-btn dx-btn-sm"><History className="h-4 w-4" /> Movements</Link>
            <DxButton icon title="Refresh" onClick={load} isLoading={isLoading}><RotateCcw /></DxButton>
            <DxButton variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>New store</DxButton>
          </>
        }
      />

      {feedback ? (
        <DxMessage tone={feedback.tone === "success" ? "success" : "danger"}>{feedback.message}</DxMessage>
      ) : null}

      <div className="max-w-md">
        <DxInput leftIcon={<Search className="h-3.5 w-3.5" />} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, code, or location…" />
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="dx-skeleton h-44 w-full" />)}</div>
      ) : error ? (
        <DxPanel>
          <div className="py-12 text-center">
            <Package className="mx-auto mb-3 h-10 w-10 text-[var(--dx-text-faint)]" />
            <p className="text-[14px] font-semibold text-[var(--dx-text)]">{error}</p>
            <DxButton className="mx-auto mt-4" variant="primary" onClick={load}>Try again</DxButton>
          </div>
        </DxPanel>
      ) : filtered.length === 0 ? (
        <DxPanel>
          <div className="py-14 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-[var(--dx-surface-sunken)]"><Package className="h-8 w-8 text-[var(--dx-text-faint)]" /></div>
            <h4 className="text-[16px] font-bold text-[var(--dx-text)]">No Stores</h4>
            <p className="mx-auto mt-1 max-w-sm text-[13px] text-[var(--dx-text-muted)]">{stores.length === 0 ? "Create your first stockroom to start tracking inventory." : "No stores match your search."}</p>
            <DxButton className="mx-auto mt-4" variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>Add store</DxButton>
          </div>
        </DxPanel>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => (
            <div key={s.id} className="flex flex-col rounded-lg border border-[var(--dx-border)] bg-[var(--dx-surface)] p-5 transition-colors hover:border-[var(--dx-border-strong)]">
              <div className="mb-4 flex items-start justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--dx-accent-soft)] text-[var(--dx-accent)]"><Package className="h-6 w-6" /></div>
                <div className="flex items-center gap-1">
                  <DxButton icon size="sm" variant="text" title="Edit" onClick={() => openEdit(s)}><Edit3 /></DxButton>
                  <DxButton icon size="sm" variant="outline-danger" title="Delete" onClick={() => setConfirmDelete(s)}><Trash2 /></DxButton>
                </div>
              </div>
              <h3 className="mb-2 text-[16px] font-bold text-[var(--dx-text)]">{s.name}</h3>
              <span className="mb-3 inline-flex w-fit items-center gap-1 rounded-md bg-[var(--dx-surface-sunken)] px-2.5 py-1 dx-mono text-[11px] font-semibold text-[var(--dx-text-muted)]">
                <Hash className="h-2.5 w-2.5" />{s.code}
              </span>
              {s.location_description ? (
                <p className="mb-2 flex items-start gap-2 text-[12px] font-medium text-[var(--dx-text-muted)]"><MapPin className="mt-0.5 h-3 w-3 shrink-0" style={{ color: "var(--dx-warning)" }} />{s.location_description}</p>
              ) : null}
              {s.description ? <p className="line-clamp-3 text-[12px] leading-relaxed text-[var(--dx-text-muted)]">{s.description}</p> : null}
              <div className="mt-auto flex gap-2 border-t border-[var(--dx-border)] pt-4">
                <Link to={`/inventory/items?store=${s.id}`} className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-[var(--dx-surface-sunken)] py-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--dx-text-muted)] transition-colors hover:bg-[var(--dx-surface)] hover:text-[var(--dx-text)]"><Boxes className="h-3.5 w-3.5" /> Items</Link>
                <Link to={`/inventory/movements?store=${s.id}`} className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-[var(--dx-surface-sunken)] py-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--dx-text-muted)] transition-colors hover:bg-[var(--dx-surface)] hover:text-[var(--dx-text)]"><History className="h-3.5 w-3.5" /> Movements</Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / edit */}
      <DxPopup
        isOpen={modal.open}
        onClose={close}
        title={modal.editing ? "Edit Store" : "New Store"}
        size="md"
        locked={saving}
        footer={<><DxButton onClick={close} disabled={saving}>Cancel</DxButton><DxButton variant="primary" onClick={handleSave} isLoading={saving}>{modal.editing ? "Save changes" : "Create store"}</DxButton></>}
      >
        <div className="space-y-4">
          {saveError ? <DxMessage tone="danger">{saveError}</DxMessage> : null}
          <DxInput label="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Main Pharmacy Store" />
          <DxInput label="Code" required mono value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="PHM-MAIN" disabled={!!modal.editing} hint={modal.editing ? "Code cannot be changed after creation" : undefined} />
          <DxInput label="Location" value={form.location_description} onChange={(e) => setForm({ ...form, location_description: e.target.value })} placeholder="Block B, Ground Floor, Room 4" />
          <DxTextarea label="Description" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What this store is used for…" />
        </div>
      </DxPopup>

      {/* Delete confirm */}
      <DxPopup
        isOpen={confirmDelete !== null}
        onClose={() => !deleting && setConfirmDelete(null)}
        title="Delete Store"
        size="sm"
        locked={deleting}
        footer={<><DxButton onClick={() => setConfirmDelete(null)} disabled={deleting}>Cancel</DxButton><DxButton variant="danger" onClick={handleDelete} isLoading={deleting} leftIcon={<Trash2 className="h-4 w-4" />}>Delete store</DxButton></>}
      >
        <DxMessage tone="danger">
          {confirmDelete ? <>Delete store <strong>{confirmDelete.name}</strong> ({confirmDelete.code})? Stock items and movement history tied to this store will be affected.</> : null}
        </DxMessage>
      </DxPopup>
    </DxPage>
  );
}
