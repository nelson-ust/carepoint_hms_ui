import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Clock3, Plus, ReceiptText, Wallet } from "lucide-react";
import {
  DxPage, DxPageHeader, DxPanel, DxBadge, DxButton, DxKpi, DxPopup, DxInput, DxSelect, DxTextarea,
  DxTabs, DxGrid, type DxGridColumn, type DxBadgeTone,
} from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import { accountsApi, type Account } from "@/features/billing/api/accounts.api";
import { accountingApi, financeApi, type VendorBill } from "../api/accounting.api";

const NGN = (v: string | number) => `₦${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
const today = () => new Date().toISOString().slice(0, 10);

function statusTone(s: string): DxBadgeTone {
  return s === "PAID" ? "success" : s === "OPEN" ? "warning" : s === "PARTIALLY_PAID" ? "info" : "danger";
}

type Tab = "bills" | "vendors" | "aging";

export function PayablesPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("bills");
  const [vendorOpen, setVendorOpen] = useState(false);
  const [billOpen, setBillOpen] = useState(false);
  const [payFor, setPayFor] = useState<VendorBill | null>(null);

  const vendors = useQuery({ queryKey: ["vendors"], queryFn: () => financeApi.listVendors() });
  const bills = useQuery({ queryKey: ["vendor-bills"], queryFn: () => financeApi.listBills() });
  const aging = useQuery({ queryKey: ["ap-aging"], queryFn: () => financeApi.apAging(), enabled: tab === "aging" });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["vendor-bills"] });
    qc.invalidateQueries({ queryKey: ["ap-aging"] });
  };

  const billColumns: DxGridColumn<VendorBill>[] = [
    { key: "bill_no", header: "Bill", render: (b) => (
        <div>
          <p className="dx-mono text-[12px] font-semibold text-[var(--dx-text)]">{b.bill_no}</p>
          <p className="max-w-[14rem] truncate text-[11px] text-[var(--dx-text-faint)]">{b.expense_account}</p>
        </div>) },
    { key: "vendor_name", header: "Vendor" },
    { key: "dates", header: "Dates", render: (b) => <span className="whitespace-nowrap text-[12px] text-[var(--dx-text-muted)]">{b.bill_date}{b.due_date ? ` → due ${b.due_date}` : ""}</span> },
    { key: "total_amount", header: "Total", align: "right", render: (b) => <span className="dx-mono">{NGN(b.total_amount)}</span> },
    { key: "balance_due", header: "Balance", align: "right", render: (b) => <span className="dx-mono font-semibold">{NGN(b.balance_due)}</span> },
    { key: "status", header: "Status", render: (b) => <DxBadge tone={statusTone(b.status)}>{b.status.replace(/_/g, " ")}</DxBadge> },
    { key: "act", header: "", align: "right", render: (b) => (b.status === "OPEN" || b.status === "PARTIALLY_PAID") ? (
        <DxButton size="sm" variant="default" leftIcon={<Wallet className="h-3.5 w-3.5" />} onClick={() => setPayFor(b)}>Pay</DxButton>) : null },
  ];

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Accounting" }, { label: "Payables" }]}
        title="Accounts Payable"
        subtitle="Vendors, supplier bills and payments — every movement double-entry posted to the ledger."
        actions={
          <>
            <DxButton variant="default" leftIcon={<Building2 className="h-4 w-4" />} onClick={() => setVendorOpen(true)}>New vendor</DxButton>
            <DxButton variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setBillOpen(true)}>New bill</DxButton>
          </>
        }
      />

      <DxTabs<Tab>
        value={tab}
        onChange={setTab}
        items={[
          { key: "bills", label: "Bills", icon: <ReceiptText className="h-4 w-4" /> },
          { key: "vendors", label: "Vendors", icon: <Building2 className="h-4 w-4" /> },
          { key: "aging", label: "AP Ageing", icon: <Clock3 className="h-4 w-4" /> },
        ]}
      />

      {tab === "bills" && (
        <DxPanel flush>
          <DxGrid<VendorBill>
            borderless columns={billColumns} data={bills.data} rowKey={(b) => b.id} isLoading={bills.isLoading}
            empty={{ icon: ReceiptText, title: "No vendor bills", description: "No vendor bills yet." }}
          />
        </DxPanel>
      )}

      {tab === "vendors" && (
        <DxPanel flush>
          {vendors.isLoading ? (
            <div className="p-4"><div className="dx-skeleton h-24 w-full" /></div>
          ) : (vendors.data ?? []).length === 0 ? (
            <div className="py-10 text-center text-[13px] text-[var(--dx-text-muted)]">No vendors registered yet.</div>
          ) : (
            <div className="divide-y divide-[var(--dx-border)]">
              {(vendors.data ?? []).map((v) => (
                <div key={v.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="text-[13px] font-semibold text-[var(--dx-text)]">{v.name}</p>
                    <p className="text-[11.5px] text-[var(--dx-text-muted)]">{[v.contact_person, v.email, v.phone].filter(Boolean).join(" · ") || "—"}</p>
                  </div>
                  <DxBadge tone={v.is_active ? "success" : "danger"}>{v.is_active ? "ACTIVE" : "INACTIVE"}</DxBadge>
                </div>
              ))}
            </div>
          )}
        </DxPanel>
      )}

      {tab === "aging" && (
        aging.isLoading ? <div className="dx-skeleton h-40 w-full rounded-lg" /> : aging.data ? <AgingView data={aging.data} kind="AP" /> : null
      )}

      <VendorModal open={vendorOpen} onClose={() => setVendorOpen(false)} onDone={() => { setVendorOpen(false); qc.invalidateQueries({ queryKey: ["vendors"] }); }} />
      <BillModal open={billOpen} onClose={() => setBillOpen(false)} vendors={vendors.data ?? []} onDone={() => { setBillOpen(false); invalidate(); }} />
      <PayModal bill={payFor} onClose={() => setPayFor(null)} onDone={() => { setPayFor(null); invalidate(); }} />
    </DxPage>
  );
}

export function AgingView({ data, kind }: { data: import("../api/accounting.api").AgingReport; kind: "AP" | "AR" }) {
  const buckets = [
    ["current", "Current"], ["d1_30", "1–30 days"], ["d31_60", "31–60 days"],
    ["d61_90", "61–90 days"], ["d90_plus", "90+ days"],
  ] as const;

  const agingColumns: DxGridColumn<any>[] = [
    { key: "ref", header: kind === "AP" ? "Bill" : "Invoice", render: (r: any) => <span className="dx-mono text-[12px] font-semibold">{r.bill_no || r.invoice_no}</span> },
    ...(kind === "AP" ? [{ key: "vendor", header: "Vendor", render: (r: any) => r.vendor } as DxGridColumn<any>] : []),
    { key: "due_date", header: "Due", render: (r: any) => r.due_date },
    { key: "days_overdue", header: "Days overdue", align: "right", render: (r: any) => r.days_overdue },
    { key: "balance", header: "Balance", align: "right", render: (r: any) => <span className="dx-mono font-semibold">{NGN(r.balance)}</span> },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {buckets.map(([k, label], i) => (
          <DxKpi key={k} label={label} tone={i >= 3 ? "warning" : i === 0 ? "success" : "neutral"} value={NGN((data.buckets as any)[k])} />
        ))}
      </div>
      <DxPanel>
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold text-[var(--dx-text)]">Total outstanding {kind === "AP" ? "payables" : "receivables"} (as of {data.as_of})</span>
          <span className="dx-mono text-[17px] font-bold text-[var(--dx-text)]">{NGN(data.total_outstanding)}</span>
        </div>
      </DxPanel>
      <DxPanel flush>
        <DxGrid<any>
          borderless columns={agingColumns} data={data.items} rowKey={(_, i) => i}
          empty={{ title: "Nothing outstanding 🎉" }}
        />
      </DxPanel>
    </div>
  );
}

function VendorModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ name: "", contact_person: "", email: "", phone: "" });
  const create = useMutation({
    mutationFn: () => financeApi.createVendor(f),
    onSuccess: () => { toast.success("Vendor created"); setF({ name: "", contact_person: "", email: "", phone: "" }); onDone(); },
    onError: (e: any) => toast.error("Couldn't create vendor", accountingApi.errMsg(e, "")),
  });
  return (
    <DxPopup isOpen={open} onClose={onClose} title="New vendor" size="md">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
        <DxInput label="Vendor name" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <DxInput label="Contact person" value={f.contact_person} onChange={(e) => setF({ ...f, contact_person: e.target.value })} />
        <div className="grid grid-cols-2 gap-3">
          <DxInput label="Email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          <DxInput label="Phone" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        </div>
        <div className="flex justify-end"><DxButton type="submit" variant="primary" isLoading={create.isPending}>Create vendor</DxButton></div>
      </form>
    </DxPopup>
  );
}

function BillModal({ open, onClose, onDone, vendors }: {
  open: boolean; onClose: () => void; onDone: () => void; vendors: import("../api/accounting.api").Vendor[];
}) {
  const toast = useToast();
  const [f, setF] = useState({ vendor_id: "", bill_date: today(), due_date: "", total_amount: "", expense_account_id: "", description: "" });
  const accounts = useQuery({ queryKey: ["accounts-all"], queryFn: () => accountsApi.list(), enabled: open });
  const create = useMutation({
    mutationFn: () => financeApi.createBill({
      vendor_id: Number(f.vendor_id), bill_date: f.bill_date, due_date: f.due_date || undefined,
      total_amount: Number(f.total_amount), expense_account_id: Number(f.expense_account_id), description: f.description || undefined,
    }),
    onSuccess: () => { toast.success("Bill booked", "Posted Dr expense / Cr Accounts Payable."); onDone(); },
    onError: (e: any) => toast.error("Couldn't book bill", accountingApi.errMsg(e, "")),
  });
  return (
    <DxPopup isOpen={open} onClose={onClose} title="New vendor bill" size="md">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
        <DxSelect label="Vendor" required value={f.vendor_id} onChange={(e) => setF({ ...f, vendor_id: e.target.value })}
          options={[{ value: "", label: "Select vendor…" }, ...vendors.map((v) => ({ value: String(v.id), label: v.name }))]} />
        <div className="grid grid-cols-2 gap-3">
          <DxInput label="Bill date" type="date" required value={f.bill_date} onChange={(e) => setF({ ...f, bill_date: e.target.value })} />
          <DxInput label="Due date" type="date" value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <DxInput label="Amount" type="number" mono min={0.01} step="0.01" required value={f.total_amount} onChange={(e) => setF({ ...f, total_amount: e.target.value })} />
          <DxSelect label="Charge to account" required value={f.expense_account_id} onChange={(e) => setF({ ...f, expense_account_id: e.target.value })}
            options={[{ value: "", label: "Select account…" }, ...(accounts.data ?? []).map((a: Account) => ({ value: String(a.id), label: `${a.code} · ${a.name}` }))]} />
        </div>
        <DxTextarea label="Description" rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        <div className="flex justify-end"><DxButton type="submit" variant="primary" isLoading={create.isPending}>Book bill</DxButton></div>
      </form>
    </DxPopup>
  );
}

function PayModal({ bill, onClose, onDone }: { bill: VendorBill | null; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(today());
  const [method, setMethod] = useState("BANK_TRANSFER");
  const [reference, setReference] = useState("");
  const pay = useMutation({
    mutationFn: () => financeApi.payBill(bill!.id, { amount: Number(amount), paid_at: paidAt, payment_method: method, reference: reference || undefined }),
    onSuccess: () => { toast.success("Payment recorded", "Posted Dr Accounts Payable / Cr cash."); setAmount(""); onDone(); },
    onError: (e: any) => toast.error("Couldn't record payment", accountingApi.errMsg(e, "")),
  });
  return (
    <DxPopup isOpen={!!bill} onClose={onClose} title={`Pay ${bill?.bill_no ?? ""}`} size="md">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); pay.mutate(); }}>
        <p className="text-[13px] text-[var(--dx-text-muted)]">Outstanding balance: <span className="dx-mono font-semibold text-[var(--dx-text)]">{NGN(bill?.balance_due ?? 0)}</span></p>
        <div className="grid grid-cols-2 gap-3">
          <DxInput label="Amount" type="number" mono min={0.01} step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} />
          <DxInput label="Paid on" type="date" required value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <DxSelect label="Method" value={method} onChange={(e) => setMethod(e.target.value)}
            options={[{ value: "BANK_TRANSFER", label: "Bank transfer" }, { value: "CASH", label: "Cash" }, { value: "POS", label: "POS / Card" }, { value: "ONLINE", label: "Online" }]} />
          <DxInput label="Reference" value={reference} onChange={(e) => setReference(e.target.value)} />
        </div>
        <div className="flex justify-end"><DxButton type="submit" variant="primary" isLoading={pay.isPending}>Record payment</DxButton></div>
      </form>
    </DxPopup>
  );
}
