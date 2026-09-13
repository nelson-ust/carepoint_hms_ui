import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/feedback/ToastProvider";
import { useSetStaffSalary } from "../hooks/use-payroll";
import type {
  AllowanceType,
  DeductionType,
  PayComponent,
  SalaryGrade,
  SalaryStep,
  StaffSalaryRow,
} from "../api/payroll.api";

function todayISO(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

type Row = { label: string; amount: string };

function toRows(items: PayComponent[]): Row[] {
  return (items || []).map((i) => ({
    label: i.label || i.type_code || "",
    amount: String(i.amount ?? ""),
  }));
}

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  staff: StaffSalaryRow | null;
  grades: SalaryGrade[];
  steps: SalaryStep[];
  allowanceTypes: AllowanceType[];
  deductionTypes: DeductionType[];
};

export function SalaryModal({ isOpen, onClose, onSaved, staff, grades, steps, allowanceTypes, deductionTypes }: Props) {
  const toast = useToast();
  const save = useSetStaffSalary();

  const [baseAmount, setBaseAmount] = useState("");
  const [currency, setCurrency] = useState("NGN");
  const [gradeId, setGradeId] = useState("");
  const [stepId, setStepId] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(todayISO());
  const [annualRent, setAnnualRent] = useState("");
  const [allowances, setAllowances] = useState<Row[]>([]);
  const [deductions, setDeductions] = useState<Row[]>([]);

  useEffect(() => {
    if (!isOpen || !staff) return;
    setBaseAmount(staff.base_amount ? String(staff.base_amount) : "");
    setCurrency(staff.currency || "NGN");
    setGradeId(staff.grade_id != null ? String(staff.grade_id) : "");
    setStepId(staff.step_id != null ? String(staff.step_id) : "");
    setEffectiveFrom(staff.effective_from ? staff.effective_from.slice(0, 10) : todayISO());
    setAnnualRent(staff.annual_rent != null ? String(staff.annual_rent) : "");
    setAllowances(toRows(staff.allowances));
    setDeductions(toRows(staff.deductions));
  }, [isOpen, staff]);

  const stepsForGrade = useMemo(
    () => (gradeId ? steps.filter((s) => String(s.grade_id) === gradeId) : []),
    [steps, gradeId],
  );

  function onPickStep(value: string) {
    setStepId(value);
    const step = steps.find((s) => String(s.id) === value);
    if (step && (!baseAmount || Number(baseAmount) === 0)) {
      setBaseAmount(String(step.base_amount));
    }
  }

  const setRow = (
    list: Row[],
    setList: (r: Row[]) => void,
    i: number,
    key: keyof Row,
    val: string,
  ) => {
    const next = list.slice();
    next[i] = { ...next[i], [key]: val };
    setList(next);
  };

  function toComponents(rows: Row[]): PayComponent[] {
    return rows
      .filter((r) => r.label.trim() && r.amount !== "" && Number.isFinite(Number(r.amount)))
      .map((r) => ({ type_code: r.label.trim(), label: r.label.trim(), amount: Number(r.amount) }));
  }

  async function handleSave() {
    if (!staff) return;
    const base = Number(baseAmount);
    if (!Number.isFinite(base) || base < 0) {
      toast.error("Invalid base salary", "Enter a valid base amount.");
      return;
    }
    if (!effectiveFrom) {
      toast.error("Missing date", "Choose an effective-from date.");
      return;
    }
    try {
      await save.mutateAsync({
        staff_profile_id: staff.staff_profile_id,
        base_amount: base,
        grade_id: gradeId ? Number(gradeId) : null,
        step_id: stepId ? Number(stepId) : null,
        currency,
        allowances: toComponents(allowances),
        deductions: toComponents(deductions),
        effective_from: effectiveFrom,
        annual_rent: annualRent ? Number(annualRent) : null,
      });
      toast.success("Salary saved", `${staff.staff_name || "Staff"}'s salary is mapped.`);
      onSaved();
      onClose();
    } catch (err: any) {
      const detail = err?.response?.data?.detail ?? err?.response?.data?.message;
      toast.error("Couldn't save salary", typeof detail === "string" ? detail : "Please try again.");
    }
  }

  function RowEditor({
    title,
    rows,
    setList,
    suggestions,
  }: {
    title: string;
    rows: Row[];
    setList: (r: Row[]) => void;
    suggestions: { code: string; name: string }[];
  }) {
    const listId = `sugg-${title.replace(/\s/g, "")}`;
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-widest text-secondary-500">{title}</p>
          <Button size="sm" variant="ghost" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setList([...rows, { label: "", amount: "" }])}>
            Add
          </Button>
        </div>
        <datalist id={listId}>
          {suggestions.map((s) => (
            <option key={s.code} value={s.name} />
          ))}
        </datalist>
        {rows.length === 0 ? (
          <p className="text-xs text-secondary-400">None.</p>
        ) : (
          rows.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                list={listId}
                value={r.label}
                onChange={(e) => setRow(rows, setList, i, "label", e.target.value)}
                placeholder="Label"
                className="input-field flex-1"
              />
              <input
                type="number"
                value={r.amount}
                onChange={(e) => setRow(rows, setList, i, "amount", e.target.value)}
                placeholder="Amount"
                className="input-field w-32"
              />
              <button type="button" onClick={() => setList(rows.filter((_, x) => x !== i))} className="p-2 rounded-xl hover:bg-rose-50">
                <Trash2 className="h-4 w-4 text-rose-400" />
              </button>
            </div>
          ))
        )}
      </div>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={staff ? `Salary — ${staff.staff_name || staff.staff_no || "Staff"}` : "Salary"}
      size="lg"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>Cancel</Button>
          <Button onClick={handleSave} isLoading={save.isPending}>Save salary</Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Grade (optional)"
            value={gradeId}
            onChange={(e) => { setGradeId(e.target.value); setStepId(""); }}
            options={[{ value: "", label: "— None —" }, ...grades.map((g) => ({ value: String(g.id), label: `${g.name} (${g.code})` }))]}
          />
          <Select
            label="Step (optional)"
            value={stepId}
            onChange={(e) => onPickStep(e.target.value)}
            disabled={!gradeId}
            options={[{ value: "", label: gradeId ? "— None —" : "Pick a grade first" }, ...stepsForGrade.map((s) => ({ value: String(s.id), label: `${s.code} · ${s.base_amount.toLocaleString()}` }))]}
          />
          <Input label="Base salary (monthly)" type="number" min="0" value={baseAmount} onChange={(e) => setBaseAmount(e.target.value)} />
          <Input label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} />
          <Input label="Effective from" type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
          <Input label="Annual rent (optional)" type="number" min={0} step="0.01" value={annualRent}
            onChange={(e) => setAnnualRent(e.target.value)}
            hint="Drives the rent relief in PAYE (20% of rent, capped at ₦500,000) under the 2025 Tax Act." />
        </div>

        <RowEditor title="Allowances" rows={allowances} setList={setAllowances} suggestions={allowanceTypes} />
        <RowEditor title="Deductions (non-statutory)" rows={deductions} setList={setDeductions} suggestions={deductionTypes} />

        <p className="text-[11px] text-secondary-400">
          Statutory deductions (PAYE per the Nigeria Tax Act 2025, pension, NHF) are computed automatically at payroll run time. NHIS and life-insurance deductions added here are treated as tax reliefs.
        </p>
      </div>
    </Modal>
  );
}
