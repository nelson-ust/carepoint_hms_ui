import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Pencil, Plus, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SuiteEyebrow } from "@/components/layout/SuiteEyebrow";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/api/api-error";
import { PayrollTabs } from "../components/PayrollTabs";
import {
  createPensionProvider,
  listPensionProviders,
  updatePensionProvider,
  type PensionProvider,
  type PensionProviderPayload,
} from "../api/payroll.api";

type Form = {
  code: string; name: string; pfa_license_no: string;
  contact_email: string; contact_phone: string; address: string;
  bank_name: string; bank_account_no: string; is_active: boolean; note: string;
};

function toFormState(p?: PensionProvider | null): Form {
  return {
    code: p?.code ?? "",
    name: p?.name ?? "",
    pfa_license_no: p?.pfa_license_no ?? "",
    contact_email: p?.contact_email ?? "",
    contact_phone: p?.contact_phone ?? "",
    address: p?.address ?? "",
    bank_name: p?.bank_name ?? "",
    bank_account_no: p?.bank_account_no ?? "",
    is_active: p?.is_active ?? true,
    note: p?.note ?? "",
  };
}

function ProviderModal({ provider, isOpen, onClose }: {
  provider: PensionProvider | null; isOpen: boolean; onClose: () => void;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Form>(() => toFormState(provider));
  const [seededFor, setSeededFor] = useState<number | "new" | null>(null);
  const key = provider?.id ?? "new";
  if (isOpen && seededFor !== key) {
    setForm(toFormState(provider));
    setSeededFor(key);
  }
  if (!isOpen && seededFor !== null) setSeededFor(null);

  const save = useMutation({
    mutationFn: () => {
      const payload: PensionProviderPayload = {
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        pfa_license_no: form.pfa_license_no || null,
        contact_email: form.contact_email || null,
        contact_phone: form.contact_phone || null,
        address: form.address || null,
        bank_name: form.bank_name || null,
        bank_account_no: form.bank_account_no || null,
        is_active: form.is_active,
        note: form.note || null,
      };
      return provider
        ? updatePensionProvider(provider.id, payload)
        : createPensionProvider(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll", "pension-providers"] });
      toast.success(provider ? "Provider updated" : "Provider created",
        `${form.name.trim()} saved.`);
      onClose();
    },
    onError: (err) => toast.error("Could not save provider", apiErrorMessage(err)),
  });

  const submit = () => {
    if (!form.code.trim() || !form.name.trim()) {
      toast.error("Missing fields", "A code and a name are required.");
      return;
    }
    save.mutate();
  };

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md"
      title={provider ? `Edit — ${provider.name}` : "New Pension Provider (PFA)"}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={save.isPending}>Cancel</Button>
          <Button size="sm" onClick={submit} isLoading={save.isPending}>
            {provider ? "Save changes" : "Create provider"}
          </Button>
        </div>
      }>
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <Input label="Code" value={form.code} onChange={set("code")}
            hint="Short unique code, e.g. STANBIC-PFA." />
          <Input label="Name" value={form.name} onChange={set("name")}
            hint="Registered PFA name." />
          <Input label="PFA licence number" value={form.pfa_license_no}
            onChange={set("pfa_license_no")} hint="PenCom licence, e.g. PFA/2005/001." />
          <Input label="Contact email" type="email" value={form.contact_email}
            onChange={set("contact_email")} />
          <Input label="Contact phone" value={form.contact_phone}
            onChange={set("contact_phone")} />
          <Input label="Address" value={form.address} onChange={set("address")} />
          <Input label="Remittance bank" value={form.bank_name} onChange={set("bank_name")}
            hint="Bank contributions are remitted into." />
          <Input label="Remittance account no." value={form.bank_account_no}
            onChange={set("bank_account_no")} />
          <Input label="Note" value={form.note} onChange={set("note")} />
        </div>
        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input type="checkbox" checked={form.is_active}
            onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
            className="h-4 w-4 rounded accent-primary-600" />
          <span className="text-sm font-semibold text-secondary-800 dark:text-secondary-100">
            Active
          </span>
        </label>
      </div>
    </Modal>
  );
}

export function PensionProvidersPage() {
  const [editProvider, setEditProvider] = useState<PensionProvider | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const providersQuery = useQuery({
    queryKey: ["payroll", "pension-providers"],
    queryFn: listPensionProviders,
  });
  const providers = providersQuery.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pension Providers"
        eyebrow={<SuiteEyebrow label="HR & Payroll Suite" />}
        description="Pension Fund Administrators (PFAs) staff contributions are remitted to. The pension remittance schedule groups amounts per provider."
        actions={
          <Button size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />}
            onClick={() => { setEditProvider(null); setModalOpen(true); }}>
            New Provider
          </Button>
        }
      />
      <PayrollTabs />

      <Card className="p-6">
        {providersQuery.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" />
          </div>
        ) : providers.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No pension providers yet"
            description="Add the PFAs your staff use, then link each staff member to theirs in HR Staff Records — the pension schedule will group remittances per provider."
            action={
              <Button size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />}
                onClick={() => { setEditProvider(null); setModalOpen(true); }}>
                New Provider
              </Button>
            }
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {providers.map((p) => (
              <div key={p.id}
                className="rounded-2xl border border-secondary-100 p-4 space-y-2.5 dark:border-white/5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-secondary-900 dark:text-white">{p.name}</p>
                    <p className="data-mono text-[10px] text-secondary-400">
                      {p.code}{p.pfa_license_no ? ` · ${p.pfa_license_no}` : ""}
                    </p>
                  </div>
                  <Badge variant={p.is_active ? "soft-success" : "secondary"}>
                    {p.is_active ? "ACTIVE" : "INACTIVE"}
                  </Badge>
                </div>
                <div className="space-y-1 text-xs text-secondary-500">
                  {p.contact_email && <p>{p.contact_email}</p>}
                  {p.contact_phone && <p>{p.contact_phone}</p>}
                  {p.bank_name && (
                    <p>
                      Remit to: {p.bank_name}
                      {p.bank_account_no ? ` · ${p.bank_account_no}` : ""}
                    </p>
                  )}
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-secondary-500">
                    <Users className="h-3.5 w-3.5" /> {p.staff_count ?? 0} staff
                  </span>
                  <Button size="sm" variant="secondary" leftIcon={<Pencil className="h-3.5 w-3.5" />}
                    onClick={() => { setEditProvider(p); setModalOpen(true); }}>
                    Edit
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <ProviderModal provider={editProvider} isOpen={modalOpen}
        onClose={() => setModalOpen(false)} />
    </div>
  );
}
