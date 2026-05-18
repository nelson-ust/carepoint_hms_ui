import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Filter,
  Layers,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Loader2,
  ShieldAlert,
  Lock,
  Unlock,
} from "lucide-react";
import {
  bulkSetTenantModules,
  listModuleCatalog,
  listTenantModules,
  resetTenantModule,
  setTenantModule,
} from "../api/tenant-modules.api";
import type { ModuleCatalogEntry, TenantModule } from "../api/tenant-modules.api";
import { Modal } from "@/components/ui/Modal";

type RowState = {
  code: string;
  name: string;
  description?: string;
  category?: string;
  isEnabled: boolean;
  defaultEnabled: boolean;
  isDirty: boolean;
  fromTenant: boolean;
};

type Props = {
  tenantId: number | string;
  showHeader?: boolean;
};

export function TenantModulesManager({ tenantId, showHeader = true }: Props) {
  const [catalog, setCatalog] = useState<ModuleCatalogEntry[]>([]);
  const [tenantModules, setTenantModulesState] = useState<TenantModule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [resetModal, setResetModal] = useState<{ isOpen: boolean; row: RowState | null }>({ isOpen: false, row: null });
  const [toggleModal, setToggleModal] = useState<{ isOpen: boolean; row: RowState | null }>({ isOpen: false, row: null });

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [enabledOnly, setEnabledOnly] = useState(false);

  const [savingCode, setSavingCode] = useState<string | null>(null);
  const [savingBulk, setSavingBulk] = useState(false);
  const [resettingCode, setResettingCode] = useState<string | null>(null);
  const [localToggles, setLocalToggles] = useState<Record<string, boolean>>({});

  const showFeedback = (tone: "success" | "error", message: string) => {
    setFeedback({ tone, message });
    if (tone === "success") setTimeout(() => setFeedback(null), 4000);
  };

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [cat, mods] = await Promise.all([
        listModuleCatalog().catch(() => [] as ModuleCatalogEntry[]),
        listTenantModules(tenantId).catch(() => [] as TenantModule[]),
      ]);
      setCatalog(cat);
      setTenantModulesState(mods);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Unable to load modules.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, [tenantId]);

  const rows = useMemo<RowState[]>(() => {
    const tenantMap = new Map(tenantModules.map((m) => [m.code || m.module_code || "", m]));
    const seen = new Set<string>();
    const out: RowState[] = [];

    for (const c of catalog) {
      const tm = tenantMap.get(c.code);
      seen.add(c.code);
      const isEnabled = tm ? (tm.effective ?? tm.is_enabled ?? !!c.default_enabled) : !!c.default_enabled;
      out.push({
        code: c.code,
        name: c.name ?? c.code ?? "Unnamed Module",
        description: c.description ?? tm?.description,
        category: c.category ?? tm?.category,
        isEnabled,
        defaultEnabled: !!c.default_enabled,
        isDirty: false,
        fromTenant: !!tm,
      });
    }

    for (const tm of tenantModules) {
      const code = tm.code || tm.module_code;
      if (!code || seen.has(code)) continue;
      out.push({
        code,
        name: tm.label || tm.module_name || code || "Unknown Module",
        description: tm.description,
        category: tm.category,
        isEnabled: tm.effective ?? tm.is_enabled ?? false,
        defaultEnabled: false,
        isDirty: false,
        fromTenant: true,
      });
    }
    return out.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [catalog, tenantModules]);

  const effectiveRows = useMemo<RowState[]>(
    () => rows.map((r) => r.code in localToggles ? { ...r, isEnabled: localToggles[r.code], isDirty: localToggles[r.code] !== r.isEnabled } : r),
    [rows, localToggles],
  );

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return effectiveRows.filter((r) => {
      if (categoryFilter && (r.category || "") !== categoryFilter) return false;
      if (enabledOnly && !r.isEnabled) return false;
      if (!q) return true;
      return (r.code.toLowerCase().includes(q) || r.name.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q) || r.category?.toLowerCase().includes(q));
    });
  }, [effectiveRows, search, categoryFilter, enabledOnly]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => r.category && set.add(r.category));
    return Array.from(set).sort();
  }, [rows]);

  const dirtyRows = useMemo(() => effectiveRows.filter((r) => r.isDirty), [effectiveRows]);

  const stats = useMemo(() => {
    const total = rows.length;
    const enabled = effectiveRows.filter((r) => r.isEnabled).length;
    const tenantOverrides = rows.filter((r) => r.fromTenant).length;
    return { total, enabled, tenantOverrides, dirty: dirtyRows.length };
  }, [rows, effectiveRows, dirtyRows]);

  const toggleLocal = (code: string, current: boolean) => {
    setLocalToggles((prev) => ({ ...prev, [code]: !current }));
  };

  const handleToggleClick = (row: RowState) => {
    setToggleModal({ isOpen: true, row });
  };

  const handleConfirmToggle = () => {
    if (!toggleModal.row) return;
    toggleLocal(toggleModal.row.code, toggleModal.row.isEnabled);
    setToggleModal({ isOpen: false, row: null });
  };

  const handleSaveOne = async (row: RowState) => {
    setSavingCode(row.code);
    try {
      await setTenantModule(tenantId, { module_code: row.code, is_enabled: row.isEnabled });
      setTenantModulesState((prev) => {
        const others = prev.filter((m) => (m.code || m.module_code) !== row.code);
        return [...others, { module_code: row.code, module_name: row.name, is_enabled: row.isEnabled, category: row.category, description: row.description }];
      });
      setLocalToggles((prev) => {
        const next = { ...prev };
        delete next[row.code];
        return next;
      });
      showFeedback("success", `${row.name} ${row.isEnabled ? "enabled" : "disabled"}.`);
    } catch (err: any) {
      showFeedback("error", err?.response?.data?.message || "Failed to update module.");
    } finally {
      setSavingCode(null);
    }
  };

  const handleSaveAll = async () => {
    if (dirtyRows.length === 0) return;
    setSavingBulk(true);
    try {
      await bulkSetTenantModules(tenantId, dirtyRows.map((r) => ({ module_code: r.code, is_enabled: r.isEnabled })));
      setTenantModulesState((prev) => {
        const map = new Map(prev.map((m) => [m.code || m.module_code, m]));
        dirtyRows.forEach((r) => {
          map.set(r.code, { module_code: r.code, module_name: r.name, is_enabled: r.isEnabled, category: r.category, description: r.description });
        });
        return Array.from(map.values()) as TenantModule[];
      });
      setLocalToggles({});
      showFeedback("success", `Updated ${dirtyRows.length} module${dirtyRows.length === 1 ? "" : "s"}.`);
    } catch (err: any) {
      showFeedback("error", err?.response?.data?.message || "Bulk update failed.");
    } finally {
      setSavingBulk(false);
    }
  };

  const handleResetClick = (row: RowState) => {
    if (!row.fromTenant) return;
    setResetModal({ isOpen: true, row });
  };

  const handleConfirmReset = async () => {
    const row = resetModal.row;
    if (!row) return;
    setResettingCode(row.code);
    try {
      await resetTenantModule(tenantId, row.code);
      setTenantModulesState((prev) => prev.filter((m) => (m.code || m.module_code) !== row.code));
      setLocalToggles((prev) => {
        const next = { ...prev };
        delete next[row.code];
        return next;
      });
      setResetModal({ isOpen: false, row: null });
      showFeedback("success", `${row.name} reset to catalog default.`);
    } catch (err: any) {
      showFeedback("error", err?.response?.data?.message || "Failed to reset module.");
    } finally {
      setResettingCode(null);
    }
  };

  return (
    <div className="space-y-6">
      {showHeader && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black font-display tracking-tight">Modules Management</h2>
            <p className="text-secondary-400 font-bold text-[10px] uppercase tracking-[0.25em] mt-1">Configure Workspace Features</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="btn-secondary p-3 rounded-xl bg-white/80 border-secondary-400 hover:rotate-180 transition-transform duration-500" title="Refresh">
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
            {dirtyRows.length > 0 && (
              <button onClick={handleSaveAll} disabled={savingBulk} className="btn-primary gap-2 px-5 py-3 text-xs disabled:opacity-50 shadow-xl shadow-primary-500/20">
                {savingBulk ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {savingBulk ? "Saving..." : `Save ${dirtyRows.length} change${dirtyRows.length === 1 ? "" : "s"}`}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Stat label="Catalog" value={stats.total} tone="primary" />
        <Stat label="Enabled" value={stats.enabled} tone="emerald" />
        <Stat label="Overrides" value={stats.tenantOverrides} tone="amber" />
        <Stat label="Pending" value={stats.dirty} tone="rose" />
      </div>

      <div className="glass-card rounded-[1.5rem] p-3 flex flex-col md:flex-row gap-3 items-stretch md:items-center bg-white/40 backdrop-blur-md">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search modules..." className="w-full bg-white/50 border-none rounded-xl pl-11 pr-4 py-3 text-sm focus:ring-2 focus:ring-primary-500/40 transition-all font-medium" />
        </div>
        {categories.length > 0 && (
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary-400 pointer-events-none" />
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="appearance-none bg-white/80 border border-secondary-400 rounded-xl pl-10 pr-6 py-3 text-xs font-bold uppercase tracking-widest text-secondary-700 focus:ring-2 focus:ring-primary-500/40">
              <option value="">All Categories</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}
        <button onClick={() => setEnabledOnly((v) => !v)} className={`flex items-center gap-2 px-4 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all ${enabledOnly ? "bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-500/20" : "bg-white/80 text-secondary-600 border-secondary-400"}`}>
          <Sparkles className="h-3.5 w-3.5" />
          Enabled Only
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 rounded-2xl bg-secondary-100/40 animate-pulse" />)}
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 text-center">
          <AlertCircle className="h-8 w-8 mx-auto mb-2" />
          <p className="text-sm font-bold">{error}</p>
          <button onClick={load} className="text-xs font-bold underline mt-2">Retry</button>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredRows.map((row) => (
            <ModuleRow key={row.code} row={row} saving={savingCode === row.code} resetting={resettingCode === row.code} onToggle={() => handleToggleClick(row)} onSave={() => handleSaveOne(row)} onReset={() => handleResetClick(row)} />
          ))}
        </div>
      )}

      {/* Toggle Confirmation Modal */}
      <Modal isOpen={toggleModal.isOpen} onClose={() => setToggleModal({ isOpen: false, row: null })} title="Confirm Module Toggle">
        <div className="text-center py-6 space-y-6">
          <div className={`h-24 w-24 rounded-[2rem] flex items-center justify-center mx-auto shadow-2xl ${toggleModal.row?.isEnabled ? 'bg-rose-500 shadow-rose-500/20' : 'bg-primary-500 shadow-primary-500/20'} text-white`}>
            {toggleModal.row?.isEnabled ? <Unlock className="h-12 w-12" /> : <Lock className="h-12 w-12" />}
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-black text-secondary-900 tracking-tight">
              {toggleModal.row?.isEnabled ? 'Disable Module?' : 'Enable & Unlock Module?'}
            </h3>
            <p className="text-sm text-secondary-500 font-medium px-4">
              {toggleModal.row?.isEnabled
                ? `Are you sure you want to disable ${toggleModal.row?.name}? This feature will be hidden from the tenant workspace immediately.`
                : `You are about to unlock ${toggleModal.row?.name}. This will make the module available for the hospital staff.`}
            </p>
          </div>
          <div className="flex gap-4">
            <button onClick={() => setToggleModal({ isOpen: false, row: null })} className="flex-1 btn-secondary py-4 rounded-2xl font-bold">Cancel</button>
            <button onClick={handleConfirmToggle} className={`flex-1 py-4 rounded-2xl font-bold text-white shadow-xl ${toggleModal.row?.isEnabled ? 'bg-rose-500 shadow-rose-500/20' : 'bg-primary-500 shadow-primary-500/20'}`}>
              Confirm {toggleModal.row?.isEnabled ? 'Disable' : 'Unlock'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Reset Confirmation Modal */}
      <Modal isOpen={resetModal.isOpen} onClose={() => setResetModal({ isOpen: false, row: null })} title="Confirm Reset">
        <div className="text-center py-6 space-y-6">
          <div className="h-24 w-24 rounded-[2rem] bg-amber-500 text-white flex items-center justify-center mx-auto shadow-2xl shadow-amber-500/20">
            <RotateCcw className="h-12 w-12" />
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-black text-secondary-900 tracking-tight">Reset Module Settings?</h3>
            <p className="text-sm text-secondary-500 font-medium px-4">
              Are you sure you want to reset <span className="font-bold text-secondary-900">{resetModal.row?.name}</span>?
              This will remove the current tenant override and revert to the global catalog default.
            </p>
          </div>
          <div className="flex gap-4">
            <button onClick={() => setResetModal({ isOpen: false, row: null })} className="flex-1 btn-secondary py-4 rounded-2xl font-bold">Cancel</button>
            <button onClick={handleConfirmReset} disabled={!!resettingCode} className="flex-1 btn-primary bg-amber-500 hover:bg-amber-600 border-amber-600 py-4 rounded-2xl font-bold text-white flex items-center justify-center gap-2">
              {resettingCode ? <Loader2 className="h-5 w-5 animate-spin" /> : "Confirm Reset"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Feedback Modal */}
      <Modal isOpen={!!feedback} onClose={() => setFeedback(null)} title={feedback?.tone === 'success' ? 'Success' : 'Attention'}>
        <div className="text-center py-6 space-y-6">
          <div className={`h-24 w-24 rounded-[2rem] flex items-center justify-center mx-auto shadow-2xl ${feedback?.tone === 'success' ? 'bg-emerald-500 text-white shadow-emerald-500/20' : 'bg-rose-500 text-white shadow-rose-500/20'}`}>
            {feedback?.tone === 'success' ? <CheckCircle2 className="h-12 w-12" /> : <ShieldAlert className="h-12 w-12" />}
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-black text-secondary-900 tracking-tight">{feedback?.tone === 'success' ? 'Operation Successful' : 'Action Required'}</h3>
            <p className="text-sm text-secondary-500 font-medium px-4">{feedback?.message}</p>
          </div>
          <button onClick={() => setFeedback(null)} className="w-full btn-primary py-4 rounded-2xl font-bold">Great, thanks!</button>
        </div>
      </Modal>
    </div>
  );
}

function ModuleRow({ row, saving, resetting, onToggle, onSave, onReset }: { row: RowState; saving: boolean; resetting: boolean; onToggle: () => void; onSave: () => void; onReset: () => void; }) {
  return (
    <div className={`flex items-center justify-between gap-4 p-4 rounded-2xl border transition-all ${row.isDirty ? "bg-amber-50 border-amber-200" : "bg-white border-secondary-400 hover:border-primary-200"}`}>
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <button onClick={onToggle} className={`shrink-0 h-7 w-12 rounded-full p-0.5 transition-all relative ${row.isEnabled ? "bg-emerald-500" : "bg-secondary-200"}`} aria-label={row.isEnabled ? "Disable module" : "Enable module"}>
          <div className={`h-6 w-6 rounded-full bg-white shadow transition-transform flex items-center justify-center ${row.isEnabled ? "translate-x-5" : ""}`}>
            {!row.isEnabled && <Lock className="h-3 w-3 text-secondary-400" />}
          </div>
        </button>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={`text-sm font-black ${row.isEnabled ? "text-secondary-900" : "text-secondary-400"}`}>{row.name}</p>
            {!row.isEnabled && <Lock className="h-3 w-3 text-secondary-300" />}
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary-100 text-secondary-500 text-[10px] font-mono font-bold">{row.code}</span>
            {row.category && <span className="inline-flex px-2 py-0.5 rounded-md bg-primary-50 text-primary-600 border border-primary-100 text-[9px] font-bold uppercase tracking-widest">{row.category}</span>}
            {row.fromTenant && <span className="inline-flex px-2 py-0.5 rounded-md bg-amber-50 text-amber-600 border border-amber-100 text-[9px] font-bold uppercase tracking-widest">Override</span>}
            {row.isDirty && <span className="inline-flex px-2 py-0.5 rounded-md bg-rose-50 text-rose-600 border border-rose-100 text-[9px] font-bold uppercase tracking-widest">Unsaved</span>}
          </div>
          {row.description && <p className="text-[11px] text-secondary-500 mt-0.5 line-clamp-1">{row.description}</p>}
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {row.fromTenant && !row.isDirty && (
          <button onClick={onReset} disabled={resetting} className="p-2 rounded-lg hover:bg-secondary-100 text-secondary-500 disabled:opacity-50" title="Reset to catalog default">
            {resetting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
          </button>
        )}
        {row.isDirty && (
          <button onClick={onSave} disabled={saving} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary-500 hover:bg-primary-600 text-white text-[10px] font-bold uppercase tracking-widest shadow-sm disabled:opacity-50">
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            {saving ? "Saving" : "Save"}
          </button>
        )}
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest border ${row.isEnabled ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-secondary-100 text-secondary-500 border-secondary-200 opacity-60"}`}>
          {row.isEnabled ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
          {row.isEnabled ? "Active" : "Locked"}
        </span>
      </div>
    </div>
  );
}

type StatTone = "primary" | "emerald" | "amber" | "rose";
const statToneStyles: Record<StatTone, string> = {
  primary: "bg-primary-50 text-primary-600 border-primary-100",
  emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
  amber: "bg-amber-50 text-amber-600 border-amber-100",
  rose: "bg-rose-50 text-rose-600 border-rose-100",
};
function Stat({ label, value, tone }: { label: string; value: number; tone: StatTone }) {
  return (
    <div className={`p-4 rounded-2xl border ${statToneStyles[tone]}`}>
      <p className="text-[9px] font-bold uppercase tracking-widest opacity-80">{label}</p>
      <p className="text-2xl font-black tracking-tight mt-1">{value}</p>
    </div>
  );
}
