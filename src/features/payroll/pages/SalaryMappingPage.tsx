import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Search, Users, Wallet } from "lucide-react";
import {
  DxPage, DxPageHeader, DxPanel, DxKpi, DxGrid, DxBadge, DxButton, DxInput, DxMessage,
  type DxGridColumn,
} from "@/components/dx";
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

  const columns: DxGridColumn<StaffSalaryRow>[] = [
    {
      key: "staff", header: "Staff", render: (r) => (
        <div>
          <div className="text-[13px] font-semibold text-[var(--dx-text)]">{r.staff_name || `Staff #${r.staff_profile_id}`}</div>
          <div className="text-[11px] text-[var(--dx-text-muted)]">{r.staff_no || "—"}</div>
        </div>
      ),
    },
    { key: "title", header: "Title", render: (r) => <span className="text-[13px] text-[var(--dx-text-muted)]">{r.job_title || "—"}</span> },
    {
      key: "base", header: "Base salary", align: "right",
      render: (r) => <span className="dx-mono text-[13px] font-semibold text-[var(--dx-text)]">{r.has_salary && r.base_amount > 0 ? `${r.currency} ${money.format(r.base_amount)}` : "—"}</span>,
    },
    {
      key: "status", header: "Status",
      render: (r) => (r.has_salary && r.base_amount > 0) ? <DxBadge tone="success">Mapped</DxBadge> : <DxBadge tone="warning">Not mapped</DxBadge>,
    },
    {
      key: "action", header: "", align: "right",
      render: (r) => {
        const isMapped = r.has_salary && r.base_amount > 0;
        return <DxButton size="sm" variant={isMapped ? "text" : "primary"} onClick={() => setEditing(r)}>{isMapped ? "Update" : "Set salary"}</DxButton>;
      },
    },
  ];

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "HR & Payroll" }, { label: "Salary Mapping" }]}
        title="Salary Mapping"
        subtitle="Assign a base salary, grade/step, allowances and deductions to each staff member so payroll runs can compute pay."
      />
      <PayrollTabs />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <DxKpi label="Staff" value={String(staffRows.length)} icon={Users} tone="accent" isLoading={isLoading} />
        <DxKpi label="Salary mapped" value={String(mapped)} icon={CheckCircle2} tone="success" isLoading={isLoading} />
        <DxKpi label="Not mapped" value={String(unmapped)} icon={AlertTriangle} tone="warning" isLoading={isLoading} />
      </div>

      {unmapped > 0 && !isLoading ? (
        <DxMessage tone="warning">
          {unmapped} staff member{unmapped === 1 ? "" : "s"} have no salary mapped — they will be paid ₦0 until you set one.
        </DxMessage>
      ) : null}

      <DxPanel>
        <div className="mb-4 max-w-sm">
          <DxInput placeholder="Search staff by name, number, or title…" leftIcon={<Search className="h-3.5 w-3.5" />} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {isLoading ? (
          <div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="dx-skeleton h-14 w-full" />)}</div>
        ) : isError ? (
          <DxMessage tone="danger" action={<DxButton size="sm" onClick={() => refetch()}>Retry</DxButton>}>
            {apiErrorMessage(error, "The server rejected the request. Check that you're signed in with an HR/payroll role and try again.")}
          </DxMessage>
        ) : staffRows.length === 0 ? (
          <div className="py-14 text-center">
            <Users className="mx-auto mb-3 h-10 w-10 text-[var(--dx-text-faint)]" />
            <h4 className="text-[15px] font-bold text-[var(--dx-text)]">No staff profiles yet</h4>
            <p className="mx-auto mt-1 max-w-md text-[13px] text-[var(--dx-text-muted)]">Salary mapping lists every staff member with a staff profile. Onboard your staff first, then return here to set their pay.</p>
            <DxButton className="mx-auto mt-4" variant="primary" onClick={() => { window.location.href = "/staff"; }}>Go to Staff Management</DxButton>
          </div>
        ) : (
          <DxGrid<StaffSalaryRow>
            columns={columns}
            data={filtered}
            rowKey={(r) => r.staff_profile_id}
            empty={{ icon: Wallet, title: "No matches", description: "No staff match your search — clear it to see everyone." }}
          />
        )}
      </DxPanel>

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
    </DxPage>
  );
}
