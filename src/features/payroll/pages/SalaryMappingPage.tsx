import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Search, Users, Wallet } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SuiteEyebrow } from "@/components/layout/SuiteEyebrow";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { MetricCard } from "@/components/charts/MetricCard";
import { PayrollTabs } from "../components/PayrollTabs";
import { apiErrorMessage } from "@/lib/api/api-error";
import { SalaryModal } from "../components/SalaryModal";
import {
  useSalaryGrades,
  useSalarySteps,
  useStaffSalaries,
  usePayrollConfig,
} from "../hooks/use-payroll";
import type { StaffSalaryRow } from "../api/payroll.api";

const money = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function SalaryMappingPage() {
  const { data: rows, isLoading, isError, error, refetch } = useStaffSalaries();
  const { data: grades = [] } = useSalaryGrades();
  const { data: steps = [] } = useSalarySteps();
  const { data: config } = usePayrollConfig();

  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<StaffSalaryRow | null>(null);

  const staffRows = rows ?? [];
  const mapped = staffRows.filter((r) => r.has_salary && r.base_amount > 0).length;
  const unmapped = staffRows.length - mapped;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return staffRows;
    return staffRows.filter(
      (r) =>
        (r.staff_name || "").toLowerCase().includes(q) ||
        (r.staff_no || "").toLowerCase().includes(q) ||
        (r.job_title || "").toLowerCase().includes(q),
    );
  }, [staffRows, search]);

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <PageHeader
        title="Salary Mapping"
        eyebrow={<SuiteEyebrow label="HR & Payroll Suite" />}
        description="Assign a base salary, grade/step, allowances and deductions to each staff member so payroll runs can compute pay."
      />
      <PayrollTabs />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <MetricCard label="Staff" value={String(staffRows.length)} icon={Users} tone="primary" isLoading={isLoading} />
        <MetricCard label="Salary mapped" value={String(mapped)} icon={CheckCircle2} tone="cyan" isLoading={isLoading} />
        <MetricCard label="Not mapped" value={String(unmapped)} icon={AlertTriangle} tone="amber" isLoading={isLoading} />
      </div>

      {unmapped > 0 && !isLoading && (
        <div className="p-5 rounded-2xl bg-amber-50 border border-amber-100 text-amber-700 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p className="text-sm font-semibold">
            {unmapped} staff member{unmapped === 1 ? "" : "s"} have no salary mapped — they will be paid ₦0 until you set one.
          </p>
        </div>
      )}

      <Card variant="panel" className="p-6">
        <div className="mb-4 max-w-sm">
          <Input
            placeholder="Search staff by name, number, or title…"
            leftIcon={<Search className="h-4 w-4" />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        ) : isError ? (
          <EmptyState
            icon={AlertTriangle}
            title="Couldn't load staff salaries"
            description={apiErrorMessage(error, "The server rejected the request. Check that you're signed in with an HR/payroll role and try again.")}
            action={<Button size="sm" variant="secondary" onClick={() => refetch()}>Retry</Button>}
          />
        ) : staffRows.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No staff profiles yet"
            description="Salary mapping lists every staff member with a staff profile. Onboard your staff first, then return here to set their pay."
            action={
              <Button size="sm" onClick={() => { window.location.href = "/staff"; }}>
                Go to Staff Management
              </Button>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState icon={Wallet} title="No matches" description="No staff match your search — clear it to see everyone." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] font-black uppercase tracking-widest text-secondary-400 border-b border-secondary-100">
                  <th className="py-3 pr-4">Staff</th>
                  <th className="py-3 pr-4">Title</th>
                  <th className="py-3 pr-4 text-right">Base salary</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3 pr-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const isMapped = r.has_salary && r.base_amount > 0;
                  return (
                    <tr key={r.staff_profile_id} className="border-b border-secondary-100/60 hover:bg-white/50">
                      <td className="py-3 pr-4">
                        <div className="font-bold text-secondary-900">{r.staff_name || `Staff #${r.staff_profile_id}`}</div>
                        <div className="text-[11px] text-secondary-400">{r.staff_no || "—"}</div>
                      </td>
                      <td className="py-3 pr-4 text-secondary-500">{r.job_title || "—"}</td>
                      <td className="py-3 pr-4 text-right font-bold text-secondary-900">
                        {isMapped ? `${r.currency} ${money.format(r.base_amount)}` : "—"}
                      </td>
                      <td className="py-3 pr-4">
                        {isMapped ? <Badge variant="soft-success">Mapped</Badge> : <Badge variant="soft-warning">Not mapped</Badge>}
                      </td>
                      <td className="py-3 pr-4 text-right">
                        <Button size="sm" variant={isMapped ? "ghost" : "primary"} onClick={() => setEditing(r)}>
                          {isMapped ? "Update" : "Set salary"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <SalaryModal
        isOpen={!!editing}
        onClose={() => setEditing(null)}
        onSaved={() => setEditing(null)}
        staff={editing}
        grades={grades}
        steps={steps}
        allowanceTypes={config?.allowanceTypes ?? []}
        deductionTypes={config?.deductionTypes ?? []}
      />
    </div>
  );
}
