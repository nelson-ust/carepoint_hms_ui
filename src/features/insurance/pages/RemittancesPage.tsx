import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { DataTable, type DataTableColumn } from "@/components/data-table/DataTable";
import { useToast } from "@/components/feedback/ToastProvider";
import { hmoApi, fmtNaira, type Remittance } from "../api/hmo.api";

export function RemittancesPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [allocating, setAllocating] = useState<Remittance | null>(null);

  const remittances = useQuery({ queryKey: ["hmo", "remittances"], queryFn: () => hmoApi.listRemittances() });
  const providers = useQuery({ queryKey: ["hmo", "providers"], queryFn: () => hmoApi.listProviders() });

  const columns: DataTableColumn<Remittance>[] = [
    { key: "reference", header: "Reference",
      render: (r) => (
        <div>
          <div className="font-semibold">{r.reference}</div>
          <div className="text-xs text-secondary-500">{r.provider_name} · {r.received_at}</div>
        </div>) },
    { key: "total_amount", header: "Total", align: "right", render: (r) => fmtNaira(r.total_amount) },
    { key: "allocated_amount", header: "Allocated", align: "right", render: (r) => fmtNaira(r.allocated_amount) },
    { key: "unallocated_amount", header: "On account", align: "right",
      render: (r) => <span className={parseFloat(r.unallocated_amount) > 0 ? "font-semibold text-warning-600" : ""}>
        {fmtNaira(r.unallocated_amount)}</span> },
    { key: "status", header: "Status", render: (r) => (
        <Badge variant={r.status === "ALLOCATED" ? "soft-success"
          : r.status === "PARTIALLY_ALLOCATED" ? "soft-warning" : "secondary"}>
          {r.status.replace(/_/g, " ")}
        </Badge>) },
    { key: "act", header: "", align: "right", render: (r) => (
        parseFloat(r.unallocated_amount) > 0
          ? <Button size="sm" onClick={(e) => { e.stopPropagation(); setAllocating(r); }}>Allocate</Button>
          : null) },
  ];

  return (
    <div>
      <PageHeader title="Remittances" description="Bulk HMO payments allocated to claims and capitation."
        actions={<Button onClick={() => setCreateOpen(true)}><Plus className="mr-1 h-4 w-4" /> Record remittance</Button>} />
      <Card className="p-4">
        <DataTable columns={columns} data={remittances.data} rowKey={(r) => r.id}
          isLoading={remittances.isLoading}
          error={remittances.isError ? "Could not load remittances." : null}
          onRetry={() => remittances.refetch()}
          empty={{ title: "No remittances", description: "Record bulk payments received from HMOs here." }} />
      </Card>

      {createOpen && (
        <CreateModal providers={(providers.data ?? []).map((pr) => ({ value: String(pr.id), label: pr.name }))}
          onClose={() => setCreateOpen(false)}
          onSaved={() => { setCreateOpen(false); qc.invalidateQueries({ queryKey: ["hmo"] }); }} />
      )}
      {allocating && (
        <AllocateModal advice={allocating} onClose={() => setAllocating(null)}
          onSaved={() => { setAllocating(null); qc.invalidateQueries({ queryKey: ["hmo"] });
            toast.success("Remittance allocated."); }} />
      )}
    </div>
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
    <Modal isOpen onClose={onClose} title="Record a remittance"
      footer={<div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={!form.insurance_provider_id || !form.total_amount}>Save</Button>
      </div>}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select label="Payer" value={form.insurance_provider_id}
          onChange={(e) => setForm((f) => ({ ...f, insurance_provider_id: e.target.value }))}
          options={[{ value: "", label: "Select payer…" }, ...providers]} />
        <Input label="Total amount (₦)" type="number" value={form.total_amount}
          onChange={(e) => setForm((f) => ({ ...f, total_amount: e.target.value }))} />
        <Input label="Received on" type="date" value={form.received_at}
          onChange={(e) => setForm((f) => ({ ...f, received_at: e.target.value }))} />
        <Input label="Bank reference" value={form.reference}
          onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))} />
      </div>
    </Modal>
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

  const totalEntered = Object.values(amounts)
    .reduce((s, v) => s + (parseFloat(v) || 0), 0);
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
    <Modal isOpen onClose={onClose} title={`Allocate ${advice.reference}`} size="xl"
      footer={<div className="flex w-full items-center justify-between">
        <span className={`text-sm ${totalEntered > unallocated ? "text-danger-600" : "text-secondary-500"}`}>
          Entered {fmtNaira(totalEntered)} of {fmtNaira(unallocated)} unallocated
        </span>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={totalEntered <= 0 || totalEntered > unallocated}>
            <Banknote className="mr-1 h-4 w-4" /> Apply allocation
          </Button>
        </div>
      </div>}>
      <div className="space-y-4">
        <div>
          <h3 className="mb-2 font-semibold text-secondary-900">Open claims</h3>
          <div className="max-h-56 space-y-1 overflow-y-auto">
            {(suggestions.data?.open_claims ?? []).map((c) => (
              <div key={c.claim_id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-secondary-50 px-3 py-2">
                <span className="text-sm">
                  <span className="font-medium">{c.claim_no}</span>
                  <span className="ml-2 text-secondary-500">outstanding {fmtNaira(c.outstanding)}</span>
                  {c.exact_amount_match && <Badge className="ml-2" variant="soft-success">exact match</Badge>}
                </span>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="ghost" onClick={() =>
                    setAmounts((a) => ({ ...a, [`claim:${c.claim_id}`]: c.outstanding }))}>Full</Button>
                  <Input className="w-32" type="number" placeholder="0.00"
                    value={amounts[`claim:${c.claim_id}`] ?? ""}
                    onChange={(e) => setAmounts((a) => ({ ...a, [`claim:${c.claim_id}`]: e.target.value }))} />
                </div>
              </div>
            ))}
            {suggestions.data?.open_claims?.length === 0 && (
              <p className="text-sm text-secondary-500">No approved unpaid claims for this payer.</p>)}
          </div>
        </div>
        <div>
          <h3 className="mb-2 font-semibold text-secondary-900">Open capitation</h3>
          <div className="space-y-1">
            {(suggestions.data?.open_capitation ?? []).map((c) => (
              <div key={c.capitation_schedule_line_id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-secondary-50 px-3 py-2">
                <span className="text-sm">
                  <span className="font-medium">Capitation {c.period_code}</span>
                  <span className="ml-2 text-secondary-500">outstanding {fmtNaira(c.outstanding)}</span>
                </span>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="ghost" onClick={() =>
                    setAmounts((a) => ({ ...a, [`cap:${c.capitation_schedule_line_id}`]: c.outstanding }))}>Full</Button>
                  <Input className="w-32" type="number" placeholder="0.00"
                    value={amounts[`cap:${c.capitation_schedule_line_id}`] ?? ""}
                    onChange={(e) => setAmounts((a) => ({
                      ...a, [`cap:${c.capitation_schedule_line_id}`]: e.target.value }))} />
                </div>
              </div>
            ))}
            {suggestions.data?.open_capitation?.length === 0 && (
              <p className="text-sm text-secondary-500">No unpaid capitation schedules.</p>)}
          </div>
        </div>
      </div>
    </Modal>
  );
}
