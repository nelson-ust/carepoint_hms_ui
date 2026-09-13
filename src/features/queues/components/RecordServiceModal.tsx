import { useMemo, useState } from "react";
import { Plus, Receipt, Search, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/api/api-error";
import type { BillableService, QueueTicket } from "../api/queues.api";
import { useBillableServices, useRecordVisitServices } from "../hooks/use-queue";
import { ticketPatientName } from "./ticket-cards";

type Line = {
  key: string;
  billable_service_id?: number;
  service_name: string;
  service_code?: string;
  quantity: number;
  unit_price: number;
};

function naira(v: number): string {
  return `₦${(Number.isFinite(v) ? v : 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Record services rendered at the CURRENT service delivery point for a serving
 * patient — pick from the billable-services catalogue (or add a custom line),
 * set quantities, and capture the charges onto the visit bill in one action.
 */
export function RecordServiceModal({
  ticket,
  sdpId,
  sdpName,
  onClose,
}: {
  ticket: QueueTicket | null;
  sdpId: number | null;
  sdpName?: string | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [customName, setCustomName] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [done, setDone] = useState<number | null>(null);

  const servicesQuery = useBillableServices(search.trim() || undefined);
  const recordMut = useRecordVisitServices();
  const services = servicesQuery.data ?? [];

  const total = useMemo(
    () => lines.reduce((sum, l) => sum + l.quantity * l.unit_price, 0),
    [lines],
  );

  const addService = (s: BillableService) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.billable_service_id === s.id);
      if (existing) {
        return prev.map((l) => (l.billable_service_id === s.id ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [
        ...prev,
        {
          key: `svc-${s.id}-${Date.now()}`,
          billable_service_id: s.id,
          service_name: s.name,
          service_code: s.code,
          quantity: 1,
          unit_price: Number(s.default_price) || 0,
        },
      ];
    });
  };

  const addCustom = () => {
    const name = customName.trim();
    if (!name) return;
    setLines((prev) => [
      ...prev,
      { key: `custom-${Date.now()}`, service_name: name, quantity: 1, unit_price: Number(customPrice) || 0 },
    ]);
    setCustomName("");
    setCustomPrice("");
  };

  const updateLine = (key: string, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const removeLine = (key: string) => setLines((prev) => prev.filter((l) => l.key !== key));

  const submit = () => {
    if (!ticket || lines.length === 0) return;
    recordMut.mutate(
      {
        visitId: ticket.visit_id,
        payload: {
          service_delivery_point_id: sdpId ?? undefined,
          items: lines.map((l) => ({
            billable_service_id: l.billable_service_id,
            service_name: l.service_name,
            service_code: l.service_code,
            quantity: l.quantity,
            unit_price: l.unit_price,
          })),
        },
      },
      {
        onSuccess: (res) => {
          setDone(res.recorded);
          toast.success("Services recorded", `${res.recorded} service(s) added to the visit bill.`);
        },
        onError: (err) => toast.error("Couldn't record", apiErrorMessage(err, "Please try again.")),
      },
    );
  };

  const reset = () => {
    setLines([]);
    setSearch("");
    setCustomName("");
    setCustomPrice("");
    setDone(null);
  };

  return (
    <Modal
      isOpen={ticket !== null}
      onClose={() => { reset(); onClose(); }}
      title="Record Services Rendered"
      size="xl"
      footer={
        done !== null ? (
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => { reset(); }}>Record more</Button>
            <Button size="sm" onClick={() => { reset(); onClose(); }}>Done</Button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-bold text-secondary-900">Total: {naira(total)}</span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => { reset(); onClose(); }}>Cancel</Button>
              <Button size="sm" isLoading={recordMut.isPending} disabled={lines.length === 0} onClick={submit} leftIcon={<Receipt className="h-3.5 w-3.5" />}>
                Record {lines.length > 0 ? `${lines.length} service(s)` : "services"}
              </Button>
            </div>
          </div>
        )
      }
    >
      {ticket ? (
        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl bg-primary-500/5 px-4 py-3 text-sm">
          <span className="font-black text-secondary-900">{ticket.queue_number}</span>
          <span className="font-bold text-secondary-800">{ticketPatientName(ticket)}</span>
          <span className="data-mono text-xs text-secondary-500">{ticket.hospital_number ?? `#${ticket.patient_id}`}</span>
          {sdpName ? <span className="ml-auto text-xs font-semibold text-primary-600">at {sdpName}</span> : null}
        </div>
      ) : null}

      {done !== null ? (
        <div className="py-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500">
            <Receipt className="h-6 w-6" />
          </div>
          <p className="font-bold text-secondary-900">{done} service(s) recorded</p>
          <p className="mt-1 text-sm text-secondary-400">Charges were added to this visit's bill and tagged to the current service point.</p>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {/* Catalogue */}
          <div>
            <p className="mb-2 text-xs font-black uppercase tracking-widest text-secondary-400">Service catalogue</p>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary-300" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search services…" className="pl-9" />
            </div>
            <div className="mt-3 max-h-72 space-y-1.5 overflow-y-auto pr-1">
              {servicesQuery.isLoading ? (
                Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-11 w-full rounded-xl" />)
              ) : services.length === 0 ? (
                <p className="py-6 text-center text-sm text-secondary-400">No services found.</p>
              ) : (
                services.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => addService(s)}
                    className="flex w-full items-center justify-between gap-2 rounded-xl border border-secondary-100 px-3 py-2 text-left transition-colors hover:border-primary-200 hover:bg-primary-500/5"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-secondary-800">{s.name}</span>
                      <span className="data-mono text-[11px] text-secondary-400">{s.code}{s.category ? ` · ${s.category}` : ""}</span>
                    </span>
                    <span className="flex items-center gap-2 whitespace-nowrap text-xs font-bold text-secondary-600">
                      {naira(Number(s.default_price) || 0)}
                      <Plus className="h-4 w-4 text-primary-500" />
                    </span>
                  </button>
                ))
              )}
            </div>
            <div className="mt-3 rounded-2xl border border-dashed border-secondary-200 p-3">
              <p className="mb-2 text-[11px] font-black uppercase tracking-widest text-secondary-400">Custom service</p>
              <div className="flex gap-2">
                <Input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="Service name" className="flex-1" />
                <Input value={customPrice} onChange={(e) => setCustomPrice(e.target.value)} placeholder="Price" type="number" className="w-24" />
                <Button variant="secondary" size="sm" onClick={addCustom} disabled={!customName.trim()}>Add</Button>
              </div>
            </div>
          </div>

          {/* Selected lines */}
          <div>
            <p className="mb-2 text-xs font-black uppercase tracking-widest text-secondary-400">Services to record</p>
            {lines.length === 0 ? (
              <div className="rounded-2xl border border-secondary-100 bg-secondary-50/50 p-8 text-center text-sm text-secondary-400">
                Pick services from the catalogue — they'll appear here for you to confirm quantities.
              </div>
            ) : (
              <div className="space-y-2">
                {lines.map((l) => (
                  <div key={l.key} className="rounded-2xl border border-secondary-100 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-secondary-900">{l.service_name}</p>
                        {l.service_code ? <p className="data-mono text-[11px] text-secondary-400">{l.service_code}</p> : null}
                      </div>
                      <button type="button" onClick={() => removeLine(l.key)} className="rounded-lg p-1 text-secondary-400 hover:bg-rose-500/10 hover:text-rose-500" aria-label="Remove">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex items-center rounded-xl border border-secondary-100">
                        <button type="button" className="px-2.5 py-1 text-secondary-500 hover:text-secondary-900" onClick={() => updateLine(l.key, { quantity: Math.max(1, l.quantity - 1) })}>−</button>
                        <span className="w-8 text-center text-sm font-bold">{l.quantity}</span>
                        <button type="button" className="px-2.5 py-1 text-secondary-500 hover:text-secondary-900" onClick={() => updateLine(l.key, { quantity: l.quantity + 1 })}>+</button>
                      </div>
                      <span className="text-xs text-secondary-400">×</span>
                      <Input
                        type="number"
                        value={String(l.unit_price)}
                        onChange={(e) => updateLine(l.key, { unit_price: Number(e.target.value) || 0 })}
                        className="h-9 w-28"
                      />
                      <span className="ml-auto text-sm font-black text-secondary-900">{naira(l.quantity * l.unit_price)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
