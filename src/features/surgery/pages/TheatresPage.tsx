import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Building2, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/api/api-error";
import { routes } from "@/config/routes";
import { useTheatres, surgeryKeys } from "../hooks/use-surgery";
import { createTheatre, changeTheatreStatus, deleteTheatre, THEATRE_STATUS_OPTIONS } from "../api/surgery.api";

const STATUS_TINT: Record<string, string> = {
  AVAILABLE: "soft-success",
  OCCUPIED: "soft-warning",
  CLEANING: "soft-info",
  OUT_OF_SERVICE: "soft-danger",
  UNDER_MAINTENANCE: "soft-danger",
};

export function TheatresPage() {
  const navigate = useNavigate();
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
    <div className="space-y-8 animate-fade-in pb-16">
      <button onClick={() => navigate(routes.surgery)} className="flex items-center gap-2 text-sm font-bold text-secondary-500 hover:text-primary-600">
        <ArrowLeft className="h-4 w-4" /> Back to worklist
      </button>
      <PageHeader
        title="Operating Theatres"
        description="Manage theatres and their real-time availability."
        actions={<Button size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>New theatre</Button>}
      />
      <Card padding="none">
        <CardHeader className="px-6 pt-6" title="Theatres" />
        {theatres.isLoading ? (
          <div className="space-y-3 px-6 pb-6">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
        ) : items.length === 0 ? (
          <div className="px-6 pb-8"><EmptyState icon={Building2} title="No theatres" description="Add your first operating theatre." /></div>
        ) : (
          <div className="grid gap-4 px-6 pb-6 md:grid-cols-2 xl:grid-cols-3">
            {items.map((t) => (
              <div key={t.id} className="rounded-2xl border border-secondary-200 p-5 dark:border-white/10">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-base font-black text-secondary-900 dark:text-secondary-100">{t.name}</p>
                    <p className="font-mono text-[11px] font-bold uppercase text-secondary-400">{t.code}</p>
                  </div>
                  <Badge variant={(STATUS_TINT[String(t.status)] as any) ?? "secondary"}>{String(t.status).replace(/_/g, " ")}</Badge>
                </div>
                {t.location_description && <p className="mt-2 text-xs text-secondary-500">{t.location_description}</p>}
                {t.is_emergency_capable && <Badge variant="soft-danger" className="mt-2">Emergency capable</Badge>}
                <div className="mt-4 flex items-center gap-2">
                  <Select value={String(t.status)} onChange={(e) => setStatus(t.id, e.target.value)} options={THEATRE_STATUS_OPTIONS} className="h-10 text-xs" />
                  <button onClick={() => remove(t.id)} className="rounded-xl p-2.5 text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10" title="Delete"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
      <Modal isOpen={open} onClose={() => setOpen(false)} title="New Operating Theatre" size="md"
        footer={<div className="flex justify-end gap-3"><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={create} isLoading={busy}>Create</Button></div>}>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="OT-1" />
            <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Main Theatre 1" />
          </div>
          <Input label="Location" value={form.location_description} onChange={(e) => setForm({ ...form, location_description: e.target.value })} placeholder="2nd floor, surgical wing" />
          <label className="flex cursor-pointer items-center gap-3">
            <input type="checkbox" className="h-5 w-5 rounded accent-rose-600" checked={form.is_emergency_capable} onChange={(e) => setForm({ ...form, is_emergency_capable: e.target.checked })} />
            <span className="text-sm font-bold text-secondary-900 dark:text-secondary-100">Emergency capable</span>
          </label>
          <Textarea label="Notes (optional)" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
      </Modal>
    </div>
  );
}
