import { useEffect, useMemo, useState } from "react";
import {
  Gift,
  Layers,
  Lock,
  RefreshCw,
  RotateCcw,
  Save,
  Sparkles,
  Unlock,
} from "lucide-react";
import {
  applyFacilityProfile,
  bulkSetTenantModules,
  listFacilityProfiles,
  listModuleCatalog,
  listTenantModules,
  resetTenantModule,
  setTenantModule,
} from "../api/tenant-modules.api";
import type { FacilityProfile, ModuleCatalogEntry, TenantModule } from "../api/tenant-modules.api";
import {
  DxBadge,
  DxButton,
  DxConfirm,
  DxKpi,
  DxMessage,
  DxSearchBox,
  DxSelect,
  DxToolbar,
  DxToolbarSeparator,
  DxToolbarSpacer,
  apiErrorMessage,
} from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";

/** SaaS-admin screen: surface the backend's DB-level detail (if any) alongside
 * the friendly message, so a failed save shows the real cause, not just "500". */
function moduleSaveError(err: unknown): string {
  const base = apiErrorMessage(err);
  const detail = (err as { response?: { data?: { detail?: { error?: unknown } } } })?.response?.data
    ?.detail;
  const extra = detail && typeof detail === "object" ? (detail as { error?: unknown }).error : undefined;
  return typeof extra === "string" && extra ? `${base} — ${extra}` : base;
}

type RowState = {
  code: string;
  name: string;
  description?: string;
  category?: string;
  isEnabled: boolean;
  defaultEnabled: boolean;
  planDefault?: boolean;
  isDirty: boolean;
  fromTenant: boolean;
};

type Props = {
  tenantId: number | string;
  showHeader?: boolean;
};

export function TenantModulesManager({ tenantId, showHeader = true }: Props) {
  const toast = useToast();
  const [catalog, setCatalog] = useState<ModuleCatalogEntry[]>([]);
  const [tenantModules, setTenantModulesState] = useState<TenantModule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resetModal, setResetModal] = useState<{ isOpen: boolean; row: RowState | null }>({ isOpen: false, row: null });
  const [toggleModal, setToggleModal] = useState<{ isOpen: boolean; row: RowState | null }>({ isOpen: false, row: null });

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [enabledOnly, setEnabledOnly] = useState(false);

  const [savingCode, setSavingCode] = useState<string | null>(null);
  const [savingBulk, setSavingBulk] = useState(false);
  const [resettingCode, setResettingCode] = useState<string | null>(null);
  const [localToggles, setLocalToggles] = useState<Record<string, boolean>>({});

  const [profiles, setProfiles] = useState<FacilityProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState("");
  const [applyingProfile, setApplyingProfile] = useState(false);
  const [profileConfirm, setProfileConfirm] = useState(false);

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [cat, mods, profs] = await Promise.all([
        listModuleCatalog().catch(() => [] as ModuleCatalogEntry[]),
        listTenantModules(tenantId).catch(() => [] as TenantModule[]),
        listFacilityProfiles().catch(() => [] as FacilityProfile[]),
      ]);
      setCatalog(cat);
      setTenantModulesState(mods);
      setProfiles(profs);
    } catch (err) {
      setError(apiErrorMessage(err) || "Unable to load modules.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const applyProfileNow = async () => {
    if (!selectedProfile) return;
    setApplyingProfile(true);
    try {
      await applyFacilityProfile(tenantId, selectedProfile);
      const label = profiles.find((p) => p.code === selectedProfile)?.label ?? selectedProfile;
      toast.success(`Applied the ${label} profile.`);
      setProfileConfirm(false);
      setSelectedProfile("");
      await load();
    } catch (err) {
      toast.error(apiErrorMessage(err) || "Failed to apply the facility profile.");
    } finally {
      setApplyingProfile(false);
    }
  };

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
        planDefault: tm?.plan_default,
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
        planDefault: tm.plan_default,
        isDirty: false,
        fromTenant: true,
      });
    }
    return out.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [catalog, tenantModules]);

  const effectiveRows = useMemo<RowState[]>(
    () =>
      rows.map((r) =>
        r.code in localToggles
          ? { ...r, isEnabled: localToggles[r.code], isDirty: localToggles[r.code] !== r.isEnabled }
          : r,
      ),
    [rows, localToggles],
  );

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return effectiveRows.filter((r) => {
      if (categoryFilter && (r.category || "") !== categoryFilter) return false;
      if (enabledOnly && !r.isEnabled) return false;
      if (!q) return true;
      return (
        r.code.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q) ||
        r.category?.toLowerCase().includes(q)
      );
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

  const toggleLocal = (code: string, current: boolean) =>
    setLocalToggles((prev) => ({ ...prev, [code]: !current }));

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
        return [
          ...others,
          { module_code: row.code, module_name: row.name, is_enabled: row.isEnabled, category: row.category, description: row.description },
        ];
      });
      setLocalToggles((prev) => {
        const next = { ...prev };
        delete next[row.code];
        return next;
      });
      toast.success(`${row.name} ${row.isEnabled ? "enabled" : "disabled"}.`);
    } catch (err) {
      toast.error(moduleSaveError(err) || "Failed to update module.");
    } finally {
      setSavingCode(null);
    }
  };

  const handleSaveAll = async () => {
    if (dirtyRows.length === 0) return;
    setSavingBulk(true);
    try {
      await bulkSetTenantModules(
        tenantId,
        dirtyRows.map((r) => ({ module_code: r.code, is_enabled: r.isEnabled })),
      );
      setTenantModulesState((prev) => {
        const map = new Map(prev.map((m) => [m.code || m.module_code, m]));
        dirtyRows.forEach((r) => {
          map.set(r.code, { module_code: r.code, module_name: r.name, is_enabled: r.isEnabled, category: r.category, description: r.description });
        });
        return Array.from(map.values()) as TenantModule[];
      });
      setLocalToggles({});
      toast.success(`Updated ${dirtyRows.length} module${dirtyRows.length === 1 ? "" : "s"}.`);
    } catch (err) {
      toast.error(moduleSaveError(err) || "Bulk update failed.");
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
      toast.success(`${row.name} reset to catalog default.`);
    } catch (err) {
      toast.error(apiErrorMessage(err) || "Failed to reset module.");
    } finally {
      setResettingCode(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Facility profile quick-apply (one-click vertical preset) */}
      {profiles.length > 0 ? (
        <div className="flex flex-col gap-2 rounded-[var(--dx-radius)] border border-[var(--dx-border)] bg-[var(--dx-surface)] p-3 md:flex-row md:items-center">
          <div className="flex-1">
            <p className="text-[13px] font-semibold text-[var(--dx-text)]">Facility profile</p>
            <p className="text-[12px] text-[var(--dx-text-muted)]">
              Apply a one-click preset: enable only a vertical's modules (Dental / Eye / Pharmacy), or restore the full hospital.
            </p>
          </div>
          <DxSelect
            value={selectedProfile}
            onChange={(e) => setSelectedProfile(e.target.value)}
            aria-label="Facility profile"
            className="w-56"
            options={[
              { value: "", label: "Choose a profile…" },
              ...profiles.map((p) => ({ value: p.code, label: p.label })),
            ]}
          />
          <DxButton
            variant="primary"
            leftIcon={<Sparkles className="h-3.5 w-3.5" />}
            disabled={!selectedProfile}
            onClick={() => setProfileConfirm(true)}
          >
            Apply profile
          </DxButton>
        </div>
      ) : null}

      <DxConfirm
        isOpen={profileConfirm}
        onClose={() => !applyingProfile && setProfileConfirm(false)}
        onConfirm={applyProfileNow}
        title="Apply facility profile?"
        description="This enables the selected vertical's modules and disables the rest for this tenant. It overwrites existing module overrides; data is not deleted and you can re-apply another profile at any time."
        confirmLabel="Apply profile"
        tone="primary"
      />

      {showHeader && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-[var(--dx-accent)]" />
            <div>
              <h2 className="text-[15px] font-semibold text-[var(--dx-text)]">Modules management</h2>
              <p className="text-[var(--dx-text-muted)]">Configure workspace features.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DxButton leftIcon={<RefreshCw className={isLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />} onClick={load}>
              Refresh
            </DxButton>
            {dirtyRows.length > 0 && (
              <DxButton variant="primary" leftIcon={<Save className="h-4 w-4" />} isLoading={savingBulk} onClick={handleSaveAll}>
                Save {dirtyRows.length} change{dirtyRows.length === 1 ? "" : "s"}
              </DxButton>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <DxKpi label="Catalog" value={stats.total} icon={Layers} tone="accent" />
        <DxKpi label="Enabled" value={stats.enabled} icon={Unlock} tone="success" />
        <DxKpi label="Overrides" value={stats.tenantOverrides} icon={Gift} tone="warning" />
        <DxKpi label="Pending" value={stats.dirty} icon={Save} tone="danger" />
      </div>

      <DxToolbar attached>
        <DxSearchBox onSearch={setSearch} placeholder="Search modules…" className="w-64" size="sm" />
        {categories.length > 0 && (
          <>
            <DxToolbarSeparator />
            <DxSelect
              editorSize="sm"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              options={[{ value: "", label: "All categories" }, ...categories.map((c) => ({ value: c, label: c }))]}
              className="w-44"
            />
          </>
        )}
        <DxToolbarSpacer />
        <DxButton
          size="sm"
          variant={enabledOnly ? "primary" : "default"}
          leftIcon={<Sparkles className="h-3.5 w-3.5" />}
          onClick={() => setEnabledOnly((v) => !v)}
        >
          Enabled only
        </DxButton>
      </DxToolbar>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 rounded-[var(--dx-radius)] bg-[var(--dx-surface-alt)] animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <DxMessage tone="danger" action={<DxButton onClick={load}>Retry</DxButton>}>
          {error}
        </DxMessage>
      ) : filteredRows.length === 0 ? (
        <DxMessage tone="info">No modules match your filters.</DxMessage>
      ) : (
        <div className="space-y-1.5">
          {filteredRows.map((row) => (
            <ModuleRow
              key={row.code}
              row={row}
              saving={savingCode === row.code}
              resetting={resettingCode === row.code}
              onToggle={() => setToggleModal({ isOpen: true, row })}
              onSave={() => handleSaveOne(row)}
              onReset={() => handleResetClick(row)}
            />
          ))}
        </div>
      )}

      <DxConfirm
        isOpen={toggleModal.isOpen}
        onClose={() => setToggleModal({ isOpen: false, row: null })}
        onConfirm={handleConfirmToggle}
        title={toggleModal.row?.isEnabled ? "Disable module?" : "Enable & unlock module?"}
        description={
          toggleModal.row?.isEnabled
            ? `${toggleModal.row?.name} will be hidden from the tenant workspace immediately.`
            : `${toggleModal.row?.name} will become available to the hospital staff.`
        }
        confirmLabel={toggleModal.row?.isEnabled ? "Confirm disable" : "Confirm unlock"}
        tone={toggleModal.row?.isEnabled ? "danger" : "primary"}
      />

      <DxConfirm
        isOpen={resetModal.isOpen}
        onClose={() => setResetModal({ isOpen: false, row: null })}
        onConfirm={handleConfirmReset}
        title="Reset module settings?"
        description={`Remove the tenant override on ${resetModal.row?.name} and revert to the global catalog default.`}
        confirmLabel="Confirm reset"
        tone="primary"
      />
    </div>
  );
}

function ModuleRow({
  row,
  saving,
  resetting,
  onToggle,
  onSave,
  onReset,
}: {
  row: RowState;
  saving: boolean;
  resetting: boolean;
  onToggle: () => void;
  onSave: () => void;
  onReset: () => void;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 p-3 rounded-[var(--dx-radius)] border transition-colors ${
        row.isDirty
          ? "border-[var(--dx-warning)] bg-[var(--dx-warning-soft)]"
          : "border-[var(--dx-border)] bg-[var(--dx-surface)] hover:border-[var(--dx-border-strong)]"
      }`}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <button
          onClick={onToggle}
          className="shrink-0 h-6 w-11 rounded-full p-0.5 transition-colors relative"
          style={{ background: row.isEnabled ? "var(--dx-success)" : "var(--dx-neutral-soft)" }}
          aria-label={row.isEnabled ? "Disable module" : "Enable module"}
        >
          <span
            className={`block h-5 w-5 rounded-full bg-white shadow transition-transform ${row.isEnabled ? "translate-x-5" : ""}`}
          />
        </button>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className={`font-semibold ${row.isEnabled ? "text-[var(--dx-text)]" : "text-[var(--dx-text-muted)]"}`}>
              {row.name}
            </p>
            <span className="font-mono text-[11px] text-[var(--dx-text-muted)]">{row.code}</span>
            {row.category && <DxBadge tone="outline">{row.category}</DxBadge>}
            {row.isEnabled && row.planDefault === false ? (
              <DxBadge tone="accent">
                <Gift className="h-2.5 w-2.5" />
                Loyalty grant
              </DxBadge>
            ) : (
              row.fromTenant && <DxBadge tone="warning">Override</DxBadge>
            )}
            {row.isDirty && <DxBadge tone="danger">Unsaved</DxBadge>}
          </div>
          {row.description && (
            <p className="text-[11px] text-[var(--dx-text-muted)] mt-0.5 line-clamp-1">{row.description}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {row.fromTenant && !row.isDirty && (
          <DxButton
            size="sm"
            variant="text"
            icon
            title="Reset to catalog default"
            isLoading={resetting}
            onClick={onReset}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </DxButton>
        )}
        {row.isDirty && (
          <DxButton size="sm" variant="primary" leftIcon={<Save className="h-3 w-3" />} isLoading={saving} onClick={onSave}>
            Save
          </DxButton>
        )}
        <DxBadge tone={row.isEnabled ? "success" : "neutral"}>
          {row.isEnabled ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
          {row.isEnabled ? "Active" : "Locked"}
        </DxBadge>
      </div>
    </div>
  );
}
