import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, Plus, Trash2 } from "lucide-react";
import {
  DxPage, DxPageHeader, DxPanel, DxBadge, DxButton, DxPopup, DxInput, DxSelect, DxTextarea, DxCheckbox,
  type DxBadgeTone,
} from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/api/api-error";
import { routes } from "@/config/routes";
import { useTheatres, surgeryKeys } from "../hooks/use-surgery";
import { createTheatre, changeTheatreStatus, deleteTheatre, THEATRE_STATUS_OPTIONS } from "../api/surgery.api";

function statusTone(status: string): DxBadgeTone {
  switch (status) {
    case "AVAILABLE":
      return "success";
    case "OCCUPIED":
      return "warning";
    case "CLEANING":
      return "info";
    default:
      return "danger";
  }
}

export function TheatresPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const theatres = useTheatres();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", location_description: "", is_emergency_capable: false, notes: "" });
  const [busy, setBusy] = useState(false);

  const invalidate = () => qc.invalidateQueries({ queryKey: [...surgeryKeys.all, "theatres"] });

  const create = async () => {
    if (!form.code.trim() || !form.name.trim()) { toast.error("Code and name are required"); return; }
    setBusy(true);
    try {
      await createTheatre({
        code: form.code.trim(), name: form.name.trim(),
        location_description: form.location_description.trim() || undefined,
        is_emergency_capable: form.is_emergency_capable,
        notes: form.notes.trim() || undefined,
      });
      toast.success("Theatre created");
      setOpen(false); setForm({ code: "", name: "", location_description: "", is_emergency_capable: false, notes: "" });
      invalidate();
    } catch (err) { toast.error("Couldn't create theatre", apiErrorMessage(err, "Retry.")); }
    finally { setBusy(false); }
  };

  const setStatus = async (id: number, status: string) => {
    try { await changeTheatreStatus(id, status); toast.success("Status updated"); invalidate(); }
    catch (err) { toast.error("Couldn't update status", apiErrorMessage(err, "Retry.")); }
  };
  const remove = async (id: number) => {
    try { await deleteTheatre(id); toast.success("Theatre removed"); invalidate(); }
    catch (err) { toast.error("Couldn't remove", apiErrorMessage(err, "It may be in use.")); }
  };

  const items = theatres.data?.items ?? [];

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Surgery", to: routes.surgery }, { label: "Theatres" }]}
        title="Operating Theatres"
        subtitle="Manage theatres and their real-time availability."
        actions={<DxButton variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>New theatre</DxButton>}
      />
      <DxPanel title="Theatres" icon={<Building2 className="h-4 w-4" />}>
        {theatres.isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="dx-skeleton h-36 w-full" />)}</div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center">
            <Building2 className="mx-auto mb-3 h-9 w-9 text-[var(--dx-text-faint)]" />
            <p className="text-[13px] font-medium text-[var(--dx-text-muted)]">No theatres. Add your first operating theatre.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {items.map((t) => (
              <div key={t.id} className="rounded-md border border-[var(--dx-border)] bg-[var(--dx-surface)] p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[15px] font-bold text-[var(--dx-text)]">{t.name}</p>
                    <p className="dx-mono text-[11px] font-semibold uppercase text-[var(--dx-text-muted)]">{t.code}</p>
                  </div>
                  <DxBadge tone={statusTone(String(t.status))}>{String(t.status).replace(/_/g, " ")}</DxBadge>
                </div>
                {t.location_description ? <p className="mt-2 text-[12px] text-[var(--dx-text-muted)]">{t.location_description}</p> : null}
                {t.is_emergency_capable ? <DxBadge tone="danger" className="mt-2">Emergency capable</DxBadge> : null}
                <div className="mt-4 flex items-center gap-2">
                  <div className="flex-1"><DxSelect value={String(t.status)} onChange={(e) => setStatus(t.id, e.target.value)} options={THEATRE_STATUS_OPTIONS} editorSize="sm" /></div>
                  <DxButton icon variant="outline-danger" title="Delete" onClick={() => remove(t.id)}><Trash2 /></DxButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </DxPanel>

      <DxPopup isOpen={open} onClose={() => setOpen(false)} title="New operating theatre" size="md" locked={busy}
        footer={<><DxButton onClick={() => setOpen(false)} disabled={busy}>Cancel</DxButton><DxButton variant="primary" onClick={create} isLoading={busy}>Create</DxButton></>}>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <DxInput label="Code" mono value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="OT-1" />
            <DxInput label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Main Theatre 1" />
          </div>
          <DxInput label="Location" value={form.location_description} onChange={(e) => setForm({ ...form, location_description: e.target.value })} placeholder="2nd floor, surgical wing" />
          <DxCheckbox label="Emergency capable" checked={form.is_emergency_capable} onChange={(e) => setForm({ ...form, is_emergency_capable: e.target.checked })} />
          <DxTextarea label="Notes (optional)" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
      </DxPopup>
    </DxPage>
  );
}
