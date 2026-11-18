import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, RotateCcw, Pencil, Trash2, Receipt, FileSpreadsheet } from "lucide-react";
import { Link } from "react-router-dom";
import {
  DxPage, DxPageHeader, DxPanel, DxBadge, DxButton, DxPopup, DxInput, DxSelect, DxTextarea,
  DxMessage, DxGrid, type DxGridColumn,
} from "@/components/dx";
import { SearchInput } from "@/components/forms/SearchInput";
import { Pagination } from "@/components/data-table/Pagination";
import { useToast } from "@/components/feedback/ToastProvider";
import { routes } from "@/config/routes";
import { billableServicesApi, downloadServicesTemplate, bulkUploadServices, type BillableService } from "../api/billable-services.api";
import { DrugBulkUploadModal } from "@/features/drugs/components/DrugBulkUploadModal";
import { accountsApi, type Account } from "../api/accounts.api";

const PAGE_SIZE = 20;

function formatMoney(v: number | string) {
  const n = Number(v || 0);
  return n.toLocaleString(undefined, { style: "currency", currency: "NGN", maximumFractionDigits: 2 });
}

export function BillableServicesPage() {
  const toast = useToast();
  const qc = useQueryClient();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const params = useMemo(() => ({ skip: (page - 1) * PAGE_SIZE, limit: PAGE_SIZE, search: search || undefined }), [page, search]);

  const list = useQuery({ queryKey: ["billable-services", "paged", params], queryFn: () => billableServicesApi.listPaged(params) });
  const services = list.data?.items ?? [];
  const meta = list.data?.meta;

  const health = useQuery({ queryKey: ["billable-services", "mapping-health"], queryFn: () => billableServicesApi.mappingHealth() });
  const backfill = useMutation({
    mutationFn: () => billableServicesApi.backfillAccounts(),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["billable-services"] });
      toast.success("Accounts mapped", `${r.mapped} service${r.mapped === 1 ? "" : "s"} auto-mapped by category.`);
    },
    onError: () => toast.error("Could not map accounts", "Please try again."),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<BillableService | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  const remove = useMutation({
    mutationFn: (id: number) => billableServicesApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["billable-services"] }); toast.success("Service deactivated"); },
    onError: () => toast.error("Couldn't remove", "Please try again."),
  });

  const columns: DxGridColumn<BillableService>[] = [
    { key: "code", header: "Code", render: (s) => <span className="dx-mono font-semibold text-[var(--dx-text)]">{s.code}</span> },
    { key: "name", header: "Service", render: (s) => <span className="text-[var(--dx-text)]">{s.name}</span> },
    { key: "category", header: "Category", render: (s) => s.category || "—" },
    { key: "default_price", header: "Rate", align: "right", render: (s) => <span className="dx-mono font-semibold">{formatMoney(s.default_price)}</span> },
    { key: "account", header: "Account", render: (s) => s.account_code
        ? <DxBadge tone="success" title={s.account_name ?? undefined}>{s.account_code}</DxBadge>
        : <DxBadge tone="warning">Unassigned</DxBadge> },
    { key: "act", header: "", align: "right", render: (s) => (
        <div className="flex items-center justify-end gap-1">
          <DxButton size="sm" variant="text" leftIcon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditing(s)}>Edit</DxButton>
          <DxButton icon size="sm" variant="text" title="Deactivate" disabled={remove.isPending} onClick={() => remove.mutate(s.id)}><Trash2 className="h-4 w-4" /></DxButton>
        </div>) },
  ];

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Billing" }, { label: "Services" }]}
        title="Billable Services"
        subtitle="Every service rendered has a rate and a posting account."
        actions={
          <>
            <Link to={routes.chartOfAccounts} className="dx-btn">Chart of Accounts</Link>
            <DxButton icon title="Refresh" onClick={() => list.refetch()} isLoading={list.isFetching}><RotateCcw /></DxButton>
            <DxButton variant="default" leftIcon={<FileSpreadsheet className="h-4 w-4" />} onClick={() => setBulkOpen(true)}>Bulk upload</DxButton>
            <DxButton variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>New service</DxButton>
          </>
        }
      />

      {list.isError && <DxMessage tone="danger" title="Failed to load services.">Please retry.</DxMessage>}

      {health.data && health.data.missing_account > 0 && (
        <DxMessage tone="warning" title={`${health.data.missing_account} of ${health.data.total_services} services have no ledger account`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>Charges for these won't post to finance until an account is assigned. Auto-map them by category, or edit a service to choose the account yourself.</span>
            <DxButton size="sm" variant="primary" isLoading={backfill.isPending} onClick={() => backfill.mutate()}>
              Auto-map all
            </DxButton>
          </div>
        </DxMessage>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput className="flex-1" placeholder="Search by code, name or category…" onSearch={(t) => { setSearch(t); setPage(1); }} />
      </div>

      <DxPanel flush>
        <DxGrid<BillableService>
          borderless
          columns={columns}
          data={services}
          rowKey={(s) => s.id}
          isLoading={list.isLoading}
          empty={{
            icon: Receipt,
            title: search ? "No matching services" : "No services yet",
            description: search ? "Try a different search term." : "Add the services your hospital charges for.",
          }}
          footer={meta && meta.total > 0 ? (
            <Pagination page={page} totalPages={meta.total_pages} totalItems={meta.total} pageSize={PAGE_SIZE} onPageChange={setPage} />
          ) : undefined}
        />
      </DxPanel>

      <ServiceModal
        isOpen={createOpen || editing !== null}
        service={editing}
        onClose={() => { setCreateOpen(false); setEditing(null); }}
        onSaved={() => qc.invalidateQueries({ queryKey: ["billable-services"] })}
      />

      <DrugBulkUploadModal
        isOpen={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onImported={() => qc.invalidateQueries({ queryKey: ["billable-services"] })}
        title="Bulk Upload Services"
        subtitle="Import billable services from Excel"
        description="Fill one row per service. Service Code, Name, Rate (> 0) and Account Code are required. The Account Code must match one in your Chart of Accounts (dropdown provided)."
        importLabel="Import Services"
        download={downloadServicesTemplate}
        upload={bulkUploadServices}
      />
    </DxPage>
  );
}

function ServiceModal({ isOpen, service, onClose, onSaved }: { isOpen: boolean; service: BillableService | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const isEdit = service !== null;
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [accountId, setAccountId] = useState("");
  const [description, setDescription] = useState("");

  const accountsQuery = useQuery({ queryKey: ["accounts"], queryFn: () => accountsApi.list(), enabled: isOpen });
  const accounts: Account[] = accountsQuery.data ?? [];

  useEffect(() => {
    setCode(service?.code ?? "");
    setName(service?.name ?? "");
    setCategory(service?.category ?? "");
    setPrice(service ? String(Number(service.default_price) || "") : "");
    setAccountId(service?.account_id != null ? String(service.account_id) : "");
    setDescription(service?.description ?? "");
  }, [service, isOpen]);

  const save = useMutation({
    mutationFn: () =>
      isEdit
        ? billableServicesApi.update(service!.id, { name, category: category || undefined, default_price: Number(price), account_id: accountId ? Number(accountId) : undefined, description: description || undefined })
        : billableServicesApi.create({ code, name, category: category || undefined, default_price: Number(price), account_id: accountId ? Number(accountId) : undefined, description: description || undefined }),
    onSuccess: () => { toast.success(isEdit ? "Service updated" : "Service created"); onSaved(); onClose(); },
    onError: (err: any) => { const d = err?.response?.data?.message; toast.error("Couldn't save", typeof d === "string" ? d : "Check the fields and try again."); },
  });

  const priceError = price !== "" && !(Number(price) > 0);

  function submit() {
    if (!isEdit && !code.trim()) { toast.error("Missing code", "Service code is required."); return; }
    if (!name.trim()) { toast.error("Missing name", "Service name is required."); return; }
    if (!(Number(price) > 0)) { toast.error("Invalid rate", "Rate must be greater than 0."); return; }
    save.mutate();
  }

  return (
    <DxPopup isOpen={isOpen} onClose={onClose} title={isEdit ? "Edit service" : "New billable service"} size="md"
      footer={<>
        <DxButton variant="text" onClick={onClose}>Cancel</DxButton>
        <DxButton variant="primary" onClick={submit} isLoading={save.isPending}>{isEdit ? "Save changes" : "Create service"}</DxButton>
      </>}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <DxInput label="Service code" value={code} onChange={(e) => setCode(e.target.value)} disabled={isEdit} hint={isEdit ? "Code can't be changed." : "e.g. CONSULT_GP"} />
          <DxInput label="Category (optional)" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. CONSULTATION" />
        </div>
        <DxInput label="Service name" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="grid grid-cols-2 gap-4">
          <DxInput label="Rate" type="number" mono value={price} onChange={(e) => setPrice(e.target.value)} error={priceError ? "Must be > 0" : undefined} hint={!priceError ? "Amount charged per unit." : undefined} />
          <DxSelect
            label="Posting account (optional)"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            placeholder="— Auto-assign by category —"
            options={accounts.map((a) => ({ value: String(a.id), label: `${a.code} — ${a.name}` }))}
            hint={accounts.length === 0 && !accountsQuery.isLoading ? "No accounts yet — one is auto-assigned by category." : "Leave blank to auto-assign a revenue account by category."}
          />
        </div>
        <DxTextarea label="Description (optional)" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
    </DxPopup>
  );
}
