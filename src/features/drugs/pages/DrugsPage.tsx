import { PageHeader } from "@/components/layout/PageHeader";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  DollarSign,
  Edit3,
  Hash,
  Layers,
  Pill,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import {
  createDrug,
  createDrugCategory,
  deleteDrug,
  deleteDrugCategory,
  DOSAGE_FORMS,
  listDrugCategories,
  listDrugs,
  updateDrug,
  updateDrugCategory,
} from "../api/drugs.api";
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
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(value);
}

export function DrugsPage() {
  const [tab, setTab] = useState<Tab>("DRUGS");
  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [categories, setCategories] = useState<DrugCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<
    { tone: "success" | "error"; message: string } | null
  >(null);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  // Drug modal
  const [drugModal, setDrugModal] = useState<{ open: boolean; editing: Drug | null }>({
    open: false,
    editing: null,
  });
  const [drugForm, setDrugForm] = useState<DrugForm>(emptyDrugForm);
  const [drugSaveError, setDrugSaveError] = useState<string | null>(null);
  const [drugSaving, setDrugSaving] = useState(false);

  // Category modal
  const [catModal, setCatModal] = useState<{ open: boolean; editing: DrugCategory | null }>({
    open: false,
    editing: null,
  });
  const [catForm, setCatForm] = useState<CategoryForm>(emptyCategoryForm);
  const [catSaveError, setCatSaveError] = useState<string | null>(null);
  const [catSaving, setCatSaving] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<
    { kind: "drug"; entity: Drug } | { kind: "cat"; entity: DrugCategory } | null
  >(null);
  const [deleting, setDeleting] = useState(false);

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
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.code?.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q),
    );
  }, [categories, search]);

  const stats = useMemo(() => {
    const total = drugs.length;
    const controlled = drugs.filter((d) => d.is_controlled).length;
    const priced = drugs.filter((d) => d.unit_price != null && d.unit_price > 0).length;
    return { total, controlled, priced, categoryCount: categories.length };
  }, [drugs, categories]);

  const categoryName = (id?: number) =>
    id != null ? categories.find((c) => c.id === id)?.name : undefined;

  // ----- Drug modal -----
  const openCreateDrug = () => {
    setDrugModal({ open: true, editing: null });
    setDrugForm({
      ...emptyDrugForm,
      drug_category_id:
        categories.length > 0 && categoryFilter
          ? categoryFilter
          : categories[0]
            ? String(categories[0].id)
            : "",
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
        drug_category_id: drugForm.drug_category_id
          ? Number(drugForm.drug_category_id)
          : undefined,
        unit_price: drugForm.unit_price ? Number(drugForm.unit_price) : undefined,
        reorder_level: drugForm.reorder_level ? Number(drugForm.reorder_level) : undefined,
        is_controlled: drugForm.is_controlled,
      };
      const result = drugModal.editing
        ? await updateDrug(drugModal.editing.id, payload as UpdateDrugPayload)
        : await createDrug(payload);
      setDrugs((prev) => {
        const others = prev.filter((d) => d.id !== result.drug.id);
        return [result.drug, ...others].sort((a, b) => a.name.localeCompare(b.name));
      });
      showFeedback(
        "success",
        result.message || (drugModal.editing ? "Drug updated." : "Drug added."),
      );
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
    setCatForm({
      name: c.name ?? "",
      code: c.code ?? "",
      description: c.description ?? "",
    });
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
      const result = catModal.editing
        ? await updateDrugCategory(catModal.editing.id, payload as UpdateDrugCategoryPayload)
        : await createDrugCategory(payload);
      setCategories((prev) => {
        const others = prev.filter((c) => c.id !== result.category.id);
        return [result.category, ...others].sort((a, b) => a.name.localeCompare(b.name));
      });
      showFeedback(
        "success",
        result.message || (catModal.editing ? "Category updated." : "Category added."),
      );
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

  return (
    <div className="space-y-10 animate-fade-in pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <PageHeader
          title="Drugs Catalogue"
          description="Master list of every medication on formulary, organised by therapeutic category."
        />
        <div className="flex items-center gap-3">
          <button
            onClick={load}
            className="btn-secondary p-4 rounded-2xl bg-white/80 border-secondary-100 hover:rotate-180 transition-transform duration-500"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={tab === "DRUGS" ? openCreateDrug : openCreateCategory}
            className="btn-primary gap-3 py-3 px-8 shadow-xl shadow-primary-500/20"
          >
            <Plus className="h-5 w-5" />
            <span className="font-bold">
              {tab === "DRUGS" ? "New Drug" : "New Category"}
            </span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`px-6 py-4 rounded-2xl border flex items-center gap-3 shadow-lg animate-fade-in ${
            feedback.tone === "success"
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

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard icon={Pill} label="Drugs" value={stats.total} tone="primary" />
        <StatCard icon={Layers} label="Categories" value={stats.categoryCount} tone="emerald" />
        <StatCard icon={ShieldAlert} label="Controlled" value={stats.controlled} tone="rose" />
        <StatCard icon={DollarSign} label="Priced" value={stats.priced} tone="amber" />
      </div>

      {/* Tabs */}
      <div className="glass-card rounded-[2rem] p-3 flex flex-col gap-3 bg-white/40 backdrop-blur-md">
        <div className="flex gap-2">
          {(["DRUGS", "CATEGORIES"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${
                tab === t
                  ? "bg-slate-900 text-white shadow-md"
                  : "bg-white/60 text-secondary-600 hover:bg-white"
              }`}
            >
              {t === "DRUGS" ? <Pill className="h-3 w-3" /> : <Layers className="h-3 w-3" />}
              {t === "DRUGS" ? "Drugs" : "Categories"}
              <span
                className={`px-1.5 py-0.5 rounded text-[9px] font-mono ${
                  tab === t ? "bg-white/20" : "bg-secondary-100 text-secondary-500"
                }`}
              >
                {t === "DRUGS" ? drugs.length : categories.length}
              </span>
            </button>
          ))}
        </div>
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tab === "DRUGS" ? "Search by name, generic, brand, SKU..." : "Search categories..."}
              className="w-full bg-white/50 border-none rounded-2xl pl-12 pr-6 py-3 text-sm focus:ring-2 focus:ring-primary-500/50 transition-all font-medium"
            />
          </div>
          {tab === "DRUGS" && (
            <div className="relative">
              <Tag className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary-400 pointer-events-none" />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="appearance-none bg-white/80 border border-secondary-100 rounded-2xl pl-11 pr-8 py-3 text-xs font-bold uppercase tracking-widest text-secondary-700 focus:ring-2 focus:ring-primary-500/40"
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="glass-card rounded-[2rem] h-20 animate-pulse bg-white/40"
            />
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
      ) : tab === "DRUGS" ? (
        <DrugsTable
          drugs={filteredDrugs}
          totalCount={drugs.length}
          categoryName={categoryName}
          onEdit={openEditDrug}
          onDelete={(d) => setConfirmDelete({ kind: "drug", entity: d })}
          onCreate={openCreateDrug}
        />
      ) : (
        <CategoriesTable
          categories={filteredCategories}
          totalCount={categories.length}
          drugCount={(catId) => drugs.filter((d) => d.drug_category_id === catId).length}
          onEdit={openEditCategory}
          onDelete={(c) => setConfirmDelete({ kind: "cat", entity: c })}
          onCreate={openCreateCategory}
        />
      )}

      {/* Drug modal */}
      {drugModal.open && (
        <Modal
          title={drugModal.editing ? "Edit Drug" : "New Drug"}
          subtitle="Configure A Medication On Formulary"
          onClose={closeDrugModal}
          icon={drugModal.editing ? Edit3 : Plus}
        >
          {drugSaveError && (
            <div className="mb-5 p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl flex items-center gap-3">
              <AlertCircle className="h-5 w-5" />
              <span className="text-sm font-bold">{drugSaveError}</span>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field
              label="Name *"
              value={drugForm.name}
              onChange={(v) => setDrugForm({ ...drugForm, name: v })}
              placeholder="Paracetamol 500mg"
            />
            <Field
              label="Generic Name"
              value={drugForm.generic_name}
              onChange={(v) => setDrugForm({ ...drugForm, generic_name: v })}
              placeholder="Acetaminophen"
            />
            <Field
              label="Brand Name"
              value={drugForm.brand_name}
              onChange={(v) => setDrugForm({ ...drugForm, brand_name: v })}
              placeholder="Panadol"
            />
            <Field
              label="Strength"
              value={drugForm.strength}
              onChange={(v) => setDrugForm({ ...drugForm, strength: v })}
              placeholder="500mg"
            />
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500">
                Dosage Form
              </label>
              <select
                value={drugForm.dosage_form}
                onChange={(e) => setDrugForm({ ...drugForm, dosage_form: e.target.value })}
                className="input-field h-12 bg-secondary-50 border-secondary-100 w-full"
              >
                {DOSAGE_FORMS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
            <Field
              label="Pack Size"
              value={drugForm.pack_size}
              onChange={(v) => setDrugForm({ ...drugForm, pack_size: v })}
              placeholder="10 tabs/blister"
            />
            <Field
              label="SKU"
              value={drugForm.sku}
              onChange={(v) => setDrugForm({ ...drugForm, sku: v.toUpperCase() })}
              placeholder="DRG-PCM-500"
              mono
            />
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500">
                Category
              </label>
              <select
                value={drugForm.drug_category_id}
                onChange={(e) =>
                  setDrugForm({ ...drugForm, drug_category_id: e.target.value })
                }
                className="input-field h-12 bg-secondary-50 border-secondary-100 w-full"
              >
                <option value="">— Uncategorised —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <Field
              label="Unit Price (NGN)"
              value={drugForm.unit_price}
              onChange={(v) => setDrugForm({ ...drugForm, unit_price: v })}
              placeholder="500"
              type="number"
            />
            <Field
              label="Reorder Level"
              value={drugForm.reorder_level}
              onChange={(v) => setDrugForm({ ...drugForm, reorder_level: v })}
              placeholder="50"
              type="number"
            />
            <div className="md:col-span-2">
              <button
                type="button"
                onClick={() =>
                  setDrugForm({ ...drugForm, is_controlled: !drugForm.is_controlled })
                }
                className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${
                  drugForm.is_controlled
                    ? "bg-rose-50 border-rose-200 text-rose-700"
                    : "bg-secondary-50 border-secondary-100 text-secondary-500"
                }`}
              >
                <div className="text-left flex items-center gap-3">
                  <ShieldAlert className="h-5 w-5" />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest">
                      Controlled Substance
                    </p>
                    <p className="text-[10px] font-bold opacity-70 mt-0.5">
                      Requires extra dispensing checks and audit trail
                    </p>
                  </div>
                </div>
                <div
                  className={`h-6 w-12 rounded-full p-0.5 transition-all ${
                    drugForm.is_controlled ? "bg-rose-500" : "bg-secondary-200"
                  }`}
                >
                  <div
                    className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      drugForm.is_controlled ? "translate-x-6" : ""
                    }`}
                  />
                </div>
              </button>
            </div>
          </div>
          <div className="pt-6 flex gap-4">
            <button
              onClick={closeDrugModal}
              disabled={drugSaving}
              className="flex-1 btn-secondary py-4 rounded-2xl font-bold"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveDrug}
              disabled={drugSaving}
              className="flex-[2] btn-primary py-4 rounded-2xl font-black tracking-tight shadow-xl shadow-primary-500/20 flex items-center justify-center gap-3 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {drugSaving ? "Saving..." : drugModal.editing ? "Save Changes" : "Add Drug"}
            </button>
          </div>
        </Modal>
      )}

      {/* Category modal */}
      {catModal.open && (
        <Modal
          title={catModal.editing ? "Edit Category" : "New Category"}
          subtitle="Group Drugs By Therapeutic Class"
          onClose={closeCatModal}
          icon={catModal.editing ? Edit3 : Plus}
        >
          {catSaveError && (
            <div className="mb-5 p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl flex items-center gap-3">
              <AlertCircle className="h-5 w-5" />
              <span className="text-sm font-bold">{catSaveError}</span>
            </div>
          )}
          <div className="space-y-5">
            <Field
              label="Name *"
              value={catForm.name}
              onChange={(v) => setCatForm({ ...catForm, name: v })}
              placeholder="Antibiotics"
            />
            <Field
              label="Code *"
              value={catForm.code}
              onChange={(v) => setCatForm({ ...catForm, code: v.toUpperCase() })}
              placeholder="ABX"
              mono
            />
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500">
                Description
              </label>
              <textarea
                value={catForm.description}
                onChange={(e) => setCatForm({ ...catForm, description: e.target.value })}
                placeholder="Notes for clinicians and pharmacists..."
                className="input-field h-24 bg-secondary-50 border-secondary-100 w-full resize-none py-3"
              />
            </div>
          </div>
          <div className="pt-6 flex gap-4">
            <button
              onClick={closeCatModal}
              disabled={catSaving}
              className="flex-1 btn-secondary py-4 rounded-2xl font-bold"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveCategory}
              disabled={catSaving}
              className="flex-[2] btn-primary py-4 rounded-2xl font-black tracking-tight shadow-xl shadow-primary-500/20 flex items-center justify-center gap-3 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {catSaving ? "Saving..." : catModal.editing ? "Save Changes" : "Add Category"}
            </button>
          </div>
        </Modal>
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <Modal
          title={confirmDelete.kind === "drug" ? "Delete Drug" : "Delete Category"}
          subtitle="This Cannot Be Undone"
          onClose={() => !deleting && setConfirmDelete(null)}
          icon={Trash2}
          tone="rose"
        >
          <p className="text-sm text-secondary-600 leading-relaxed mb-6">
            Are you sure you want to delete{" "}
            <strong className="text-secondary-900">{confirmDelete.entity.name}</strong>
            {"code" in confirmDelete.entity && confirmDelete.entity.code && (
              <span className="font-mono text-secondary-500"> ({confirmDelete.entity.code})</span>
            )}
            ?
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
              {deleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// =============================================================
// Sub-components
// =============================================================

function DrugsTable({
  drugs,
  totalCount,
  categoryName,
  onEdit,
  onDelete,
  onCreate,
}: {
  drugs: Drug[];
  totalCount: number;
  categoryName: (id?: number) => string | undefined;
  onEdit: (d: Drug) => void;
  onDelete: (d: Drug) => void;
  onCreate: () => void;
}) {
  return (
    <div className="glass-card rounded-[2.5rem] overflow-hidden border border-secondary-100/50 shadow-premium bg-white/40">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-secondary-900/5">
              <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500">Drug</th>
              <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500">Strength / Form</th>
              <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500">Category</th>
              <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500">Price</th>
              <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500">Status</th>
              <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-secondary-100/50">
            {drugs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-8 py-32 text-center">
                  <div className="max-w-sm mx-auto space-y-6">
                    <div className="h-20 w-20 bg-secondary-50 rounded-3xl flex items-center justify-center mx-auto">
                      <Pill className="h-10 w-10 text-secondary-200" />
                    </div>
                    <h4 className="text-xl font-bold text-secondary-900">No Drugs</h4>
                    <p className="text-sm text-secondary-500">
                      {totalCount === 0
                        ? "Add your first drug to the catalogue."
                        : "No drugs match your filters."}
                    </p>
                    <button onClick={onCreate} className="btn-primary inline-flex items-center gap-2 px-8 py-3">
                      <Plus className="h-4 w-4" />
                      <span>Add Drug</span>
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              drugs.map((d) => (
                <tr key={d.id} className="hover:bg-primary-50/30 transition-all group">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-md">
                        <Pill className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-bold text-secondary-900">{d.name}</p>
                          {d.is_controlled && (
                            <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-600 border border-rose-100 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-widest">
                              <ShieldAlert className="h-2.5 w-2.5" />
                              Controlled
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] font-bold text-secondary-500 mt-0.5">
                          {d.generic_name || d.brand_name || "—"}
                        </p>
                        {d.sku && (
                          <span className="inline-flex items-center gap-1 mt-1 bg-secondary-100 text-secondary-500 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold">
                            <Hash className="h-2.5 w-2.5" />
                            {d.sku}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="text-xs font-bold text-secondary-700">
                      {d.strength || "—"}
                    </div>
                    <div className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest mt-0.5">
                      {d.dosage_form || "—"} · {d.pack_size || "—"}
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    {d.drug_category_id != null ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 text-[10px] font-bold uppercase tracking-widest">
                        <Tag className="h-3 w-3" />
                        {categoryName(d.drug_category_id) ?? `Cat #${d.drug_category_id}`}
                      </span>
                    ) : (
                      <span className="text-secondary-400 text-[11px] font-bold">—</span>
                    )}
                  </td>
                  <td className="px-8 py-6">
                    <span className="text-sm font-black text-secondary-900">
                      {priceFmt(d.unit_price)}
                    </span>
                    {d.reorder_level != null && (
                      <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest mt-1">
                        Reorder @ {d.reorder_level}
                      </p>
                    )}
                  </td>
                  <td className="px-8 py-6">
                    <span className="inline-flex px-3 py-1.5 rounded-xl border bg-emerald-50 text-emerald-600 border-emerald-100 text-[10px] font-bold uppercase tracking-widest">
                      Active
                    </span>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => onEdit(d)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-primary-700 transition-all shadow-md shadow-primary-500/10"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => onDelete(d)}
                        className="p-2.5 hover:bg-rose-50 text-rose-500 rounded-xl transition-all"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CategoriesTable({
  categories,
  totalCount,
  drugCount,
  onEdit,
  onDelete,
  onCreate,
}: {
  categories: DrugCategory[];
  totalCount: number;
  drugCount: (catId: number) => number;
  onEdit: (c: DrugCategory) => void;
  onDelete: (c: DrugCategory) => void;
  onCreate: () => void;
}) {
  return (
    <div className="glass-card rounded-[2.5rem] overflow-hidden border border-secondary-100/50 shadow-premium bg-white/40">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-secondary-900/5">
              <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500">Category</th>
              <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500">Code</th>
              <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500">Drugs</th>
              <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-secondary-100/50">
            {categories.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-8 py-32 text-center">
                  <div className="max-w-sm mx-auto space-y-6">
                    <div className="h-20 w-20 bg-secondary-50 rounded-3xl flex items-center justify-center mx-auto">
                      <Layers className="h-10 w-10 text-secondary-200" />
                    </div>
                    <h4 className="text-xl font-bold text-secondary-900">No Categories</h4>
                    <p className="text-sm text-secondary-500">
                      {totalCount === 0
                        ? "Create your first therapeutic category."
                        : "No categories match your search."}
                    </p>
                    <button onClick={onCreate} className="btn-primary inline-flex items-center gap-2 px-8 py-3">
                      <Plus className="h-4 w-4" />
                      <span>Add Category</span>
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              categories.map((c) => (
                <tr key={c.id} className="hover:bg-primary-50/30 transition-all">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-md">
                        <Tag className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-secondary-900">{c.name}</p>
                        {c.description && (
                          <p className="text-[11px] text-secondary-500 mt-0.5 truncate max-w-md">
                            {c.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className="inline-flex items-center gap-1 bg-secondary-100 text-secondary-600 px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold">
                      <Hash className="h-2.5 w-2.5" />
                      {c.code}
                    </span>
                  </td>
                  <td className="px-8 py-6">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary-50 text-primary-600 border border-primary-100 text-[10px] font-bold uppercase tracking-widest">
                      <Pill className="h-3 w-3" />
                      {drugCount(c.id)}
                    </span>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => onEdit(c)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-primary-700 transition-all shadow-md shadow-primary-500/10"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => onDelete(c)}
                        className="p-2.5 hover:bg-rose-50 text-rose-500 rounded-xl transition-all"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ----- Stat Card -----

type StatTone = "primary" | "emerald" | "amber" | "rose";
const statToneStyles: Record<StatTone, string> = {
  primary: "bg-primary-50 text-primary-600 border-primary-100",
  emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
  amber: "bg-amber-50 text-amber-600 border-amber-100",
  rose: "bg-rose-50 text-rose-600 border-rose-100",
};
function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Pill;
  label: string;
  value: number;
  tone: StatTone;
}) {
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

// ----- Field -----

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  mono,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  mono?: boolean;
}) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`input-field h-12 bg-secondary-50 border-secondary-100 w-full ${mono ? "font-mono" : ""}`}
      />
    </div>
  );
}

// ----- Modal -----

function Modal({
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
  icon: typeof Plus;
  tone?: "primary" | "rose";
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-6 animate-fade-in">
      <div className="bg-white rounded-[2.5rem] p-10 max-w-2xl w-full shadow-2xl relative animate-slide-up max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-3 hover:bg-secondary-50 rounded-2xl transition-all"
        >
          <X className="h-5 w-5 text-secondary-400" />
        </button>
        <div className="flex items-center gap-5 mb-8">
          <div
            className={`h-14 w-14 rounded-2xl text-white flex items-center justify-center shadow-xl ${
              tone === "rose" ? "bg-rose-500 shadow-rose-500/20" : "bg-primary-600 shadow-primary-500/20"
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
