import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ClipboardList, Plus, Trash2, Search, Droplet } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/api/api-error";
import { routes } from "@/config/routes";
import { useProcedures, surgeryKeys } from "../hooks/use-surgery";
import { createProcedure, deleteProcedure } from "../api/surgery.api";

export function ProcedureCatalogPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const procedures = useProcedures({ search: search.trim() || undefined });
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    code: "", name: "", cpt_code: "", typical_duration_minutes: "", default_price: "",
    requires_blood_products: false, average_blood_loss_ml: "", description: "", pre_op_instructions: "", post_op_instructions: "",
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: [...surgeryKeys.all, "procedures"] });

  const create = async () => {
    if (!form.code.trim() || !form.name.trim()) { toast.error("Code and name are required"); return; }
    setBusy(true);
    try {
      await createProcedure({
        code: form.code.trim(), name: form.name.trim(),
        cpt_code: form.cpt_code.trim() || undefined,
        typical_duration_minutes: form.typical_duration_minutes ? Number(form.typical_duration_minutes) : undefined,
        default_price: form.default_price ? Number(form.default_price) : undefined,
        requires_blood_products: form.requires_blood_products,
        average_blood_loss_ml: form.average_blood_loss_ml ? Number(form.average_blood_loss_ml) : undefined,
        description: form.description.trim() || undefined,
        pre_op_instructions: form.pre_op_instructions.trim() || undefined,
        post_op_instructions: form.post_op_instructions.trim() || undefined,
      });
      toast.success("Procedure added");
      setOpen(false);
      setForm({ code: "", name: "", cpt_code: "", typical_duration_minutes: "", default_price: "", requires_blood_products: false, average_blood_loss_ml: "", description: "", pre_op_instructions: "", post_op_instructions: "" });
      invalidate();
    } catch (err) { toast.error("Couldn't add procedure", apiErrorMessage(err, "Retry.")); }
    finally { setBusy(false); }
  };
  const remove = async (id: number) => {
    try { await deleteProcedure(id); toast.success("Removed"); invalidate(); }
    catch (err) { toast.error("Couldn't remove", apiErrorMessage(err, "It may be in use.")); }
  };

  const items = procedures.data?.items ?? [];

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      <button onClick={() => navigate(routes.surgery)} className="flex items-center gap-2 text-sm font-bold text-secondary-500 hover:text-primary-600">
        <ArrowLeft className="h-4 w-4" /> Back to worklist
      </button>
      <PageHeader
        title="Surgical Procedure Catalog"
        description="The catalog of procedures that can be booked, with default pricing and instructions."
        actions={<Button size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>New procedure</Button>}
      />
      <Card padding="none">
        <div className="px-6 pt-6">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary-400" />
            <input className="input-field pl-10" placeholder="Search procedures…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <CardHeader className="px-6 pt-6" title="Procedures" />
        {procedures.isLoading ? (
          <div className="space-y-3 px-6 pb-6">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : items.length === 0 ? (
          <div className="px-6 pb-8"><EmptyState icon={ClipboardList} title="No procedures" description="Add procedures to the catalog to start booking cases." /></div>
        ) : (
          <div className="overflow-x-auto px-6 pb-6">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="text-left text-[10px] font-black uppercase tracking-[0.15em] text-secondary-400">
                  <th className="px-3 py-2">Code</th><th className="px-3 py-2">Name</th><th className="px-3 py-2">CPT</th>
                  <th className="px-3 py-2">Duration</th><th className="px-3 py-2">Price</th><th className="px-3 py-2">Blood</th><th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.id} className="border-t border-secondary-100 dark:border-white/5">
                    <td className="px-3 py-3 font-mono text-xs font-bold text-secondary-500">{p.code}</td>
                    <td className="px-3 py-3 font-black text-secondary-900 dark:text-secondary-100">{p.name}</td>
                    <td className="px-3 py-3 text-secondary-500">{p.cpt_code || "—"}</td>
                    <td className="px-3 py-3 text-secondary-500">{p.typical_duration_minutes ? `${p.typical_duration_minutes} min` : "—"}</td>
                    <td className="px-3 py-3 text-secondary-500">{p.default_price != null ? Number(p.default_price).toLocaleString() : "—"}</td>
                    <td className="px-3 py-3">{p.requires_blood_products ? <Badge variant="soft-danger"><Droplet className="h-3 w-3" /> Yes</Badge> : <span className="text-secondary-300">—</span>}</td>
                    <td className="px-3 py-3 text-right"><button onClick={() => remove(p.id)} className="rounded-lg p-1.5 text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10" title="Delete"><Trash2 className="h-4 w-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Modal isOpen={open} onClose={() => setOpen(false)} title="New Surgical Procedure" size="lg"
        footer={<div className="flex justify-end gap-3"><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={create} isLoading={busy}>Create</Button></div>}>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="APPEND" />
            <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Appendectomy" />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Input label="CPT code" value={form.cpt_code} onChange={(e) => setForm({ ...form, cpt_code: e.target.value })} />
            <Input label="Duration (min)" type="number" value={form.typical_duration_minutes} onChange={(e) => setForm({ ...form, typical_duration_minutes: e.target.value })} />
            <Input label="Default price" type="number" value={form.default_price} onChange={(e) => setForm({ ...form, default_price: e.target.value })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-secondary-200 px-4 py-3 dark:border-white/10">
              <input type="checkbox" className="h-5 w-5 rounded accent-rose-600" checked={form.requires_blood_products} onChange={(e) => setForm({ ...form, requires_blood_products: e.target.checked })} />
              <span className="text-sm font-bold text-secondary-900 dark:text-secondary-100">Requires blood products</span>
            </label>
            <Input label="Avg blood loss (ml)" type="number" value={form.average_blood_loss_ml} onChange={(e) => setForm({ ...form, average_blood_loss_ml: e.target.value })} />
          </div>
          <Textarea label="Description" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Textarea label="Pre-op instructions" rows={2} value={form.pre_op_instructions} onChange={(e) => setForm({ ...form, pre_op_instructions: e.target.value })} />
          <Textarea label="Post-op instructions" rows={2} value={form.post_op_instructions} onChange={(e) => setForm({ ...form, post_op_instructions: e.target.value })} />
        </div>
      </Modal>
    </div>
  );
}
