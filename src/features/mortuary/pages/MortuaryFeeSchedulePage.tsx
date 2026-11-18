import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Landmark, Pencil, Plus, Receipt, Sparkles, Trash2 } from "lucide-react";
import {
  DxBadge,
  DxButton,
  DxCheckbox,
  DxConfirm,
  DxForm,
  DxInput,
  DxKpi,
  DxMessage,
  DxPage,
  DxPageHeader,
  DxPanel,
  DxPopup,
  DxSelect,
  DxTextarea,
  DxGrid,
  apiErrorMessage,
  formatNaira,
  type DxGridColumn,
} from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import { mortuaryApi, type MortuaryFee, type MortuaryFeePayload } from "../api/mortuary.api";

const CHARGE_TYPES = [
  "STORAGE", "EMBALMING", "AUTOPSY", "BODY_PREP", "DRESSING", "PRESERVATION",
  "COFFIN", "HEARSE", "PENALTY", "DOCUMENTATION", "MORTUARY_FEE", "OTHER",
];

const humanType = (t: string) => t.charAt(0) + t.slice(1).toLowerCase().replace(/_/g, " ");

type FormState = {
  code: string;
  name: string;
  charge_type: string;
  unit_price: string;
  billing_cadence: string;
  account_code: string;
  is_active: boolean;
  description: string;
};

const emptyForm: FormState = {
  code: "", name: "", charge_type: "OTHER", unit_price: "0",
  billing_cadence: "ONE_OFF", account_code: "", is_active: true, description: "",
};

export function MortuaryFeeSchedulePage() {
  const toast = useToast();
  const qc = useQueryClient();

  const feesQuery = useQuery({
    queryKey: ["mortuary", "fee-schedule"],
    queryFn: () => mortuaryApi.listFees(false),
  });
  const fees = feesQuery.data?.items ?? [];
  const accountsQuery = useQuery({ queryKey: ["mortuary", "accounts"], queryFn: mortuaryApi.listAccounts });
  const accountOptions = (accountsQuery.data ?? []).map((a) => ({ value: a.code, label: `${a.code} — ${a.name}` }));

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MortuaryFee | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MortuaryFee | null>(null);

  useEffect(() => {
    if (editing) {
      setForm({
        code: editing.code,
        name: editing.name,
        charge_type: editing.charge_type,
        unit_price: String(editing.unit_price ?? 0),
        billing_cadence: editing.billing_cadence,
        account_code: editing.account_code ?? "",
        is_active: editing.is_active,
        description: editing.description ?? "",
      });
    } else {
      setForm(emptyForm);
    }
    setFormError(null);
  }, [editing, open]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["mortuary", "fee-schedule"] });

  const saveMut = useMutation({
    mutationFn: (payload: MortuaryFeePayload) =>
      editing ? mortuaryApi.updateFee(editing.id, payload) : mortuaryApi.createFee(payload),
    onSuccess: () => {
      toast.success(editing ? "Fee item updated." : "Fee item added.");
      setOpen(false);
      setEditing(null);
      invalidate();
    },
    onError: (err) => setFormError(apiErrorMessage(err) || "Failed to save fee item."),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => mortuaryApi.deleteFee(id),
    onSuccess: () => {
      toast.success("Fee item removed.");
      setDeleteTarget(null);
      invalidate();
    },
    onError: (err) => toast.error(apiErrorMessage(err) || "Failed to remove fee item."),
  });

  const seedMut = useMutation({
    mutationFn: () => mortuaryApi.seedDefaultFees(),
    onSuccess: (res) => {
      toast.success(res.message || "Default price list seeded.");
      invalidate();
    },
    onError: (err) => toast.error(apiErrorMessage(err) || "Failed to seed defaults."),
  });

  const submit = () => {
    setFormError(null);
    if (!editing && !form.code.trim()) return setFormError("Give the fee item a code.");
    if (!form.name.trim()) return setFormError("Give the fee item a name.");
    const price = Number(form.unit_price);
    if (Number.isNaN(price) || price < 0) return setFormError("Enter a valid unit price.");
    saveMut.mutate({
      code: editing ? undefined : form.code.trim().toUpperCase(),
      name: form.name.trim(),
      charge_type: form.charge_type,
      unit_price: price,
      billing_cadence: form.billing_cadence,
      account_code: form.account_code.trim() || undefined,
      is_active: form.is_active,
      description: form.description.trim() || undefined,
    });
  };

  const stats = useMemo(() => {
    const active = fees.filter((f) => f.is_active).length;
    const withAccount = fees.filter((f) => f.account_code).length;
    return { total: fees.length, active, withAccount };
  }, [fees]);

  const columns: DxGridColumn<MortuaryFee>[] = [
    {
      key: "name",
      header: "Service",
      minWidth: 220,
      render: (f) => (
        <div>
          <p className="font-medium text-[var(--dx-text)]">{f.name}</p>
          <span className="font-mono text-[11px] text-[var(--dx-text-muted)]">{f.code}</span>
        </div>
      ),
    },
    {
      key: "charge_type",
      header: "Type",
      width: 140,
      accessor: (f) => f.charge_type,
      render: (f) => (
        <DxBadge tone="neutral">
          {humanType(f.charge_type)}
          {f.billing_cadence === "DAILY" && <span className="ml-1 text-[var(--dx-accent)]">/day</span>}
          {f.billing_cadence === "MONTHLY" && <span className="ml-1 text-[var(--dx-accent)]">/month</span>}
        </DxBadge>
      ),
    },
    {
      key: "unit_price",
      header: "Unit price",
      width: 140,
      align: "right",
      accessor: (f) => Number(f.unit_price),
      render: (f) => (
        <span className="font-mono text-[var(--dx-text)]">
          {formatNaira(Number(f.unit_price))}
          {f.billing_cadence === "DAILY" ? <span className="text-[11px] text-[var(--dx-text-muted)]">/day</span> : null}
          {f.billing_cadence === "MONTHLY" ? <span className="text-[11px] text-[var(--dx-text-muted)]">/month</span> : null}
        </span>
      ),
    },
    {
      key: "account_code",
      header: "Account code",
      width: 150,
      render: (f) =>
        f.account_code ? (
          <DxBadge tone="accent">
            <Landmark className="h-3 w-3" />
            {f.account_code}
          </DxBadge>
        ) : (
          <span className="text-[var(--dx-text-muted)]">—</span>
        ),
    },
    {
      key: "is_active",
      header: "Status",
      width: 100,
      accessor: (f) => (f.is_active ? "active" : "inactive"),
      render: (f) =>
        f.is_active ? (
          <DxBadge tone="success" dot>Active</DxBadge>
        ) : (
          <DxBadge tone="neutral" dot>Inactive</DxBadge>
        ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      width: 120,
      render: (f) => (
        <div className="flex items-center justify-end gap-1.5">
          <DxButton size="sm" variant="text" icon title="Edit" onClick={() => { setEditing(f); setOpen(true); }}>
            <Pencil className="h-3.5 w-3.5" />
          </DxButton>
          <DxButton size="sm" variant="text" icon title="Remove" onClick={() => setDeleteTarget(f)}>
            <Trash2 className="h-3.5 w-3.5" />
          </DxButton>
        </div>
      ),
    },
  ];

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Mortuary" }, { label: "Fee schedule" }]}
        title="Mortuary fee schedule"
        subtitle="The mortuary price list. Every costing points at a chart-of-accounts code so captured revenue posts to the right ledger."
        actions={
          <>
            {fees.length === 0 && (
              <DxButton leftIcon={<Sparkles className="h-4 w-4" />} isLoading={seedMut.isPending} onClick={() => seedMut.mutate()}>
                Seed defaults
              </DxButton>
            )}
            <DxButton variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => { setEditing(null); setOpen(true); }}>
              Add fee item
            </DxButton>
          </>
        }
      />

      <div className="grid gap-3 md:grid-cols-3">
        <DxKpi label="Fee items" value={stats.total} icon={Receipt} tone="accent" isLoading={feesQuery.isLoading} />
        <DxKpi label="Active" value={stats.active} icon={Sparkles} tone="success" isLoading={feesQuery.isLoading} />
        <DxKpi label="With account code" value={stats.withAccount} icon={Landmark} tone="info" isLoading={feesQuery.isLoading} />
      </div>

      <DxPanel title="Price list" icon={<Receipt className="h-4 w-4" />} flush>
        <DxGrid
          borderless
          columns={columns}
          data={fees}
          rowKey={(f) => f.id}
          isLoading={feesQuery.isLoading}
          error={feesQuery.error ? "Unable to load the fee schedule." : null}
          onRetry={() => feesQuery.refetch()}
          empty={{
            icon: Receipt,
            title: "No fee items yet",
            description: "Seed the default Nigerian mortuary price list, or add your own items.",
            action: (
              <DxButton variant="primary" leftIcon={<Sparkles className="h-4 w-4" />} isLoading={seedMut.isPending} onClick={() => seedMut.mutate()}>
                Seed defaults
              </DxButton>
            ),
          }}
        />
      </DxPanel>

      <DxPopup
        isOpen={open}
        onClose={() => { if (!saveMut.isPending) { setOpen(false); setEditing(null); } }}
        title={editing ? `Edit fee item — ${editing.code}` : "Add fee item"}
        size="lg"
        footer={
          <>
            <DxButton onClick={() => { setOpen(false); setEditing(null); }} disabled={saveMut.isPending}>
              Cancel
            </DxButton>
            <DxButton variant="primary" isLoading={saveMut.isPending} onClick={submit}>
              {editing ? "Save changes" : "Add fee item"}
            </DxButton>
          </>
        }
      >
        {formError && <DxMessage tone="danger" className="mb-4">{formError}</DxMessage>}
        <DxForm cols={2}>
          <DxInput
            label={editing ? "Code (fixed)" : "Code"}
            required={!editing}
            mono
            disabled={!!editing}
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            placeholder="e.g. MORT-STORAGE"
          />
          <DxInput
            label="Service name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Daily body storage"
          />
          <DxSelect
            label="Charge type"
            value={form.charge_type}
            onChange={(e) => setForm({ ...form, charge_type: e.target.value })}
            options={CHARGE_TYPES.map((t) => ({ value: t, label: humanType(t) }))}
          />
          <DxInput
            label="Unit price (₦)"
            type="number"
            min={0}
            value={form.unit_price}
            onChange={(e) => setForm({ ...form, unit_price: e.target.value })}
          />
          <DxSelect
            label="Account code"
            value={form.account_code}
            onChange={(e) => setForm({ ...form, account_code: e.target.value })}
            options={accountOptions}
            placeholder="Auto — by charge type"
            hint="Chart-of-accounts code this costing posts to."
          />
          <DxSelect
            label="Billing cadence"
            value={form.billing_cadence}
            onChange={(e) => setForm({ ...form, billing_cadence: e.target.value })}
            options={[
              { value: "ONE_OFF", label: "One-off" },
              { value: "DAILY", label: "Recurrent — daily" },
              { value: "MONTHLY", label: "Recurrent — monthly" },
            ]}
            hint="Recurrent charges accrue over the body's stay."
          />
          <div className="flex items-end">
            <DxCheckbox
              label="Active"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
          </div>
          <DxTextarea
            label="Description"
            fieldClassName="dx-col-span-full"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </DxForm>
      </DxPopup>

      <DxConfirm
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) deleteMut.mutate(deleteTarget.id); }}
        title="Remove fee item?"
        description={deleteTarget ? `Remove "${deleteTarget.name}" from the price list? Existing charges are not affected.` : undefined}
        confirmLabel="Remove"
        tone="danger"
      />
    </DxPage>
  );
}
