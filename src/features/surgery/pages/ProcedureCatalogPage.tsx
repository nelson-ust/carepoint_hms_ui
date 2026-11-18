import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ClipboardList, Plus, Trash2, Search, Droplet } from "lucide-react";
import {
  DxPage, DxPageHeader, DxPanel, DxGrid, DxBadge, DxButton, DxPopup, DxInput, DxTextarea, DxCheckbox,
  type DxGridColumn,
} from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/api/api-error";
import { routes } from "@/config/routes";
import { useProcedures, surgeryKeys } from "../hooks/use-surgery";
import { createProcedure, deleteProcedure } from "../api/surgery.api";

type Procedure = {
  id: number; code: string; name: string; cpt_code?: string | null;
  typical_duration_minutes?: number | null; default_price?: number | string | null; requires_blood_products?: boolean;
};

export function ProcedureCatalogPage() {
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

  const items = (procedures.data?.items ?? []) as Procedure[];

  const columns: DxGridColumn<Procedure>[] = [
    { key: "code", header: "Code", render: (p) => <span className="dx-mono text-[12px] font-semibold text-[var(--dx-text-muted)]">{p.code}</span> },
    { key: "name", header: "Name", render: (p) => <span className="text-[13px] font-semibold text-[var(--dx-text)]">{p.name}</span> },
    { key: "cpt_code", header: "CPT", render: (p) => <span className="text-[13px] text-[var(--dx-text-muted)]">{p.cpt_code || "—"}</span> },
    { key: "duration", header: "Duration", render: (p) => <span className="text-[13px] text-[var(--dx-text-muted)]">{p.typical_duration_minutes ? `${p.typical_duration_minutes} min` : "—"}</span> },
    { key: "price", header: "Price", align: "right", render: (p) => <span className="dx-mono text-[13px] text-[var(--dx-text)]">{p.default_price != null ? Number(p.default_price).toLocaleString() : "—"}</span> },
    { key: "blood", header: "Blood", align: "center", render: (p) => p.requires_blood_products ? <DxBadge tone="danger"><Droplet className="mr-1 inline h-3 w-3" />Yes</DxBadge> : <span className="text-[var(--dx-text-faint)]">—</span> },
    { key: "actions", header: "", align: "right", render: (p) => <DxButton icon size="sm" variant="outline-danger" title="Delete" onClick={() => remove(p.id)}><Trash2 /></DxButton> },
  ];

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Surgery", to: routes.surgery }, { label: "Procedures" }]}
        title="Surgical Procedure Catalog"
        subtitle="The catalog of procedures that can be booked, with default pricing and instructions."
        actions={<DxButton variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>New procedure</DxButton>}
      />

      <div className="max-w-sm">
        <DxInput leftIcon={<Search className="h-3.5 w-3.5" />} placeholder="Search procedures…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <DxPanel title="Procedures" icon={<ClipboardList className="h-4 w-4" />} flush>
        <DxGrid<Procedure>
          columns={columns}
          data={items}
          rowKey={(p) => p.id}
          isLoading={procedures.isLoading}
          empty={{ icon: ClipboardList, title: "No procedures", description: "Add procedures to the catalog to start booking cases." }}
        />
      </DxPanel>

      <DxPopup isOpen={open} onClose={() => setOpen(false)} title="New surgical procedure" size="lg" locked={busy}
        footer={<><DxButton onClick={() => setOpen(false)} disabled={busy}>Cancel</DxButton><DxButton variant="primary" onClick={create} isLoading={busy}>Create</DxButton></>}>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <DxInput label="Code" mono value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="APPEND" />
            <DxInput label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Appendectomy" />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <DxInput label="CPT code" value={form.cpt_code} onChange={(e) => setForm({ ...form, cpt_code: e.target.value })} />
            <DxInput label="Duration (min)" type="number" value={form.typical_duration_minutes} onChange={(e) => setForm({ ...form, typical_duration_minutes: e.target.value })} />
            <DxInput label="Default price" type="number" value={form.default_price} onChange={(e) => setForm({ ...form, default_price: e.target.value })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-end pb-1"><DxCheckbox label="Requires blood products" checked={form.requires_blood_products} onChange={(e) => setForm({ ...form, requires_blood_products: e.target.checked })} /></div>
            <DxInput label="Avg blood loss (ml)" type="number" value={form.average_blood_loss_ml} onChange={(e) => setForm({ ...form, average_blood_loss_ml: e.target.value })} />
          </div>
          <DxTextarea label="Description" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <DxTextarea label="Pre-op instructions" rows={2} value={form.pre_op_instructions} onChange={(e) => setForm({ ...form, pre_op_instructions: e.target.value })} />
          <DxTextarea label="Post-op instructions" rows={2} value={form.post_op_instructions} onChange={(e) => setForm({ ...form, post_op_instructions: e.target.value })} />
        </div>
      </DxPopup>
    </DxPage>
  );
}
