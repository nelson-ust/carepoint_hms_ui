import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, RotateCcw, ListChecks, Search, Edit3, Trash2, Banknote, CheckCircle2 } from "lucide-react";
import {
  DxBadge, DxButton, DxGrid, DxKpi, DxPage, DxPageHeader, DxPageLoading, DxPanel,
  DxPopup, DxInput, DxSelect, DxCheckbox, DxTextarea, DxMessage, apiErrorMessage,
  type DxGridColumn,
} from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import { billableServicesApi } from "@/features/billing/api/billable-services.api";
import { dentalApi, type DentalCatalogItem } from "../api/dental.api";

const naira = (n?: string | number | null) => `₦ ${Number(n ?? 0).toLocaleString()}`;

const CATEGORIES = [
  "Preventive", "Restorative", "Endodontics", "Periodontics",
  "Oral Surgery", "Prosthodontics", "Orthodontics", "Diagnostic", "Other",
];

type FormState = {
  code: string; name: string; category: string; default_cost: string;
  tooth_specific: boolean; billable_service_id: string; is_active: boolean; description: string;
};

const emptyForm: FormState = {
  code: "", name: "", category: "", default_cost: "",
  tooth_specific: false, billable_service_id: "", is_active: true, description: "",
};

export function DentalCatalogPage() {
  const toast = useToast();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [modal, setModal] = useState<{ open: boolean; editing: DentalCatalogItem | null }>({ open: false, editing: null });
  const [form, setForm] = useState<FormState>(emptyForm);
  const [confirmDelete, setConfirmDelete] = useState<DentalCatalogItem | null>(null);

  const catalogQ = useQuery({ queryKey: ["dental", "catalog", "all"], queryFn: () => dentalApi.listCatalog({ limit: 500 }) });
  const servicesQ = useQuery({ queryKey: ["billable-services", "for-dental"], queryFn: () => billableServicesApi.list() });

  const items = useMemo(() => catalogQ.data?.items ?? [], [catalogQ.data]);
  const services = servicesQ.data ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((c) => {
      if (category && c.category !== category) return false;
      if (!q) return true;
      return c.name.toLowerCase().includes(q) || (c.code ?? "").toLowerCase().includes(q);
    });
  }, [items, search, category]);

  const stats = useMemo(() => {
    const active = items.filter((c) => c.is_active).length;
    const linked = items.filter((c) => c.billable_service_id != null).length;
    return { total: items.length, active, linked };
  }, [items]);

  const serviceName = (sid?: number | null) => services.find((s) => s.id === sid)?.name;

  const openCreate = () => { setForm(emptyForm); setModal({ open: true, editing: null }); };
  const openEdit = (c: DentalCatalogItem) => {
    setForm({
      code: c.code ?? "", name: c.name, category: c.category ?? "",
      default_cost: c.default_cost != null ? String(c.default_cost) : "",
      tooth_specific: c.tooth_specific, billable_service_id: c.billable_service_id != null ? String(c.billable_service_id) : "",
      is_active: c.is_active, description: c.description ?? "",
    });
    setModal({ open: true, editing: c });
  };

  const save = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {
        code: form.code.trim() || null,
        name: form.name.trim(),
        category: form.category || null,
        default_cost: form.default_cost ? Number(form.default_cost) : 0,
        tooth_specific: form.tooth_specific,
        billable_service_id: form.billable_service_id ? Number(form.billable_service_id) : null,
        is_active: form.is_active,
        description: form.description.trim() || null,
      };
      return modal.editing
        ? dentalApi.updateCatalog(modal.editing.id, body)
        : dentalApi.createCatalog(body);
    },
    onSuccess: () => {
      toast.success(modal.editing ? "Catalogue procedure updated." : "Catalogue procedure added.");
      qc.invalidateQueries({ queryKey: ["dental", "catalog"] });
      setModal({ open: false, editing: null });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: (c: DentalCatalogItem) => dentalApi.deleteCatalog(c.id),
    onSuccess: () => { toast.success("Catalogue procedure removed."); qc.invalidateQueries({ queryKey: ["dental", "catalog"] }); setConfirmDelete(null); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const columns: DxGridColumn<DentalCatalogItem>[] = [
    { key: "name", header: "Procedure", render: (c) => (
      <div className="min-w-0">
        <div className="truncate font-semibold text-[var(--dx-text)]">{c.name}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
          {c.code ? <span className="dx-mono text-[11px] text-[var(--dx-text-muted)]">{c.code}</span> : null}
          {c.tooth_specific ? <DxBadge tone="neutral">Per-tooth</DxBadge> : null}
          {!c.is_active ? <DxBadge tone="warning" dot>Inactive</DxBadge> : null}
        </div>
      </div>
    ) },
    { key: "category", header: "Category", render: (c) => c.category ?? <span className="text-[var(--dx-text-faint)]">--</span> },
    { key: "default_cost", header: "Price", align: "right", accessor: (c) => Number(c.default_cost ?? 0),
      render: (c) => <span className="dx-mono font-semibold text-[var(--dx-text)]">{naira(c.default_cost)}</span> },
    { key: "billable_service_id", header: "Ledger service", render: (c) => (
      c.billable_service_id != null
        ? <span className="inline-flex items-center gap-1.5 text-[var(--dx-text-muted)]"><Banknote className="h-3 w-3" />{serviceName(c.billable_service_id) ?? `#${c.billable_service_id}`}</span>
        : <span className="text-[var(--dx-text-faint)]">Not linked</span>
    ) },
    { key: "actions", header: "", align: "right", render: (c) => (
      <div className="flex items-center justify-end gap-1">
        <DxButton size="sm" leftIcon={<Edit3 className="h-3.5 w-3.5" />} onClick={() => openEdit(c)}>Edit</DxButton>
        <DxButton icon size="sm" variant="outline-danger" title="Remove" onClick={() => setConfirmDelete(c)}><Trash2 className="h-3.5 w-3.5" /></DxButton>
      </div>
    ) },
  ];

  if (catalogQ.isLoading) return <DxPageLoading label="Loading procedure catalogue..." />;

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Dental" }, { label: "Procedure Catalogue" }]}
        title="Procedure Catalogue"
        subtitle="The clinic's dental procedure price list — the menu charted procedures and bills are drawn from."
        actions={
          <>
            <DxButton icon title="Refresh" onClick={() => catalogQ.refetch()} isLoading={catalogQ.isFetching}><RotateCcw /></DxButton>
            <DxButton variant="primary" onClick={openCreate}><Plus /> New procedure</DxButton>
          </>
        }
      />

      <div className="grid grid-cols-3 gap-3">
        <DxKpi label="Procedures" value={stats.total} icon={ListChecks} tone="accent" />
        <DxKpi label="Active" value={stats.active} icon={CheckCircle2} tone="success" />
        <DxKpi label="Ledger-linked" value={stats.linked} icon={Banknote} tone="info" sub="post to accounts" />
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="w-full flex-1">
          <DxInput leftIcon={<Search className="h-3.5 w-3.5" />} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or code…" />
        </div>
        <div className="w-full md:w-52">
          <DxSelect value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category"
            options={[{ value: "", label: "All categories" }, ...CATEGORIES.map((c) => ({ value: c, label: c }))]} />
        </div>
      </div>

      <DxPanel flush>
        <DxGrid<DentalCatalogItem>
          columns={columns}
          data={filtered}
          rowKey={(c) => c.id}
          onRowClick={(c) => openEdit(c)}
          empty={{ icon: ListChecks, title: "No catalogue procedures", description: items.length === 0 ? "Add your first priced procedure." : "No procedures match your filters.",
            action: <DxButton size="sm" variant="primary" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={openCreate}>New procedure</DxButton> }}
        />
      </DxPanel>

      <DxPopup
        isOpen={modal.open}
        onClose={() => setModal({ open: false, editing: null })}
        title={modal.editing ? "Edit procedure" : "New procedure"}
        size="lg"
        footer={
          <>
            <DxButton variant="text" onClick={() => setModal({ open: false, editing: null })}>Cancel</DxButton>
            <DxButton variant="primary" disabled={!form.name.trim()} isLoading={save.isPending} onClick={() => save.mutate()}>
              {modal.editing ? "Save changes" : "Add procedure"}
            </DxButton>
          </>
        }
      >
        <div className="grid gap-3 md:grid-cols-2">
          <DxInput label="Name" required fieldClassName="md:col-span-2" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Composite restoration (1 surface)" />
          <DxInput label="Code" mono value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="e.g. D2391" />
          <DxSelect label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
            placeholder="Select category" options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
          <DxInput label="Default price (₦)" type="number" step="any" mono value={form.default_cost} onChange={(e) => setForm({ ...form, default_cost: e.target.value })} placeholder="0.00" />
          <DxSelect label="Ledger service (optional)" value={form.billable_service_id} onChange={(e) => setForm({ ...form, billable_service_id: e.target.value })}
            hint="Link to a billable service so charges post to the right account."
            options={[{ value: "", label: "— Not linked —" }, ...services.map((s) => ({ value: String(s.id), label: `${s.name} (${s.code})` }))]} />
          <DxTextarea label="Description" fieldClassName="md:col-span-2" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="flex items-center gap-6 md:col-span-2">
            <DxCheckbox label="Tooth-specific" checked={form.tooth_specific} onChange={(e) => setForm({ ...form, tooth_specific: e.target.checked })} />
            <DxCheckbox label="Active" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
          </div>
        </div>
      </DxPopup>

      <DxPopup
        isOpen={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title="Remove procedure"
        size="sm"
        footer={
          <>
            <DxButton variant="text" onClick={() => setConfirmDelete(null)}>Cancel</DxButton>
            <DxButton variant="danger" isLoading={remove.isPending} onClick={() => confirmDelete && remove.mutate(confirmDelete)}>Remove</DxButton>
          </>
        }
      >
        <DxMessage tone="warning">
          {confirmDelete ? <>Remove <strong>{confirmDelete.name}</strong> from the catalogue? Procedures already charted keep their details.</> : null}
        </DxMessage>
      </DxPopup>
    </DxPage>
  );
}
