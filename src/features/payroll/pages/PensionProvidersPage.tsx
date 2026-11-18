import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Pencil, Plus, Users } from "lucide-react";
import {
  DxPage, DxPageHeader, DxPanel, DxBadge, DxButton, DxInput, DxCheckbox, DxPopup,
} from "@/components/dx";
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
    <DxPopup
      isOpen={isOpen} onClose={onClose} size="md"
      title={provider ? `Edit — ${provider.name}` : "New Pension Provider (PFA)"}
      locked={save.isPending}
      footer={
        <>
          <DxButton onClick={onClose} disabled={save.isPending}>Cancel</DxButton>
          <DxButton variant="primary" onClick={submit} isLoading={save.isPending}>{provider ? "Save changes" : "Create provider"}</DxButton>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <DxInput label="Code" value={form.code} onChange={set("code")} hint="Short unique code, e.g. STANBIC-PFA." />
          <DxInput label="Name" value={form.name} onChange={set("name")} hint="Registered PFA name." />
          <DxInput label="PFA licence number" value={form.pfa_license_no} onChange={set("pfa_license_no")} hint="PenCom licence, e.g. PFA/2005/001." />
          <DxInput label="Contact email" type="email" value={form.contact_email} onChange={set("contact_email")} />
          <DxInput label="Contact phone" value={form.contact_phone} onChange={set("contact_phone")} />
          <DxInput label="Address" value={form.address} onChange={set("address")} />
          <DxInput label="Remittance bank" value={form.bank_name} onChange={set("bank_name")} hint="Bank contributions are remitted into." />
          <DxInput label="Remittance account no." value={form.bank_account_no} onChange={set("bank_account_no")} />
          <DxInput label="Note" value={form.note} onChange={set("note")} />
        </div>
        <DxCheckbox label="Active" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} />
      </div>
    </DxPopup>
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
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "HR & Payroll" }, { label: "Pension Providers" }]}
        title="Pension Providers"
        subtitle="Pension Fund Administrators (PFAs) staff contributions are remitted to. The pension remittance schedule groups amounts per provider."
        actions={
          <DxButton variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => { setEditProvider(null); setModalOpen(true); }}>New provider</DxButton>
        }
      />
      <PayrollTabs />

      <DxPanel title="Providers" icon={<Building2 className="h-4 w-4" />}>
        {providersQuery.isLoading ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="dx-skeleton h-36 w-full" />)}</div>
        ) : providers.length === 0 ? (
          <div className="py-14 text-center">
            <Building2 className="mx-auto mb-3 h-10 w-10 text-[var(--dx-text-faint)]" />
            <h4 className="text-[15px] font-bold text-[var(--dx-text)]">No pension providers yet</h4>
            <p className="mx-auto mt-1 max-w-md text-[13px] text-[var(--dx-text-muted)]">Add the PFAs your staff use, then link each staff member to theirs in HR Staff Records — the pension schedule will group remittances per provider.</p>
            <DxButton className="mx-auto mt-4" variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => { setEditProvider(null); setModalOpen(true); }}>New provider</DxButton>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {providers.map((p) => (
              <div key={p.id} className="space-y-2.5 rounded-lg border border-[var(--dx-border)] bg-[var(--dx-surface)] p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[14px] font-bold text-[var(--dx-text)]">{p.name}</p>
                    <p className="dx-mono text-[10px] text-[var(--dx-text-muted)]">{p.code}{p.pfa_license_no ? ` · ${p.pfa_license_no}` : ""}</p>
                  </div>
                  <DxBadge tone={p.is_active ? "success" : "neutral"}>{p.is_active ? "ACTIVE" : "INACTIVE"}</DxBadge>
                </div>
                <div className="space-y-1 text-[12px] text-[var(--dx-text-muted)]">
                  {p.contact_email ? <p>{p.contact_email}</p> : null}
                  {p.contact_phone ? <p>{p.contact_phone}</p> : null}
                  {p.bank_name ? <p>Remit to: {p.bank_name}{p.bank_account_no ? ` · ${p.bank_account_no}` : ""}</p> : null}
                </div>
                <div className="flex items-center justify-between border-t border-[var(--dx-border)] pt-2">
                  <span className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--dx-text-muted)]">
                    <Users className="h-3.5 w-3.5" /> {p.staff_count ?? 0} staff
                  </span>
                  <DxButton size="sm" leftIcon={<Pencil className="h-3.5 w-3.5" />} onClick={() => { setEditProvider(p); setModalOpen(true); }}>Edit</DxButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </DxPanel>

      <ProviderModal provider={editProvider} isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </DxPage>
  );
}
