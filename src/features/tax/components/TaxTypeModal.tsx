import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/feedback/ToastProvider";
import { taxApi, TAX_KINDS, type TaxType } from "../api/tax.api";

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
  type?: TaxType | null;
  /** Current effective rate for the type being edited, shown for context. */
  currentRate?: number | null;
};

export function TaxTypeModal({ isOpen, onClose, onSaved, type, currentRate }: Props) {
  const toast = useToast();
  const isEdit = !!type;

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [kind, setKind] = useState("VAT");
  const [rate, setRate] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (type) {
      setCode(type.code ?? "");
      setName(type.name ?? "");
      setKind(type.kind ?? "OTHER");
      setIsActive(type.is_active ?? true);
      setRate("");
    } else {
      setCode("");
      setName("");
      setKind("VAT");
      setRate("7.5");
      setIsActive(true);
    }
  }, [isOpen, type]);

  async function handleSubmit() {
    if (!isEdit && !code.trim()) {
      toast.error("Missing code", "Enter a short code, e.g. VAT.");
      return;
    }
    if (!name.trim()) {
      toast.error("Missing name", "Give the tax type a name.");
      return;
    }
    const rateProvided = rate.trim() !== "";
    const rateNum = Number(rate);
    if ((!isEdit || rateProvided) && (!Number.isFinite(rateNum) || rateNum < 0 || rateNum > 100)) {
      toast.error("Invalid rate", "Enter a rate between 0 and 100.");
      return;
    }

    setSaving(true);
    try {
      let typeId: number;
      if (isEdit && type) {
        await taxApi.updateType(type.id, {
          name: name.trim(),
          kind,
          is_withholding: kind === "WHT",
          is_active: isActive,
        });
        typeId = type.id;
      } else {
        const created = await taxApi.createType({
          code: code.trim().toUpperCase(),
          name: name.trim(),
          kind,
          is_withholding: kind === "WHT",
        });
        typeId = created.id;
      }

      // Create a new effective-dated rate when one was supplied (always on
      // create; optional on edit).
      if (rateProvided) {
        await taxApi.addRate({
          tax_type_id: typeId,
          rate_percent: rateNum,
          effective_from: todayISO(),
          note: isEdit ? "Rate update" : "Initial rate",
        });
      }

      toast.success(
        isEdit ? "Tax type updated" : "Tax type created",
        `“${name.trim()}” has been saved.`,
      );
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(
        isEdit ? "Couldn't update tax type" : "Couldn't create tax type",
        apiErrorMessage(err, "Please try again."),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? "Edit Tax Type" : "Add Tax Type"}
      size="md"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} isLoading={saving}>
            {isEdit ? "Save changes" : "Create type"}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <Input
          label="Code"
          placeholder="VAT"
          value={code}
          disabled={isEdit}
          onChange={(e) => setCode(e.target.value)}
          hint={isEdit ? "The code can't be changed after creation." : "Short unique code, e.g. VAT, WHT."}
        />
        <Input
          label="Name"
          placeholder="Value Added Tax"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Select
          label="Kind"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          options={TAX_KINDS.map((k) => ({ value: k, label: k.replace(/_/g, " ") }))}
        />
        <Input
          label={isEdit ? "New rate (%) — optional" : "Rate (%)"}
          type="number"
          step="0.01"
          min="0"
          max="100"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          hint={
            isEdit
              ? currentRate != null
                ? `Current rate is ${currentRate}%. Enter a new value to add an effective-dated rate.`
                : "Enter a value to set the first rate for this type."
              : "The initial effective rate, applied from today."
          }
        />
        {isEdit ? (
          <label className="flex items-center gap-3 rounded-2xl border border-secondary-100 p-4 dark:border-white/10">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-5 w-5 rounded-md accent-primary-500"
            />
            <span className="text-sm font-semibold text-secondary-700 dark:text-secondary-200">
              Active
            </span>
          </label>
        ) : null}
      </div>
    </Modal>
  );
}
