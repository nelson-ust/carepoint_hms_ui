import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FlaskConical, Pill, Plus, Truck, PackageCheck, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Modal } from "@/components/ui/Modal";
import { EntityPicker, type EntityOption } from "@/components/forms/EntityPicker";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/api/api-error";
import { listLabTests } from "@/features/laboratory/api/lab-tests.api";
import { listDrugs } from "@/features/drugs/api/drugs.api";
import {
  homeLabApi, homeMedApi, homeOrderStatusVariant, labelize,
  type HomeLabOrder, type HomeMedicationOrder,
} from "../api/home-health.api";

export function HomeOrdersSection({
  patientId, homeVisitId, carePlanId, address,
}: { patientId: number; homeVisitId?: number; carePlanId?: number | null; address?: string | null }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <HomeLabCard patientId={patientId} homeVisitId={homeVisitId} carePlanId={carePlanId} address={address} />
      <HomeMedCard patientId={patientId} homeVisitId={homeVisitId} carePlanId={carePlanId} address={address} />
    </div>
  );
}

// --------------------------------------------------------------------------
// Lab
// --------------------------------------------------------------------------
function HomeLabCard({ patientId, homeVisitId, carePlanId, address }: { patientId: number; homeVisitId?: number; carePlanId?: number | null; address?: string | null }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [showOrder, setShowOrder] = useState(false);
  const [resultItem, setResultItem] = useState<{ id: number; name: string } | null>(null);

  const key = ["home-lab", homeVisitId ?? patientId];
  const q = useQuery({ queryKey: key, queryFn: () => homeVisitId ? homeLabApi.list({ home_visit_id: homeVisitId }) : homeLabApi.list({ patient_id: patientId }) });
  const invalidate = () => qc.invalidateQueries({ queryKey: key });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => homeLabApi.setStatus(id, status),
    onSuccess: () => { invalidate(); toast.success("Lab order updated"); },
    onError: (e) => toast.error("Failed", apiErrorMessage(e, "Try again.")),
  });

  const orders = q.data?.items ?? [];
  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-secondary-500"><FlaskConical className="h-4 w-4" /> Home lab orders</h3>
        <Button size="sm" onClick={() => setShowOrder(true)}><Plus className="h-4 w-4" /> Order labs</Button>
      </div>
      {orders.length === 0 && <p className="text-sm text-secondary-400">No lab orders for this visit.</p>}
      {orders.map((o) => (
        <div key={o.id} className="rounded-xl border border-secondary-100 p-3 dark:border-white/5">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-secondary-800 dark:text-secondary-100">{o.order_no}</div>
            <Badge variant={homeOrderStatusVariant(o.status)}>{labelize(o.status)}</Badge>
          </div>
          <ul className="mt-2 space-y-1">
            {o.items.map((it) => (
              <li key={it.id} className="flex items-center justify-between text-sm">
                <span className="text-secondary-700 dark:text-secondary-200">{it.test_name || `Test #${it.lab_test_catalog_id}`}</span>
                <span className="flex items-center gap-2">
                  {it.result_value ? (
                    <span className={it.is_abnormal ? "font-semibold text-rose-600" : "text-secondary-600"}>{it.result_value} {it.result_unit}</span>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => setResultItem({ id: it.id, name: it.test_name || "test" })}>Enter result</Button>
                  )}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex flex-wrap gap-2">
            {o.status === "REQUESTED" && <Button size="sm" variant="secondary" onClick={() => statusMut.mutate({ id: o.id, status: "SAMPLE_COLLECTED" })}>Sample collected</Button>}
            {o.status === "SAMPLE_COLLECTED" && <Button size="sm" variant="secondary" onClick={() => statusMut.mutate({ id: o.id, status: "IN_TRANSIT" })}>In transit</Button>}
            {o.status === "IN_TRANSIT" && <Button size="sm" variant="secondary" onClick={() => statusMut.mutate({ id: o.id, status: "RECEIVED" })}>Received at lab</Button>}
          </div>
        </div>
      ))}

      {showOrder && (
        <OrderLabsModal patientId={patientId} homeVisitId={homeVisitId} carePlanId={carePlanId} address={address}
          onClose={() => setShowOrder(false)} onDone={() => { setShowOrder(false); invalidate(); toast.success("Lab order created"); }} />
      )}
      {resultItem && (
        <ResultModal item={resultItem} onClose={() => setResultItem(null)}
          onDone={() => { setResultItem(null); invalidate(); toast.success("Result recorded"); }} />
      )}
    </Card>
  );
}

function OrderLabsModal({ patientId, homeVisitId, carePlanId, address, onClose, onDone }: { patientId: number; homeVisitId?: number; carePlanId?: number | null; address?: string | null; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [tests, setTests] = useState<EntityOption[]>([]);
  const [note, setNote] = useState("");
  const mut = useMutation({
    mutationFn: () => homeLabApi.create({ patient_id: patientId, home_visit_id: homeVisitId, care_plan_id: carePlanId ?? undefined, clinical_note: note.trim() || undefined, collection_address: address ?? undefined, items: tests.map((t) => ({ lab_test_catalog_id: t.value })) }),
    onSuccess: onDone,
    onError: (e) => toast.error("Couldn't create order", apiErrorMessage(e, "Try again.")),
  });
  return (
    <Modal isOpen onClose={onClose} title="Order home labs" footer={
      <div className="flex justify-end gap-3"><Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button disabled={tests.length === 0 || mut.isPending} onClick={() => mut.mutate()}>{mut.isPending ? "Creating…" : "Create order"}</Button></div>}>
      <div className="space-y-4">
        <EntityPicker label="Add test" placeholder="Search lab tests…"
          value={null} onChange={(o) => { if (o && !tests.find((t) => t.value === o.value)) setTests([...tests, o]); }}
          search={async (query) => { const res = await listLabTests({ search: query, limit: 15 } as any); const items = (res as any)?.items ?? []; return items.map((t: any) => ({ value: t.id, label: t.name, sublabel: t.code })); }} />
        {tests.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tests.map((t) => (
              <span key={t.value} className="inline-flex items-center gap-1 rounded-full bg-primary-500/10 px-3 py-1 text-xs text-primary-700 dark:text-primary-300">
                {t.label}<button onClick={() => setTests(tests.filter((x) => x.value !== t.value))}><X className="h-3 w-3" /></button>
              </span>
            ))}
          </div>
        )}
        <Textarea label="Clinical note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
    </Modal>
  );
}

function ResultModal({ item, onClose, onDone }: { item: { id: number; name: string }; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState("");
  const [abnormal, setAbnormal] = useState(false);
  const mut = useMutation({
    mutationFn: () => homeLabApi.enterResult(item.id, { result_value: value.trim(), result_unit: unit.trim() || undefined, is_abnormal: abnormal }),
    onSuccess: onDone,
    onError: (e) => toast.error("Couldn't save result", apiErrorMessage(e, "Try again.")),
  });
  return (
    <Modal isOpen onClose={onClose} title={`Result — ${item.name}`} size="sm" footer={
      <div className="flex justify-end gap-3"><Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button disabled={!value.trim() || mut.isPending} onClick={() => mut.mutate()}>Save result</Button></div>}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Value" value={value} onChange={(e) => setValue(e.target.value)} />
          <Input label="Unit" value={unit} onChange={(e) => setUnit(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm text-secondary-600 dark:text-secondary-300">
          <input type="checkbox" checked={abnormal} onChange={(e) => setAbnormal(e.target.checked)} /> Flag as abnormal (alerts the care team)
        </label>
      </div>
    </Modal>
  );
}

// --------------------------------------------------------------------------
// Medication
// --------------------------------------------------------------------------
type MedLine = { drug: EntityOption; dosage: string; frequency: string; quantity: string };

function HomeMedCard({ patientId, homeVisitId, carePlanId, address }: { patientId: number; homeVisitId?: number; carePlanId?: number | null; address?: string | null }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [showRx, setShowRx] = useState(false);
  const key = ["home-med", homeVisitId ?? patientId];
  const q = useQuery({ queryKey: key, queryFn: () => homeVisitId ? homeMedApi.list({ home_visit_id: homeVisitId }) : homeMedApi.list({ patient_id: patientId }) });
  const invalidate = () => qc.invalidateQueries({ queryKey: key });

  const dispenseMut = useMutation({ mutationFn: (id: number) => homeMedApi.dispense(id), onSuccess: () => { invalidate(); toast.success("Dispensed"); }, onError: (e) => toast.error("Failed", apiErrorMessage(e, "Try again.")) });
  const dispatchMut = useMutation({ mutationFn: (id: number) => homeMedApi.dispatch(id, { courier_name: "In-house rider" }), onSuccess: () => { invalidate(); toast.success("Out for delivery"); }, onError: (e) => toast.error("Failed", apiErrorMessage(e, "Try again.")) });
  const deliverMut = useMutation({ mutationFn: (id: number) => homeMedApi.deliver(id), onSuccess: () => { invalidate(); toast.success("Delivered"); }, onError: (e) => toast.error("Failed", apiErrorMessage(e, "Try again.")) });

  const orders = q.data?.items ?? [];
  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-secondary-500"><Pill className="h-4 w-4" /> Home medications</h3>
        <Button size="sm" onClick={() => setShowRx(true)}><Plus className="h-4 w-4" /> Prescribe</Button>
      </div>
      {orders.length === 0 && <p className="text-sm text-secondary-400">No medication orders for this visit.</p>}
      {orders.map((o) => (
        <div key={o.id} className="rounded-xl border border-secondary-100 p-3 dark:border-white/5">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-secondary-800 dark:text-secondary-100">{o.order_no}</div>
            <Badge variant={homeOrderStatusVariant(o.status)}>{labelize(o.status)}</Badge>
          </div>
          <ul className="mt-2 space-y-1 text-sm text-secondary-700 dark:text-secondary-200">
            {o.items.map((it) => <li key={it.id}>{it.drug_name || `Drug #${it.drug_id}`} {it.drug_strength || ""} — {it.dosage || ""} {it.frequency || ""} ×{Number(it.quantity)}</li>)}
          </ul>
          <div className="mt-2 flex flex-wrap gap-2">
            {o.status === "PRESCRIBED" && <Button size="sm" variant="secondary" disabled={dispenseMut.isPending} onClick={() => dispenseMut.mutate(o.id)}><PackageCheck className="h-3.5 w-3.5" /> Dispense</Button>}
            {o.status === "DISPENSED" && <Button size="sm" variant="secondary" disabled={dispatchMut.isPending} onClick={() => dispatchMut.mutate(o.id)}><Truck className="h-3.5 w-3.5" /> Out for delivery</Button>}
            {o.status === "OUT_FOR_DELIVERY" && <Button size="sm" variant="primary" disabled={deliverMut.isPending} onClick={() => deliverMut.mutate(o.id)}>Confirm delivered</Button>}
          </div>
        </div>
      ))}
      {showRx && (
        <PrescribeModal patientId={patientId} homeVisitId={homeVisitId} carePlanId={carePlanId} address={address}
          onClose={() => setShowRx(false)} onDone={() => { setShowRx(false); invalidate(); toast.success("Medication prescribed"); }} />
      )}
    </Card>
  );
}

function PrescribeModal({ patientId, homeVisitId, carePlanId, address, onClose, onDone }: { patientId: number; homeVisitId?: number; carePlanId?: number | null; address?: string | null; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [lines, setLines] = useState<MedLine[]>([]);
  const [note, setNote] = useState("");
  const mut = useMutation({
    mutationFn: () => homeMedApi.create({ patient_id: patientId, home_visit_id: homeVisitId, care_plan_id: carePlanId ?? undefined, note: note.trim() || undefined, delivery_address: address ?? undefined,
      items: lines.map((l) => ({ drug_id: l.drug.value, dosage: l.dosage || undefined, frequency: l.frequency || undefined, quantity: l.quantity ? Number(l.quantity) : 1 })) }),
    onSuccess: onDone,
    onError: (e) => toast.error("Couldn't prescribe", apiErrorMessage(e, "Try again.")),
  });
  const update = (i: number, patch: Partial<MedLine>) => setLines(lines.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  return (
    <Modal isOpen onClose={onClose} title="Prescribe home medication" size="lg" footer={
      <div className="flex justify-end gap-3"><Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button disabled={lines.length === 0 || mut.isPending} onClick={() => mut.mutate()}>{mut.isPending ? "Saving…" : "Create order"}</Button></div>}>
      <div className="space-y-4">
        <EntityPicker label="Add drug" placeholder="Search drug formulary…" value={null}
          onChange={(o) => { if (o && !lines.find((l) => l.drug.value === o.value)) setLines([...lines, { drug: o, dosage: "", frequency: "", quantity: "1" }]); }}
          search={async (query) => { const res = await listDrugs({ limit: 500 }); const items = (res as any)?.items ?? []; const ql = query.toLowerCase(); return items.filter((d: any) => d.name.toLowerCase().includes(ql)).slice(0, 15).map((d: any) => ({ value: d.id, label: d.name, sublabel: d.strength })); }} />
        {lines.map((l, i) => (
          <div key={l.drug.value} className="rounded-xl border border-secondary-100 p-3 dark:border-white/5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium">{l.drug.label} {l.drug.sublabel || ""}</span>
              <button onClick={() => setLines(lines.filter((_, idx) => idx !== i))}><X className="h-4 w-4 text-secondary-400" /></button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Input label="Dosage" value={l.dosage} onChange={(e) => update(i, { dosage: e.target.value })} placeholder="e.g. 500mg" />
              <Input label="Frequency" value={l.frequency} onChange={(e) => update(i, { frequency: e.target.value })} placeholder="e.g. BD" />
              <Input label="Qty" type="number" value={l.quantity} onChange={(e) => update(i, { quantity: e.target.value })} />
            </div>
          </div>
        ))}
        <Textarea label="Note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
    </Modal>
  );
}
