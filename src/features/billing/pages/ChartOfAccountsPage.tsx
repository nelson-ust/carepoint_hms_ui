import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, RotateCcw, Pencil, Trash2, BookOpen, FileSpreadsheet } from "lucide-react";
import {
  DxPage, DxPageHeader, DxPanel, DxBadge, DxButton, DxPopup, DxInput, DxSelect, DxTextarea,
  DxMessage, DxGrid, type DxGridColumn, type DxBadgeTone,
} from "@/components/dx";
import { SearchInput } from "@/components/forms/SearchInput";
import { Pagination } from "@/components/data-table/Pagination";
import { useToast } from "@/components/feedback/ToastProvider";
import {
  accountsApi, ACCOUNT_TYPE_OPTIONS, downloadAccountsTemplate, bulkUploadAccounts,
  type Account, type AccountType,
} from "../api/accounts.api";
import { DrugBulkUploadModal } from "@/features/drugs/components/DrugBulkUploadModal";

const PAGE_SIZE = 20;

const TYPE_TONES: Record<string, DxBadgeTone> = {
  REVENUE: "success", ASSET: "info", LIABILITY: "warning", EXPENSE: "danger", EQUITY: "neutral",
};

export function ChartOfAccountsPage() {
  const toast = useToast();
  const qc = useQueryClient();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");

  const params = useMemo(
    () => ({ skip: (page - 1) * PAGE_SIZE, limit: PAGE_SIZE, search: search || undefined, account_type: type || undefined }),
    [page, search, type],
  );

  const list = useQuery({ queryKey: ["accounts", "paged", params], queryFn: () => accountsApi.listPaged(params) });
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

  const columns: DxGridColumn<Account>[] = [
    { key: "code", header: "Code", render: (a) => <span className="dx-mono font-semibold text-[var(--dx-text)]">{a.code}</span> },
    { key: "name", header: "Name", render: (a) => <span className="text-[var(--dx-text)]">{a.name}</span> },
    { key: "account_type", header: "Type", render: (a) => <DxBadge tone={TYPE_TONES[a.account_type] ?? "neutral"}>{a.account_type}</DxBadge> },
    { key: "act", header: "", align: "right", render: (a) => (
        <div className="flex items-center justify-end gap-1">
          <DxButton size="sm" variant="text" leftIcon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditing(a)}>Edit</DxButton>
          <DxButton icon size="sm" variant="text" title="Remove" disabled={remove.isPending} onClick={() => remove.mutate(a.id)}><Trash2 className="h-4 w-4" /></DxButton>
        </div>) },
  ];

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Billing" }, { label: "Chart of Accounts" }]}
        title="Chart of Accounts"
        subtitle="Ledger accounts every billable service posts to."
        actions={
          <>
            <DxButton icon title="Refresh" onClick={() => list.refetch()} isLoading={list.isFetching}><RotateCcw /></DxButton>
            <DxButton variant="default" leftIcon={<FileSpreadsheet className="h-4 w-4" />} onClick={() => setBulkOpen(true)}>Bulk upload</DxButton>
            <DxButton variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>New account</DxButton>
          </>
        }
      />

      {list.isError && <DxMessage tone="danger" title="Failed to load accounts.">Please retry.</DxMessage>}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput className="flex-1" placeholder="Search by code or name…" onSearch={(t) => { setSearch(t); setPage(1); }} />
        <div className="sm:w-52">
          <DxSelect aria-label="Type" value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} options={[{ value: "", label: "All types" }, ...ACCOUNT_TYPE_OPTIONS]} />
        </div>
      </div>

      <DxPanel flush>
        <DxGrid<Account>
          borderless
          columns={columns}
          data={accounts}
          rowKey={(a) => a.id}
          isLoading={list.isLoading}
          empty={{
            icon: BookOpen,
            title: isFiltering ? "No matching accounts" : "No accounts yet",
            description: isFiltering ? "Try a different search or filter." : "Add revenue accounts before pricing services.",
          }}
          footer={meta && meta.total > 0 ? (
            <Pagination page={page} totalPages={meta.total_pages} totalItems={meta.total} pageSize={PAGE_SIZE} onPageChange={setPage} />
          ) : undefined}
        />
      </DxPanel>

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
    </DxPage>
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
    <DxPopup isOpen={isOpen} onClose={onClose} title={isEdit ? "Edit account" : "New account"} size="md"
      footer={<>
        <DxButton variant="text" onClick={onClose}>Cancel</DxButton>
        <DxButton variant="primary" onClick={submit} isLoading={save.isPending}>{isEdit ? "Save changes" : "Create account"}</DxButton>
      </>}>
      <div className="space-y-4">
        <DxInput label="Account code" value={code} onChange={(e) => setCode(e.target.value)} disabled={isEdit} hint={isEdit ? "Code can't be changed." : "e.g. REV-CONS"} />
        <DxInput label="Account name" value={name} onChange={(e) => setName(e.target.value)} />
        <DxSelect label="Account type" value={type} onChange={(e) => setType(e.target.value as AccountType)} options={ACCOUNT_TYPE_OPTIONS} />
        <DxTextarea label="Description (optional)" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
    </DxPopup>
  );
}
