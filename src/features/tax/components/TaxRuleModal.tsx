import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/feedback/ToastProvider";
import {
  taxApi,
  TAX_APPLICABILITIES,
  TAX_KINDS,
  TAX_PRICING_MODES,
  TAX_SCOPES,
  type TaxRule,
  type TaxType,
} from "../api/tax.api";

function todayISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function apiErrorMessage(err: any, fallback: string): string {
  const detail = err?.response?.data?.detail ?? err?.response?.data?.message;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg;
  return fallback;
}

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  rule?: TaxRule | null;
  taxTypes: TaxType[];
  onTypesChanged: () => void;
};

const NEW_TYPE = "__new__";

export function TaxRuleModal({ isOpen, onClose, onSaved, rule, taxTypes, onTypesChanged }: Props) {
  const toast = useToast();
  const isEdit = !!rule;

  const [typeChoice, setTypeChoice] = useState<string>("");
  const [newType, setNewType] = useState({ code: "", name: "", kind: "VAT", rate: "7.5" });

  const [name, setName] = useState("");
  const [scope, setScope] = useState<string>("TENANT");
  const [applicability, setApplicability] = useState<string>("ALL");
  const [matchValues, setMatchValues] = useState("");
  const [pricingMode, setPricingMode] = useState<string>("EXCLUSIVE");
  const [priority, setPriority] = useState<string>("100");
  const [facilityId, setFacilityId] = useState<string>("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  // (Re)initialise the form whenever the modal opens or the target rule changes.
  useEffect(() => {
    if (!isOpen) return;
    if (rule) {
      setTypeChoice(String(rule.tax_type_id));
      setName(rule.name ?? "");
      setScope(rule.scope ?? "TENANT");
      setApplicability(rule.applicability ?? "ALL");
      setMatchValues((rule.match_values ?? []).join(", "));
      setPricingMode(rule.pricing_mode ?? "EXCLUSIVE");
      setPriority(String(rule.priority ?? 100));
      setFacilityId(rule.facility_id != null ? String(rule.facility_id) : "");
      setIsActive(rule.is_active ?? true);
    } else {
      setTypeChoice(taxTypes.length ? String(taxTypes[0].id) : NEW_TYPE);
      setNewType({ code: "", name: "", kind: "VAT", rate: "7.5" });
      setName("");
      setScope("TENANT");
      setApplicability("ALL");
      setMatchValues("");
      setPricingMode("EXCLUSIVE");
      setPriority("100");
      setFacilityId("");
      setIsActive(true);
    }
  }, [isOpen, rule, taxTypes]);

  const creatingType = typeChoice === NEW_TYPE;

  const typeOptions = useMemo(
    () => [
      ...taxTypes.map((t) => ({ value: String(t.id), label: `${t.name} (${t.code})` })),
      ...(isEdit ? [] : [{ value: NEW_TYPE, label: "➕ Create new tax type…" }]),
    ],
    [taxTypes, isEdit],
  );

  async function resolveTaxTypeId(): Promise<number> {
    if (!creatingType) return Number(typeChoice);
    // Create the tax type + its first effective rate, then use it.
    const code = newType.code.trim().toUpperCase();
    if (!code || !newType.name.trim()) {
      throw new Error("Enter a code and name for the new tax type.");
    }
    const rate = Number(newType.rate);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      throw new Error("Enter a valid rate between 0 and 100.");
    }
    const created = await taxApi.createType({
      code,
      name: newType.name.trim(),
      kind: newType.kind,
      is_withholding: newType.kind === "WHT",
    });
    await taxApi.addRate({
      tax_type_id: created.id,
      rate_percent: rate,
      effective_from: todayISO(),
      note: "Initial rate",
    });
    onTypesChanged();
    return created.id;
  }

  async function handleSubmit() {
    if (!name.trim()) {
      toast.error("Missing name", "Give the tax rule a name.");
      return;
    }
    const prio = Number(priority);
    if (!Number.isFinite(prio)) {
      toast.error("Invalid priority", "Priority must be a number.");
      return;
    }
    setSaving(true);
    try {
      const taxTypeId = await resolveTaxTypeId();
      const payload = {
        tax_type_id: taxTypeId,
        name: name.trim(),
        scope,
        applicability,
        match_values:
          applicability === "ALL"
            ? null
            : matchValues.split(",").map((v) => v.trim()).filter(Boolean),
        pricing_mode: pricingMode,
        priority: prio,
        facility_id: scope === "FACILITY" && facilityId ? Number(facilityId) : null,
        is_active: isActive,
      };
      if (isEdit && rule) {
        await taxApi.updateRule(rule.id, payload);
        toast.success("Tax rule updated", `“${payload.name}” has been saved.`);
      } else {
        await taxApi.createRule(payload);
        toast.success("Tax rule created", `“${payload.name}” is now active.`);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(
        isEdit ? "Couldn't update rule" : "Couldn't create rule",
        err?.message && !err?.response ? err.message : apiErrorMessage(err, "Please try again."),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? "Edit Tax Rule" : "Add Tax Rule"}
      size="lg"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} isLoading={saving}>
            {isEdit ? "Save changes" : "Create rule"}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <Select
          label="Tax type"
          value={typeChoice}
          onChange={(e) => setTypeChoice(e.target.value)}
          options={typeOptions}
          hint={
            taxTypes.length === 0
              ? "No tax types yet — create one (e.g. VAT at 7.5%) to base this rule on."
              : undefined
          }
        />

        {creatingType ? (
          <div className="grid grid-cols-1 gap-4 rounded-2xl border border-secondary-100 p-4 dark:border-white/10 sm:grid-cols-2">
            <Input
              label="Type code"
              placeholder="VAT"
              value={newType.code}
              onChange={(e) => setNewType((s) => ({ ...s, code: e.target.value }))}
            />
            <Input
              label="Type name"
              placeholder="Value Added Tax"
              value={newType.name}
              onChange={(e) => setNewType((s) => ({ ...s, name: e.target.value }))}
            />
            <Select
              label="Kind"
              value={newType.kind}
              onChange={(e) => setNewType((s) => ({ ...s, kind: e.target.value }))}
              options={TAX_KINDS.map((k) => ({ value: k, label: k.replace(/_/g, " ") }))}
            />
            <Input
              label="Rate (%)"
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={newType.rate}
              onChange={(e) => setNewType((s) => ({ ...s, rate: e.target.value }))}
            />
          </div>
        ) : null}

        <Input
          label="Rule name"
          placeholder="Standard VAT"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            label="Scope"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            options={TAX_SCOPES.map((s) => ({ value: s, label: s }))}
          />
          <Select
            label="Pricing mode"
            value={pricingMode}
            onChange={(e) => setPricingMode(e.target.value)}
            options={TAX_PRICING_MODES.map((m) => ({
              value: m,
              label: m === "EXCLUSIVE" ? "Exclusive (added on top)" : "Inclusive (in price)",
            }))}
          />
          <Select
            label="Applies to"
            value={applicability}
            onChange={(e) => setApplicability(e.target.value)}
            options={TAX_APPLICABILITIES.map((a) => ({ value: a, label: a.replace(/_/g, " ") }))}
          />
          <Input
            label="Priority"
            type="number"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            hint="Lower runs first."
          />
        </div>

        {applicability !== "ALL" ? (
          <Input
            label="Match values"
            placeholder="Comma-separated, e.g. CONSULTATION, LAB"
            value={matchValues}
            onChange={(e) => setMatchValues(e.target.value)}
            hint="The rule only applies to items matching these values."
          />
        ) : null}

        {scope === "FACILITY" ? (
          <Input
            label="Facility ID"
            type="number"
            placeholder="Optional — leave blank for all facilities"
            value={facilityId}
            onChange={(e) => setFacilityId(e.target.value)}
          />
        ) : null}

        <label className="flex items-center gap-3 rounded-2xl border border-secondary-100 p-4 dark:border-white/10">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-5 w-5 rounded-md accent-primary-500"
          />
          <span className="text-sm font-semibold text-secondary-700 dark:text-secondary-200">
            Active — apply this rule to new invoices
          </span>
        </label>
      </div>
    </Modal>
  );
}
