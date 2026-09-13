import { useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Plus, Upload } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { DataTable, type DataTableColumn } from "@/components/data-table/DataTable";
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

  const providerColumns: DataTableColumn<HmoProvider>[] = [
    { key: "name", header: "Payer",
      render: (r) => (
        <div>
          <div className="font-semibold text-secondary-900">{r.name}</div>
          <div className="text-xs text-secondary-500">{r.provider_type ?? "—"}</div>
        </div>) },
    { key: "plan_count", header: "Plans", align: "center" },
    { key: "active_enrollee_count", header: "Enrollees", align: "center" },
    { key: "modes", header: "Modes", render: (r) => (
        <div className="flex gap-1">
          {r.fee_for_service_supported && <Badge variant="soft-info">FFS</Badge>}
          {r.capitation_supported && <Badge variant="soft-success">Capitation</Badge>}
        </div>) },
  ];

  const planColumns: DataTableColumn<HmoPlan>[] = [
    { key: "name", header: "Plan",
      render: (r) => (
        <div>
          <div className="font-semibold">{r.name}</div>
          <div className="text-xs text-secondary-500">{r.code} · {r.plan_tier ?? "—"}</div>
        </div>) },
    { key: "coverage_type", header: "Type",
      render: (r) => <Badge variant={r.coverage_type === "CAPITATION" ? "soft-success" : "soft-info"}>{r.coverage_type.replace(/_/g, " ")}</Badge> },
    { key: "default_coverage_percent", header: "Coverage %", align: "right",
      render: (r) => `${parseFloat(r.default_coverage_percent)}%` },
    { key: "default_copay_flat", header: "Flat co-pay", align: "right",
      render: (r) => fmtNaira(r.default_copay_flat) },
    { key: "benefit_count", header: "Rules", align: "center" },
    { key: "actions", header: "", align: "right",
      render: (r) => (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setBenefitModal(r); }}>
            Benefits
          </Button>
          <Button size="sm" variant="ghost"
            onClick={(e) => { e.stopPropagation(); setTariffPlanId(r.id); setTab("tariffs"); }}>
            Tariffs
          </Button>
        </div>) },
  ];

  const tariffColumns: DataTableColumn<HmoTariff>[] = [
    { key: "billable_service_name", header: "Service",
      render: (r) => r.billable_service_name ?? r.service_code ?? `Drug #${r.drug_id ?? "?"}` },
    { key: "agreed_price", header: "Agreed price", align: "right", render: (r) => fmtNaira(r.agreed_price) },
    { key: "effective_from", header: "From", render: (r) => r.effective_from ?? "—" },
    { key: "effective_to", header: "To", render: (r) => r.effective_to ?? "—" },
    { key: "del", header: "", align: "right",
      render: (r) => <Button size="sm" variant="ghost" onClick={() =>
        hmoApi.deleteTariff(r.id).then(invalidate)}>Remove</Button> },
  ];

  const scheduleColumns: DataTableColumn<CapitationLine>[] = [
    { key: "period_code", header: "Period" },
    { key: "enrollee_count", header: "Enrollees", align: "center" },
    { key: "expected_amount", header: "Expected", align: "right", render: (r) => fmtNaira(r.expected_amount) },
    { key: "received_amount", header: "Received", align: "right", render: (r) => fmtNaira(r.received_amount) },
    { key: "status", header: "Status", render: (r) => <Badge variant={
        r.status === "PAID" ? "soft-success" : r.status === "DRAFT" ? "secondary" : "soft-warning"
      }>{r.status.replace(/_/g, " ")}</Badge> },
    { key: "actions", header: "", align: "right", render: (r) => (
        <div className="flex justify-end gap-2">
          {r.status === "DRAFT" && (
            <Button size="sm" onClick={() => setConfirmLine(r)}>
              Confirm
            </Button>
          )}
          {r.variance && (
            <span className="text-xs text-secondary-500">
              Δ {r.variance.missing_from_hmo} disputed ({fmtNaira(r.variance.disputed_value)})
            </span>
          )}
        </div>) },
  ];

  const statementColumns: DataTableColumn<StatementRow>[] = [
    { key: "date", header: "Date" },
    { key: "type", header: "Type", render: (r) => r.type.replace(/_/g, " ") },
    { key: "ref", header: "Reference" },
    { key: "debit", header: "Debit", align: "right", render: (r) => parseFloat(r.debit) ? fmtNaira(r.debit) : "" },
    { key: "credit", header: "Credit", align: "right", render: (r) => parseFloat(r.credit) ? fmtNaira(r.credit) : "" },
    { key: "balance", header: "Balance", align: "right", render: (r) => fmtNaira(r.balance) },
  ];

  return (
    <div>
      <PageHeader title="HMO Payers" description="Plans, tariffs, capitation and payer statements."
        actions={selected && (
          <Button variant="primary" onClick={() => setPlanModal(true)}>
            <Plus className="mr-1 h-4 w-4" /> New plan
          </Button>
        )} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="p-4 xl:col-span-1">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-secondary-900">
            <Building2 className="h-5 w-5" /> Payers
          </h2>
          <DataTable columns={providerColumns} data={providers.data}
            rowKey={(r) => r.id} isLoading={providers.isLoading}
            error={providers.isError ? "Could not load payers." : null}
            onRetry={() => providers.refetch()}
            onRowClick={(r) => { setSelectedId(r.id); setTab("plans"); }}
            empty={{ title: "No payers yet", description: "Register insurance providers from the Insurance module." }} />
        </Card>

        <Card className="p-4 xl:col-span-2">
          {!selected ? (
            <p className="p-8 text-center text-secondary-500">Select a payer to manage its plans, tariffs, capitation and statement.</p>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-secondary-900">{selected.name}</h2>
                <div className="flex flex-wrap gap-1 rounded-xl bg-secondary-100 p-1">
                  {(["plans", "tariffs", "capitation", "statement"] as Tab[]).map((t) => (
                    <button key={t} onClick={() => setTab(t)}
                      className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition ${
                        tab === t ? "bg-white text-secondary-900 shadow-sm" : "text-secondary-500 hover:text-secondary-800"}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {tab === "plans" && (
                <DataTable columns={planColumns} data={plans.data}
                  rowKey={(r) => r.id} isLoading={plans.isLoading}
                  error={plans.isError ? "Could not load plans." : null}
                  onRetry={() => plans.refetch()}
                  empty={{ title: "No plans", description: "Create the payer's benefit plans." }} />
              )}

              {tab === "tariffs" && (
                <div>
                  <div className="mb-3 flex items-center gap-3">
                    <Select value={tariffPlanId ?? ""} onChange={(e) => setTariffPlanId(Number(e.target.value) || null)}
                      options={[{ value: "", label: "Select plan…" },
                        ...(plans.data ?? []).map((pl) => ({ value: String(pl.id), label: pl.name }))]} />
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
                        <Button variant="secondary" onClick={() => fileRef.current?.click()}>
                          <Upload className="mr-1 h-4 w-4" /> Import CSV
                        </Button>
                      </>
                    )}
                  </div>
                  {tariffPlanId ? (
                    <DataTable columns={tariffColumns} data={tariffs.data}
                      rowKey={(r) => r.id} isLoading={tariffs.isLoading}
                      empty={{ title: "No tariff lines", description: "Import the HMO's price list (CSV: service_code, agreed_price)." }} />
                  ) : <p className="text-sm text-secondary-500">Choose a plan to view its negotiated prices.</p>}
                </div>
              )}

              {tab === "capitation" && (
                <CapitationTab providerId={selected.id}
                  contracts={contracts.data ?? []} schedule={schedule.data ?? []}
                  scheduleColumns={scheduleColumns} onChanged={invalidate} />
              )}

              {tab === "statement" && (
                <div>
                  <div className="mb-3 flex items-center justify-between text-sm">
                    <span className="text-secondary-500">Opening: {fmtNaira(statement.data?.opening_balance)}</span>
                    <span className="font-semibold text-secondary-900">
                      Balance: {fmtNaira(statement.data?.closing_balance)}
                    </span>
                  </div>
                  <DataTable columns={statementColumns} data={statement.data?.rows}
                    rowKey={(_, i) => i} isLoading={statement.isLoading}
                    empty={{ title: "No activity", description: "Approved claims and capitation will appear here." }} />
                </div>
              )}
            </>
          )}
        </Card>
      </div>

      {selected && (
        <NewPlanModal isOpen={planModal} onClose={() => setPlanModal(false)}
          providerId={selected.id} onSaved={() => { setPlanModal(false); invalidate(); }} />
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
    </div>
  );
}

function CapitationTab({ providerId, contracts, schedule, scheduleColumns, onChanged }: {
  providerId: number;
  contracts: CapitationContract[];
  schedule: CapitationLine[];
  scheduleColumns: DataTableColumn<CapitationLine>[];
  onChanged: () => void;
}) {
  const toast = useToast();
  const [rate, setRate] = useState("");
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [contractId, setContractId] = useState<number | null>(contracts[0]?.id ?? null);
  const effectiveContract = contractId ?? contracts[0]?.id ?? null;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-secondary-200 p-4">
        <h3 className="mb-2 font-semibold text-secondary-900">Contracts</h3>
        {contracts.length === 0 ? (
          <div className="flex flex-wrap items-end gap-3">
            <Input label="Rate / enrollee / month" type="number" value={rate}
              onChange={(e) => setRate(e.target.value)} placeholder="750" />
            <Button onClick={() => hmoApi.createContract({
                insurance_provider_id: providerId,
                rate_per_enrollee: Number(rate),
                effective_from: new Date().toISOString().slice(0, 10),
              }).then(() => { toast.success("Contract created."); onChanged(); })}
              disabled={!rate}>
              Create contract
            </Button>
          </div>
        ) : (
          <ul className="space-y-1 text-sm">
            {contracts.map((c) => (
              <li key={c.id} className="flex justify-between rounded-lg bg-secondary-50 px-3 py-2">
                <span>{c.plan_name ?? "All capitation plans"} · {fmtNaira(c.rate_per_enrollee)}/enrollee</span>
                <Badge variant={c.status === "ACTIVE" ? "soft-success" : "secondary"}>{c.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </div>

      {contracts.length > 0 && (
        <div className="flex flex-wrap items-end gap-3">
          <Select label="Contract" value={effectiveContract ?? ""}
            onChange={(e) => setContractId(Number(e.target.value))}
            options={contracts.map((c) => ({ value: String(c.id),
              label: `${c.plan_name ?? "All plans"} @ ${fmtNaira(c.rate_per_enrollee)}` }))} />
          <Input label="Period" type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
          <Button onClick={() => effectiveContract && hmoApi.runCapitation({
              contract_id: effectiveContract, period_code: period })
            .then((l) => { toast.success(`Schedule generated: ${l.enrollee_count} enrollees, ${fmtNaira(l.expected_amount)}.`); onChanged(); })
            .catch((e) => toast.error(e?.response?.data?.detail ?? "Failed to run capitation."))}>
            Run capitation
          </Button>
        </div>
      )}

      <DataTable columns={scheduleColumns} data={schedule} rowKey={(r) => r.id}
        empty={{ title: "No capitation schedules", description: "Run a month to snapshot the enrollee register." }} />
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
      default_coverage_percent: Number(form.default_coverage_percent),
      default_copay_flat: Number(form.default_copay_flat) }),
    onSuccess: () => { toast.success("Plan created."); onSaved(); },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? "Could not create the plan."),
  });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New HMO plan"
      footer={<div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={() => save.mutate()} disabled={!form.name || save.isPending}>Create plan</Button>
      </div>}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="Plan name" value={form.name} onChange={set("name")} />
        <Input label="Code" value={form.code} onChange={set("code")} />
        <Select label="Coverage type" value={form.coverage_type} onChange={set("coverage_type")}
          options={[{ value: "FEE_FOR_SERVICE", label: "Fee for service" },
                    { value: "CAPITATION", label: "Capitation" },
                    { value: "HYBRID", label: "Hybrid" }]} />
        <Input label="Tier" value={form.plan_tier} onChange={set("plan_tier")} placeholder="gold" />
        <Input label="Default coverage %" type="number" value={form.default_coverage_percent}
          onChange={set("default_coverage_percent")} />
        <Input label="Flat co-pay (₦)" type="number" value={form.default_copay_flat}
          onChange={set("default_copay_flat")} />
      </div>
    </Modal>
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
    <Modal isOpen onClose={onClose} title={`Benefit rules — ${plan.name}`} size="xl">
      <div className="mb-4 space-y-2">
        {benefits.map((b) => (
          <div key={b.id} className="flex items-center justify-between rounded-lg bg-secondary-50 px-3 py-2 text-sm">
            <span className="font-medium">{b.billable_service_name ?? b.category ?? "—"}</span>
            <span className="flex items-center gap-2 text-secondary-500">
              {b.is_excluded ? <Badge variant="soft-danger">Excluded</Badge> : (
                <>
                  {b.coverage_percent != null && `${parseFloat(b.coverage_percent)}%`}
                  {b.copay_flat != null && parseFloat(b.copay_flat) > 0 && ` · co-pay ${fmtNaira(b.copay_flat)}`}
                  {b.limit_amount != null && ` · cap ${fmtNaira(b.limit_amount)}/${b.limit_period}`}
                </>
              )}
              {b.requires_preauth && <Badge variant="soft-warning">Pre-auth</Badge>}
              <Button size="sm" variant="ghost" onClick={() =>
                hmoApi.deleteBenefit(b.id).then(() => detail.refetch())}>×</Button>
            </span>
          </div>
        ))}
        {benefits.length === 0 && <p className="text-sm text-secondary-500">No rules yet — plan defaults apply to everything.</p>}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Select label="Category" value={form.category}
          onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
          options={["CONSULTATION", "PHARMACY", "LAB", "RADIOLOGY", "PROCEDURE", "ADMISSION",
                    "MATERNITY", "DENTAL", "OPTICAL", "OTHER"].map((c) => ({ value: c, label: c }))} />
        <Input label="Coverage %" type="number" value={form.coverage_percent}
          onChange={(e) => setForm((f) => ({ ...f, coverage_percent: e.target.value }))} />
        <Input label="Flat co-pay" type="number" value={form.copay_flat}
          onChange={(e) => setForm((f) => ({ ...f, copay_flat: e.target.value }))} />
        <Input label="Limit amount" type="number" value={form.limit_amount}
          onChange={(e) => setForm((f) => ({ ...f, limit_amount: e.target.value }))} />
        <Select label="Limit period" value={form.limit_period}
          onChange={(e) => setForm((f) => ({ ...f, limit_period: e.target.value }))}
          options={[{ value: "", label: "No limit period" },
                    { value: "PER_VISIT", label: "Per visit" },
                    { value: "PER_ANNUM", label: "Per annum" },
                    { value: "LIFETIME", label: "Lifetime" }]} />
        <div className="flex items-end gap-4 pb-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.requires_preauth}
              onChange={(e) => setForm((f) => ({ ...f, requires_preauth: e.target.checked }))} />
            Pre-auth
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_excluded}
              onChange={(e) => setForm((f) => ({ ...f, is_excluded: e.target.checked }))} />
            Excluded
          </label>
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <Button onClick={add}><Plus className="mr-1 h-4 w-4" /> Add rule</Button>
      </div>
    </Modal>
  );
}
