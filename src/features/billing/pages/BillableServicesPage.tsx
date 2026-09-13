import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, RefreshCw, AlertCircle, Pencil, Trash2, Receipt, FileSpreadsheet } from "lucide-react";
import { Link } from "react-router-dom";
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

  const params = useMemo(
    () => ({ skip: (page - 1) * PAGE_SIZE, limit: PAGE_SIZE, search: search || undefined }),
    [page, search],
  );

  const list = useQuery({
    queryKey: ["billable-services", "paged", params],
    queryFn: () => billableServicesApi.listPaged(params),
  });
  const services = list.data?.items ?? [];
  const meta = list.data?.meta;

  const health = useQuery({
    queryKey: ["billable-services", "mapping-health"],
    queryFn: () => billableServicesApi.mappingHealth(),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<BillableService | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  const remove = useMutation({
    mutationFn: (id: number) => billableServicesApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["billable-services"] }); toast.success("Service deactivated"); },
    onError: () => toast.error("Couldn't remove", "Please try again."),
  });

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <PageHeader title="Billable Services" description="Every service rendered has a rate and a posting account." />
        <div className="flex flex-wrap gap-3">
          <Link to={routes.chartOfAccounts} className="btn-secondary rounded-2xl px-5 py-3 text-sm font-bold">Chart of Accounts</Link>
          <button
            onClick={() => list.refetch()}
            className="btn-secondary p-4 rounded-2xl bg-white/80 border-secondary-400"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${list.isFetching ? "animate-spin" : ""}`} />
          </button>
          <Button variant="secondary" leftIcon={<FileSpreadsheet className="h-5 w-5" />} onClick={() => setBulkOpen(true)}>Bulk Upload</Button>
          <Button leftIcon={<Plus className="h-5 w-5" />} onClick={() => setCreateOpen(true)}>New Service</Button>
        </div>
      </div>

      {list.isError && (
        <div className="p-5 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center gap-3">
          <AlertCircle className="h-5 w-5" /><p className="text-sm font-bold">Failed to load services.</p>
        </div>
      )}

      {health.data && health.data.missing_account > 0 && (
        <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm font-bold">
            {health.data.missing_account} of {health.data.total_services} services have no ledger account.
            Charges for these won't post to finance until an account is assigned — edit the service and pick a posting account.
          </p>
        </div>
      )}

      {/* Filter toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          className="flex-1"
          placeholder="Search by code, name or category…"
          onSearch={(t) => { setSearch(t); setPage(1); }}
        />
      </div>

      <Card variant="panel" className="p-0 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-secondary-900/5 text-[10px] font-bold uppercase tracking-widest text-secondary-500">
              <th className="px-6 py-4">Code</th>
              <th className="px-6 py-4">Service</th>
              <th className="px-6 py-4">Category</th>
              <th className="px-6 py-4 text-right">Rate</th>
              <th className="px-6 py-4">Account</th>
              <th className="px-6 py-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-secondary-100/60">
            {list.isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}><td colSpan={6} className="px-6 py-4"><Skeleton className="h-8 w-full" /></td></tr>
              ))
            ) : services.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-24 text-center">
                  <Receipt className="h-12 w-12 mx-auto text-secondary-200 mb-3" />
                  <p className="font-bold text-secondary-900">{search ? "No matching services" : "No services yet"}</p>
                  <p className="text-sm text-secondary-400 mt-1">
                    {search ? "Try a different search term." : "Add the services your hospital charges for."}
                  </p>
                </td>
              </tr>
            ) : (
              services.map((s) => (
                <tr key={s.id} className="hover:bg-primary-50/20">
                  <td className="px-6 py-4 font-mono font-bold text-secondary-900">{s.code}</td>
                  <td className="px-6 py-4 text-secondary-700">{s.name}</td>
                  <td className="px-6 py-4 text-secondary-500">{s.category || "—"}</td>
                  <td className="px-6 py-4 text-right font-bold text-secondary-900">{formatMoney(s.default_price)}</td>
                  <td className="px-6 py-4">
                    {s.account_code ? (
                      <Badge variant="soft-success" title={s.account_name ?? undefined}>{s.account_code}</Badge>
                    ) : (
                      <Badge variant="soft-warning">Unassigned</Badge>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <Button size="sm" variant="ghost" leftIcon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditing(s)}>Edit</Button>
                      <button
                        onClick={() => remove.mutate(s.id)}
                        className="p-2 rounded-xl hover:bg-rose-50"
                        title="Deactivate"
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
    </div>
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
        ? billableServicesApi.update(service!.id, {
            name, category: category || undefined, default_price: Number(price), account_id: Number(accountId), description: description || undefined,
          })
        : billableServicesApi.create({
            code, name, category: category || undefined, default_price: Number(price), account_id: Number(accountId), description: description || undefined,
          }),
    onSuccess: () => { toast.success(isEdit ? "Service updated" : "Service created"); onSaved(); onClose(); },
    onError: (err: any) => { const d = err?.response?.data?.message; toast.error("Couldn't save", typeof d === "string" ? d : "Check the fields and try again."); },
  });

  const priceError = price !== "" && !(Number(price) > 0);

  function submit() {
    if (!isEdit && !code.trim()) { toast.error("Missing code", "Service code is required."); return; }
    if (!name.trim()) { toast.error("Missing name", "Service name is required."); return; }
    if (!(Number(price) > 0)) { toast.error("Invalid rate", "Rate must be greater than 0."); return; }
    if (!accountId) { toast.error("Missing account", "Select a posting account."); return; }
    save.mutate();
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? "Edit Service" : "New Billable Service"} size="md"
      footer={<div className="flex justify-end gap-3"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit} isLoading={save.isPending} disabled={accounts.length === 0}>{isEdit ? "Save changes" : "Create service"}</Button></div>}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Service code" value={code} onChange={(e) => setCode(e.target.value)} disabled={isEdit} hint={isEdit ? "Code can't be changed." : "e.g. CONSULT_GP"} />
          <Input label="Category (optional)" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. CONSULTATION" />
        </div>
        <Input label="Service name" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Rate" type="number" value={price} onChange={(e) => setPrice(e.target.value)} error={priceError ? "Must be > 0" : undefined} hint={!priceError ? "Amount charged per unit." : undefined} />
          <Select
            label="Posting account"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            placeholder="— Select account —"
            options={accounts.map((a) => ({ value: String(a.id), label: `${a.code} — ${a.name}` }))}
            hint={!accountsQuery.isLoading && accounts.length === 0 ? "No accounts yet — create one under Chart of Accounts first." : undefined}
          />
        </div>
        <Textarea label="Description (optional)" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
    </Modal>
  );
}
