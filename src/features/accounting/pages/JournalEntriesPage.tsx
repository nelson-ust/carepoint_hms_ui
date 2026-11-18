import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpenCheck, Plus, RotateCcw, Trash2, Undo2, UploadCloud, Eye, Scale } from "lucide-react";
import {
  DxPage, DxPageHeader, DxPanel, DxBadge, DxButton, DxPopup, DxInput, DxSelect, DxCheckbox,
  DxGrid, type DxGridColumn, type DxBadgeTone,
} from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import { accountsApi, type Account } from "@/features/billing/api/accounts.api";
import { accountingApi } from "../api/accounting.api";

const NGN = (v: string | number) => `₦${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

function fmtDate(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function statusTone(s: string): DxBadgeTone {
  return s === "POSTED" ? "success" : s === "DRAFT" ? "warning" : "danger";
}

type JEntry = {
  id: number; entry_no: string; entry_date: string; memo?: string | null;
  source_type: string; total_debit: string | number; status: string;
};
type DraftLine = { account_id: string; debit: string; credit: string; description: string };
const emptyLine = (): DraftLine => ({ account_id: "", debit: "", credit: "", description: "" });

export function JournalEntriesPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);

  const list = useQuery({
    queryKey: ["je", statusFilter, page],
    queryFn: () => accountingApi.listEntries({ status: statusFilter || undefined, page, page_size: 25 }),
  });
  const detail = useQuery({ queryKey: ["je-detail", detailId], queryFn: () => accountingApi.getEntry(detailId!), enabled: !!detailId });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["je"] });

  const post = useMutation({ mutationFn: (id: number) => accountingApi.postEntry(id), onSuccess: () => { invalidate(); toast.success("Entry posted"); }, onError: (e: any) => toast.error("Couldn't post", accountingApi.errMsg(e, "")) });
  const reverse = useMutation({ mutationFn: (id: number) => accountingApi.reverseEntry(id), onSuccess: () => { invalidate(); toast.success("Entry reversed"); }, onError: (e: any) => toast.error("Couldn't reverse", accountingApi.errMsg(e, "")) });
  const del = useMutation({ mutationFn: (id: number) => accountingApi.deleteDraft(id), onSuccess: () => { invalidate(); toast.success("Draft deleted"); }, onError: (e: any) => toast.error("Couldn't delete", accountingApi.errMsg(e, "")) });
  const autoPost = useMutation({
    mutationFn: () => accountingApi.autoPost(),
    onSuccess: (r) => { invalidate(); toast.success("Auto-posting complete", `${r.created} new entr${r.created === 1 ? "y" : "ies"} posted · ${r.skipped_existing} already booked.`); },
    onError: (e: any) => toast.error("Auto-posting failed", accountingApi.errMsg(e, "")),
  });

  const items = (list.data?.items ?? []) as JEntry[];
  const total = list.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / 25));

  const columns: DxGridColumn<JEntry>[] = [
    { key: "entry_no", header: "Entry", render: (e) => <span className="dx-mono text-[12px] font-semibold">{e.entry_no}</span> },
    { key: "entry_date", header: "Date", render: (e) => <span className="whitespace-nowrap">{fmtDate(e.entry_date)}</span> },
    { key: "memo", header: "Memo", render: (e) => <span className="block max-w-[16rem] truncate">{e.memo || "—"}</span> },
    { key: "source_type", header: "Source", render: (e) => <DxBadge tone="neutral">{e.source_type.replace(/_/g, " ")}</DxBadge> },
    { key: "total_debit", header: "Amount", align: "right", render: (e) => <span className="dx-mono font-semibold">{NGN(e.total_debit)}</span> },
    { key: "status", header: "Status", render: (e) => <DxBadge tone={statusTone(e.status)}>{e.status}</DxBadge> },
    { key: "actions", header: "", align: "right", render: (e) => (
        <div className="flex justify-end gap-1">
          <DxButton icon size="sm" variant="text" title="View lines" onClick={() => setDetailId(e.id)}><Eye className="h-3.5 w-3.5" /></DxButton>
          {e.status === "DRAFT" && (
            <>
              <DxButton size="sm" variant="default" isLoading={post.isPending} onClick={() => post.mutate(e.id)}>Post</DxButton>
              <DxButton icon size="sm" variant="text" title="Delete draft" onClick={() => del.mutate(e.id)}><Trash2 className="h-3.5 w-3.5" /></DxButton>
            </>
          )}
          {e.status === "POSTED" && <DxButton icon size="sm" variant="text" title="Reverse entry" onClick={() => reverse.mutate(e.id)}><Undo2 className="h-3.5 w-3.5" /></DxButton>}
        </div>) },
  ];

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Accounting" }, { label: "Journal Entries" }]}
        title="Journal Entries"
        subtitle="Double-entry journal — every entry balances, posted entries feed the ledgers and financial statements."
        actions={
          <>
            <DxButton icon title="Refresh" onClick={() => list.refetch()} isLoading={list.isFetching}><RotateCcw /></DxButton>
            <DxButton variant="default" leftIcon={<UploadCloud className="h-4 w-4" />} isLoading={autoPost.isPending} onClick={() => autoPost.mutate()} title="Sweep patient payments, expense claims and salary advances into the ledger (never double-books)">Auto-post operations</DxButton>
            <DxButton variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>New entry</DxButton>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="w-48">
          <DxSelect aria-label="Status" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            options={[{ value: "", label: "All statuses" }, { value: "DRAFT", label: "Draft" }, { value: "POSTED", label: "Posted" }, { value: "REVERSED", label: "Reversed" }]} />
        </div>
        <span className="ml-auto text-[12px] font-semibold text-[var(--dx-text-muted)]">{total} entries</span>
      </div>

      <DxPanel flush>
        <DxGrid<JEntry>
          borderless columns={columns} data={items} rowKey={(e) => e.id} isLoading={list.isLoading}
          empty={{ icon: BookOpenCheck, title: "No journal entries", description: "No journal entries yet. Create one manually or run “Auto-post operations”." }}
        />
      </DxPanel>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <DxButton size="sm" variant="default" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</DxButton>
          <span className="text-[12px] font-semibold text-[var(--dx-text-muted)]">Page {page} / {pages}</span>
          <DxButton size="sm" variant="default" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</DxButton>
        </div>
      )}

      <CreateEntryModal open={createOpen} onClose={() => setCreateOpen(false)} onDone={() => { setCreateOpen(false); invalidate(); }} />

      <DxPopup isOpen={!!detailId} onClose={() => setDetailId(null)} title={detail.data?.entry_no ?? "Journal entry"} size="lg">
        {detail.isLoading ? <div className="dx-skeleton h-40 w-full" /> : detail.data ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-[13px]">
              <DxBadge tone={statusTone(detail.data.status)}>{detail.data.status}</DxBadge>
              <DxBadge tone="neutral">{detail.data.source_type.replace(/_/g, " ")}</DxBadge>
              <span className="text-[var(--dx-text-muted)]">{fmtDate(detail.data.entry_date)} · {detail.data.period_code}</span>
            </div>
            {detail.data.memo && <p className="text-[13px] italic text-[var(--dx-text-muted)]">“{detail.data.memo}”</p>}
            <div className="overflow-hidden rounded-lg border border-[var(--dx-border)]">
              <table className="w-full text-[12.5px]">
                <thead className="bg-[var(--dx-surface-sunken)] text-left text-[11px] uppercase tracking-wide text-[var(--dx-text-muted)]">
                  <tr><th className="px-4 py-2">Account</th><th className="px-4 py-2">Description</th><th className="px-4 py-2 text-right">Debit</th><th className="px-4 py-2 text-right">Credit</th></tr>
                </thead>
                <tbody className="divide-y divide-[var(--dx-border)]">
                  {(detail.data.lines ?? []).map((l) => (
                    <tr key={l.id}>
                      <td className="px-4 py-2"><span className="dx-mono font-semibold">{l.account_code}</span> {l.account_name}</td>
                      <td className="px-4 py-2">{l.description || "—"}</td>
                      <td className="px-4 py-2 text-right dx-mono">{Number(l.debit) ? NGN(l.debit) : ""}</td>
                      <td className="px-4 py-2 text-right dx-mono">{Number(l.credit) ? NGN(l.credit) : ""}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-[var(--dx-surface-sunken)] font-semibold">
                  <tr>
                    <td className="px-4 py-2" colSpan={2}>Totals</td>
                    <td className="px-4 py-2 text-right dx-mono">{NGN(detail.data.total_debit)}</td>
                    <td className="px-4 py-2 text-right dx-mono">{NGN(detail.data.total_credit)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        ) : null}
      </DxPopup>
    </DxPage>
  );
}

function CreateEntryModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [memo, setMemo] = useState("");
  const [autoPostFlag, setAutoPostFlag] = useState(true);
  const [lines, setLines] = useState<DraftLine[]>([emptyLine(), emptyLine()]);

  const accounts = useQuery({ queryKey: ["accounts-all"], queryFn: () => accountsApi.list(), enabled: open });

  const totals = useMemo(() => {
    const d = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
    const c = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
    return { d, c, balanced: d > 0 && Math.abs(d - c) < 0.005 };
  }, [lines]);

  const create = useMutation({
    mutationFn: () => accountingApi.createEntry({
      entry_date: entryDate, memo: memo || undefined, auto_post: autoPostFlag,
      lines: lines.filter((l) => l.account_id).map((l) => ({ account_id: Number(l.account_id), debit: Number(l.debit) || 0, credit: Number(l.credit) || 0, description: l.description || undefined })),
    }),
    onSuccess: () => { toast.success(autoPostFlag ? "Entry created & posted" : "Draft entry created"); setLines([emptyLine(), emptyLine()]); setMemo(""); onDone(); },
    onError: (e: any) => toast.error("Couldn't create entry", accountingApi.errMsg(e, "")),
  });

  const setLine = (i: number, patch: Partial<DraftLine>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const accountOptions = [{ value: "", label: "Select account…" }, ...(accounts.data ?? []).map((a: Account) => ({ value: String(a.id), label: `${a.code} · ${a.name}` }))];

  return (
    <DxPopup isOpen={open} onClose={onClose} title="New journal entry" size="lg">
      <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
        <div className="grid gap-4 sm:grid-cols-3">
          <DxInput label="Entry date" type="date" required value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
          <div className="sm:col-span-2"><DxInput label="Memo" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="What is this entry for?" /></div>
        </div>

        <div className="space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-12 items-end gap-2">
              <div className="col-span-4"><DxSelect label={i === 0 ? "Account" : undefined} value={l.account_id} onChange={(e) => setLine(i, { account_id: e.target.value })} options={accountOptions} /></div>
              <div className="col-span-3"><DxInput label={i === 0 ? "Description" : undefined} value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} /></div>
              <div className="col-span-2"><DxInput label={i === 0 ? "Debit" : undefined} type="number" mono min={0} step="0.01" value={l.debit} onChange={(e) => setLine(i, { debit: e.target.value, credit: e.target.value ? "" : l.credit })} /></div>
              <div className="col-span-2"><DxInput label={i === 0 ? "Credit" : undefined} type="number" mono min={0} step="0.01" value={l.credit} onChange={(e) => setLine(i, { credit: e.target.value, debit: e.target.value ? "" : l.debit })} /></div>
              <div className="col-span-1 pb-1">
                {lines.length > 2 && (
                  <DxButton icon size="sm" variant="text" title="Remove line" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></DxButton>
                )}
              </div>
            </div>
          ))}
          <DxButton type="button" size="sm" variant="default" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={() => setLines((ls) => [...ls, emptyLine()])}>Add line</DxButton>
        </div>

        <div className={`flex items-center justify-between rounded-lg px-4 py-3 text-[13px] font-semibold ${totals.balanced ? "bg-[var(--dx-success-soft,#ecfdf5)] text-[var(--dx-success,#10b981)]" : "bg-[var(--dx-warning-soft,#fffbeb)] text-[var(--dx-warning,#d97706)]"}`}>
          <span className="flex items-center gap-2"><Scale className="h-4 w-4" />{totals.balanced ? "Balanced" : "Out of balance"}</span>
          <span className="dx-mono">Dr {NGN(totals.d)} · Cr {NGN(totals.c)}</span>
        </div>

        <DxCheckbox label="Post immediately (otherwise saved as draft)" checked={autoPostFlag} onChange={(e) => setAutoPostFlag(e.target.checked)} />

        <div className="flex justify-end">
          <DxButton type="submit" variant="primary" isLoading={create.isPending} disabled={!totals.balanced}>{autoPostFlag ? "Create & post" : "Save draft"}</DxButton>
        </div>
      </form>
    </DxPopup>
  );
}
