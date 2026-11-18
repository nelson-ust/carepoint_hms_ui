import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, Plus } from "lucide-react";
import {
  DxPage, DxPageHeader, DxPanel, DxButton, DxBadge, DxInput, DxSelect, DxPopup,
  DxGrid, type DxGridColumn,
} from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import { hmoApi, fmtNaira, type Remittance } from "../api/hmo.api";

export function RemittancesPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [allocating, setAllocating] = useState<Remittance | null>(null);

  const remittances = useQuery({ queryKey: ["hmo", "remittances"], queryFn: () => hmoApi.listRemittances() });
  const providers = useQuery({ queryKey: ["hmo", "providers"], queryFn: () => hmoApi.listProviders() });

  const columns: DxGridColumn<Remittance>[] = [
    { key: "reference", header: "Reference", render: (r) => (
        <div>
          <div className="font-semibold text-[var(--dx-text)]">{r.reference}</div>
          <div className="text-[11.5px] text-[var(--dx-text-muted)]">{r.provider_name} · {r.received_at}</div>
        </div>) },
    { key: "total_amount", header: "Total", align: "right", render: (r) => <span className="dx-mono">{fmtNaira(r.total_amount)}</span> },
    { key: "allocated_amount", header: "Allocated", align: "right", render: (r) => <span className="dx-mono">{fmtNaira(r.allocated_amount)}</span> },
    { key: "unallocated_amount", header: "On account", align: "right", render: (r) => (
        <span className={`dx-mono ${parseFloat(r.unallocated_amount) > 0 ? "font-semibold text-[var(--dx-warning,#d97706)]" : ""}`}>{fmtNaira(r.unallocated_amount)}</span>) },
    { key: "status", header: "Status", render: (r) => (
        <DxBadge dot tone={r.status === "ALLOCATED" ? "success" : r.status === "PARTIALLY_ALLOCATED" ? "warning" : "neutral"}>
          {r.status.replace(/_/g, " ")}
        </DxBadge>) },
    { key: "act", header: "", align: "right", render: (r) => (
        parseFloat(r.unallocated_amount) > 0
          ? <DxButton size="sm" variant="primary" onClick={(e) => { e.stopPropagation(); setAllocating(r); }}>Allocate</DxButton>
          : null) },
  ];

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Insurance" }, { label: "Remittances" }]}
        title="Remittances"
        subtitle="Bulk HMO payments allocated to claims and capitation."
        actions={<DxButton variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>Record remittance</DxButton>}
      />
      <DxPanel flush>
        <DxGrid<Remittance>
          borderless columns={columns} data={remittances.data} rowKey={(r) => r.id}
          isLoading={remittances.isLoading}
          error={remittances.isError ? "Could not load remittances." : null}
          onRetry={() => remittances.refetch()}
          empty={{ icon: Banknote, title: "No remittances", description: "Record bulk payments received from HMOs here." }}
        />
      </DxPanel>

      {createOpen && (
        <CreateModal providers={(providers.data ?? []).map((pr) => ({ value: String(pr.id), label: pr.name }))}
          onClose={() => setCreateOpen(false)}
          onSaved={() => { setCreateOpen(false); qc.invalidateQueries({ queryKey: ["hmo"] }); }} />
      )}
      {allocating && (
        <AllocateModal advice={allocating} onClose={() => setAllocating(null)}
          onSaved={() => { setAllocating(null); qc.invalidateQueries({ queryKey: ["hmo"] }); toast.success("Remittance allocated."); }} />
      )}
    </DxPage>
  );
}

function CreateModal({ providers, onClose, onSaved }: {
  providers: { value: string; label: string }[]; onClose: () => void; onSaved: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({ insurance_provider_id: "", total_amount: "",
    received_at: new Date().toISOString().slice(0, 10), reference: "", notes: "" });
  const save = () => hmoApi.createRemittance({
      insurance_provider_id: Number(form.insurance_provider_id),
      total_amount: Number(form.total_amount),
      received_at: form.received_at,
      reference: form.reference || undefined, notes: form.notes || undefined })
    .then(onSaved)
    .catch((e) => toast.error(e?.response?.data?.detail ?? "Could not record the remittance."));
  return (
    <DxPopup isOpen onClose={onClose} title="Record a remittance" size="md"
      footer={<>
        <DxButton variant="text" onClick={onClose}>Cancel</DxButton>
        <DxButton variant="primary" onClick={save} disabled={!form.insurance_provider_id || !form.total_amount}>Save</DxButton>
      </>}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <DxSelect label="Payer" value={form.insurance_provider_id}
          onChange={(e) => setForm((f) => ({ ...f, insurance_provider_id: e.target.value }))}
          options={[{ value: "", label: "Select payer…" }, ...providers]} />
        <DxInput label="Total amount (₦)" type="number" mono value={form.total_amount}
          onChange={(e) => setForm((f) => ({ ...f, total_amount: e.target.value }))} />
        <DxInput label="Received on" type="date" value={form.received_at}
          onChange={(e) => setForm((f) => ({ ...f, received_at: e.target.value }))} />
        <DxInput label="Bank reference" value={form.reference}
          onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))} />
      </div>
    </DxPopup>
  );
}

function AllocateModal({ advice, onClose, onSaved }: {
  advice: Remittance; onClose: () => void; onSaved: () => void;
}) {
  const toast = useToast();
  const suggestions = useQuery({
    queryKey: ["hmo", "remit-suggestions", advice.id],
    queryFn: () => hmoApi.remittanceSuggestions(advice.id),
  });
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  const totalEntered = Object.values(amounts).reduce((s, v) => s + (parseFloat(v) || 0), 0);
  const unallocated = parseFloat(advice.unallocated_amount);

  const submit = () => {
    const allocations = Object.entries(amounts)
      .filter(([, v]) => parseFloat(v) > 0)
      .map(([k, v]) => {
        const [kind, id] = k.split(":");
        return kind === "claim"
          ? { claim_id: Number(id), amount: parseFloat(v) }
          : { capitation_schedule_line_id: Number(id), amount: parseFloat(v) };
      });
    if (!allocations.length) return;
    hmoApi.allocateRemittance(advice.id, allocations)
      .then(onSaved)
      .catch((e) => toast.error(e?.response?.data?.detail ?? "Allocation failed."));
  };

  return (
    <DxPopup isOpen onClose={onClose} title={`Allocate ${advice.reference}`} size="lg"
      footer={<div className="flex w-full items-center justify-between">
        <span className={`text-[13px] ${totalEntered > unallocated ? "text-[var(--dx-danger,#e11d48)]" : "text-[var(--dx-text-muted)]"}`}>
          Entered {fmtNaira(totalEntered)} of {fmtNaira(unallocated)} unallocated
        </span>
        <div className="flex gap-2">
          <DxButton variant="text" onClick={onClose}>Cancel</DxButton>
          <DxButton variant="primary" onClick={submit} disabled={totalEntered <= 0 || totalEntered > unallocated} leftIcon={<Banknote className="h-4 w-4" />}>
            Apply allocation
          </DxButton>
        </div>
      </div>}>
      <div className="space-y-4">
        <div>
          <h3 className="mb-2 font-semibold text-[var(--dx-text)]">Open claims</h3>
          <div className="max-h-56 space-y-1 overflow-y-auto">
            {(suggestions.data?.open_claims ?? []).map((c) => (
              <div key={c.claim_id} className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-[var(--dx-surface-sunken)] px-3 py-2">
                <span className="text-[13px]">
                  <span className="font-medium text-[var(--dx-text)]">{c.claim_no}</span>
                  <span className="ml-2 text-[var(--dx-text-muted)]">outstanding {fmtNaira(c.outstanding)}</span>
                  {c.exact_amount_match && <DxBadge className="ml-2" tone="success">exact match</DxBadge>}
                </span>
                <div className="flex items-center gap-2">
                  <DxButton size="sm" variant="text" onClick={() => setAmounts((a) => ({ ...a, [`claim:${c.claim_id}`]: c.outstanding }))}>Full</DxButton>
                  <DxInput className="w-32" type="number" mono placeholder="0.00"
                    value={amounts[`claim:${c.claim_id}`] ?? ""}
                    onChange={(e) => setAmounts((a) => ({ ...a, [`claim:${c.claim_id}`]: e.target.value }))} />
                </div>
              </div>
            ))}
            {suggestions.data?.open_claims?.length === 0 && (
              <p className="text-[13px] text-[var(--dx-text-muted)]">No approved unpaid claims for this payer.</p>)}
          </div>
        </div>
        <div>
          <h3 className="mb-2 font-semibold text-[var(--dx-text)]">Open capitation</h3>
          <div className="space-y-1">
            {(suggestions.data?.open_capitation ?? []).map((c) => (
              <div key={c.capitation_schedule_line_id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-[var(--dx-surface-sunken)] px-3 py-2">
                <span className="text-[13px]">
                  <span className="font-medium text-[var(--dx-text)]">Capitation {c.period_code}</span>
                  <span className="ml-2 text-[var(--dx-text-muted)]">outstanding {fmtNaira(c.outstanding)}</span>
                </span>
                <div className="flex items-center gap-2">
                  <DxButton size="sm" variant="text" onClick={() => setAmounts((a) => ({ ...a, [`cap:${c.capitation_schedule_line_id}`]: c.outstanding }))}>Full</DxButton>
                  <DxInput className="w-32" type="number" mono placeholder="0.00"
                    value={amounts[`cap:${c.capitation_schedule_line_id}`] ?? ""}
                    onChange={(e) => setAmounts((a) => ({ ...a, [`cap:${c.capitation_schedule_line_id}`]: e.target.value }))} />
                </div>
              </div>
            ))}
            {suggestions.data?.open_capitation?.length === 0 && (
              <p className="text-[13px] text-[var(--dx-text-muted)]">No unpaid capitation schedules.</p>)}
          </div>
        </div>
      </div>
    </DxPopup>
  );
}
