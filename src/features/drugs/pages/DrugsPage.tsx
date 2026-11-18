import { useNavigate } from "react-router-dom";
import { routes } from "@/config/routes";
import { useEffect, useMemo, useState } from "react";
import {
  Edit3,
  Hash,
  Layers,
  Pill,
  Plus,
  RotateCcw,
  Search,
  ShieldAlert,
  Tag,
  DollarSign,
  PackagePlus,
  Trash2,
  Upload,
} from "lucide-react";
import {
  DxPage, DxPageHeader, DxPanel, DxKpi, DxGrid, DxTabs, DxBadge, DxButton, DxInput, DxSelect, DxTextarea, DxCheckbox, DxPopup, DxMessage,
  type DxGridColumn,
} from "@/components/dx";
import {
  bulkUploadDrugCategories,
  createDrug,
  createDrugCategory,
  deleteDrug,
  deleteDrugCategory,
  downloadDrugCategoryTemplate,
  DOSAGE_FORMS,
  listDrugCategories,
  listDrugs,
  updateDrug,
  updateDrugCategory,
} from "../api/drugs.api";
import { DrugBulkUploadModal } from "../components/DrugBulkUploadModal";
import type {
  CreateDrugCategoryPayload,
  CreateDrugPayload,
  Drug,
  DrugCategory,
  UpdateDrugCategoryPayload,
  UpdateDrugPayload,
} from "../api/drugs.api";

type Tab = "DRUGS" | "CATEGORIES";

type DrugForm = {
  name: string;
  generic_name: string;
  brand_name: string;
  strength: string;
  dosage_form: string;
  pack_size: string;
  sku: string;
  drug_category_id: string;
  unit_price: string;
  reorder_level: string;
  is_controlled: boolean;
};

const emptyDrugForm: DrugForm = {
  name: "",
  generic_name: "",
  brand_name: "",
  strength: "",
  dosage_form: DOSAGE_FORMS[0],
  pack_size: "",
  sku: "",
  drug_category_id: "",
  unit_price: "",
  reorder_level: "",
  is_controlled: false,
};

type CategoryForm = {
  name: string;
  code: string;
  description: string;
};

const emptyCategoryForm: CategoryForm = { name: "", code: "", description: "" };

function priceFmt(value?: number) {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 2 }).format(value);
}

export function DrugsPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("DRUGS");
  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [categories, setCategories] = useState<DrugCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(null);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const [drugModal, setDrugModal] = useState<{ open: boolean; editing: Drug | null }>({ open: false, editing: null });
  const [drugForm, setDrugForm] = useState<DrugForm>(emptyDrugForm);
  const [drugSaveError, setDrugSaveError] = useState<string | null>(null);
  const [drugSaving, setDrugSaving] = useState(false);

  const [catModal, setCatModal] = useState<{ open: boolean; editing: DrugCategory | null }>({ open: false, editing: null });
  const [catForm, setCatForm] = useState<CategoryForm>(emptyCategoryForm);
  const [catSaveError, setCatSaveError] = useState<string | null>(null);
  const [catSaving, setCatSaving] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<{ kind: "drug"; entity: Drug } | { kind: "cat"; entity: DrugCategory } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  const showFeedback = (tone: "success" | "error", message: string) => {
    setFeedback({ tone, message });
    window.setTimeout(() => setFeedback(null), 3500);
  };

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [drugsRes, catsRes] = await Promise.all([
        listDrugs({ skip: 0, limit: 500 }),
        listDrugCategories({ skip: 0, limit: 200 }),
      ]);
      setDrugs(drugsRes.items ?? []);
      setCategories(catsRes.items ?? []);
    } catch (err: any) {
      console.error("Failed to load drugs", err);
      setError(err?.response?.data?.message || "Unable to load drugs catalogue.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filteredDrugs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return drugs.filter((d) => {
      if (categoryFilter && String(d.drug_category_id ?? "") !== categoryFilter) return false;
      if (!q) return true;
      return (
        d.name?.toLowerCase().includes(q) ||
        d.generic_name?.toLowerCase().includes(q) ||
        d.brand_name?.toLowerCase().includes(q) ||
        d.sku?.toLowerCase().includes(q) ||
        d.strength?.toLowerCase().includes(q)
      );
    });
  }, [drugs, search, categoryFilter]);

  const filteredCategories = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter(
      (c) => c.name?.toLowerCase().includes(q) || c.code?.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q),
    );
  }, [categories, search]);

  const stats = useMemo(() => {
    const total = drugs.length;
    const controlled = drugs.filter((d) => d.is_controlled).length;
    const priced = drugs.filter((d) => d.unit_price != null && d.unit_price > 0).length;
    return { total, controlled, priced, categoryCount: categories.length };
  }, [drugs, categories]);

  const categoryName = (id?: number) => (id != null ? categories.find((c) => c.id === id)?.name : undefined);

  // ----- Drug modal -----
  const openCreateDrug = () => {
    setDrugModal({ open: true, editing: null });
    setDrugForm({
      ...emptyDrugForm,
      drug_category_id: categories.length > 0 && categoryFilter ? categoryFilter : categories[0] ? String(categories[0].id) : "",
    });
    setDrugSaveError(null);
  };
  const openEditDrug = (d: Drug) => {
    setDrugModal({ open: true, editing: d });
    setDrugForm({
      name: d.name ?? "",
      generic_name: d.generic_name ?? "",
      brand_name: d.brand_name ?? "",
      strength: d.strength ?? "",
      dosage_form: d.dosage_form ?? DOSAGE_FORMS[0],
      pack_size: d.pack_size ?? "",
      sku: d.sku ?? "",
      drug_category_id: d.drug_category_id != null ? String(d.drug_category_id) : "",
      unit_price: d.unit_price != null ? String(d.unit_price) : "",
      reorder_level: d.reorder_level != null ? String(d.reorder_level) : "",
      is_controlled: !!d.is_controlled,
    });
    setDrugSaveError(null);
  };
  const closeDrugModal = () => {
    if (drugSaving) return;
    setDrugModal({ open: false, editing: null });
  };
  const handleSaveDrug = async () => {
    if (!drugForm.name.trim()) {
      setDrugSaveError("Drug name is required.");
      return;
    }
    setDrugSaving(true);
    setDrugSaveError(null);
    try {
      const payload: CreateDrugPayload = {
        name: drugForm.name.trim(),
        generic_name: drugForm.generic_name.trim() || undefined,
        brand_name: drugForm.brand_name.trim() || undefined,
        strength: drugForm.strength.trim() || undefined,
        dosage_form: drugForm.dosage_form || undefined,
        pack_size: drugForm.pack_size.trim() || undefined,
        sku: drugForm.sku.trim() || undefined,
        drug_category_id: drugForm.drug_category_id ? Number(drugForm.drug_category_id) : undefined,
        unit_price: drugForm.unit_price ? Number(drugForm.unit_price) : undefined,
        reorder_level: drugForm.reorder_level ? Number(drugForm.reorder_level) : undefined,
        is_controlled: drugForm.is_controlled,
      };
      const result = drugModal.editing ? await updateDrug(drugModal.editing.id, payload as UpdateDrugPayload) : await createDrug(payload);
      setDrugs((prev) => {
        const others = prev.filter((d) => d.id !== result.drug.id);
        return [result.drug, ...others].sort((a, b) => a.name.localeCompare(b.name));
      });
      showFeedback("success", result.message || (drugModal.editing ? "Drug updated." : "Drug added."));
      setDrugModal({ open: false, editing: null });
    } catch (err: any) {
      setDrugSaveError(err?.response?.data?.message || "Failed to save drug.");
    } finally {
      setDrugSaving(false);
    }
  };

  // ----- Category modal -----
  const openCreateCategory = () => {
    setCatModal({ open: true, editing: null });
    setCatForm(emptyCategoryForm);
    setCatSaveError(null);
  };
  const openEditCategory = (c: DrugCategory) => {
    setCatModal({ open: true, editing: c });
    setCatForm({ name: c.name ?? "", code: c.code ?? "", description: c.description ?? "" });
    setCatSaveError(null);
  };
  const closeCatModal = () => {
    if (catSaving) return;
    setCatModal({ open: false, editing: null });
  };
  const handleSaveCategory = async () => {
    if (!catForm.name.trim() || !catForm.code.trim()) {
      setCatSaveError("Name and code are required.");
      return;
    }
    setCatSaving(true);
    setCatSaveError(null);
    try {
      const payload: CreateDrugCategoryPayload = {
        name: catForm.name.trim(),
        code: catForm.code.trim().toUpperCase(),
        description: catForm.description.trim() || undefined,
      };
      const result = catModal.editing ? await updateDrugCategory(catModal.editing.id, payload as UpdateDrugCategoryPayload) : await createDrugCategory(payload);
      setCategories((prev) => {
        const others = prev.filter((c) => c.id !== result.category.id);
        return [result.category, ...others].sort((a, b) => a.name.localeCompare(b.name));
      });
      showFeedback("success", result.message || (catModal.editing ? "Category updated." : "Category added."));
      setCatModal({ open: false, editing: null });
    } catch (err: any) {
      setCatSaveError(err?.response?.data?.message || "Failed to save category.");
    } finally {
      setCatSaving(false);
    }
  };

  // ----- Delete -----
  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      if (confirmDelete.kind === "drug") {
        await deleteDrug(confirmDelete.entity.id);
        setDrugs((prev) => prev.filter((d) => d.id !== confirmDelete.entity.id));
      } else {
        await deleteDrugCategory(confirmDelete.entity.id);
        setCategories((prev) => prev.filter((c) => c.id !== confirmDelete.entity.id));
      }
      showFeedback("success", "Deleted.");
      setConfirmDelete(null);
    } catch (err: any) {
      showFeedback("error", err?.response?.data?.message || "Failed to delete.");
    } finally {
      setDeleting(false);
    }
  };

  const drugColumns: DxGridColumn<Drug>[] = [
    {
      key: "drug", header: "Drug", render: (d) => (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--dx-accent-soft)] text-[var(--dx-accent)]"><Pill className="h-5 w-5" /></div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[13px] font-semibold text-[var(--dx-text)]">{d.name}</p>
              {d.is_controlled ? <DxBadge tone="danger"><ShieldAlert className="mr-1 inline h-2.5 w-2.5" />Controlled</DxBadge> : null}
            </div>
            <p className="text-[11px] font-medium text-[var(--dx-text-muted)]">{d.generic_name || d.brand_name || "—"}</p>
            {d.sku ? <span className="mt-1 inline-flex items-center gap-1 rounded-md bg-[var(--dx-surface-sunken)] px-2 py-0.5 dx-mono text-[10px] font-semibold text-[var(--dx-text-muted)]"><Hash className="h-2.5 w-2.5" />{d.sku}</span> : null}
          </div>
        </div>
      ),
    },
    {
      key: "strength", header: "Strength / Form", render: (d) => (
        <div>
          <div className="text-[12px] font-semibold text-[var(--dx-text)]">{d.strength || "—"}</div>
          <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--dx-text-muted)]">{d.dosage_form || "—"} · {d.pack_size || "—"}</div>
        </div>
      ),
    },
    { key: "category", header: "Category", render: (d) => d.drug_category_id != null ? <DxBadge tone="success"><Tag className="mr-1 inline h-3 w-3" />{d.category?.name ?? categoryName(d.drug_category_id) ?? `Cat #${d.drug_category_id}`}</DxBadge> : <span className="text-[11px] text-[var(--dx-text-muted)]">—</span> },
    {
      key: "price", header: "Price", render: (d) => (
        <div>
          <span className="dx-mono text-[13px] font-semibold text-[var(--dx-text)]">{priceFmt(d.unit_price)}</span>
          {d.reorder_level != null ? <p className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--dx-text-muted)]">Reorder @ {d.reorder_level}</p> : null}
        </div>
      ),
    },
    { key: "status", header: "Status", render: () => <DxBadge tone="success">Active</DxBadge> },
    {
      key: "actions", header: "", align: "right", render: (d) => (
        <div className="flex items-center justify-end gap-2">
          <DxButton size="sm" leftIcon={<PackagePlus className="h-3.5 w-3.5" />} title="Receive this drug into a store as stock" onClick={() => navigate(`${routes.inventoryItems}?drug_id=${d.id}`)}>Receive stock</DxButton>
          <DxButton size="sm" variant="text" leftIcon={<Edit3 className="h-3.5 w-3.5" />} onClick={() => openEditDrug(d)}>Edit</DxButton>
          <DxButton icon size="sm" variant="outline-danger" title="Delete" onClick={() => setConfirmDelete({ kind: "drug", entity: d })}><Trash2 /></DxButton>
        </div>
      ),
    },
  ];

  const catColumns: DxGridColumn<DrugCategory>[] = [
    {
      key: "category", header: "Category", render: (c) => (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ background: "var(--dx-success-soft)", color: "var(--dx-success)" }}><Tag className="h-5 w-5" /></div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-[var(--dx-text)]">{c.name}</p>
            {c.description ? <p className="mt-0.5 max-w-md truncate text-[11px] text-[var(--dx-text-muted)]">{c.description}</p> : null}
          </div>
        </div>
      ),
    },
    { key: "code", header: "Code", render: (c) => <span className="inline-flex items-center gap-1 rounded-md bg-[var(--dx-surface-sunken)] px-2.5 py-1 dx-mono text-[11px] font-semibold text-[var(--dx-text-muted)]"><Hash className="h-2.5 w-2.5" />{c.code}</span> },
    { key: "drugs", header: "Drugs", render: (c) => <DxBadge tone="accent"><Pill className="mr-1 inline h-3 w-3" />{drugs.filter((d) => d.drug_category_id === c.id).length}</DxBadge> },
    {
      key: "actions", header: "", align: "right", render: (c) => (
        <div className="flex items-center justify-end gap-2">
          <DxButton size="sm" variant="text" leftIcon={<Edit3 className="h-3.5 w-3.5" />} onClick={() => openEditCategory(c)}>Edit</DxButton>
          <DxButton icon size="sm" variant="outline-danger" title="Delete" onClick={() => setConfirmDelete({ kind: "cat", entity: c })}><Trash2 /></DxButton>
        </div>
      ),
    },
  ];

  return (
    <DxPage>
      <DrugBulkUploadModal
        isOpen={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onImported={() => {
          load();
          showFeedback("success", tab === "DRUGS" ? "Drugs imported successfully." : "Categories imported successfully.");
        }}
        {...(tab === "CATEGORIES"
          ? {
              title: "Bulk Upload Drug Categories",
              subtitle: "Import Many Categories From Excel",
              description: "Category Name is required and must be unique; Code is optional. Fill one row per category, then upload it below.",
              importLabel: "Import Categories",
              download: downloadDrugCategoryTemplate,
              upload: bulkUploadDrugCategories,
            }
          : {})}
      />

      <DxPageHeader
        crumbs={[{ label: "Pharmacy" }, { label: "Drugs Catalogue" }]}
        title="Drugs Catalogue"
        subtitle="Master list of every medication on formulary, organised by therapeutic category."
        actions={
          <>
            <DxButton icon title="Refresh" onClick={load} isLoading={isLoading}><RotateCcw /></DxButton>
            <DxButton leftIcon={<Upload className="h-4 w-4" />} onClick={() => setBulkOpen(true)} title={tab === "DRUGS" ? "Bulk upload drugs from Excel" : "Bulk upload drug categories from Excel"}>Bulk upload</DxButton>
            <DxButton variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={tab === "DRUGS" ? openCreateDrug : openCreateCategory}>{tab === "DRUGS" ? "New drug" : "New category"}</DxButton>
          </>
        }
      />

      {feedback ? <DxMessage tone={feedback.tone === "success" ? "success" : "danger"}>{feedback.message}</DxMessage> : null}

      <div className="grid gap-4 md:grid-cols-4">
        <DxKpi icon={Pill} label="Drugs" value={stats.total} tone="accent" />
        <DxKpi icon={Layers} label="Categories" value={stats.categoryCount} tone="success" />
        <DxKpi icon={ShieldAlert} label="Controlled" value={stats.controlled} tone="danger" />
        <DxKpi icon={DollarSign} label="Priced" value={stats.priced} tone="warning" />
      </div>

      <DxTabs
        items={[
          { key: "DRUGS", label: `Drugs (${drugs.length})` },
          { key: "CATEGORIES", label: `Categories (${categories.length})` },
        ]}
        value={tab}
        onChange={setTab}
      />

      <div className="flex flex-col gap-3 md:flex-row">
        <div className="w-full flex-1">
          <DxInput leftIcon={<Search className="h-3.5 w-3.5" />} value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tab === "DRUGS" ? "Search by name, generic, brand, SKU…" : "Search categories…"} />
        </div>
        {tab === "DRUGS" ? (
          <div className="w-full md:w-60">
            <DxSelect value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} aria-label="Filter by category"
              options={[{ value: "", label: "All Categories" }, ...categories.map((c) => ({ value: String(c.id), label: c.name }))]} />
          </div>
        ) : null}
      </div>

      {error ? (
        <DxMessage tone="danger" action={<DxButton size="sm" onClick={load}>Retry</DxButton>}>{error}</DxMessage>
      ) : (
        <DxPanel flush>
          {tab === "DRUGS" ? (
            <DxGrid<Drug>
              columns={drugColumns}
              data={filteredDrugs}
              rowKey={(d) => d.id}
              isLoading={isLoading}
              empty={{ icon: Pill, title: "No Drugs", description: drugs.length === 0 ? "Add your first drug to the catalogue." : "No drugs match your filters.", action: <DxButton size="sm" variant="primary" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={openCreateDrug}>Add drug</DxButton> }}
            />
          ) : (
            <DxGrid<DrugCategory>
              columns={catColumns}
              data={filteredCategories}
              rowKey={(c) => c.id}
              isLoading={isLoading}
              empty={{ icon: Layers, title: "No Categories", description: categories.length === 0 ? "Create your first therapeutic category." : "No categories match your search.", action: <DxButton size="sm" variant="primary" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={openCreateCategory}>Add category</DxButton> }}
            />
          )}
        </DxPanel>
      )}

      {/* Drug modal */}
      <DxPopup
        isOpen={drugModal.open}
        onClose={closeDrugModal}
        title={drugModal.editing ? "Edit Drug" : "New Drug"}
        size="xl"
        locked={drugSaving}
        footer={<><DxButton onClick={closeDrugModal} disabled={drugSaving}>Cancel</DxButton><DxButton variant="primary" onClick={handleSaveDrug} isLoading={drugSaving}>{drugModal.editing ? "Save changes" : "Add drug"}</DxButton></>}
      >
        <div className="space-y-4">
          {drugSaveError ? <DxMessage tone="danger">{drugSaveError}</DxMessage> : null}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <DxInput label="Name" required value={drugForm.name} onChange={(e) => setDrugForm({ ...drugForm, name: e.target.value })} placeholder="Paracetamol 500mg" />
            <DxInput label="Generic Name" value={drugForm.generic_name} onChange={(e) => setDrugForm({ ...drugForm, generic_name: e.target.value })} placeholder="Acetaminophen" />
            <DxInput label="Brand Name" value={drugForm.brand_name} onChange={(e) => setDrugForm({ ...drugForm, brand_name: e.target.value })} placeholder="Panadol" />
            <DxInput label="Strength" value={drugForm.strength} onChange={(e) => setDrugForm({ ...drugForm, strength: e.target.value })} placeholder="500mg" />
            <DxSelect label="Dosage Form" value={drugForm.dosage_form} onChange={(e) => setDrugForm({ ...drugForm, dosage_form: e.target.value })} options={DOSAGE_FORMS.map((f) => ({ value: f, label: f }))} />
            <DxInput label="Pack Size" value={drugForm.pack_size} onChange={(e) => setDrugForm({ ...drugForm, pack_size: e.target.value })} placeholder="10 tabs/blister" />
            <DxInput label="SKU" mono value={drugForm.sku} onChange={(e) => setDrugForm({ ...drugForm, sku: e.target.value.toUpperCase() })} placeholder="DRG-PCM-500" />
            <DxSelect label="Category" value={drugForm.drug_category_id} onChange={(e) => setDrugForm({ ...drugForm, drug_category_id: e.target.value })}
              options={[{ value: "", label: "— Uncategorised —" }, ...categories.map((c) => ({ value: String(c.id), label: c.name }))]} />
            <DxInput label="Unit Price (NGN)" type="number" value={drugForm.unit_price} onChange={(e) => setDrugForm({ ...drugForm, unit_price: e.target.value })} placeholder="500" />
            <DxInput label="Reorder Level" type="number" value={drugForm.reorder_level} onChange={(e) => setDrugForm({ ...drugForm, reorder_level: e.target.value })} placeholder="50" />
          </div>
          <div className="rounded-md border p-4" style={drugForm.is_controlled ? { borderColor: "var(--dx-danger)", background: "var(--dx-danger-soft)" } : { borderColor: "var(--dx-border)", background: "var(--dx-surface-sunken)" }}>
            <DxCheckbox
              label="Controlled substance"
              description="Requires extra dispensing checks and audit trail"
              checked={drugForm.is_controlled}
              onChange={(e) => setDrugForm({ ...drugForm, is_controlled: e.target.checked })}
            />
          </div>
        </div>
      </DxPopup>

      {/* Category modal */}
      <DxPopup
        isOpen={catModal.open}
        onClose={closeCatModal}
        title={catModal.editing ? "Edit Category" : "New Category"}
        size="md"
        locked={catSaving}
        footer={<><DxButton onClick={closeCatModal} disabled={catSaving}>Cancel</DxButton><DxButton variant="primary" onClick={handleSaveCategory} isLoading={catSaving}>{catModal.editing ? "Save changes" : "Add category"}</DxButton></>}
      >
        <div className="space-y-4">
          {catSaveError ? <DxMessage tone="danger">{catSaveError}</DxMessage> : null}
          <DxInput label="Name" required value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} placeholder="Antibiotics" />
          <DxInput label="Code" required mono value={catForm.code} onChange={(e) => setCatForm({ ...catForm, code: e.target.value.toUpperCase() })} placeholder="ABX" />
          <DxTextarea label="Description" rows={3} value={catForm.description} onChange={(e) => setCatForm({ ...catForm, description: e.target.value })} placeholder="Notes for clinicians and pharmacists…" />
        </div>
      </DxPopup>

      {/* Delete confirm */}
      <DxPopup
        isOpen={confirmDelete !== null}
        onClose={() => !deleting && setConfirmDelete(null)}
        title={confirmDelete?.kind === "drug" ? "Delete Drug" : "Delete Category"}
        size="sm"
        locked={deleting}
        footer={<><DxButton onClick={() => setConfirmDelete(null)} disabled={deleting}>Cancel</DxButton><DxButton variant="danger" onClick={handleDelete} isLoading={deleting} leftIcon={<Trash2 className="h-4 w-4" />}>Delete</DxButton></>}
      >
        <DxMessage tone="danger">
          {confirmDelete ? (
            <>
              Are you sure you want to delete <strong>{confirmDelete.entity.name}</strong>
              {"code" in confirmDelete.entity && confirmDelete.entity.code ? <span className="dx-mono"> ({confirmDelete.entity.code})</span> : null}?
            </>
          ) : null}
        </DxMessage>
      </DxPopup>
    </DxPage>
  );
}
