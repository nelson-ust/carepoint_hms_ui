import { useMemo, useState } from "react";
import { Minus, Plus, Receipt, Trash2 } from "lucide-react";
import {
  DxButton,
  DxGrid,
  DxInput,
  DxMessage,
  DxPopup,
  DxSearchBox,
  formatNaira,
  type DxGridColumn,
} from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/api/api-error";
import type { BillableService, QueueTicket } from "../api/queues.api";
import { useBillableServices, useRecordVisitServices } from "../hooks/use-queue";
import { ticketPatientName } from "../lib/ticket-utils";

type Line = {
  key: string;
  billable_service_id?: number;
  service_name: string;
  service_code?: string;
  quantity: number;
  unit_price: number;
};

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

  const total = useMemo(() => lines.reduce((sum, l) => sum + l.quantity * l.unit_price, 0), [lines]);

  const addService = (s: BillableService) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.billable_service_id === s.id);
      if (existing) return prev.map((l) => (l.billable_service_id === s.id ? { ...l, quantity: l.quantity + 1 } : l));
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
    setLines((prev) => [...prev, { key: `custom-${Date.now()}`, service_name: name, quantity: 1, unit_price: Number(customPrice) || 0 }]);
    setCustomName("");
    setCustomPrice("");
  };

  const updateLine = (key: string, patch: Partial<Line>) => setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
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
  const close = () => {
    reset();
    onClose();
  };

  const catalogueColumns: DxGridColumn<BillableService>[] = [
    {
      key: "name",
      header: "Service",
      render: (s) => (
        <div className="min-w-0">
          <div className="dx-row-primary truncate">{s.name}</div>
          <div className="dx-row-secondary dx-mono">
            {s.code}
            {s.category ? ` · ${s.category}` : ""}
          </div>
        </div>
      ),
      wrap: true,
    },
    { key: "default_price", header: "Price", align: "right", width: 110, render: (s) => <span className="dx-mono">{formatNaira(Number(s.default_price) || 0)}</span> },
    {
      key: "add",
      header: "",
      width: 44,
      align: "center",
      render: (s) => (
        <DxButton size="sm" variant="accent-text" icon title="Add" onClick={() => addService(s)}>
          <Plus aria-hidden />
        </DxButton>
      ),
    },
  ];

  const lineColumns: DxGridColumn<Line>[] = [
    {
      key: "service_name",
      header: "Service",
      wrap: true,
      render: (l) => (
        <div className="min-w-0">
          <div className="dx-row-primary truncate">{l.service_name}</div>
          {l.service_code ? <div className="dx-row-secondary dx-mono">{l.service_code}</div> : null}
        </div>
      ),
    },
    {
      key: "quantity",
      header: "Qty",
      width: 110,
      align: "center",
      render: (l) => (
        <span className="inline-flex items-center gap-1">
          <DxButton size="sm" variant="text" icon onClick={() => updateLine(l.key, { quantity: Math.max(1, l.quantity - 1) })} title="Decrease">
            <Minus aria-hidden />
          </DxButton>
          <span className="dx-mono w-6 text-center font-semibold">{l.quantity}</span>
          <DxButton size="sm" variant="text" icon onClick={() => updateLine(l.key, { quantity: l.quantity + 1 })} title="Increase">
            <Plus aria-hidden />
          </DxButton>
        </span>
      ),
    },
    {
      key: "unit_price",
      header: "Unit price",
      width: 120,
      align: "right",
      render: (l) => (
        <input
          type="number"
          className="dx-editor dx-editor-sm dx-mono text-right"
          value={String(l.unit_price)}
          onChange={(e) => updateLine(l.key, { unit_price: Number(e.target.value) || 0 })}
          aria-label="Unit price"
        />
      ),
    },
    { key: "amount", header: "Amount", width: 120, align: "right", render: (l) => <span className="dx-mono font-semibold">{formatNaira(l.quantity * l.unit_price)}</span> },
    {
      key: "remove",
      header: "",
      width: 40,
      align: "center",
      render: (l) => (
        <DxButton size="sm" variant="text" icon onClick={() => removeLine(l.key)} title="Remove" className="text-[var(--dx-danger)]">
          <Trash2 aria-hidden />
        </DxButton>
      ),
    },
  ];

  return (
    <DxPopup
      isOpen={ticket !== null}
      onClose={close}
      title="Record services rendered"
      size="xl"
      locked={recordMut.isPending}
      footer={
        done !== null ? (
          <>
            <DxButton onClick={reset}>Record more</DxButton>
            <DxButton variant="primary" onClick={close}>
              Done
            </DxButton>
          </>
        ) : (
          <>
            <span className="mr-auto text-[13px]">
              Total <b className="dx-mono">{formatNaira(total)}</b>
            </span>
            <DxButton onClick={close}>Cancel</DxButton>
            <DxButton variant="primary" isLoading={recordMut.isPending} disabled={lines.length === 0} onClick={submit} leftIcon={<Receipt />}>
              Record {lines.length > 0 ? `${lines.length} service(s)` : "services"}
            </DxButton>
          </>
        )
      }
    >
      {ticket ? (
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded border border-[var(--dx-border)] bg-[var(--dx-surface-alt)] px-3 py-2 text-[12.5px]">
          <span className="dx-mono font-semibold">{ticket.queue_number}</span>
          <span className="font-semibold">{ticketPatientName(ticket)}</span>
          <span className="dx-mono dx-muted">{ticket.hospital_number ?? `#${ticket.patient_id}`}</span>
          {sdpName ? <span className="ml-auto dx-muted">at {sdpName}</span> : null}
        </div>
      ) : null}

      {done !== null ? (
        <DxMessage tone="success" title={`${done} service(s) recorded`}>
          Charges were added to this visit's bill and tagged to the current service point.
        </DxMessage>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <p className="dx-caption">Service catalogue</p>
            <DxSearchBox onSearch={setSearch} placeholder="Search services…" size="sm" />
            <DxGrid
              columns={catalogueColumns}
              data={services}
              rowKey={(s) => s.id}
              isLoading={servicesQuery.isLoading}
              onRowClick={addService}
              maxHeight={260}
              striped={false}
              verticalLines={false}
              empty={{ title: "No services found" }}
            />
            <div className="rounded border border-dashed border-[var(--dx-border-strong)] p-2">
              <p className="dx-caption mb-1.5">Custom service</p>
              <div className="flex gap-2">
                <DxInput editorSize="sm" value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="Service name" fieldClassName="flex-1" className="flex-1" />
                <DxInput editorSize="sm" type="number" value={customPrice} onChange={(e) => setCustomPrice(e.target.value)} placeholder="Price" className="w-24" mono />
                <DxButton size="sm" onClick={addCustom} disabled={!customName.trim()}>
                  Add
                </DxButton>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <p className="dx-caption">Services to record</p>
            <DxGrid
              columns={lineColumns}
              data={lines}
              rowKey={(l) => l.key}
              striped={false}
              maxHeight={340}
              empty={{ title: "Nothing selected yet", description: "Pick services from the catalogue — confirm quantities here." }}
              summary={lines.length ? { amount: <span className="dx-mono">{formatNaira(total)}</span>, service_name: "Total" } : undefined}
            />
          </div>
        </div>
      )}
    </DxPopup>
  );
}
