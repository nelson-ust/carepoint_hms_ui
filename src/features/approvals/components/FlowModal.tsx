import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/feedback/ToastProvider";
import { useCreateFlow, useUpdateFlow } from "../hooks/use-approvals";
import {
  APPROVER_KINDS, DECISION_RULES, DYNAMIC_TOKENS,
  type ApprovalFlow, type ApproverKind, type DecisionRule, type DynamicToken,
} from "../api/approvals.api";

type RoleOption = { id: number; name: string; code: string };

type StepDraft = {
  name: string;
  approver_kind: ApproverKind;
  approver_role_id: string;
  approver_user_id: string;
  approver_department_id: string;
  dynamic_token: DynamicToken;
  decision_rule: DecisionRule;
  required_approvals: string;
};

const blankStep = (): StepDraft => ({
  name: "", approver_kind: "ROLE", approver_role_id: "", approver_user_id: "",
  approver_department_id: "", dynamic_token: "FINANCE_HEAD", decision_rule: "ANY_OF", required_approvals: "1",
});

type Props = {
  isOpen: boolean;
  onClose: () => void;
  requestType: string;
  roles: RoleOption[];
  flow?: ApprovalFlow | null;
};

export function FlowModal({ isOpen, onClose, requestType, roles, flow }: Props) {
  const toast = useToast();
  const create = useCreateFlow();
  const update = useUpdateFlow();
  const isEdit = !!flow;

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [isDefault, setIsDefault] = useState(true);
  const [steps, setSteps] = useState<StepDraft[]>([blankStep()]);

  useEffect(() => {
    if (!isOpen) return;
    if (flow) {
      setCode(flow.code); setName(flow.name); setIsDefault(flow.is_default);
      setSteps(flow.steps.length ? flow.steps.map((s) => ({
        name: s.name, approver_kind: s.approver_kind,
        approver_role_id: s.approver_role_id != null ? String(s.approver_role_id) : "",
        approver_user_id: s.approver_user_id != null ? String(s.approver_user_id) : "",
        approver_department_id: s.approver_department_id != null ? String(s.approver_department_id) : "",
        dynamic_token: (s.dynamic_token as DynamicToken) || "FINANCE_HEAD",
        decision_rule: s.decision_rule, required_approvals: String(s.required_approvals ?? 1),
      })) : [blankStep()]);
    } else {
      setCode(""); setName(""); setIsDefault(true); setSteps([blankStep()]);
    }
  }, [isOpen, flow]);

  const setStep = (i: number, k: keyof StepDraft, v: string) =>
    setSteps((prev) => prev.map((s, x) => (x === i ? { ...s, [k]: v } : s)));

  async function submit() {
    if (!code.trim() || !name.trim()) { toast.error("Missing fields", "Code and name are required."); return; }
    if (steps.some((s) => !s.name.trim())) { toast.error("Incomplete step", "Every step needs a name."); return; }
    const payloadSteps = steps.map((s, idx) => ({
      step_order: idx + 1,
      name: s.name.trim(),
      approver_kind: s.approver_kind,
      approver_role_id: s.approver_kind === "ROLE" && s.approver_role_id ? Number(s.approver_role_id) : null,
      approver_user_id: s.approver_kind === "USER" && s.approver_user_id ? Number(s.approver_user_id) : null,
      approver_department_id: s.approver_kind === "DEPARTMENT" && s.approver_department_id ? Number(s.approver_department_id) : null,
      dynamic_token: s.approver_kind === "DYNAMIC" ? s.dynamic_token : null,
      decision_rule: s.decision_rule,
      required_approvals: Number(s.required_approvals) || 1,
      allow_self_approval: false,
      is_active: true,
    }));
    try {
      if (isEdit && flow) {
        await update.mutateAsync({ id: flow.id, payload: { name: name.trim(), is_default: isDefault, steps: payloadSteps } });
        toast.success("Flow updated", name);
      } else {
        await create.mutateAsync({ request_type: requestType, code: code.trim(), name: name.trim(), is_default: isDefault, steps: payloadSteps });
        toast.success("Flow created", name);
      }
      onClose();
    } catch (err: any) {
      const d = err?.response?.data?.detail ?? err?.response?.data?.message;
      toast.error("Couldn't save flow", typeof d === "string" ? d : "Please try again.");
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? "Edit Approval Flow" : `New Approval Flow — ${requestType}`} size="xl"
      footer={<div className="flex justify-end gap-3"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit} isLoading={create.isPending || update.isPending}>{isEdit ? "Save flow" : "Create flow"}</Button></div>}>
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Flow code" value={code} disabled={isEdit} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="STANDARD" />
          <Input label="Flow name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Standard payroll approval" />
        </div>
        <label className="flex items-center gap-3 text-sm font-semibold text-secondary-700">
          <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className="h-5 w-5 rounded-md accent-primary-500" />
          Use as the default flow for {requestType}
        </label>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-widest text-secondary-500">Steps (in order)</p>
            <Button size="sm" variant="ghost" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setSteps((p) => [...p, blankStep()])}>Add step</Button>
          </div>
          {steps.map((s, i) => (
            <div key={i} className="rounded-2xl border border-secondary-100 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary-900 text-white text-[11px] font-black">{i + 1}</span>
                <Input className="flex-1" placeholder="Step name (e.g. Finance review)" value={s.name} onChange={(e) => setStep(i, "name", e.target.value)} />
                {steps.length > 1 && <button type="button" onClick={() => setSteps((p) => p.filter((_, x) => x !== i))} className="p-2 rounded-xl hover:bg-rose-50"><Trash2 className="h-4 w-4 text-rose-400" /></button>}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Select label="Approver" value={s.approver_kind} onChange={(e) => setStep(i, "approver_kind", e.target.value)}
                  options={APPROVER_KINDS.map((k) => ({ value: k, label: k }))} />
                {s.approver_kind === "ROLE" && (
                  <Select label="Role" value={s.approver_role_id} onChange={(e) => setStep(i, "approver_role_id", e.target.value)}
                    options={[{ value: "", label: "— Select role —" }, ...roles.map((r) => ({ value: String(r.id), label: `${r.name} (${r.code})` }))]} />
                )}
                {s.approver_kind === "DYNAMIC" && (
                  <Select label="Dynamic approver" value={s.dynamic_token} onChange={(e) => setStep(i, "dynamic_token", e.target.value)}
                    options={DYNAMIC_TOKENS.map((t) => ({ value: t, label: t.replace(/_/g, " ") }))} />
                )}
                {s.approver_kind === "USER" && (
                  <Input label="User ID" type="number" value={s.approver_user_id} onChange={(e) => setStep(i, "approver_user_id", e.target.value)} />
                )}
                {s.approver_kind === "DEPARTMENT" && (
                  <Input label="Department ID" type="number" value={s.approver_department_id} onChange={(e) => setStep(i, "approver_department_id", e.target.value)} />
                )}
                <Select label="Decision rule" value={s.decision_rule} onChange={(e) => setStep(i, "decision_rule", e.target.value)}
                  options={DECISION_RULES.map((d) => ({ value: d, label: d.replace(/_/g, " ") }))} />
                {s.decision_rule === "N_OF_M" && (
                  <Input label="Required approvals" type="number" min="1" value={s.required_approvals} onChange={(e) => setStep(i, "required_approvals", e.target.value)} />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
