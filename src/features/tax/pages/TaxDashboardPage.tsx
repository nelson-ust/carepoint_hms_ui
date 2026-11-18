import { useState, useEffect } from "react";
import {
  Percent, Plus, RotateCcw, Settings as SettingsIcon, FileText, Trash2,
  ShieldCheck, BarChart3, Tag,

} from "lucide-react";
import {
  DxPage, DxPageHeader, DxPanel, DxButton, DxBadge, DxKpi, DxMessage, DxTabs,
} from "@/components/dx";
import { taxApi, type TaxRule, type TaxSummaryReport, type TaxType, type TaxRate } from "../api/tax.api";
import { TaxRuleModal } from "../components/TaxRuleModal";
import { TaxTypeModal } from "../components/TaxTypeModal";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { useToast } from "@/components/feedback/ToastProvider";

function monthToDateRange() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const first = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return { period_start: first, period_end: today };
}

function todayStr() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function currentRateFor(typeId: number, rates: TaxRate[]): number | null {
  const today = todayStr();
  const applicable = rates
    .filter((r) => r.tax_type_id === typeId)
    .filter((r) => String(r.effective_from) <= today)
    .filter((r) => !r.effective_to || String(r.effective_to) >= today)
    .sort((a, b) => String(b.effective_from).localeCompare(String(a.effective_from)));
  if (!applicable.length) return null;
  const val = Number(applicable[0].rate_percent);
  return Number.isFinite(val) ? val : null;
}

type Tab = "rules" | "types";
const naira = (n: number) => `₦${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

export function TaxDashboardPage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<Tab>("rules");

  const [rules, setRules] = useState<TaxRule[]>([]);
  const [taxTypes, setTaxTypes] = useState<TaxType[]>([]);
  const [rates, setRates] = useState<TaxRate[]>([]);
  const [summary, setSummary] = useState<TaxSummaryReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSummaryLoading, setIsSummaryLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<TaxRule | null>(null);
  const [deleteRuleTarget, setDeleteRuleTarget] = useState<TaxRule | null>(null);
  const [togglingRuleId, setTogglingRuleId] = useState<number | null>(null);

  const [typeModalOpen, setTypeModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<TaxType | null>(null);
  const [deleteTypeTarget, setDeleteTypeTarget] = useState<TaxType | null>(null);
  const [togglingTypeId, setTogglingTypeId] = useState<number | null>(null);

  const [exporting, setExporting] = useState(false);

  const loadTypes = async () => {
    try {
      const [t, r] = await Promise.all([taxApi.listTypes(), taxApi.listRates()]);
      setTaxTypes(t);
      setRates(r);
    } catch { /* non-fatal */ }
  };

  const load = async () => {
    setIsLoading(true);
    setIsSummaryLoading(true);
    setError(null);
    loadTypes();
    try {
      const data = await taxApi.listRules();
      setRules(data.items || []);
    } catch {
      setError("Unable to sync tax configurations from the fiscal server.");
    } finally {
      setIsLoading(false);
    }
    try {
      const report = await taxApi.getSummaryReport(monthToDateRange());
      setSummary(report);
    } catch {
      setSummary(null);
    } finally {
      setIsSummaryLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreateRule = () => { setEditingRule(null); setRuleModalOpen(true); };
  const openEditRule = (rule: TaxRule) => { setEditingRule(rule); setRuleModalOpen(true); };

  const handleToggleRule = async (rule: TaxRule) => {
    setTogglingRuleId(rule.id);
    try {
      await taxApi.updateRule(rule.id, { is_active: !rule.is_active });
      toast.success(rule.is_active ? "Rule deactivated" : "Rule activated", rule.name);
      await load();
    } catch {
      toast.error("Couldn't update rule", "Please try again.");
    } finally {
      setTogglingRuleId(null);
    }
  };

  const handleDeleteRule = async () => {
    if (!deleteRuleTarget) return;
    try {
      await taxApi.deleteRule(deleteRuleTarget.id);
      toast.success("Rule deleted", `“${deleteRuleTarget.name}” was removed.`);
      await load();
    } catch {
      toast.error("Couldn't delete rule", "Please try again.");
    }
  };

  const openCreateType = () => { setEditingType(null); setTypeModalOpen(true); };
  const openEditType = (t: TaxType) => { setEditingType(t); setTypeModalOpen(true); };

  const handleToggleType = async (t: TaxType) => {
    setTogglingTypeId(t.id);
    try {
      await taxApi.updateType(t.id, { is_active: !t.is_active });
      toast.success(t.is_active ? "Tax type deactivated" : "Tax type activated", t.name);
      await loadTypes();
    } catch {
      toast.error("Couldn't update tax type", "Please try again.");
    } finally {
      setTogglingTypeId(null);
    }
  };

  const handleDeleteType = async () => {
    if (!deleteTypeTarget) return;
    try {
      await taxApi.deleteType(deleteTypeTarget.id);
      toast.success("Tax type deleted", `“${deleteTypeTarget.name}” was removed.`);
      await loadTypes();
    } catch (err: any) {
      const detail = err?.response?.data?.detail ?? err?.response?.data?.message;
      toast.error("Couldn't delete tax type", typeof detail === "string" ? detail : "Please try again.");
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const log = await taxApi.listAuditLog();
      const blob = new Blob([JSON.stringify(log, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tax-audit-log-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Audit export ready", `${log.length} log entr${log.length === 1 ? "y" : "ies"} downloaded.`);
    } catch {
      toast.error("Export failed", "Could not fetch the tax audit log.");
    } finally {
      setExporting(false);
    }
  };

  const mtdLiability = summary?.summary.reduce((sum, line) => sum + (line.tax_amount || 0), 0) ?? null;
  const mtdTaxableBase = summary?.summary.reduce((sum, line) => sum + (line.taxable_base || 0), 0) ?? null;
  const mtdLineCount = summary?.summary.reduce((sum, line) => sum + (line.line_count || 0), 0) ?? null;

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Finance" }, { label: "Tax" }]}
        title="Fiscal & Tax Rules"
        subtitle="Manage tax types, VAT & service tax rates, and automated fiscal rules."
        actions={
          <>
            <DxButton icon title="Refresh" onClick={load} isLoading={isLoading}><RotateCcw /></DxButton>
            {activeTab === "rules" ? (
              <DxButton variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={openCreateRule}>Add tax rule</DxButton>
            ) : (
              <DxButton variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={openCreateType}>Add tax type</DxButton>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Fiscal summary */}
        <div className="space-y-5 lg:col-span-1">
          <DxPanel title="Fiscal compliance" icon={<ShieldCheck className="h-4 w-4" />}>
            <DxKpi label="Total tax liability (MTD)" tone="accent" value={isSummaryLoading ? "…" : mtdLiability === null ? "—" : naira(mtdLiability)} />
            <div className="mt-3 grid grid-cols-2 gap-3">
              <DxKpi label="Taxable base (MTD)" tone="success" value={isSummaryLoading ? "…" : mtdTaxableBase === null ? "—" : naira(mtdTaxableBase)} />
              <DxKpi label="Tax lines (MTD)" tone="info" value={isSummaryLoading ? "…" : mtdLineCount === null ? "—" : mtdLineCount.toLocaleString()} />
            </div>
            {summary && summary.summary.length > 0 && (
              <div className="mt-4 space-y-1">
                {summary.summary.map((line) => (
                  <div key={line.code} className="flex items-center justify-between border-b border-[var(--dx-border)] py-2 text-[12.5px] last:border-0">
                    <span className="font-semibold uppercase tracking-wide text-[var(--dx-text-muted)]">{line.name || line.code}</span>
                    <span className="dx-mono font-semibold text-[var(--dx-text)]">{naira(line.tax_amount)}</span>
                  </div>
                ))}
              </div>
            )}
            <DxButton className="mt-4 w-full" variant="default" isLoading={exporting} leftIcon={<FileText className="h-4 w-4" />} onClick={handleExport}>Generate audit export</DxButton>
          </DxPanel>

          <DxPanel title="Tax analytics" icon={<BarChart3 className="h-4 w-4" />}>
            <p className="text-[13px] leading-relaxed text-[var(--dx-text-muted)]">Real-time breakdown of tax collection by department and service point.</p>
            <DxButton className="mt-4" variant="text" onClick={handleExport}>Explore insights →</DxButton>
          </DxPanel>
        </div>

        {/* Rules / Types */}
        <div className="space-y-4 lg:col-span-2">
          <DxTabs<Tab>
            value={activeTab}
            onChange={setActiveTab}
            items={[
              { key: "rules", label: "Tax rules", icon: <Percent className="h-4 w-4" />, count: rules.length },
              { key: "types", label: "Tax types", icon: <Tag className="h-4 w-4" />, count: taxTypes.length },
            ]}
          />

          {error && <DxMessage tone="danger" title="Sync error">{error}</DxMessage>}

          {activeTab === "rules" && (
            <div className="space-y-3">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => <div key={i} className="dx-skeleton h-24 w-full rounded-lg" />)
              ) : rules.length === 0 ? (
                <DxPanel>
                  <div className="py-10 text-center">
                    <Percent className="mx-auto mb-3 h-10 w-10 text-[var(--dx-text-faint)]" />
                    <h4 className="font-semibold text-[var(--dx-text)]">No tax rules defined</h4>
                    <p className="mt-1 text-[13px] text-[var(--dx-text-muted)]">{taxTypes.length === 0 ? "Start by creating a tax type, then add a rule that applies it." : "Fiscal calculations will default to zero."}</p>
                    <DxButton className="mt-4" variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={openCreateRule}>Add your first tax rule</DxButton>
                  </div>
                </DxPanel>
              ) : (
                rules.map((rule) => {
                  const t = taxTypes.find((x) => x.id === rule.tax_type_id);
                  return (
                    <DxPanel key={rule.id}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-4">
                          <div className="flex h-12 w-12 items-center justify-center rounded-md bg-[var(--dx-accent-soft)] text-[var(--dx-accent)]"><span className="text-[15px] font-bold">#{rule.priority}</span></div>
                          <div>
                            <h4 className="font-semibold text-[var(--dx-text)]">{rule.name}</h4>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                              {t && <DxBadge tone="accent">{t.code}</DxBadge>}
                              <span className="uppercase tracking-wide text-[var(--dx-text-muted)]">{rule.scope}</span>
                              {rule.is_active ? <DxBadge tone="success" dot>Active</DxBadge> : <DxBadge tone="neutral">Inactive</DxBadge>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <DxButton size="sm" variant="text" disabled={togglingRuleId === rule.id} onClick={() => handleToggleRule(rule)}>{rule.is_active ? "Deactivate" : "Activate"}</DxButton>
                          <DxButton icon size="sm" variant="text" title="Edit rule" onClick={() => openEditRule(rule)}><SettingsIcon className="h-4 w-4" /></DxButton>
                          <DxButton icon size="sm" variant="text" title="Delete rule" onClick={() => setDeleteRuleTarget(rule)}><Trash2 className="h-4 w-4" /></DxButton>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-1.5">
                        <DxBadge tone="neutral">{rule.applicability}</DxBadge>
                        <DxBadge tone="neutral">{rule.pricing_mode}</DxBadge>
                        {(rule.match_values || []).map((mv) => <DxBadge key={mv} tone="neutral">{mv}</DxBadge>)}
                      </div>
                    </DxPanel>
                  );
                })
              )}
            </div>
          )}

          {activeTab === "types" && (
            <div className="space-y-3">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => <div key={i} className="dx-skeleton h-20 w-full rounded-lg" />)
              ) : taxTypes.length === 0 ? (
                <DxPanel>
                  <div className="py-10 text-center">
                    <Tag className="mx-auto mb-3 h-10 w-10 text-[var(--dx-text-faint)]" />
                    <h4 className="font-semibold text-[var(--dx-text)]">No tax types yet</h4>
                    <p className="mt-1 text-[13px] text-[var(--dx-text-muted)]">Define a tax type (e.g. VAT at 7.5%) before creating rules.</p>
                    <DxButton className="mt-4" variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={openCreateType}>Add your first tax type</DxButton>
                  </div>
                </DxPanel>
              ) : (
                taxTypes.map((t) => {
                  const rate = currentRateFor(t.id, rates);
                  const ruleCount = rules.filter((r) => r.tax_type_id === t.id).length;
                  return (
                    <DxPanel key={t.id}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-4">
                          <div className="flex h-12 w-12 items-center justify-center rounded-md bg-[var(--dx-accent-soft)] text-[var(--dx-accent)]"><span className="text-[13px] font-bold">{rate === null ? "—" : `${rate}%`}</span></div>
                          <div>
                            <h4 className="font-semibold text-[var(--dx-text)]">{t.name}</h4>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                              <DxBadge tone="accent">{t.code}</DxBadge>
                              <span className="uppercase tracking-wide text-[var(--dx-text-muted)]">{t.kind}</span>
                              {t.is_active ? <DxBadge tone="success" dot>Active</DxBadge> : <DxBadge tone="neutral">Inactive</DxBadge>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <DxButton size="sm" variant="text" disabled={togglingTypeId === t.id} onClick={() => handleToggleType(t)}>{t.is_active ? "Deactivate" : "Activate"}</DxButton>
                          <DxButton icon size="sm" variant="text" title="Edit type / add rate" onClick={() => openEditType(t)}><SettingsIcon className="h-4 w-4" /></DxButton>
                          <DxButton icon size="sm" variant="text" title="Delete type" onClick={() => setDeleteTypeTarget(t)}><Trash2 className="h-4 w-4" /></DxButton>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-1.5">
                        <DxBadge tone="neutral">{rate === null ? "No rate set" : `Rate ${rate}%`}</DxBadge>
                        <DxBadge tone="neutral">{ruleCount} rule{ruleCount === 1 ? "" : "s"}</DxBadge>
                        {t.is_withholding && <DxBadge tone="warning">Withholding</DxBadge>}
                      </div>
                    </DxPanel>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      <TaxRuleModal isOpen={ruleModalOpen} onClose={() => setRuleModalOpen(false)} onSaved={load} rule={editingRule} taxTypes={taxTypes} onTypesChanged={loadTypes} />
      <TaxTypeModal isOpen={typeModalOpen} onClose={() => setTypeModalOpen(false)} onSaved={load} type={editingType} currentRate={editingType ? currentRateFor(editingType.id, rates) : null} />

      <ConfirmDialog
        isOpen={!!deleteRuleTarget}
        onClose={() => setDeleteRuleTarget(null)}
        onConfirm={handleDeleteRule}
        title="Delete tax rule?"
        description={deleteRuleTarget ? `“${deleteRuleTarget.name}” will no longer apply to new invoices. This cannot be undone.` : undefined}
        confirmLabel="Delete"
        tone="danger"
      />
      <ConfirmDialog
        isOpen={!!deleteTypeTarget}
        onClose={() => setDeleteTypeTarget(null)}
        onConfirm={handleDeleteType}
        title="Delete tax type?"
        description={deleteTypeTarget ? `“${deleteTypeTarget.name}” (${deleteTypeTarget.code}) will be removed. Types still used by rules can't be deleted.` : undefined}
        confirmLabel="Delete"
        tone="danger"
      />
    </DxPage>
  );
}
