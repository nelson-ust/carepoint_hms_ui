import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Pill, Plus, RotateCcw, Trash2 } from "lucide-react";
import {
  DxButton,
  DxGrid,
  DxInput,
  DxMessage,
  DxPanel,
  DxPopup,
  DxSelect,
  DxStatusBadge,
  DxTextarea,
  apiErrorMessage,
  formatDateTime,
  type DxGridColumn,
} from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import {
  asPrescriptionItemArray,
  cancelPrescription,
  createPrescription,
  listPrescriptionsForVisit,
} from "../api/prescriptions.api";
import type { CreatePrescriptionItemPayload, Prescription, PrescriptionItem } from "../api/prescriptions.api";
import { listDrugs } from "@/features/drugs/api/drugs.api";
import type { Drug } from "@/features/drugs/api/drugs.api";

type PrescriptionsPanelProps = {
  visitId: number;
  consultationId?: number | null;
  /** Read-only mode (e.g. when consultation is finalised) */
  disabled?: boolean;
};

type DraftItem = {
  drug_id: string;
  dose: string;
  route: string;
  frequency: string;
  duration: string;
  quantity: string;
  instructions: string;
};

const emptyDraftItem: DraftItem = {
  drug_id: "",
  dose: "",
  route: "PO",
  frequency: "",
  duration: "",
  quantity: "1",
  instructions: "",
};

const ROUTES = ["PO", "IV", "IM", "SC", "PR", "TOP", "INH", "SL", "OTHER"];

const sortPrescriptions = (items: Prescription[]) =>
  [...items].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

/**
 * Medications ordered during the visit. Writing a prescription is gated by an
 * active, non-finalised consultation; charges are captured on the visit bill.
 */
export function PrescriptionsPanel({ visitId, consultationId, disabled }: PrescriptionsPanelProps) {
  const toast = useToast();
  const qc = useQueryClient();
  const queryKey = ["prescriptions", "visit", visitId] as const;

  const [createOpen, setCreateOpen] = useState(false);
  const [draftNote, setDraftNote] = useState("");
  const [draftItems, setDraftItems] = useState<DraftItem[]>([{ ...emptyDraftItem }]);
  const [createError, setCreateError] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Prescription | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const prescriptionsQuery = useQuery({
    queryKey,
    queryFn: async () => sortPrescriptions((await listPrescriptionsForVisit(visitId)).items ?? []),
    enabled: Number.isFinite(visitId),
  });
  const drugsQuery = useQuery({
    queryKey: ["drugs", "all", 500],
    queryFn: () => listDrugs({ skip: 0, limit: 500 }).catch(() => null),
  });
  const prescriptions = prescriptionsQuery.data ?? [];
  const drugs: Drug[] = drugsQuery.data?.items ?? [];

  const canCreate = !disabled && !!consultationId;

  const openCreate = () => {
    setDraftNote("");
    setDraftItems([{ ...emptyDraftItem }]);
    setCreateError(null);
    setCreateOpen(true);
  };
  const addDraftItem = () => setDraftItems((prev) => [...prev, { ...emptyDraftItem }]);
  const removeDraftItem = (idx: number) => setDraftItems((prev) => prev.filter((_, i) => i !== idx));
  const updateDraftItem = (idx: number, patch: Partial<DraftItem>) =>
    setDraftItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  const createMutation = useMutation({
    mutationFn: (items: CreatePrescriptionItemPayload[]) =>
      createPrescription({
        visit_id: visitId,
        consultation_id: consultationId as number,
        note: draftNote.trim() || undefined,
        items,
        auto_capture_charge: true,
      }),
    onSuccess: (res) => {
      qc.setQueryData<Prescription[]>(queryKey, (old) => sortPrescriptions([res.prescription, ...(old ?? [])]));
      qc.invalidateQueries({ queryKey: ["visits", visitId, "timeline"] });
      setCreateOpen(false);
      toast.success("Prescription submitted", res.message || "Charges have been captured on the visit bill.");
    },
    onError: (err) => setCreateError(apiErrorMessage(err, "Failed to create prescription.")),
  });

  const cancelMutation = useMutation({
    mutationFn: (vars: { id: number; reason: string }) => cancelPrescription(vars.id, { reason: vars.reason }),
    onSuccess: (res) => {
      qc.setQueryData<Prescription[]>(queryKey, (old) => (old ?? []).map((p) => (p.id === res.prescription.id ? res.prescription : p)));
      setCancelTarget(null);
      setCancelReason("");
      toast.success("Prescription cancelled", res.message || undefined);
    },
    onError: (err) => toast.error("Could not cancel prescription", apiErrorMessage(err)),
  });

  const handleCreate = () => {
    if (!consultationId) {
      setCreateError("Active consultation required.");
      return;
    }
    const validItems = draftItems.filter((it) => it.drug_id && it.dose.trim());
    if (validItems.length === 0) {
      setCreateError("Add at least one item with a drug and dose.");
      return;
    }
    setCreateError(null);
    createMutation.mutate(
      validItems.map((it) => ({
        drug_id: Number(it.drug_id),
        dose: it.dose.trim(),
        route: it.route || undefined,
        frequency: it.frequency.trim() || undefined,
        duration: it.duration.trim() || undefined,
        quantity: Number(it.quantity) || 1,
        instructions: it.instructions.trim() || undefined,
      })),
    );
  };

  const drugOf = (it: PrescriptionItem): Drug | undefined => it.drug || drugs.find((d) => d.id === it.drug_id);

  const itemColumns: DxGridColumn<PrescriptionItem>[] = [
    {
      key: "drug",
      header: "Drug",
      wrap: true,
      render: (it) => {
        const drug = drugOf(it);
        return (
          <div className="min-w-0">
            <div className="font-medium">{drug?.name ?? `Drug #${it.drug_id}`}</div>
            {drug?.strength || it.instructions ? (
              <div className="dx-muted text-[11.5px]">
                {[drug?.strength, it.instructions].filter(Boolean).join(" · ")}
              </div>
            ) : null}
          </div>
        );
      },
    },
    { key: "dose", header: "Dose", width: 110 },
    { key: "route", header: "Route", width: 70, render: (it) => it.route ?? "PO" },
    { key: "frequency", header: "Frequency", width: 100, render: (it) => it.frequency ?? "—" },
    { key: "duration", header: "Duration", width: 100, render: (it) => it.duration ?? "—" },
    { key: "quantity", header: "Qty", width: 60, align: "right", render: (it) => <span className="dx-num">{it.quantity}</span> },
  ];

  const drugOptions = drugs.map((d) => ({ value: String(d.id), label: `${d.name}${d.strength ? ` · ${d.strength}` : ""}` }));

  return (
    <DxPanel
      title="Prescriptions"
      icon={<Pill />}
      description="Medications ordered during this visit."
      flush={prescriptions.length === 0}
      actions={
        <>
          <DxButton size="sm" variant="text" icon title="Refresh" onClick={() => prescriptionsQuery.refetch()}>
            <RotateCcw className={prescriptionsQuery.isFetching ? "animate-spin" : undefined} />
          </DxButton>
          {canCreate ? (
            <DxButton size="sm" variant="primary" leftIcon={<Plus />} onClick={openCreate}>
              New prescription
            </DxButton>
          ) : null}
        </>
      }
    >
      {prescriptionsQuery.isError ? (
        <div className="p-3">
          <DxMessage
            tone="danger"
            action={
              <DxButton size="sm" onClick={() => prescriptionsQuery.refetch()} leftIcon={<RotateCcw />}>
                Retry
              </DxButton>
            }
          >
            {apiErrorMessage(prescriptionsQuery.error, "Unable to load prescriptions.")}
          </DxMessage>
        </div>
      ) : prescriptionsQuery.isLoading ? (
        <div className="space-y-2 p-3">
          <div className="dx-skeleton h-3.5 w-2/3" />
          <div className="dx-skeleton h-3.5 w-1/2" />
        </div>
      ) : prescriptions.length === 0 ? (
        <div className="dx-grid-state">
          <Pill aria-hidden />
          <p className="dx-grid-state-title">No prescriptions raised for this visit yet</p>
          {canCreate ? (
            <div className="mt-2">
              <DxButton size="sm" variant="primary" leftIcon={<Plus />} onClick={openCreate}>
                Write prescription
              </DxButton>
            </div>
          ) : !consultationId ? (
            <p>Start a consultation to prescribe.</p>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3">
          {prescriptions.map((p) => {
            const statusKey = (p.status || "DRAFT").toUpperCase();
            const items = asPrescriptionItemArray(p.items);
            const canCancel = !disabled && !["DISPENSED", "CANCELLED"].includes(statusKey);
            return (
              <section key={p.id} className="dx-panel">
                <header className="dx-panel-header">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="dx-mono font-semibold">{p.prescription_no}</span>
                    <DxStatusBadge status={p.status} />
                    <span className="dx-muted text-[11.5px]">{formatDateTime(p.prescribed_at || p.created_at)}</span>
                    <span className="dx-faint text-[11.5px]">· {items.length} item{items.length === 1 ? "" : "s"}</span>
                  </div>
                  {canCancel ? (
                    <DxButton
                      size="sm"
                      variant="outline-danger"
                      leftIcon={<Ban />}
                      onClick={() => {
                        setCancelTarget(p);
                        setCancelReason("");
                      }}
                    >
                      Cancel
                    </DxButton>
                  ) : null}
                </header>
                {p.note ? <p className="dx-muted border-b border-[var(--dx-border)] px-3 py-2 text-[12px] italic">{p.note}</p> : null}
                <DxGrid
                  columns={itemColumns}
                  data={items}
                  rowKey={(it) => it.id}
                  borderless
                  striped={false}
                  empty={{ title: "No items" }}
                />
              </section>
            );
          })}
        </div>
      )}

      {/* ---- New prescription ---- */}
      <DxPopup
        isOpen={createOpen}
        onClose={() => !createMutation.isPending && setCreateOpen(false)}
        title="New prescription"
        size="lg"
        locked={createMutation.isPending}
        footer={
          <>
            <span className="dx-faint mr-auto text-[11.5px]">Charges are auto-captured from drug pricing.</span>
            <DxButton onClick={() => setCreateOpen(false)} disabled={createMutation.isPending}>
              Cancel
            </DxButton>
            <DxButton variant="primary" isLoading={createMutation.isPending} onClick={handleCreate}>
              Submit prescription
            </DxButton>
          </>
        }
      >
        <div className="space-y-4">
          {createError ? <DxMessage tone="danger">{createError}</DxMessage> : null}
          <DxTextarea
            label="Clinical note (optional)"
            rows={2}
            value={draftNote}
            onChange={(e) => setDraftNote(e.target.value)}
            placeholder="Notes for the pharmacist or context for the prescription…"
          />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="dx-caption">Items</span>
              <DxButton size="sm" variant="accent-text" leftIcon={<Plus />} onClick={addDraftItem}>
                Add item
              </DxButton>
            </div>
            {draftItems.map((it, idx) => (
              <fieldset key={idx} className="dx-group">
                <legend className="dx-group-caption">Item {idx + 1}</legend>
                {draftItems.length > 1 ? (
                  <div className="absolute right-1 top-1">
                    <DxButton size="sm" variant="text" icon title="Remove item" onClick={() => removeDraftItem(idx)}>
                      <Trash2 />
                    </DxButton>
                  </div>
                ) : null}
                <div className="dx-form dx-form-4">
                  <DxSelect
                    label="Drug"
                    required
                    fieldClassName="dx-col-span-2"
                    placeholder="Pick a drug…"
                    value={it.drug_id}
                    onChange={(e) => updateDraftItem(idx, { drug_id: e.target.value })}
                    options={drugOptions}
                  />
                  <DxInput label="Dose" required value={it.dose} onChange={(e) => updateDraftItem(idx, { dose: e.target.value })} placeholder="500 mg" />
                  <DxSelect label="Route" value={it.route} onChange={(e) => updateDraftItem(idx, { route: e.target.value })} options={ROUTES.map((r) => ({ value: r, label: r }))} />
                  <DxInput label="Frequency" value={it.frequency} onChange={(e) => updateDraftItem(idx, { frequency: e.target.value })} placeholder="TDS, BD" />
                  <DxInput label="Duration" value={it.duration} onChange={(e) => updateDraftItem(idx, { duration: e.target.value })} placeholder="5 days" />
                  <DxInput label="Quantity" type="number" min={1} mono value={it.quantity} onChange={(e) => updateDraftItem(idx, { quantity: e.target.value })} />
                  <DxInput label="Instructions" value={it.instructions} onChange={(e) => updateDraftItem(idx, { instructions: e.target.value })} placeholder="After meals, with water…" />
                </div>
              </fieldset>
            ))}
          </div>
        </div>
      </DxPopup>

      {/* ---- Cancel prescription ---- */}
      <DxPopup
        isOpen={!!cancelTarget}
        onClose={() => !cancelMutation.isPending && setCancelTarget(null)}
        title="Cancel prescription"
        size="sm"
        locked={cancelMutation.isPending}
        footer={
          <>
            <DxButton onClick={() => setCancelTarget(null)} disabled={cancelMutation.isPending}>
              Close
            </DxButton>
            <DxButton
              variant="danger"
              leftIcon={<Ban />}
              isLoading={cancelMutation.isPending}
              disabled={!cancelReason.trim()}
              onClick={() => cancelTarget && cancelMutation.mutate({ id: cancelTarget.id, reason: cancelReason.trim() })}
            >
              Cancel prescription
            </DxButton>
          </>
        }
      >
        <div className="space-y-3">
          <DxMessage tone="warning">
            <span className="dx-mono">{cancelTarget?.prescription_no}</span> · {asPrescriptionItemArray(cancelTarget?.items).length} item(s). The
            pharmacy will no longer dispense it.
          </DxMessage>
          <DxTextarea
            label="Reason"
            required
            rows={3}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Why is this prescription being cancelled?"
            autoFocus
          />
        </div>
      </DxPopup>
    </DxPanel>
  );
}
