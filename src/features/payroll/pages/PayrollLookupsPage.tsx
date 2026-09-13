import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Plus, Layers, Landmark, Coins, Puzzle, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SuiteEyebrow } from "@/components/layout/SuiteEyebrow";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/api/api-error";
import { routes } from "@/config/routes";
import { PayrollTabs } from "../components/PayrollTabs";
import {
  useSalaryGrades,
  useSalarySteps,
  usePayrollConfig,
  useCreateSalaryGrade,
  useCreateSalaryStep,
  useCreateStatutoryConfig,
} from "../hooks/use-payroll";

type FormKind = "grade" | "step" | "statutory" | null;

function todayISO(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const money = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

export function PayrollLookupsPage() {
  const toast = useToast();
  const grades = useSalaryGrades();
  const steps = useSalarySteps();
  const config = usePayrollConfig();

  const createGrade = useCreateSalaryGrade();
  const createStep = useCreateSalaryStep();
  const createStatutory = useCreateStatutoryConfig();

  const [form, setForm] = useState<FormKind>(null);
  const [f, setF] = useState<Record<string, string | boolean>>({});
  const set = (k: string, v: string | boolean) => setF((s) => ({ ...s, [k]: v }));

  function open(kind: FormKind) {
    setF(kind === "statutory" ? { effective_from: todayISO() } : kind === "step" ? { currency: "NGN" } : {});
    setForm(kind);
  }

  const saving = createGrade.isPending || createStep.isPending || createStatutory.isPending;

  async function submit() {
    try {
      if (form === "grade") {
        if (!f.code || !f.name) return toast.error("Missing fields", "Code and name are required.");
        await createGrade.mutateAsync({ code: String(f.code), name: String(f.name), description: f.description ? String(f.description) : undefined });
      } else if (form === "step") {
        if (!f.grade_id || !f.code) return toast.error("Missing fields", "Grade and code are required.");
        await createStep.mutateAsync({ grade_id: Number(f.grade_id), code: String(f.code), base_amount: Number(f.base_amount || 0), currency: String(f.currency || "NGN") });
      } else if (form === "statutory") {
        if (!f.code || !f.name) return toast.error("Missing fields", "Code and name are required.");
        await createStatutory.mutateAsync({ code: String(f.code), name: String(f.name), rate_percent: f.rate_percent ? Number(f.rate_percent) : null, employer_rate_percent: f.employer_rate_percent ? Number(f.employer_rate_percent) : null, effective_from: String(f.effective_from || todayISO()) });
      }
      toast.success("Saved", "The payroll lookup has been added.");
      setForm(null);
    } catch (err) {
      toast.error("Couldn't save", apiErrorMessage(err, "Please try again."));
    }
  }

  function Section({ title, icon: Icon, onAdd, loading, empty, children }: any) {
    return (
      <Card variant="panel" className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-secondary-700">
            <Icon className="h-4 w-4 text-primary-500" /> {title}
          </h3>
          <Button size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={onAdd}>Add</Button>
        </div>
        {loading ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : empty ? (
          <p className="text-xs text-secondary-400">Nothing yet — add your first entry.</p>
        ) : (
          <div className="space-y-2">{children}</div>
        )}
      </Card>
    );
  }

  const Line = ({ left, sub, right }: { left: string; sub?: string; right?: ReactNode }) => (
    <div className="flex items-center justify-between py-2 border-b border-secondary-100/60 last:border-0">
      <div>
        <div className="text-sm font-bold text-secondary-900">{left}</div>
        {sub && <div className="text-[11px] text-secondary-400">{sub}</div>}
      </div>
      {right}
    </div>
  );

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <PageHeader title="Payroll Lookups"
        eyebrow={<SuiteEyebrow label="HR & Payroll Suite" />} description="Structural building blocks: salary grades & steps and statutory configurations. Pay elements (allowances & deductions) live in Pay Components." />
      <PayrollTabs />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section title="Salary Grades" icon={Layers} onAdd={() => open("grade")} loading={grades.isLoading} empty={(grades.data ?? []).length === 0}>
          {(grades.data ?? []).map((g) => (
            <Line key={g.id} left={g.name} sub={g.code} right={g.is_active ? <Badge variant="soft-success">Active</Badge> : <Badge variant="secondary">Inactive</Badge>} />
          ))}
        </Section>

        <Section title="Salary Steps" icon={Coins} onAdd={() => open("step")} loading={steps.isLoading} empty={(steps.data ?? []).length === 0}>
          {(steps.data ?? []).map((s) => {
            const g = (grades.data ?? []).find((x) => x.id === s.grade_id);
            return <Line key={s.id} left={`${s.code}`} sub={g ? g.name : `Grade #${s.grade_id}`} right={<span className="text-sm font-bold text-secondary-900">{s.currency} {money.format(s.base_amount)}</span>} />;
          })}
        </Section>

        <Section title="Statutory Configurations" icon={Landmark} onAdd={() => open("statutory")} loading={config.isLoading} empty={(config.data?.statutoryConfigs ?? []).length === 0}>
          {(config.data?.statutoryConfigs ?? []).map((c) => (
            <Line key={c.id} left={c.name} sub={c.code} right={<span className="text-sm font-bold text-secondary-900">{c.rate_percent != null ? `${c.rate_percent}%` : c.employer_rate_percent != null ? `${c.employer_rate_percent}% (employer)` : "—"}</span>} />
          ))}
        </Section>

        {/* Allowance/deduction management moved to Pay Components — one catalog, no duplicates. */}
        <Card variant="panel" className="p-6 flex flex-col justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-secondary-700">
              <Puzzle className="h-4 w-4 text-primary-500" /> Allowances &amp; Deductions
            </h3>
            <p className="mt-3 text-sm text-secondary-500">
              Pay elements are managed once, in the <span className="font-bold">Pay Components</span> catalog —
              earnings, deductions, taxability and templates. They were removed from this
              page so the same item can't be defined in two places.
            </p>
          </div>
          <div className="mt-4">
            <Link to={routes.payrollComponents}>
              <Button size="sm" variant="secondary" rightIcon={<ArrowRight className="h-3.5 w-3.5" />}>
                Open Pay Components
              </Button>
            </Link>
          </div>
        </Card>
      </div>

      <Modal
        isOpen={form !== null}
        onClose={() => setForm(null)}
        title={
          form === "grade" ? "Add Salary Grade"
          : form === "step" ? "Add Salary Step"
          : "Add Statutory Configuration"
        }
        size="md"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setForm(null)} disabled={saving}>Cancel</Button>
            <Button onClick={submit} isLoading={saving}>Save</Button>
          </div>
        }
      >
        <div className="space-y-4">
          {form === "step" ? (
            <Select
              label="Grade"
              value={String(f.grade_id ?? "")}
              onChange={(e) => set("grade_id", e.target.value)}
              options={[{ value: "", label: "— Select grade —" }, ...(grades.data ?? []).map((g) => ({ value: String(g.id), label: `${g.name} (${g.code})` }))]}
            />
          ) : null}

          <Input label="Code" value={String(f.code ?? "")} onChange={(e) => set("code", e.target.value)} placeholder={form === "grade" ? "GL-08" : form === "step" ? "STEP-1" : "NSITF"} />

          {form !== "step" ? (
            <Input label="Name" value={String(f.name ?? "")} onChange={(e) => set("name", e.target.value)} />
          ) : null}

          {form === "step" ? (
            <div className="grid grid-cols-2 gap-4">
              <Input label="Base amount" type="number" min="0" value={String(f.base_amount ?? "")} onChange={(e) => set("base_amount", e.target.value)} />
              <Input label="Currency" value={String(f.currency ?? "NGN")} onChange={(e) => set("currency", e.target.value.toUpperCase())} maxLength={3} />
            </div>
          ) : null}

          {form === "grade" ? (
            <Input label="Description (optional)" value={String(f.description ?? "")} onChange={(e) => set("description", e.target.value)} />
          ) : null}

          {form === "statutory" ? (
            <div className="grid grid-cols-2 gap-4">
              <Input label="Rate (%)" type="number" min="0" value={String(f.rate_percent ?? "")} onChange={(e) => set("rate_percent", e.target.value)} />
              <Input label="Employer rate (%)" type="number" min="0" value={String(f.employer_rate_percent ?? "")} onChange={(e) => set("employer_rate_percent", e.target.value)} />
              <Input label="Effective from" type="date" value={String(f.effective_from ?? todayISO())} onChange={(e) => set("effective_from", e.target.value)} />
            </div>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}
