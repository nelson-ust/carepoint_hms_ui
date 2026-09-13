import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Clock3, Plus, ReceiptText, Wallet } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/feedback/ToastProvider";
import { accountsApi, type Account } from "@/features/billing/api/accounts.api";
import { accountingApi, financeApi, type VendorBill } from "../api/accounting.api";

const NGN = (v: string | number) => `₦${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
const today = () => new Date().toISOString().slice(0, 10);

function statusVariant(s: string): any {
  return s === "PAID" ? "soft-success" : s === "OPEN" ? "soft-warning"
    : s === "PARTIALLY_PAID" ? "soft-info" : "soft-danger";
}

export function PayablesPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"bills" | "vendors" | "aging">("bills");
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

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <PageHeader title="Accounts Payable" description="Vendors, supplier bills and payments — every movement double-entry posted to the ledger." />
        <div className="flex gap-3">
          <Button variant="secondary" leftIcon={<Building2 className="h-4 w-4" />} onClick={() => setVendorOpen(true)}>New vendor</Button>
          <Button leftIcon={<Plus className="h-5 w-5" />} onClick={() => setBillOpen(true)}>New bill</Button>
        </div>
      </div>

      <div className="flex gap-2">
        {([["bills", "Bills", ReceiptText], ["vendors", "Vendors", Building2], ["aging", "AP Ageing", Clock3]] as const).map(([k, label, Icon]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold ${tab === k ? "bg-primary-600 text-white" : "bg-secondary-100 text-secondary-600 dark:bg-white/10 dark:text-secondary-300"}`}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === "bills" && (
        bills.isLoading ? <Skeleton className="h-40 w-full" /> : (bills.data ?? []).length === 0 ? (
          <Card className="p-10 text-center text-secondary-500">No vendor bills yet.</Card>
        ) : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="bg-secondary-50 text-secondary-500 text-[10px] uppercase tracking-widest dark:bg-white/5">
                <tr>
                  <th className="text-left px-5 py-3">Bill</th>
                  <th className="text-left px-5 py-3">Vendor</th>
                  <th className="text-left px-5 py-3">Dates</th>
                  <th className="text-right px-5 py-3">Total</th>
                  <th className="text-right px-5 py-3">Balance</th>
                  <th className="text-left px-5 py-3">Status</th>
                  <th className="text-right px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-100 dark:divide-white/5">
                {(bills.data ?? []).map((b) => (
                  <tr key={b.id} className="hover:bg-secondary-50/60 dark:hover:bg-white/5">
                    <td className="px-5 py-3">
                      <p className="data-mono text-xs font-bold">{b.bill_no}</p>
                      <p className="text-xs text-secondary-400 truncate max-w-[14rem]">{b.expense_account}</p>
                    </td>
                    <td className="px-5 py-3">{b.vendor_name}</td>
                    <td className="px-5 py-3 text-xs text-secondary-500 whitespace-nowrap">
                      {b.bill_date}{b.due_date ? ` → due ${b.due_date}` : ""}
                    </td>
                    <td className="px-5 py-3 text-right data-mono">{NGN(b.total_amount)}</td>
                    <td className="px-5 py-3 text-right data-mono font-bold">{NGN(b.balance_due)}</td>
                    <td className="px-5 py-3"><Badge variant={statusVariant(b.status)}>{b.status.replace(/_/g, " ")}</Badge></td>
                    <td className="px-5 py-3 text-right">
                      {(b.status === "OPEN" || b.status === "PARTIALLY_PAID") && (
                        <Button size="sm" variant="secondary" leftIcon={<Wallet className="h-3.5 w-3.5" />}
                          onClick={() => setPayFor(b)}>Pay</Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )
      )}

      {tab === "vendors" && (
        vendors.isLoading ? <Skeleton className="h-32 w-full" /> : (vendors.data ?? []).length === 0 ? (
          <Card className="p-10 text-center text-secondary-500">No vendors registered yet.</Card>
        ) : (
          <Card className="p-0 divide-y divide-secondary-100 dark:divide-white/5">
            {(vendors.data ?? []).map((v) => (
              <div key={v.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div>
                  <p className="font-bold text-sm">{v.name}</p>
                  <p className="text-xs text-secondary-400">{[v.contact_person, v.email, v.phone].filter(Boolean).join(" · ") || "—"}</p>
                </div>
                <Badge variant={v.is_active ? "soft-success" : "soft-danger"}>{v.is_active ? "ACTIVE" : "INACTIVE"}</Badge>
              </div>
            ))}
          </Card>
        )
      )}

      {tab === "aging" && (
        aging.isLoading ? <Skeleton className="h-40 w-full" /> : aging.data ? (
          <AgingView data={aging.data} kind="AP" />
        ) : null
      )}

      <VendorModal open={vendorOpen} onClose={() => setVendorOpen(false)}
        onDone={() => { setVendorOpen(false); qc.invalidateQueries({ queryKey: ["vendors"] }); }} />
      <BillModal open={billOpen} onClose={() => setBillOpen(false)}
        vendors={vendors.data ?? []}
        onDone={() => { setBillOpen(false); invalidate(); }} />
      <PayModal bill={payFor} onClose={() => setPayFor(null)}
        onDone={() => { setPayFor(null); invalidate(); }} />
    </div>
  );
}

export function AgingView({ data, kind }: { data: import("../api/accounting.api").AgingReport; kind: "AP" | "AR" }) {
  const buckets = [
    ["current", "Current"], ["d1_30", "1–30 days"], ["d31_60", "31–60 days"],
    ["d61_90", "61–90 days"], ["d90_plus", "90+ days"],
  ] as const;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {buckets.map(([k, label]) => (
          <Card key={k} className="p-4 text-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-secondary-400">{label}</p>
            <p className="data-mono text-lg font-black mt-1">{NGN((data.buckets as any)[k])}</p>
          </Card>
        ))}
      </div>
      <Card className="p-4 flex items-center justify-between">
        <span className="font-bold text-sm">Total outstanding {kind === "AP" ? "payables" : "receivables"} (as of {data.as_of})</span>
        <span className="data-mono text-lg font-black">{NGN(data.total_outstanding)}</span>
      </Card>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-secondary-50 text-secondary-500 text-[10px] uppercase tracking-widest dark:bg-white/5">
            <tr>
              <th className="text-left px-5 py-3">{kind === "AP" ? "Bill" : "Invoice"}</th>
              {kind === "AP" && <th className="text-left px-5 py-3">Vendor</th>}
              <th className="text-left px-5 py-3">Due</th>
              <th className="text-right px-5 py-3">Days overdue</th>
              <th className="text-right px-5 py-3">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-secondary-100 dark:divide-white/5">
            {data.items.length === 0 ? (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-secondary-400">Nothing outstanding. 🎉</td></tr>
            ) : data.items.map((r, i) => (
              <tr key={i}>
                <td className="px-5 py-2.5 data-mono text-xs font-bold">{r.bill_no || r.invoice_no}</td>
                {kind === "AP" && <td className="px-5 py-2.5">{r.vendor}</td>}
                <td className="px-5 py-2.5">{r.due_date}</td>
                <td className="px-5 py-2.5 text-right">{r.days_overdue}</td>
                <td className="px-5 py-2.5 text-right data-mono font-bold">{NGN(r.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
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
    <Modal isOpen={open} onClose={onClose} title="New vendor">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
        <Input label="Vendor name" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <Input label="Contact person" value={f.contact_person} onChange={(e) => setF({ ...f, contact_person: e.target.value })} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          <Input label="Phone" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        </div>
        <Button type="submit" isLoading={create.isPending}>Create vendor</Button>
      </form>
    </Modal>
  );
}

function BillModal({ open, onClose, onDone, vendors }: {
  open: boolean; onClose: () => void; onDone: () => void;
  vendors: import("../api/accounting.api").Vendor[];
}) {
  const toast = useToast();
  const [f, setF] = useState({ vendor_id: "", bill_date: today(), due_date: "", total_amount: "", expense_account_id: "", description: "" });
  const accounts = useQuery({ queryKey: ["accounts-all"], queryFn: () => accountsApi.list(), enabled: open });
  const create = useMutation({
    mutationFn: () => financeApi.createBill({
      vendor_id: Number(f.vendor_id), bill_date: f.bill_date,
      due_date: f.due_date || undefined, total_amount: Number(f.total_amount),
      expense_account_id: Number(f.expense_account_id), description: f.description || undefined,
    }),
    onSuccess: () => { toast.success("Bill booked", "Posted Dr expense / Cr Accounts Payable."); onDone(); },
    onError: (e: any) => toast.error("Couldn't book bill", accountingApi.errMsg(e, "")),
  });
  return (
    <Modal isOpen={open} onClose={onClose} title="New vendor bill" size="lg">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
        <Select label="Vendor" required value={f.vendor_id} onChange={(e) => setF({ ...f, vendor_id: e.target.value })}>
          <option value="">Select vendor…</option>
          {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </Select>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Bill date" type="date" required value={f.bill_date} onChange={(e) => setF({ ...f, bill_date: e.target.value })} />
          <Input label="Due date" type="date" value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Amount" type="number" min={0.01} step="0.01" required value={f.total_amount} onChange={(e) => setF({ ...f, total_amount: e.target.value })} />
          <Select label="Charge to account" required value={f.expense_account_id} onChange={(e) => setF({ ...f, expense_account_id: e.target.value })}>
            <option value="">Select account…</option>
            {(accounts.data ?? []).map((a: Account) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
          </Select>
        </div>
        <Textarea label="Description" rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        <Button type="submit" isLoading={create.isPending}>Book bill</Button>
      </form>
    </Modal>
  );
}

function PayModal({ bill, onClose, onDone }: { bill: VendorBill | null; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(today());
  const [method, setMethod] = useState("BANK_TRANSFER");
  const [reference, setReference] = useState("");
  const pay = useMutation({
    mutationFn: () => financeApi.payBill(bill!.id, {
      amount: Number(amount), paid_at: paidAt, payment_method: method, reference: reference || undefined,
    }),
    onSuccess: () => { toast.success("Payment recorded", "Posted Dr Accounts Payable / Cr cash."); setAmount(""); onDone(); },
    onError: (e: any) => toast.error("Couldn't record payment", accountingApi.errMsg(e, "")),
  });
  return (
    <Modal isOpen={!!bill} onClose={onClose} title={`Pay ${bill?.bill_no ?? ""}`}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); pay.mutate(); }}>
        <p className="text-sm text-secondary-500">Outstanding balance: <span className="data-mono font-bold">{NGN(bill?.balance_due ?? 0)}</span></p>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Amount" type="number" min={0.01} step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Input label="Paid on" type="date" required value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select label="Method" value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="BANK_TRANSFER">Bank transfer</option>
            <option value="CASH">Cash</option>
            <option value="POS">POS / Card</option>
            <option value="ONLINE">Online</option>
          </Select>
          <Input label="Reference" value={reference} onChange={(e) => setReference(e.target.value)} />
        </div>
        <Button type="submit" isLoading={pay.isPending}>Record payment</Button>
      </form>
    </Modal>
  );
}
