import { useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Plus, Upload, X } from "lucide-react";
import {
  DxPage, DxPageHeader, DxPanel, DxButton, DxBadge, DxInput, DxSelect,
  DxCheckbox, DxPopup, DxTabs, DxGrid, type DxGridColumn,
} from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import {
  hmoApi, fmtNaira,
  type CapitationContract, type CapitationLine, type HmoBenefit,
  type HmoPlan, type HmoProvider, type HmoTariff, type StatementRow,
} from "../api/hmo.api";

type Tab = "plans" | "tariffs" | "capitation" | "statement";

export function PayersPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const selectedId = params.get("payer") ? Number(params.get("payer")) : null;
  const tab = ((params.get("tab") as Tab) || "plans");
  const setSelectedId = (id: number | null) => {
    setParams((p) => {
      const n = new URLSearchParams(p);
      if (id == null) n.delete("payer"); else n.set("payer", String(id));
      return n;
    }, { replace: true });
  };
  const setTab = (t: Tab) => {
    setParams((p) => {
      const n = new URLSearchParams(p);
      n.set("tab", t);
      return n;
    }, { replace: true });
  };
  const [planModal, setPlanModal] = useState(false);
  const [confirmLine, setConfirmLine] = useState<CapitationLine | null>(null);
  const [benefitModal, setBenefitModal] = useState<HmoPlan | null>(null);
  const [tariffPlanId, setTariffPlanId] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const providers = useQuery({ queryKey: ["hmo", "providers"], queryFn: () => hmoApi.listProviders() });
  const selected = providers.data?.find((x) => x.id === selectedId) ?? null;

  const plans = useQuery({
    queryKey: ["hmo", "plans", selectedId],
    queryFn: () => hmoApi.listPlans(selectedId!),
    enabled: selectedId != null,
  });
  const contracts = useQuery({
    queryKey: ["hmo", "contracts", selectedId],
    queryFn: () => hmoApi.listContracts(selectedId!),
    enabled: selectedId != null && tab === "capitation",
  });
  const schedule = useQuery({
    queryKey: ["hmo", "schedule", selectedId],
    queryFn: () => hmoApi.listSchedule({ provider_id: selectedId! }),
    enabled: selectedId != null && tab === "capitation",
  });
  const statement = useQuery({
    queryKey: ["hmo", "statement", selectedId],
    queryFn: () => hmoApi.payerStatement(selectedId!),
    enabled: selectedId != null && tab === "statement",
  });
  const tariffs = useQuery({
    queryKey: ["hmo", "tariffs", tariffPlanId],
    queryFn: () => hmoApi.listTariffs(tariffPlanId!),
    enabled: tariffPlanId != null && tab === "tariffs",
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["hmo"] });

  const providerColumns: DxGridColumn<HmoProvider>[] = [
    { key: "name", header: "Payer", render: (r) => (
        <div>
          <div className="font-semibold text-[var(--dx-text)]">{r.name}</div>
          <div className="text-[11.5px] text-[var(--dx-text-muted)]">{r.provider_type ?? "—"}</div>
        </div>) },
    { key: "plan_count", header: "Plans", align: "center" },
    { key: "active_enrollee_count", header: "Enrollees", align: "center" },
    { key: "modes", header: "Modes", render: (r) => (
        <div className="flex gap-1">
          {r.fee_for_service_supported && <DxBadge tone="info">FFS</DxBadge>}
          {r.capitation_supported && <DxBadge tone="success">Capitation</DxBadge>}
        </div>) },
  ];

  const planColumns: DxGridColumn<HmoPlan>[] = [
    { key: "name", header: "Plan", render: (r) => (
        <div>
          <div className="font-semibold text-[var(--dx-text)]">{r.name}</div>
          <div className="text-[11.5px] text-[var(--dx-text-muted)]">{r.code} · {r.plan_tier ?? "—"}</div>
        </div>) },
    { key: "coverage_type", header: "Type", render: (r) => <DxBadge tone={r.coverage_type === "CAPITATION" ? "success" : "info"}>{r.coverage_type.replace(/_/g, " ")}</DxBadge> },
    { key: "default_coverage_percent", header: "Coverage %", align: "right", render: (r) => `${parseFloat(r.default_coverage_percent)}%` },
    { key: "default_copay_flat", header: "Flat co-pay", align: "right", render: (r) => <span className="dx-mono">{fmtNaira(r.default_copay_flat)}</span> },
    { key: "benefit_count", header: "Rules", align: "center" },
    { key: "actions", header: "", align: "right", render: (r) => (
        <div className="flex justify-end gap-1">
          <DxButton size="sm" variant="text" onClick={(e) => { e.stopPropagation(); setBenefitModal(r); }}>Benefits</DxButton>
          <DxButton size="sm" variant="text" onClick={(e) => { e.stopPropagation(); setTariffPlanId(r.id); setTab("tariffs"); }}>Tariffs</DxButton>
        </div>) },
  ];

  const tariffColumns: DxGridColumn<HmoTariff>[] = [
    { key: "billable_service_name", header: "Service", render: (r) => r.billable_service_name ?? r.service_code ?? `Drug #${r.drug_id ?? "?"}` },
    { key: "agreed_price", header: "Agreed price", align: "right", render: (r) => <span className="dx-mono">{fmtNaira(r.agreed_price)}</span> },
    { key: "effective_from", header: "From", render: (r) => r.effective_from ?? "—" },
    { key: "effective_to", header: "To", render: (r) => r.effective_to ?? "—" },
    { key: "del", header: "", align: "right", render: (r) => <DxButton size="sm" variant="text" onClick={() => hmoApi.deleteTariff(r.id).then(invalidate)}>Remove</DxButton> },
  ];

  const scheduleColumns: DxGridColumn<CapitationLine>[] = [
    { key: "period_code", header: "Period" },
    { key: "enrollee_count", header: "Enrollees", align: "center" },
    { key: "expected_amount", header: "Expected", align: "right", render: (r) => <span className="dx-mono">{fmtNaira(r.expected_amount)}</span> },
    { key: "received_amount", header: "Received", align: "right", render: (r) => <span className="dx-mono">{fmtNaira(r.received_amount)}</span> },
    { key: "status", header: "Status", render: (r) => <DxBadge tone={r.status === "PAID" ? "success" : r.status === "DRAFT" ? "neutral" : "warning"}>{r.status.replace(/_/g, " ")}</DxBadge> },
    { key: "actions", header: "", align: "right", render: (r) => (
        <div className="flex justify-end gap-2">
          {r.status === "DRAFT" && <DxButton size="sm" variant="primary" onClick={() => setConfirmLine(r)}>Confirm</DxButton>}
          {r.variance && <span className="text-[11.5px] text-[var(--dx-text-muted)]">Δ {r.variance.missing_from_hmo} disputed ({fmtNaira(r.variance.disputed_value)})</span>}
        </div>) },
  ];

  const statementColumns: DxGridColumn<StatementRow>[] = [
    { key: "date", header: "Date" },
    { key: "type", header: "Type", render: (r) => r.type.replace(/_/g, " ") },
    { key: "ref", header: "Reference" },
    { key: "debit", header: "Debit", align: "right", render: (r) => <span className="dx-mono">{parseFloat(r.debit) ? fmtNaira(r.debit) : ""}</span> },
    { key: "credit", header: "Credit", align: "right", render: (r) => <span className="dx-mono">{parseFloat(r.credit) ? fmtNaira(r.credit) : ""}</span> },
    { key: "balance", header: "Balance", align: "right", render: (r) => <span className="dx-mono font-semibold">{fmtNaira(r.balance)}</span> },
  ];

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Insurance" }, { label: "Payers" }]}
        title="HMO Payers"
        subtitle="Plans, tariffs, capitation and payer statements."
        actions={selected ? <DxButton variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setPlanModal(true)}>New plan</DxButton> : undefined}
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <DxPanel title="Payers" icon={<Building2 className="h-4 w-4" />} flush className="xl:col-span-1">
          <DxGrid<HmoProvider>
            borderless columns={providerColumns} data={providers.data} rowKey={(r) => r.id} isLoading={providers.isLoading}
            error={providers.isError ? "Could not load payers." : null}
            onRetry={() => providers.refetch()}
            selectedKey={selected?.id ?? null}
            onRowClick={(r) => { setSelectedId(r.id); setTab("plans"); }}
            empty={{ title: "No payers yet", description: "Register insurance providers from the Insurance module." }}
          />
        </DxPanel>

        <DxPanel className="xl:col-span-2">
          {!selected ? (
            <p className="p-8 text-center text-[13px] text-[var(--dx-text-muted)]">Select a payer to manage its plans, tariffs, capitation and statement.</p>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-[16px] font-bold text-[var(--dx-text)]">{selected.name}</h2>
                <DxTabs<Tab>
                  value={tab}
                  onChange={setTab}
                  items={[
                    { key: "plans", label: "Plans" },
                    { key: "tariffs", label: "Tariffs" },
                    { key: "capitation", label: "Capitation" },
                    { key: "statement", label: "Statement" },
                  ]}
                />
              </div>

              {tab === "plans" && (
                <DxGrid<HmoPlan>
                  borderless columns={planColumns} data={plans.data} rowKey={(r) => r.id} isLoading={plans.isLoading}
                  error={plans.isError ? "Could not load plans." : null}
                  onRetry={() => plans.refetch()}
                  empty={{ title: "No plans", description: "Create the payer's benefit plans." }}
                />
              )}

              {tab === "tariffs" && (
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <DxSelect value={tariffPlanId ?? ""} aria-label="Plan" onChange={(e) => setTariffPlanId(Number(e.target.value) || null)}
                      options={[{ value: "", label: "Select plan…" }, ...(plans.data ?? []).map((pl) => ({ value: String(pl.id), label: pl.name }))]} />
                    {tariffPlanId && (
                      <>
                        <input ref={fileRef} type="file" accept=".csv" className="hidden"
                          onChange={async (e) => {
                            const f = e.target.files?.[0];
                            if (!f) return;
                            const dry = await hmoApi.importTariffs(tariffPlanId, f, true);
                            if (dry.errors.length) {
                              toast.error(`${dry.errors.length} row error(s): ${dry.errors[0].error}`);
                            } else {
                              const done = await hmoApi.importTariffs(tariffPlanId, f, false);
                              toast.success(`Imported ${done.imported} tariff lines.`);
                              invalidate();
                            }
                            e.target.value = "";
                          }} />
                        <DxButton variant="default" leftIcon={<Upload className="h-4 w-4" />} onClick={() => fileRef.current?.click()}>Import CSV</DxButton>
                      </>
                    )}
                  </div>
                  {tariffPlanId ? (
                    <DxGrid<HmoTariff>
                      borderless columns={tariffColumns} data={tariffs.data} rowKey={(r) => r.id} isLoading={tariffs.isLoading}
                      empty={{ title: "No tariff lines", description: "Import the HMO's price list (CSV: service_code, agreed_price)." }}
                    />
                  ) : <p className="text-[13px] text-[var(--dx-text-muted)]">Choose a plan to view its negotiated prices.</p>}
                </div>
              )}

              {tab === "capitation" && (
                <CapitationTab providerId={selected.id} contracts={contracts.data ?? []} schedule={schedule.data ?? []} scheduleColumns={scheduleColumns} onChanged={invalidate} />
              )}

              {tab === "statement" && (
                <div>
                  <div className="mb-3 flex items-center justify-between text-[13px]">
                    <span className="text-[var(--dx-text-muted)]">Opening: {fmtNaira(statement.data?.opening_balance)}</span>
                    <span className="font-semibold text-[var(--dx-text)]">Balance: {fmtNaira(statement.data?.closing_balance)}</span>
                  </div>
                  <DxGrid<StatementRow>
                    borderless columns={statementColumns} data={statement.data?.rows} rowKey={(_, i) => i} isLoading={statement.isLoading}
                    empty={{ title: "No activity", description: "Approved claims and capitation will appear here." }}
                  />
                </div>
              )}
            </>
          )}
        </DxPanel>
      </div>

      {selected && (
        <NewPlanModal isOpen={planModal} onClose={() => setPlanModal(false)} providerId={selected.id} onSaved={() => { setPlanModal(false); invalidate(); }} />
      )}
      {benefitModal && (
        <BenefitsModal plan={benefitModal} onClose={() => { setBenefitModal(null); invalidate(); }} />
      )}
      <ConfirmDialog
        isOpen={confirmLine !== null}
        onClose={() => setConfirmLine(null)}
        tone="primary"
        title="Confirm this capitation schedule?"
        description={confirmLine
          ? `${confirmLine.period_code}: ${confirmLine.enrollee_count} enrollees, ${fmtNaira(confirmLine.expected_amount)} expected. Confirming locks the snapshot and books the receivable on the next posting sweep.`
          : undefined}
        confirmLabel="Confirm schedule"
        onConfirm={async () => {
          if (!confirmLine) return;
          try {
            await hmoApi.confirmSchedule(confirmLine.id);
            toast.success("Schedule confirmed — receivable will post on the next sweep.");
            setConfirmLine(null);
            invalidate();
          } catch (e: any) {
            toast.error(e?.response?.data?.detail ?? "Could not confirm the schedule.");
          }
        }}
      />
    </DxPage>
  );
}

function CapitationTab({ providerId, contracts, schedule, scheduleColumns, onChanged }: {
  providerId: number;
  contracts: CapitationContract[];
  schedule: CapitationLine[];
  scheduleColumns: DxGridColumn<CapitationLine>[];
  onChanged: () => void;
}) {
  const toast = useToast();
  const [rate, setRate] = useState("");
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [contractId, setContractId] = useState<number | null>(contracts[0]?.id ?? null);
  const effectiveContract = contractId ?? contracts[0]?.id ?? null;

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-[var(--dx-border)] p-4">
        <h3 className="mb-2 font-semibold text-[var(--dx-text)]">Contracts</h3>
        {contracts.length === 0 ? (
          <div className="flex flex-wrap items-end gap-3">
            <DxInput label="Rate / enrollee / month" type="number" mono value={rate} onChange={(e) => setRate(e.target.value)} placeholder="750" />
            <DxButton variant="primary" onClick={() => hmoApi.createContract({
                insurance_provider_id: providerId, rate_per_enrollee: Number(rate), effective_from: new Date().toISOString().slice(0, 10),
              }).then(() => { toast.success("Contract created."); onChanged(); })} disabled={!rate}>Create contract</DxButton>
          </div>
        ) : (
          <ul className="space-y-1 text-[13px]">
            {contracts.map((c) => (
              <li key={c.id} className="flex justify-between rounded-md bg-[var(--dx-surface-sunken)] px-3 py-2">
                <span className="text-[var(--dx-text)]">{c.plan_name ?? "All capitation plans"} · {fmtNaira(c.rate_per_enrollee)}/enrollee</span>
                <DxBadge tone={c.status === "ACTIVE" ? "success" : "neutral"}>{c.status}</DxBadge>
              </li>
            ))}
          </ul>
        )}
      </div>

      {contracts.length > 0 && (
        <div className="flex flex-wrap items-end gap-3">
          <DxSelect label="Contract" value={effectiveContract ?? ""} onChange={(e) => setContractId(Number(e.target.value))}
            options={contracts.map((c) => ({ value: String(c.id), label: `${c.plan_name ?? "All plans"} @ ${fmtNaira(c.rate_per_enrollee)}` }))} />
          <DxInput label="Period" type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
          <DxButton variant="primary" onClick={() => effectiveContract && hmoApi.runCapitation({ contract_id: effectiveContract, period_code: period })
            .then((l) => { toast.success(`Schedule generated: ${l.enrollee_count} enrollees, ${fmtNaira(l.expected_amount)}.`); onChanged(); })
            .catch((e) => toast.error(e?.response?.data?.detail ?? "Failed to run capitation."))}>Run capitation</DxButton>
        </div>
      )}

      <DxGrid<CapitationLine>
        borderless columns={scheduleColumns} data={schedule} rowKey={(r) => r.id}
        empty={{ title: "No capitation schedules", description: "Run a month to snapshot the enrollee register." }}
      />
    </div>
  );
}

function NewPlanModal({ isOpen, onClose, providerId, onSaved }: {
  isOpen: boolean; onClose: () => void; providerId: number; onSaved: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({ name: "", code: "", coverage_type: "FEE_FOR_SERVICE",
    default_coverage_percent: "90", default_copay_flat: "0", plan_tier: "" });
  const save = useMutation({
    mutationFn: () => hmoApi.createPlan({ ...form, insurance_provider_id: providerId,
      default_coverage_percent: Number(form.default_coverage_percent), default_copay_flat: Number(form.default_copay_flat) }),
    onSuccess: () => { toast.success("Plan created."); onSaved(); },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? "Could not create the plan."),
  });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <DxPopup isOpen={isOpen} onClose={onClose} title="New HMO plan" size="md"
      footer={<>
        <DxButton variant="text" onClick={onClose}>Cancel</DxButton>
        <DxButton variant="primary" onClick={() => save.mutate()} disabled={!form.name || save.isPending}>Create plan</DxButton>
      </>}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <DxInput label="Plan name" value={form.name} onChange={set("name")} />
        <DxInput label="Code" value={form.code} onChange={set("code")} />
        <DxSelect label="Coverage type" value={form.coverage_type} onChange={set("coverage_type")}
          options={[{ value: "FEE_FOR_SERVICE", label: "Fee for service" }, { value: "CAPITATION", label: "Capitation" }, { value: "HYBRID", label: "Hybrid" }]} />
        <DxInput label="Tier" value={form.plan_tier} onChange={set("plan_tier")} placeholder="gold" />
        <DxInput label="Default coverage %" type="number" mono value={form.default_coverage_percent} onChange={set("default_coverage_percent")} />
        <DxInput label="Flat co-pay (₦)" type="number" mono value={form.default_copay_flat} onChange={set("default_copay_flat")} />
      </div>
    </DxPopup>
  );
}

function BenefitsModal({ plan, onClose }: { plan: HmoPlan; onClose: () => void }) {
  const toast = useToast();
  const detail = useQuery({ queryKey: ["hmo", "plan", plan.id], queryFn: () => hmoApi.getPlan(plan.id) });
  const [form, setForm] = useState({ category: "PHARMACY", coverage_percent: "",
    copay_flat: "", limit_amount: "", limit_period: "", requires_preauth: false, is_excluded: false });
  const benefits: HmoBenefit[] = detail.data?.benefits ?? [];

  const add = () => hmoApi.createBenefit({
      hmo_plan_id: plan.id, category: form.category,
      coverage_percent: form.coverage_percent ? Number(form.coverage_percent) : undefined,
      copay_flat: form.copay_flat ? Number(form.copay_flat) : undefined,
      limit_amount: form.limit_amount ? Number(form.limit_amount) : undefined,
      limit_period: form.limit_period || undefined,
      requires_preauth: form.requires_preauth, is_excluded: form.is_excluded,
    }).then(() => { toast.success("Benefit rule added."); detail.refetch(); })
      .catch((e) => toast.error(e?.response?.data?.detail ?? "Could not add the rule."));

  return (
    <DxPopup isOpen onClose={onClose} title={`Benefit rules — ${plan.name}`} size="lg">
      <div className="mb-4 space-y-2">
        {benefits.map((b) => (
          <div key={b.id} className="flex items-center justify-between rounded-md bg-[var(--dx-surface-sunken)] px-3 py-2 text-[13px]">
            <span className="font-medium text-[var(--dx-text)]">{b.billable_service_name ?? b.category ?? "—"}</span>
            <span className="flex items-center gap-2 text-[var(--dx-text-muted)]">
              {b.is_excluded ? <DxBadge tone="danger">Excluded</DxBadge> : (
                <>
                  {b.coverage_percent != null && `${parseFloat(b.coverage_percent)}%`}
                  {b.copay_flat != null && parseFloat(b.copay_flat) > 0 && ` · co-pay ${fmtNaira(b.copay_flat)}`}
                  {b.limit_amount != null && ` · cap ${fmtNaira(b.limit_amount)}/${b.limit_period}`}
                </>
              )}
              {b.requires_preauth && <DxBadge tone="warning">Pre-auth</DxBadge>}
              <DxButton icon size="sm" variant="text" title="Remove" onClick={() => hmoApi.deleteBenefit(b.id).then(() => detail.refetch())}><X className="h-3.5 w-3.5" /></DxButton>
            </span>
          </div>
        ))}
        {benefits.length === 0 && <p className="text-[13px] text-[var(--dx-text-muted)]">No rules yet — plan defaults apply to everything.</p>}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <DxSelect label="Category" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
          options={["CONSULTATION", "PHARMACY", "LAB", "RADIOLOGY", "PROCEDURE", "ADMISSION", "MATERNITY", "DENTAL", "OPTICAL", "OTHER"].map((c) => ({ value: c, label: c }))} />
        <DxInput label="Coverage %" type="number" mono value={form.coverage_percent} onChange={(e) => setForm((f) => ({ ...f, coverage_percent: e.target.value }))} />
        <DxInput label="Flat co-pay" type="number" mono value={form.copay_flat} onChange={(e) => setForm((f) => ({ ...f, copay_flat: e.target.value }))} />
        <DxInput label="Limit amount" type="number" mono value={form.limit_amount} onChange={(e) => setForm((f) => ({ ...f, limit_amount: e.target.value }))} />
        <DxSelect label="Limit period" value={form.limit_period} onChange={(e) => setForm((f) => ({ ...f, limit_period: e.target.value }))}
          options={[{ value: "", label: "No limit period" }, { value: "PER_VISIT", label: "Per visit" }, { value: "PER_ANNUM", label: "Per annum" }, { value: "LIFETIME", label: "Lifetime" }]} />
        <div className="flex items-end gap-4 pb-1">
          <DxCheckbox label="Pre-auth" checked={form.requires_preauth} onChange={(e) => setForm((f) => ({ ...f, requires_preauth: e.target.checked }))} />
          <DxCheckbox label="Excluded" checked={form.is_excluded} onChange={(e) => setForm((f) => ({ ...f, is_excluded: e.target.checked }))} />
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <DxButton variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={add}>Add rule</DxButton>
      </div>
    </DxPopup>
  );
}
