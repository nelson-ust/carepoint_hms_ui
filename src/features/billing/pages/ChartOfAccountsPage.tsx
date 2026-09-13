import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, RefreshCw, AlertCircle, Pencil, Trash2, BookOpen, FileSpreadsheet } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Skeleton } from "@/components/ui/Skeleton";
import { SearchInput } from "@/components/forms/SearchInput";
import { Pagination } from "@/components/data-table/Pagination";
import { useToast } from "@/components/feedback/ToastProvider";
import {
  accountsApi,
  ACCOUNT_TYPE_OPTIONS,
  downloadAccountsTemplate,
  bulkUploadAccounts,
  type Account,
  type AccountType,
} from "../api/accounts.api";
import { DrugBulkUploadModal } from "@/features/drugs/components/DrugBulkUploadModal";

const PAGE_SIZE = 20;

const typeVariant: Record<string, "soft-success" | "soft-info" | "soft-warning" | "soft-danger" | "secondary"> = {
  REVENUE: "soft-success",
  ASSET: "soft-info",
  LIABILITY: "soft-warning",
  EXPENSE: "soft-danger",
  EQUITY: "secondary",
};

export function ChartOfAccountsPage() {
  const toast = useToast();
  const qc = useQueryClient();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");

  const params = useMemo(
    () => ({
      skip: (page - 1) * PAGE_SIZE,
      limit: PAGE_SIZE,
      search: search || undefined,
      account_type: type || undefined,
    }),
    [page, search, type],
  );

  const list = useQuery({
    queryKey: ["accounts", "paged", params],
    queryFn: () => accountsApi.listPaged(params),
  });
  const accounts = list.data?.items ?? [];
  const meta = list.data?.meta;

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  const remove = useMutation({
    mutationFn: (id: number) => accountsApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["accounts"] }); toast.success("Account removed"); },
    onError: () => toast.error("Couldn't remove", "The account may be linked to services."),
  });

  const isFiltering = Boolean(search || type);

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <PageHeader title="Chart of Accounts" description="Ledger accounts every billable service posts to." />
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => list.refetch()}
            className="btn-secondary p-4 rounded-2xl bg-white/80 border-secondary-400"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${list.isFetching ? "animate-spin" : ""}`} />
          </button>
          <Button variant="secondary" leftIcon={<FileSpreadsheet className="h-5 w-5" />} onClick={() => setBulkOpen(true)}>Bulk Upload</Button>
          <Button leftIcon={<Plus className="h-5 w-5" />} onClick={() => setCreateOpen(true)}>New Account</Button>
        </div>
      </div>

      {list.isError && (
        <div className="p-5 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center gap-3">
          <AlertCircle className="h-5 w-5" /><p className="text-sm font-bold">Failed to load accounts.</p>
        </div>
      )}

      {/* Filter toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          className="flex-1"
          placeholder="Search by code or name…"
          onSearch={(t) => { setSearch(t); setPage(1); }}
        />
        <div className="sm:w-52">
          <Select
            value={type}
            onChange={(e) => { setType(e.target.value); setPage(1); }}
            options={[{ value: "", label: "All types" }, ...ACCOUNT_TYPE_OPTIONS]}
          />
        </div>
      </div>

      <Card variant="panel" className="p-0 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-secondary-900/5 text-[10px] font-bold uppercase tracking-widest text-secondary-500">
              <th className="px-6 py-4">Code</th>
              <th className="px-6 py-4">Name</th>
              <th className="px-6 py-4">Type</th>
              <th className="px-6 py-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-secondary-100/60">
            {list.isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}><td colSpan={4} className="px-6 py-4"><Skeleton className="h-8 w-full" /></td></tr>
              ))
            ) : accounts.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-24 text-center">
                  <BookOpen className="h-12 w-12 mx-auto text-secondary-200 mb-3" />
                  <p className="font-bold text-secondary-900">{isFiltering ? "No matching accounts" : "No accounts yet"}</p>
                  <p className="text-sm text-secondary-400 mt-1">
                    {isFiltering ? "Try a different search or filter." : "Add revenue accounts before pricing services."}
                  </p>
                </td>
              </tr>
            ) : (
              accounts.map((a) => (
                <tr key={a.id} className="hover:bg-primary-50/20">
                  <td className="px-6 py-4 font-mono font-bold text-secondary-900">{a.code}</td>
                  <td className="px-6 py-4 text-secondary-700">{a.name}</td>
                  <td className="px-6 py-4"><Badge variant={typeVariant[a.account_type] ?? "secondary"}>{a.account_type}</Badge></td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <Button size="sm" variant="ghost" leftIcon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditing(a)}>Edit</Button>
                      <button
                        onClick={() => remove.mutate(a.id)}
                        className="p-2 rounded-xl hover:bg-rose-50"
                        title="Remove"
                        disabled={remove.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-rose-400" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {meta && meta.total > 0 && (
          <Pagination
            page={page}
            totalPages={meta.total_pages}
            totalItems={meta.total}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        )}
      </Card>

      <AccountModal
        isOpen={createOpen || editing !== null}
        account={editing}
        onClose={() => { setCreateOpen(false); setEditing(null); }}
        onSaved={() => qc.invalidateQueries({ queryKey: ["accounts"] })}
      />

      <DrugBulkUploadModal
        isOpen={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onImported={() => qc.invalidateQueries({ queryKey: ["accounts"] })}
        title="Bulk Upload Accounts"
        subtitle="Import chart of accounts from Excel"
        description="Fill one row per account. Account Code and Name are required; Account Type has a dropdown and defaults to REVENUE."
        importLabel="Import Accounts"
        download={downloadAccountsTemplate}
        upload={bulkUploadAccounts}
      />
    </div>
  );
}

function AccountModal({ isOpen, account, onClose, onSaved }: { isOpen: boolean; account: Account | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const isEdit = account !== null;
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("REVENUE");
  const [description, setDescription] = useState("");

  useEffect(() => {
    setCode(account?.code ?? "");
    setName(account?.name ?? "");
    setType(account?.account_type ?? "REVENUE");
    setDescription(account?.description ?? "");
  }, [account, isOpen]);

  const save = useMutation({
    mutationFn: () =>
      isEdit
        ? accountsApi.update(account!.id, { name, account_type: type, description: description || undefined })
        : accountsApi.create({ code, name, account_type: type, description: description || undefined }),
    onSuccess: () => { toast.success(isEdit ? "Account updated" : "Account created"); onSaved(); onClose(); },
    onError: (err: any) => { const d = err?.response?.data?.message; toast.error("Couldn't save", typeof d === "string" ? d : "Check the fields and try again."); },
  });

  function submit() {
    if (!isEdit && !code.trim()) { toast.error("Missing code", "Account code is required."); return; }
    if (!name.trim()) { toast.error("Missing name", "Account name is required."); return; }
    save.mutate();
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? "Edit Account" : "New Account"} size="md"
      footer={<div className="flex justify-end gap-3"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit} isLoading={save.isPending}>{isEdit ? "Save changes" : "Create account"}</Button></div>}>
      <div className="space-y-4">
        <Input label="Account code" value={code} onChange={(e) => setCode(e.target.value)} disabled={isEdit} hint={isEdit ? "Code can't be changed." : "e.g. REV-CONS"} />
        <Input label="Account name" value={name} onChange={(e) => setName(e.target.value)} />
        <Select label="Account type" value={type} onChange={(e) => setType(e.target.value as AccountType)} options={ACCOUNT_TYPE_OPTIONS} />
        <Textarea label="Description (optional)" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
    </Modal>
  );
}
