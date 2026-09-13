import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpenCheck, Plus, RefreshCw, Trash2, Undo2, UploadCloud, Eye, Scale,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/feedback/ToastProvider";
import { accountsApi, type Account } from "@/features/billing/api/accounts.api";
import { accountingApi } from "../api/accounting.api";

const NGN = (v: string | number) =>
  `₦${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

function fmtDate(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function statusVariant(s: string): any {
  return s === "POSTED" ? "soft-success" : s === "DRAFT" ? "soft-warning" : "soft-danger";
}

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
  const detail = useQuery({
    queryKey: ["je-detail", detailId],
    queryFn: () => accountingApi.getEntry(detailId!),
    enabled: !!detailId,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["je"] });

  const post = useMutation({
    mutationFn: (id: number) => accountingApi.postEntry(id),
    onSuccess: () => { invalidate(); toast.success("Entry posted"); },
    onError: (e: any) => toast.error("Couldn't post", accountingApi.errMsg(e, "")),
  });
  const reverse = useMutation({
    mutationFn: (id: number) => accountingApi.reverseEntry(id),
    onSuccess: () => { invalidate(); toast.success("Entry reversed"); },
    onError: (e: any) => toast.error("Couldn't reverse", accountingApi.errMsg(e, "")),
  });
  const del = useMutation({
    mutationFn: (id: number) => accountingApi.deleteDraft(id),
    onSuccess: () => { invalidate(); toast.success("Draft deleted"); },
    onError: (e: any) => toast.error("Couldn't delete", accountingApi.errMsg(e, "")),
  });
  const autoPost = useMutation({
    mutationFn: () => accountingApi.autoPost(),
    onSuccess: (r) => {
      invalidate();
      toast.success("Auto-posting complete",
        `${r.created} new entr${r.created === 1 ? "y" : "ies"} posted · ${r.skipped_existing} already booked.`);
    },
    onError: (e: any) => toast.error("Auto-posting failed", accountingApi.errMsg(e, "")),
  });

  const items = list.data?.items ?? [];
  const total = list.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / 25));

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <PageHeader title="Journal Entries" description="Double-entry journal — every entry balances, posted entries feed the ledgers and financial statements." />
        <div className="flex flex-wrap gap-3">
          <button onClick={() => list.refetch()} className="btn-secondary p-4 rounded-2xl bg-white/80 border-secondary-400" title="Refresh">
            <RefreshCw className={`h-4 w-4 ${list.isFetching ? "animate-spin" : ""}`} />
          </button>
          <Button variant="secondary" leftIcon={<UploadCloud className="h-4 w-4" />} isLoading={autoPost.isPending}
            onClick={() => autoPost.mutate()}
            title="Sweep patient payments, expense claims and salary advances into the ledger (never double-books)">
            Auto-post operations
          </Button>
          <Button leftIcon={<Plus className="h-5 w-5" />} onClick={() => setCreateOpen(true)}>New entry</Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select label="" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="POSTED">Posted</option>
          <option value="REVERSED">Reversed</option>
        </Select>
        <span className="text-xs text-secondary-400 font-bold ml-auto">{total} entries</span>
      </div>

      {list.isLoading ? <Skeleton className="h-40 w-full" /> : items.length === 0 ? (
        <Card className="p-10 text-center text-secondary-500">
          <BookOpenCheck className="h-8 w-8 mx-auto mb-3 opacity-40" />
          No journal entries yet. Create one manually or run “Auto-post operations”.
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-secondary-50 text-secondary-500 text-[10px] uppercase tracking-widest dark:bg-white/5">
              <tr>
                <th className="text-left px-5 py-3">Entry</th>
                <th className="text-left px-5 py-3">Date</th>
                <th className="text-left px-5 py-3">Memo</th>
                <th className="text-left px-5 py-3">Source</th>
                <th className="text-right px-5 py-3">Amount</th>
                <th className="text-left px-5 py-3">Status</th>
                <th className="text-right px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-100 dark:divide-white/5">
              {items.map((e) => (
                <tr key={e.id} className="hover:bg-secondary-50/60 dark:hover:bg-white/5">
                  <td className="px-5 py-3 data-mono text-xs font-bold">{e.entry_no}</td>
                  <td className="px-5 py-3 whitespace-nowrap">{fmtDate(e.entry_date)}</td>
                  <td className="px-5 py-3 max-w-[16rem] truncate">{e.memo || "—"}</td>
                  <td className="px-5 py-3"><Badge variant="secondary">{e.source_type.replace(/_/g, " ")}</Badge></td>
                  <td className="px-5 py-3 text-right data-mono font-bold">{NGN(e.total_debit)}</td>
                  <td className="px-5 py-3"><Badge variant={statusVariant(e.status)}>{e.status}</Badge></td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-1.5">
                      <Button size="sm" variant="ghost" onClick={() => setDetailId(e.id)} title="View lines"><Eye className="h-3.5 w-3.5" /></Button>
                      {e.status === "DRAFT" && (
                        <>
                          <Button size="sm" variant="secondary" isLoading={post.isPending} onClick={() => post.mutate(e.id)}>Post</Button>
                          <Button size="sm" variant="ghost" onClick={() => del.mutate(e.id)} title="Delete draft"><Trash2 className="h-3.5 w-3.5 text-rose-500" /></Button>
                        </>
                      )}
                      {e.status === "POSTED" && (
                        <Button size="sm" variant="ghost" onClick={() => reverse.mutate(e.id)} title="Reverse entry"><Undo2 className="h-3.5 w-3.5" /></Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span className="text-xs font-bold text-secondary-500">Page {page} / {pages}</span>
          <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      )}

      <CreateEntryModal open={createOpen} onClose={() => setCreateOpen(false)}
        onDone={() => { setCreateOpen(false); invalidate(); }} />

      {/* Detail modal */}
      <Modal isOpen={!!detailId} onClose={() => setDetailId(null)} title={detail.data?.entry_no ?? "Journal entry"} size="lg">
        {detail.isLoading ? <Skeleton className="h-40 w-full" /> : detail.data ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant={statusVariant(detail.data.status)}>{detail.data.status}</Badge>
              <Badge variant="secondary">{detail.data.source_type.replace(/_/g, " ")}</Badge>
              <span className="text-secondary-500">{fmtDate(detail.data.entry_date)} · {detail.data.period_code}</span>
            </div>
            {detail.data.memo && <p className="text-sm text-secondary-600 italic">“{detail.data.memo}”</p>}
            <div className="overflow-x-auto rounded-xl border border-secondary-200 dark:border-white/10">
              <table className="w-full text-xs">
                <thead className="bg-secondary-50 text-secondary-500 dark:bg-white/5">
                  <tr>
                    <th className="text-left px-4 py-2">Account</th>
                    <th className="text-left px-4 py-2">Description</th>
                    <th className="text-right px-4 py-2">Debit</th>
                    <th className="text-right px-4 py-2">Credit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-secondary-100 dark:divide-white/5">
                  {(detail.data.lines ?? []).map((l) => (
                    <tr key={l.id}>
                      <td className="px-4 py-2"><span className="data-mono font-bold">{l.account_code}</span> {l.account_name}</td>
                      <td className="px-4 py-2">{l.description || "—"}</td>
                      <td className="px-4 py-2 text-right data-mono">{Number(l.debit) ? NGN(l.debit) : ""}</td>
                      <td className="px-4 py-2 text-right data-mono">{Number(l.credit) ? NGN(l.credit) : ""}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-secondary-50 font-bold dark:bg-white/5">
                  <tr>
                    <td className="px-4 py-2" colSpan={2}>Totals</td>
                    <td className="px-4 py-2 text-right data-mono">{NGN(detail.data.total_debit)}</td>
                    <td className="px-4 py-2 text-right data-mono">{NGN(detail.data.total_credit)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
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
      lines: lines.filter((l) => l.account_id).map((l) => ({
        account_id: Number(l.account_id), debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0, description: l.description || undefined,
      })),
    }),
    onSuccess: () => {
      toast.success(autoPostFlag ? "Entry created & posted" : "Draft entry created");
      setLines([emptyLine(), emptyLine()]); setMemo("");
      onDone();
    },
    onError: (e: any) => toast.error("Couldn't create entry", accountingApi.errMsg(e, "")),
  });

  const setLine = (i: number, patch: Partial<DraftLine>) =>
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  return (
    <Modal isOpen={open} onClose={onClose} title="New journal entry" size="2xl">
      <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
        <div className="grid sm:grid-cols-3 gap-4">
          <Input label="Entry date" type="date" required value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
          <div className="sm:col-span-2">
            <Input label="Memo" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="What is this entry for?" />
          </div>
        </div>

        <div className="space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-4">
                <Select label={i === 0 ? "Account" : ""} value={l.account_id} onChange={(e) => setLine(i, { account_id: e.target.value })}>
                  <option value="">Select account…</option>
                  {(accounts.data ?? []).map((a: Account) => (
                    <option key={a.id} value={a.id}>{a.code} · {a.name}</option>
                  ))}
                </Select>
              </div>
              <div className="col-span-3">
                <Input label={i === 0 ? "Description" : ""} value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Input label={i === 0 ? "Debit" : ""} type="number" min={0} step="0.01" value={l.debit}
                  onChange={(e) => setLine(i, { debit: e.target.value, credit: e.target.value ? "" : l.credit })} />
              </div>
              <div className="col-span-2">
                <Input label={i === 0 ? "Credit" : ""} type="number" min={0} step="0.01" value={l.credit}
                  onChange={(e) => setLine(i, { credit: e.target.value, debit: e.target.value ? "" : l.debit })} />
              </div>
              <div className="col-span-1 pb-1">
                {lines.length > 2 && (
                  <button type="button" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}
                    className="p-2 rounded-lg text-rose-500 hover:bg-rose-500/10" title="Remove line">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
          <Button type="button" size="sm" variant="secondary" leftIcon={<Plus className="h-3.5 w-3.5" />}
            onClick={() => setLines((ls) => [...ls, emptyLine()])}>Add line</Button>
        </div>

        <div className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm font-bold ${totals.balanced ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
          <span className="flex items-center gap-2"><Scale className="h-4 w-4" />
            {totals.balanced ? "Balanced" : "Out of balance"}
          </span>
          <span className="data-mono">Dr {NGN(totals.d)} · Cr {NGN(totals.c)}</span>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={autoPostFlag} onChange={(e) => setAutoPostFlag(e.target.checked)} />
          Post immediately (otherwise saved as draft)
        </label>

        <Button type="submit" isLoading={create.isPending} disabled={!totals.balanced}>
          {autoPostFlag ? "Create & post" : "Save draft"}
        </Button>
      </form>
    </Modal>
  );
}
