import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Banknote, Briefcase, CheckCircle2, Landmark, Pencil, Search, ShieldCheck, Users, Wallet,
} from "lucide-react";
import {
  DxPage, DxPageHeader, DxPanel, DxKpi, DxGrid, DxBadge, DxButton, DxInput, DxSelect, DxPopup,
  type DxGridColumn, type DxBadgeTone,
} from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import { listPensionProviders } from "@/features/payroll/api/payroll.api";
import { listDepartments } from "@/features/staff/api/staff-admin.api";
import {
  EMPLOYMENT_STATUSES, EMPLOYMENT_TYPES,
  listStaffRecords, updateStaffRecord,
  type StaffRecord, type StaffRecordUpdate,
} from "../api/staff-records.api";

const money = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function statusTone(status?: string | null): DxBadgeTone {
  switch ((status ?? "").toUpperCase()) {
    case "ACTIVE": return "success";
    case "ON_LEAVE":
    case "PROBATION": return "info";
    case "SUSPENDED": return "warning";
    case "TERMINATED": return "danger";
    default: return "neutral";
  }
}

function labelize(v?: string | null): string {
  if (!v) return "—";
  return v.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());
}

// =====================================================================
// Edit modal — three sections: employment, compensation, bank/statutory
// =====================================================================

type FormState = {
  job_title: string;
  designation: string;
  specialty: string;
  department_id: string;
  employment_type: string;
  employment_status: string;
  hire_date: string;
  confirmation_date: string;
  probation_end_date: string;
  contract_start_date: string;
  contract_end_date: string;
  exit_date: string;
  exit_reason: string;
  supervisor_staff_id: string;
  date_of_birth: string;
  gender: string;
  marital_status: string;
  nationality: string;
  address_line_1: string;
  address_line_2: string;
  city: string;
  state_region: string;
  country: string;
  personal_email: string;
  personal_phone: string;
  next_of_kin_name: string;
  next_of_kin_relationship: string;
  next_of_kin_phone: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  bank_name: string;
  bank_account_no: string;
  bank_account_name: string;
  tax_id: string;
  pension_pin: string;
  pension_provider_id: string;
  nhf_no: string;
};

function toForm(r: StaffRecord): FormState {
  return {
    job_title: r.job_title ?? "",
    designation: r.designation ?? "",
    specialty: r.specialty ?? "",
    department_id: r.department_id != null ? String(r.department_id) : "",
    employment_type: r.employment_type ?? "",
    employment_status: r.employment_status ?? "",
    hire_date: r.hire_date ?? "",
    confirmation_date: r.confirmation_date ?? "",
    probation_end_date: r.probation_end_date ?? "",
    contract_start_date: r.contract_start_date ?? "",
    contract_end_date: r.contract_end_date ?? "",
    exit_date: r.exit_date ?? "",
    exit_reason: r.exit_reason ?? "",
    supervisor_staff_id: r.supervisor_staff_id != null ? String(r.supervisor_staff_id) : "",
    date_of_birth: r.date_of_birth ?? "",
    gender: r.gender ?? "",
    marital_status: r.marital_status ?? "",
    nationality: r.nationality ?? "",
    address_line_1: r.address_line_1 ?? "",
    address_line_2: r.address_line_2 ?? "",
    city: r.city ?? "",
    state_region: r.state_region ?? "",
    country: r.country ?? "",
    personal_email: r.personal_email ?? "",
    personal_phone: r.personal_phone ?? "",
    next_of_kin_name: r.next_of_kin_name ?? "",
    next_of_kin_relationship: r.next_of_kin_relationship ?? "",
    next_of_kin_phone: r.next_of_kin_phone ?? "",
    emergency_contact_name: r.emergency_contact_name ?? "",
    emergency_contact_phone: r.emergency_contact_phone ?? "",
    bank_name: r.bank_name ?? "",
    bank_account_no: r.bank_account_no ?? "",
    bank_account_name: r.bank_account_name ?? "",
    tax_id: r.tax_id ?? "",
    pension_pin: r.pension_pin ?? "",
    pension_provider_id: r.pension_provider_id != null ? String(r.pension_provider_id) : "",
    nhf_no: r.nhf_no ?? "",
  };
}

function SectionTitle({ icon: Icon, children }: { icon: any; children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--dx-text-muted)]">
      <Icon className="h-3.5 w-3.5" /> {children}
    </p>
  );
}

function EditStaffModal({ record, onClose }: { record: StaffRecord | null; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState | null>(record ? toForm(record) : null);
  const [recordId, setRecordId] = useState<number | null>(record?.staff_profile_id ?? null);

  // Re-seed the form when a different staff row is opened.
  if (record && record.staff_profile_id !== recordId) {
    setForm(toForm(record));
    setRecordId(record.staff_profile_id);
  }

  const { data: departments = [] } = useQuery({
    queryKey: ["departments", "all"],
    queryFn: () => listDepartments({ skip: 0, limit: 500 }),
    staleTime: 5 * 60_000,
  });
  const { data: allStaff = [] } = useQuery({
    queryKey: ["hr", "staff-records", "all"],
    queryFn: () => listStaffRecords(),
    staleTime: 5 * 60_000,
  });
  const { data: pensionProviders = [] } = useQuery({
    queryKey: ["payroll", "pension-providers"],
    queryFn: listPensionProviders,
    staleTime: 5 * 60_000,
  });

  const save = useMutation({
    mutationFn: (payload: StaffRecordUpdate) => updateStaffRecord(record!.staff_profile_id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr", "staff-records"] });
      queryClient.invalidateQueries({ queryKey: ["payroll"] });
      toast.success("Staff record updated", "The changes have been saved.");
      onClose();
    },
    onError: (err: any) => {
      const d = err?.response?.data?.detail ?? err?.response?.data?.message;
      toast.error("Couldn't save", typeof d === "string" ? d : "Please try again.");
    },
  });

  if (!record || !form) return null;

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => (f ? { ...f, [k]: e.target.value } : f));

  const initial = toForm(record);

  const submit = () => {
    const payload: StaffRecordUpdate = {};
    const diff = (k: keyof FormState) => form[k] !== initial[k];

    if (diff("job_title")) payload.job_title = form.job_title;
    if (diff("designation")) payload.designation = form.designation;
    if (diff("specialty")) payload.specialty = form.specialty;
    if (diff("department_id") && form.department_id) payload.department_id = Number(form.department_id);
    if (diff("employment_type") && form.employment_type) payload.employment_type = form.employment_type as any;
    if (diff("employment_status") && form.employment_status) payload.employment_status = form.employment_status as any;
    if (diff("hire_date") && form.hire_date) payload.hire_date = form.hire_date;
    if (diff("confirmation_date") && form.confirmation_date) payload.confirmation_date = form.confirmation_date;
    if (diff("probation_end_date") && form.probation_end_date) payload.probation_end_date = form.probation_end_date;
    if (diff("contract_start_date") && form.contract_start_date) payload.contract_start_date = form.contract_start_date;
    if (diff("contract_end_date") && form.contract_end_date) payload.contract_end_date = form.contract_end_date;
    if (diff("exit_date") && form.exit_date) payload.exit_date = form.exit_date;
    if (diff("exit_reason")) payload.exit_reason = form.exit_reason;
    if (diff("supervisor_staff_id") && form.supervisor_staff_id)
      payload.supervisor_staff_id = Number(form.supervisor_staff_id);
    if (diff("date_of_birth") && form.date_of_birth) payload.date_of_birth = form.date_of_birth;
    if (diff("gender")) payload.gender = form.gender;
    if (diff("marital_status")) payload.marital_status = form.marital_status;
    if (diff("nationality")) payload.nationality = form.nationality;
    if (diff("address_line_1")) payload.address_line_1 = form.address_line_1;
    if (diff("address_line_2")) payload.address_line_2 = form.address_line_2;
    if (diff("city")) payload.city = form.city;
    if (diff("state_region")) payload.state_region = form.state_region;
    if (diff("country")) payload.country = form.country;
    if (diff("personal_email")) payload.personal_email = form.personal_email;
    if (diff("personal_phone")) payload.personal_phone = form.personal_phone;
    if (diff("next_of_kin_name")) payload.next_of_kin_name = form.next_of_kin_name;
    if (diff("next_of_kin_relationship")) payload.next_of_kin_relationship = form.next_of_kin_relationship;
    if (diff("next_of_kin_phone")) payload.next_of_kin_phone = form.next_of_kin_phone;
    if (diff("emergency_contact_name")) payload.emergency_contact_name = form.emergency_contact_name;
    if (diff("emergency_contact_phone")) payload.emergency_contact_phone = form.emergency_contact_phone;

    if (diff("bank_name")) payload.bank_name = form.bank_name;
    if (diff("bank_account_no")) payload.bank_account_no = form.bank_account_no;
    if (diff("bank_account_name")) payload.bank_account_name = form.bank_account_name;
    if (diff("tax_id")) payload.tax_id = form.tax_id;
    if (diff("pension_pin")) payload.pension_pin = form.pension_pin;
    if (diff("pension_provider_id") && form.pension_provider_id)
      payload.pension_provider_id = Number(form.pension_provider_id);
    if (diff("nhf_no")) payload.nhf_no = form.nhf_no;

    if (Object.keys(payload).length === 0) {
      toast.info("Nothing to save", "No fields were changed.");
      return;
    }
    save.mutate(payload);
  };

  return (
    <DxPopup
      isOpen={!!record}
      onClose={onClose}
      title={`Edit — ${record.staff_name || record.staff_no}`}
      size="lg"
      locked={save.isPending}
      footer={
        <>
          <DxButton onClick={onClose} disabled={save.isPending}>Cancel</DxButton>
          <DxButton variant="primary" onClick={submit} isLoading={save.isPending}>Save changes</DxButton>
        </>
      }
    >
      <div className="space-y-6">
        {/* ── Job & employment ── */}
        <div className="space-y-3">
          <SectionTitle icon={Briefcase}>Job &amp; employment</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            <DxInput label="Job title" value={form.job_title} onChange={set("job_title")} />
            <DxInput label="Designation" value={form.designation} onChange={set("designation")} />
            <DxInput label="Specialty" value={form.specialty} onChange={set("specialty")} />
            <DxSelect label="Department" value={form.department_id} onChange={set("department_id")} placeholder="Select department…"
              options={departments.map((d: any) => ({ value: String(d.id), label: d.name }))} />
            <DxSelect label="Employment type" value={form.employment_type} onChange={set("employment_type")} placeholder="Select type…"
              options={EMPLOYMENT_TYPES.map((t) => ({ value: t, label: labelize(t) }))} />
            <DxSelect label="Employment status" value={form.employment_status} onChange={set("employment_status")} placeholder="Select status…"
              options={EMPLOYMENT_STATUSES.map((s) => ({ value: s, label: labelize(s) }))}
              hint="Exits (resigned/terminated/retired) also deactivate the user's login." />
            <DxInput label="Hire date" type="date" value={form.hire_date} onChange={set("hire_date")} />
            <DxSelect label="Supervisor / line manager" value={form.supervisor_staff_id} onChange={set("supervisor_staff_id")} placeholder="Select supervisor…"
              options={(allStaff ?? []).filter((sm) => sm.staff_profile_id !== record.staff_profile_id).map((sm) => ({ value: String(sm.staff_profile_id), label: sm.staff_name || sm.staff_no }))} />
            <DxInput label="Confirmation date" type="date" value={form.confirmation_date} onChange={set("confirmation_date")} hint="When probation was confirmed." />
            <DxInput label="Probation end date" type="date" value={form.probation_end_date} onChange={set("probation_end_date")} />
            <DxInput label="Contract start" type="date" value={form.contract_start_date} onChange={set("contract_start_date")} />
            <DxInput label="Contract end" type="date" value={form.contract_end_date} onChange={set("contract_end_date")} />
            <DxInput label="Exit date" type="date" value={form.exit_date} onChange={set("exit_date")} />
            <DxInput label="Exit reason" value={form.exit_reason} onChange={set("exit_reason")} />
          </div>
        </div>

        {/* ── Personal, contact & next of kin ── */}
        <div className="space-y-3">
          <SectionTitle icon={Users}>Personal &amp; next of kin</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            <DxInput label="Date of birth" type="date" value={form.date_of_birth} onChange={set("date_of_birth")} />
            <DxSelect label="Gender" value={form.gender} onChange={set("gender")} placeholder="Select…"
              options={["MALE", "FEMALE", "OTHER"].map((g) => ({ value: g, label: labelize(g) }))} />
            <DxSelect label="Marital status" value={form.marital_status} onChange={set("marital_status")} placeholder="Select…"
              options={["SINGLE", "MARRIED", "DIVORCED", "WIDOWED", "SEPARATED"].map((m) => ({ value: m, label: labelize(m) }))} />
            <DxInput label="Nationality" value={form.nationality} onChange={set("nationality")} />
            <DxInput label="Personal email" type="email" value={form.personal_email} onChange={set("personal_email")} />
            <DxInput label="Personal phone" value={form.personal_phone} onChange={set("personal_phone")} />
            <DxInput label="Address line 1" value={form.address_line_1} onChange={set("address_line_1")} />
            <DxInput label="Address line 2" value={form.address_line_2} onChange={set("address_line_2")} />
            <DxInput label="City" value={form.city} onChange={set("city")} />
            <DxInput label="State / region" value={form.state_region} onChange={set("state_region")} />
            <DxInput label="Country" value={form.country} onChange={set("country")} />
          </div>
          <div className="grid gap-3 rounded-md bg-[var(--dx-surface-sunken)] p-4 sm:grid-cols-2">
            <DxInput label="Next of kin — name" value={form.next_of_kin_name} onChange={set("next_of_kin_name")} />
            <DxInput label="Next of kin — relationship" value={form.next_of_kin_relationship} onChange={set("next_of_kin_relationship")} />
            <DxInput label="Next of kin — phone" value={form.next_of_kin_phone} onChange={set("next_of_kin_phone")} />
            <DxInput label="Emergency contact — name" value={form.emergency_contact_name} onChange={set("emergency_contact_name")} />
            <DxInput label="Emergency contact — phone" value={form.emergency_contact_phone} onChange={set("emergency_contact_phone")} />
          </div>
        </div>

        {/* ── Compensation (read-only — managed in Payroll → Salary Mapping) ── */}
        <div className="space-y-3 rounded-md bg-[var(--dx-surface-sunken)] p-4">
          <SectionTitle icon={Wallet}>Compensation</SectionTitle>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-[13px]">
            <span className="text-[var(--dx-text-muted)]">
              Base <span className="font-bold text-[var(--dx-text)]">{record.base_salary_amount ? `${record.salary_currency} ${money.format(Number(record.base_salary_amount))}` : "Not mapped"}</span>
            </span>
            {(record.allowances?.length ?? 0) > 0 ? <span className="text-[var(--dx-text-muted)]">{record.allowances!.length} allowance{record.allowances!.length === 1 ? "" : "s"}</span> : null}
            {(record.deductions?.length ?? 0) > 0 ? <span className="text-[var(--dx-text-muted)]">{record.deductions!.length} deduction{record.deductions!.length === 1 ? "" : "s"}</span> : null}
            {record.salary_effective_from ? <span className="text-[var(--dx-text-muted)]">since {record.salary_effective_from}</span> : null}
          </div>
          <p className="text-[11px] text-[var(--dx-text-muted)]">
            Pay structure (base, grade/step, allowances, deductions, annual rent for tax relief) is managed in one place — Payroll → Salary Mapping — so the same figures can't diverge between two editors.
          </p>
          <DxButton size="sm" onClick={() => { window.location.href = "/payroll/salary"; }}>Open Salary Mapping</DxButton>
        </div>

        {/* ── Bank & statutory ── */}
        <div className="space-y-3">
          <SectionTitle icon={Landmark}>Bank &amp; statutory</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            <DxInput label="Bank name" value={form.bank_name} onChange={set("bank_name")} />
            <DxInput label="Account number" value={form.bank_account_no} onChange={set("bank_account_no")} />
            <DxInput label="Account name" value={form.bank_account_name} onChange={set("bank_account_name")} />
            <DxInput label="Tax ID (TIN)" value={form.tax_id} onChange={set("tax_id")} />
            <DxInput label="Pension PIN" value={form.pension_pin} onChange={set("pension_pin")} />
            <DxSelect label="Pension provider (PFA)" value={form.pension_provider_id} onChange={set("pension_provider_id")} placeholder="Select PFA…"
              options={pensionProviders.filter((pv) => pv.is_active || String(pv.id) === form.pension_provider_id).map((pv) => ({ value: String(pv.id), label: pv.name }))}
              hint="Drives the per-PFA pension remittance schedule." />
            <DxInput label="NHF number" value={form.nhf_no} onChange={set("nhf_no")} />
          </div>
        </div>
      </div>
    </DxPopup>
  );
}

// =====================================================================
// Page
// =====================================================================

export function StaffRecordsPage() {
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<StaffRecord | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["hr", "staff-records"],
    queryFn: () => listStaffRecords(),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.staff_name, r.staff_no, r.email, r.job_title, r.department_name]
        .some((v) => (v || "").toLowerCase().includes(q)),
    );
  }, [rows, search]);

  const active = rows.filter((r) => r.employment_status === "ACTIVE").length;
  const mapped = rows.filter((r) => r.has_salary).length;

  const columns: DxGridColumn<StaffRecord>[] = [
    {
      key: "staff", header: "Staff", render: (r) => (
        <div>
          <div className="text-[13px] font-semibold text-[var(--dx-text)]">{r.staff_name || `Staff #${r.staff_profile_id}`}</div>
          <div className="text-[11px] text-[var(--dx-text-muted)]">{r.staff_no}{r.job_title ? ` · ${r.job_title}` : ""}</div>
        </div>
      ),
    },
    { key: "department", header: "Department", render: (r) => <span className="text-[13px] text-[var(--dx-text-muted)]">{r.department_name || "—"}</span> },
    {
      key: "employment", header: "Employment", render: (r) => (
        <div className="flex flex-col items-start gap-1">
          <DxBadge tone={statusTone(r.employment_status)}>{labelize(r.employment_status)}</DxBadge>
          <span className="text-[11px] text-[var(--dx-text-muted)]">{labelize(r.employment_type)}</span>
        </div>
      ),
    },
    {
      key: "base_salary", header: "Base salary", align: "right", render: (r) =>
        r.base_salary_amount ? (
          <div>
            <div className="dx-mono text-[13px] font-semibold text-[var(--dx-text)]">{r.salary_currency} {money.format(Number(r.base_salary_amount))}</div>
            <div className="text-[11px] text-[var(--dx-text-muted)]">
              {r.salary_grade ? `${r.salary_grade}${r.salary_step ? ` / ${r.salary_step}` : ""}` : "No grade"}
              {(r.allowances?.length || r.deductions?.length) ? (
                <span className="ml-1 text-[var(--dx-text-faint)]">
                  · {r.allowances?.length ? `+${r.allowances.length} allow` : ""}
                  {r.allowances?.length && r.deductions?.length ? ", " : ""}
                  {r.deductions?.length ? `−${r.deductions.length} deduct` : ""}
                </span>
              ) : null}
            </div>
          </div>
        ) : (
          <DxBadge tone="warning">Not set</DxBadge>
        ),
    },
    {
      key: "bank", header: "Bank", render: (r) =>
        r.bank_name ? (
          <div>
            <div className="text-[13px] font-semibold text-[var(--dx-text)]">{r.bank_name}</div>
            <div className="text-[11px] text-[var(--dx-text-muted)]">{r.bank_account_no || "—"}</div>
          </div>
        ) : <span className="text-[var(--dx-text-muted)]">—</span>,
    },
    {
      key: "action", header: "", align: "right",
      render: (r) => <DxButton size="sm" variant="text" leftIcon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditing(r)}>Edit</DxButton>,
    },
  ];

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "HR & Payroll" }, { label: "Staff Records" }]}
        title="Staff Records"
        subtitle="The HR directory — review every staff member and update their employment, compensation and banking details."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <DxKpi label="Staff" value={String(rows.length)} icon={Users} tone="accent" isLoading={isLoading} />
        <DxKpi label="Active" value={String(active)} icon={CheckCircle2} tone="success" isLoading={isLoading} />
        <DxKpi label="Salary on record" value={String(mapped)} icon={Banknote} tone="warning" isLoading={isLoading} />
      </div>

      <DxPanel>
        <div className="mb-4 max-w-sm">
          <DxInput placeholder="Search by name, staff no, email, title or department…" leftIcon={<Search className="h-3.5 w-3.5" />} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {isLoading ? (
          <div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="dx-skeleton h-14 w-full" />)}</div>
        ) : (
          <DxGrid<StaffRecord>
            columns={columns}
            data={filtered}
            rowKey={(r) => r.staff_profile_id}
            empty={{ icon: ShieldCheck, title: "No staff found", description: "Onboard staff members first — they will appear here for HR updates." }}
          />
        )}
      </DxPanel>

      <EditStaffModal record={editing} onClose={() => setEditing(null)} />
    </DxPage>
  );
}
