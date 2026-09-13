import { PageHeader } from "@/components/layout/PageHeader";
import {
   Percent,
   Plus,
   RefreshCw,
   Settings as SettingsIcon,
   FileText,
   AlertCircle,
   CheckCircle2,
   Trash2,
   ShieldCheck,
   BarChart3,
   Tag,
} from "lucide-react";
import { useState, useEffect } from "react";
import {
   taxApi,
   type TaxRule,
   type TaxSummaryReport,
   type TaxType,
   type TaxRate,
} from "../api/tax.api";
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

/** Pick the rate in effect today for a tax type from a flat list of rates. */
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
      } catch {
         /* non-fatal */
      }
   };

   const load = async () => {
      setIsLoading(true);
      setIsSummaryLoading(true);
      setError(null);
      loadTypes();
      try {
         const data = await taxApi.listRules();
         setRules(data.items || []);
      } catch (err: any) {
         setError("Unable to sync tax configurations from the fiscal server.");
      } finally {
         setIsLoading(false);
      }
      try {
         const report = await taxApi.getSummaryReport(monthToDateRange());
         setSummary(report);
      } catch (err: any) {
         setSummary(null);
      } finally {
         setIsSummaryLoading(false);
      }
   };

   useEffect(() => {
      load();
   }, []);

   // ── Rule actions ──────────────────────────────────────────────
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

   // ── Type actions ──────────────────────────────────────────────
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
      <div className="space-y-10 animate-fade-in pb-20">
         <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <PageHeader
               title="Fiscal & Tax Rules"
               description="Manage tax types, VAT & service tax rates, and automated fiscal rules."
            />
            <div className="flex gap-3">
               <button onClick={load} className="btn-secondary p-4 rounded-2xl bg-white/80 border-secondary-400 transition-all active:scale-95" title="Refresh">
                  <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
               </button>
               {activeTab === "rules" ? (
                  <button onClick={openCreateRule} className="btn-primary gap-3 py-3 px-8 shadow-xl shadow-primary-500/20">
                     <Plus className="h-5 w-5" />
                     <span className="font-bold">Add Tax Rule</span>
                  </button>
               ) : (
                  <button onClick={openCreateType} className="btn-primary gap-3 py-3 px-8 shadow-xl shadow-primary-500/20">
                     <Plus className="h-5 w-5" />
                     <span className="font-bold">Add Tax Type</span>
                  </button>
               )}
            </div>
         </div>

         <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            {/* Fiscal Summary */}
            <div className="lg:col-span-1 space-y-6">
               <div className="glass-card rounded-[2.5rem] p-8 border border-secondary-400/50 bg-white/40 shadow-premium relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-6 opacity-10">
                     <ShieldCheck className="h-24 w-24" />
                  </div>
                  <h4 className="text-[10px] font-bold text-secondary-400 uppercase tracking-[0.2em] mb-8">Fiscal Compliance</h4>
                  <div className="space-y-8">
                     <div>
                        <p className="text-sm font-bold text-secondary-500 mb-1">Total Tax Liability (MTD)</p>
                        {isSummaryLoading ? (
                           <div className="h-9 w-40 rounded-xl bg-secondary-100/50 animate-pulse" />
                        ) : (
                           <p className="text-3xl font-black text-secondary-900">
                              {mtdLiability === null ? "—" : `₦${mtdLiability.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                           </p>
                        )}
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
                           <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Taxable Base (MTD)</p>
                           <p className="text-xs font-bold text-emerald-700">
                              {isSummaryLoading ? "…" : mtdTaxableBase === null ? "—" : `₦${mtdTaxableBase.toLocaleString()}`}
                           </p>
                        </div>
                        <div className="p-4 rounded-2xl bg-primary-50 border border-primary-100">
                           <p className="text-[10px] font-black text-primary-600 uppercase tracking-widest mb-1">Tax Lines (MTD)</p>
                           <p className="text-xs font-bold text-primary-700">
                              {isSummaryLoading ? "…" : mtdLineCount === null ? "—" : mtdLineCount.toLocaleString()}
                           </p>
                        </div>
                     </div>
                     {summary && summary.summary.length > 0 && (
                        <div className="space-y-2">
                           {summary.summary.map((line) => (
                              <div key={line.code} className="flex items-center justify-between py-2 border-b border-secondary-100/60 last:border-0">
                                 <span className="text-[10px] font-bold text-secondary-500 uppercase tracking-widest">{line.name || line.code}</span>
                                 <span className="text-xs font-black text-secondary-900">₦{line.tax_amount.toLocaleString()}</span>
                              </div>
                           ))}
                        </div>
                     )}
                     <button onClick={handleExport} disabled={exporting} className="w-full btn-secondary py-3 gap-2 text-[10px] font-black uppercase tracking-widest disabled:opacity-60">
                        <FileText className="h-4 w-4" />
                        {exporting ? "Exporting…" : "Generate Audit Export"}
                     </button>
                  </div>
               </div>

               <div className="glass-card rounded-[2.5rem] p-8 border border-secondary-400/50 bg-primary-900 text-white shadow-xl shadow-primary-900/20">
                  <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center mb-6">
                     <BarChart3 className="h-6 w-6" />
                  </div>
                  <h4 className="text-lg font-bold mb-2">Tax Analytics</h4>
                  <p className="text-sm text-primary-100 leading-relaxed mb-6">
                     Real-time breakdown of tax collection by department and service point.
                  </p>
                  <button onClick={handleExport} className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 hover:translate-x-2 transition-transform">
                     Explore Insights →
                  </button>
               </div>
            </div>

            {/* Right column: tabbed Rules / Types */}
            <div className="lg:col-span-2 space-y-6">
               <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-white/40 border border-secondary-400/40 w-fit">
                  <button
                     onClick={() => setActiveTab("rules")}
                     className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === "rules" ? "bg-secondary-900 text-white shadow-lg" : "text-secondary-500 hover:text-secondary-900"}`}
                  >
                     <Percent className="h-4 w-4" /> Tax Rules
                  </button>
                  <button
                     onClick={() => setActiveTab("types")}
                     className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === "types" ? "bg-secondary-900 text-white shadow-lg" : "text-secondary-500 hover:text-secondary-900"}`}
                  >
                     <Tag className="h-4 w-4" /> Tax Types
                  </button>
               </div>

               {error && (
                  <div className="p-6 rounded-[2rem] bg-rose-50 border border-rose-100 text-rose-600 flex items-center gap-4 animate-shake">
                     <AlertCircle className="h-6 w-6" />
                     <p className="text-sm font-bold">{error}</p>
                  </div>
               )}

               {/* ── RULES TAB ── */}
               {activeTab === "rules" && (
                  <div className="space-y-4">
                     {isLoading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                           <div key={i} className="h-32 bg-white/40 rounded-[2.5rem] animate-pulse" />
                        ))
                     ) : rules.length === 0 ? (
                        <div className="py-24 text-center bg-white/20 rounded-[3rem] border-2 border-dashed border-secondary-400">
                           <Percent className="h-16 w-16 mx-auto text-secondary-100 mb-6" />
                           <h4 className="text-xl font-bold text-secondary-900">No Tax Rules Defined</h4>
                           <p className="text-secondary-500 mt-2 mb-6">
                              {taxTypes.length === 0
                                 ? "Start by creating a tax type, then add a rule that applies it."
                                 : "Fiscal calculations will default to zero."}
                           </p>
                           <button onClick={openCreateRule} className="btn-primary gap-2 py-3 px-6 mx-auto">
                              <Plus className="h-4 w-4" />
                              <span className="font-bold">Add your first tax rule</span>
                           </button>
                        </div>
                     ) : (
                        rules.map((rule) => {
                           const t = taxTypes.find((x) => x.id === rule.tax_type_id);
                           return (
                              <div key={rule.id} className="glass-card rounded-[2.5rem] p-8 border border-secondary-400/50 bg-white/40 hover:bg-white/60 transition-all group">
                                 <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-5">
                                       <div className="h-14 w-14 rounded-2xl bg-secondary-900 text-white flex items-center justify-center shadow-lg">
                                          <span className="text-lg font-black">#{rule.priority}</span>
                                       </div>
                                       <div>
                                          <h4 className="text-lg font-black text-secondary-900">{rule.name}</h4>
                                          <div className="flex items-center gap-3 mt-1">
                                             {t && <span className="text-[10px] font-bold text-primary-500 uppercase tracking-widest">{t.code}</span>}
                                             <span className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest">{rule.scope}</span>
                                             {rule.is_active ? (
                                                <span className="flex items-center gap-1 text-[8px] font-black text-emerald-500 uppercase tracking-widest">
                                                   <CheckCircle2 className="h-3 w-3" /> Active
                                                </span>
                                             ) : (
                                                <span className="text-[8px] font-black text-secondary-400 uppercase tracking-widest">Inactive</span>
                                             )}
                                          </div>
                                       </div>
                                    </div>
                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                       <button onClick={() => handleToggleRule(rule)} disabled={togglingRuleId === rule.id} className="px-3 py-2 hover:bg-secondary-100 rounded-2xl transition-all text-[10px] font-black uppercase tracking-widest text-secondary-500 disabled:opacity-50">
                                          {rule.is_active ? "Deactivate" : "Activate"}
                                       </button>
                                       <button onClick={() => openEditRule(rule)} className="p-3 hover:bg-secondary-100 rounded-2xl transition-all" title="Edit rule">
                                          <SettingsIcon className="h-5 w-5 text-secondary-400" />
                                       </button>
                                       <button onClick={() => setDeleteRuleTarget(rule)} className="p-3 hover:bg-rose-50 rounded-2xl transition-all" title="Delete rule">
                                          <Trash2 className="h-5 w-5 text-rose-400" />
                                       </button>
                                    </div>
                                 </div>
                                 <div className="mt-8 flex flex-wrap gap-2">
                                    <span className="px-3 py-1 rounded-full bg-secondary-50 text-secondary-500 text-[9px] font-bold uppercase tracking-widest">{rule.applicability}</span>
                                    <span className="px-3 py-1 rounded-full bg-secondary-50 text-secondary-500 text-[9px] font-bold uppercase tracking-widest">{rule.pricing_mode}</span>
                                    {(rule.match_values || []).map((mv) => (
                                       <span key={mv} className="px-3 py-1 rounded-full bg-secondary-50 text-secondary-500 text-[9px] font-bold uppercase tracking-widest">{mv}</span>
                                    ))}
                                 </div>
                              </div>
                           );
                        })
                     )}
                  </div>
               )}

               {/* ── TYPES TAB ── */}
               {activeTab === "types" && (
                  <div className="space-y-4">
                     {isLoading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                           <div key={i} className="h-28 bg-white/40 rounded-[2.5rem] animate-pulse" />
                        ))
                     ) : taxTypes.length === 0 ? (
                        <div className="py-24 text-center bg-white/20 rounded-[3rem] border-2 border-dashed border-secondary-400">
                           <Tag className="h-16 w-16 mx-auto text-secondary-100 mb-6" />
                           <h4 className="text-xl font-bold text-secondary-900">No Tax Types Yet</h4>
                           <p className="text-secondary-500 mt-2 mb-6">Define a tax type (e.g. VAT at 7.5%) before creating rules.</p>
                           <button onClick={openCreateType} className="btn-primary gap-2 py-3 px-6 mx-auto">
                              <Plus className="h-4 w-4" />
                              <span className="font-bold">Add your first tax type</span>
                           </button>
                        </div>
                     ) : (
                        taxTypes.map((t) => {
                           const rate = currentRateFor(t.id, rates);
                           const ruleCount = rules.filter((r) => r.tax_type_id === t.id).length;
                           return (
                              <div key={t.id} className="glass-card rounded-[2.5rem] p-8 border border-secondary-400/50 bg-white/40 hover:bg-white/60 transition-all group">
                                 <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-5">
                                       <div className="h-14 w-14 rounded-2xl bg-primary-500/10 text-primary-600 flex items-center justify-center shadow-inner">
                                          <span className="text-sm font-black">{rate === null ? "—" : `${rate}%`}</span>
                                       </div>
                                       <div>
                                          <h4 className="text-lg font-black text-secondary-900">{t.name}</h4>
                                          <div className="flex items-center gap-3 mt-1">
                                             <span className="text-[10px] font-bold text-primary-500 uppercase tracking-widest">{t.code}</span>
                                             <span className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest">{t.kind}</span>
                                             {t.is_active ? (
                                                <span className="flex items-center gap-1 text-[8px] font-black text-emerald-500 uppercase tracking-widest">
                                                   <CheckCircle2 className="h-3 w-3" /> Active
                                                </span>
                                             ) : (
                                                <span className="text-[8px] font-black text-secondary-400 uppercase tracking-widest">Inactive</span>
                                             )}
                                          </div>
                                       </div>
                                    </div>
                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                       <button onClick={() => handleToggleType(t)} disabled={togglingTypeId === t.id} className="px-3 py-2 hover:bg-secondary-100 rounded-2xl transition-all text-[10px] font-black uppercase tracking-widest text-secondary-500 disabled:opacity-50">
                                          {t.is_active ? "Deactivate" : "Activate"}
                                       </button>
                                       <button onClick={() => openEditType(t)} className="p-3 hover:bg-secondary-100 rounded-2xl transition-all" title="Edit type / add rate">
                                          <SettingsIcon className="h-5 w-5 text-secondary-400" />
                                       </button>
                                       <button onClick={() => setDeleteTypeTarget(t)} className="p-3 hover:bg-rose-50 rounded-2xl transition-all" title="Delete type">
                                          <Trash2 className="h-5 w-5 text-rose-400" />
                                       </button>
                                    </div>
                                 </div>
                                 <div className="mt-6 flex flex-wrap gap-2">
                                    <span className="px-3 py-1 rounded-full bg-secondary-50 text-secondary-500 text-[9px] font-bold uppercase tracking-widest">
                                       {rate === null ? "No rate set" : `Rate ${rate}%`}
                                    </span>
                                    <span className="px-3 py-1 rounded-full bg-secondary-50 text-secondary-500 text-[9px] font-bold uppercase tracking-widest">
                                       {ruleCount} rule{ruleCount === 1 ? "" : "s"}
                                    </span>
                                    {t.is_withholding && (
                                       <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-600 text-[9px] font-bold uppercase tracking-widest">Withholding</span>
                                    )}
                                 </div>
                              </div>
                           );
                        })
                     )}
                  </div>
               )}
            </div>
         </div>

         <TaxRuleModal
            isOpen={ruleModalOpen}
            onClose={() => setRuleModalOpen(false)}
            onSaved={load}
            rule={editingRule}
            taxTypes={taxTypes}
            onTypesChanged={loadTypes}
         />

         <TaxTypeModal
            isOpen={typeModalOpen}
            onClose={() => setTypeModalOpen(false)}
            onSaved={load}
            type={editingType}
            currentRate={editingType ? currentRateFor(editingType.id, rates) : null}
         />

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
      </div>
   );
}
