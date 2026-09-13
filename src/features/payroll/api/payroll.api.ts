import { apiClient } from "@/lib/api/api-client";

// ---------- Types (mirrors app/api/v1/endpoints/hr_routes.py payroll section) ----------

export type PayrollRunStatus =
  | "DRAFT"
  | "CALCULATED"
  | "APPROVED"
  | "PAID"
  | "LOCKED"
  | "CANCELLED";

export type PayrollLineStatus = "PENDING" | "APPROVED" | "PAID" | "ERROR";

export type PayrollRun = {
  id: number;
  code: string;
  period_start: string;
  period_end: string;
  facility_id?: number | null;
  department_id?: number | null;
  account_id?: number | null;
  account_code?: string | null;
  account_name?: string | null;
  status: PayrollRunStatus;
  total_gross: number;
  total_deductions: number;
  total_net: number;
  calculated_at?: string | null;
  approved_at?: string | null;
  approved_by_user_id?: number | null;
  paid_at?: string | null;
  locked_at?: string | null;
  note?: string | null;
  approval_request_id?: number | null;
  created_at?: string;
  updated_at?: string;
};

export type PayrollLine = {
  id: number;
  payroll_run_id: number;
  staff_profile_id: number;
  timesheet_id?: number | null;
  base_salary: number;
  total_allowances: number;
  overtime_amount: number;
  bonus_amount: number;
  gross_pay: number;
  paye_amount: number;
  pension_amount: number;
  nhf_amount: number;
  health_insurance_amount: number;
  loan_repayment_amount: number;
  other_deductions: number;
  total_deductions: number;
  net_pay: number;
  status: PayrollLineStatus;
  paid_at?: string | null;
  note?: string | null;
  breakdown_json?: Record<string, unknown> | null;
};

/** Salary-advance amount recovered on this line (from the calculation breakdown). */
export function lineAdvanceRecovery(line: PayrollLine): number {
  const raw = line.breakdown_json?.["advance_recovery"];
  const n = typeof raw === "string" || typeof raw === "number" ? Number(raw) : 0;
  return Number.isFinite(n) ? n : 0;
}

/** Staff-loan repayment on this line, excluding salary-advance recovery. */
export function lineLoanRepayment(line: PayrollLine): number {
  const raw = line.breakdown_json?.["loan_repayment"];
  if (raw !== undefined && raw !== null) {
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return Math.max(0, line.loan_repayment_amount - lineAdvanceRecovery(line));
}

export type CreatePayrollRunPayload = {
  code: string;
  period_start: string;
  period_end: string;
  facility_id?: number;
  department_id?: number;
  account_id: number;
};

// ---------- Payroll configuration (hr_payroll_routes.py /hr/payroll-config) ----------

export type AllowanceType = {
  id: number;
  code: string;
  name: string;
  is_taxable: boolean;
  default_amount?: number | null;
  default_percent_of_base?: number | null;
  description?: string | null;
  is_active: boolean;
};

export type DeductionType = {
  id: number;
  code: string;
  name: string;
  is_statutory: boolean;
  default_amount?: number | null;
  default_percent_of_base?: number | null;
  description?: string | null;
  is_active: boolean;
};

export type StatutoryDeductionConfig = {
  id: number;
  code: string;
  name: string;
  rate_percent?: number | null;
  employer_rate_percent?: number | null;
  effective_from: string;
  effective_to?: string | null;
  note?: string | null;
};

export type PayrollConfig = {
  allowanceTypes: AllowanceType[];
  deductionTypes: DeductionType[];
  statutoryConfigs: StatutoryDeductionConfig[];
};

// ---------- Normalization helpers ----------

/** The backend serializes Decimal columns as strings — coerce to numbers. */
function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  return toNumber(value);
}

/** Accept a bare array or the `{ items: [...] }` envelope. */
function asArray<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  const items = (data as { items?: unknown })?.items;
  if (Array.isArray(items)) return items as T[];
  return [];
}

function normalizeRun(raw: Record<string, unknown>): PayrollRun {
  return {
    ...(raw as unknown as PayrollRun),
    total_gross: toNumber(raw.total_gross),
    total_deductions: toNumber(raw.total_deductions),
    total_net: toNumber(raw.total_net),
  };
}

function normalizeLine(raw: Record<string, unknown>): PayrollLine {
  return {
    ...(raw as unknown as PayrollLine),
    base_salary: toNumber(raw.base_salary),
    total_allowances: toNumber(raw.total_allowances),
    overtime_amount: toNumber(raw.overtime_amount),
    bonus_amount: toNumber(raw.bonus_amount),
    gross_pay: toNumber(raw.gross_pay),
    paye_amount: toNumber(raw.paye_amount),
    pension_amount: toNumber(raw.pension_amount),
    nhf_amount: toNumber(raw.nhf_amount),
    health_insurance_amount: toNumber(raw.health_insurance_amount),
    loan_repayment_amount: toNumber(raw.loan_repayment_amount),
    other_deductions: toNumber(raw.other_deductions),
    total_deductions: toNumber(raw.total_deductions),
    net_pay: toNumber(raw.net_pay),
  };
}

// ---------- Pension providers (PFAs) ----------

export type PensionProvider = {
  id: number;
  code: string;
  name: string;
  pfa_license_no?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  address?: string | null;
  bank_name?: string | null;
  bank_account_no?: string | null;
  is_active: boolean;
  note?: string | null;
  staff_count?: number;
};

export type PensionProviderPayload = {
  code: string;
  name: string;
  pfa_license_no?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  address?: string | null;
  bank_name?: string | null;
  bank_account_no?: string | null;
  is_active?: boolean;
  note?: string | null;
};

export async function listPensionProviders(): Promise<PensionProvider[]> {
  const response = await apiClient.get<unknown>("/hr/pension-providers");
  return asArray<PensionProvider>(response.data);
}

export async function createPensionProvider(
  payload: PensionProviderPayload,
): Promise<PensionProvider> {
  const response = await apiClient.post("/hr/pension-providers", payload);
  return response.data as PensionProvider;
}

export async function updatePensionProvider(
  providerId: number,
  payload: Partial<PensionProviderPayload>,
): Promise<PensionProvider> {
  const response = await apiClient.patch(`/hr/pension-providers/${providerId}`, payload);
  return response.data as PensionProvider;
}

// ---------- Component catalog / templates / line components ----------

export type PayrollComponentType =
  | "EARNING" | "DEDUCTION" | "STATUTORY" | "EMPLOYER_CONTRIBUTION";

export type PayrollCalcMethod =
  | "FIXED_AMOUNT" | "PERCENT_OF_BASE" | "PERCENT_OF_GROSS";

export type PayrollComponent = {
  id: number;
  code: string;
  name: string;
  component_type: PayrollComponentType;
  calc_method: PayrollCalcMethod;
  default_amount?: string | null;
  default_percent?: string | null;
  is_taxable: boolean;
  is_tax_relief: boolean;
  is_statutory: boolean;
  is_active: boolean;
  gl_account_id?: number | null;
  display_order: number;
  description?: string | null;
};

export type PayrollComponentPayload = {
  code: string;
  name: string;
  component_type: PayrollComponentType;
  calc_method?: PayrollCalcMethod;
  default_amount?: string | null;
  default_percent?: string | null;
  is_taxable?: boolean;
  is_tax_relief?: boolean;
  is_active?: boolean;
  gl_account_id?: number | null;
  display_order?: number;
  description?: string | null;
};

export type ComponentTemplateItem = {
  id: number;
  component_id: number;
  code?: string | null;
  name?: string | null;
  component_type?: PayrollComponentType | null;
  amount?: string | null;
  percent?: string | null;
  display_order: number;
};

export type PayrollComponentTemplate = {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  is_active: boolean;
  items: ComponentTemplateItem[];
};

export type TemplateItemPayload = {
  component_id: number;
  amount?: string | null;
  percent?: string | null;
};

export type PayrollLineComponent = {
  id: number;
  payroll_line_id: number;
  component_id?: number | null;
  code: string;
  name: string;
  component_type: PayrollComponentType;
  amount: string;
  is_taxable: boolean;
  sequence: number;
  meta_json?: Record<string, unknown> | null;
};

export async function listPayrollComponents(): Promise<PayrollComponent[]> {
  const response = await apiClient.get<unknown>("/hr/payroll/components");
  return asArray<PayrollComponent>(response.data);
}

export async function createPayrollComponent(
  payload: PayrollComponentPayload,
): Promise<PayrollComponent> {
  const response = await apiClient.post("/hr/payroll/components", payload);
  return response.data as PayrollComponent;
}

export async function updatePayrollComponent(
  componentId: number,
  payload: Partial<PayrollComponentPayload>,
): Promise<PayrollComponent> {
  const response = await apiClient.patch(`/hr/payroll/components/${componentId}`, payload);
  return response.data as PayrollComponent;
}

export async function listComponentTemplates(): Promise<PayrollComponentTemplate[]> {
  const response = await apiClient.get<unknown>("/hr/payroll/component-templates");
  return asArray<PayrollComponentTemplate>(response.data);
}

export async function createComponentTemplate(payload: {
  code: string;
  name: string;
  description?: string | null;
}): Promise<PayrollComponentTemplate> {
  const response = await apiClient.post("/hr/payroll/component-templates", payload);
  return response.data as PayrollComponentTemplate;
}

export async function updateComponentTemplate(
  templateId: number,
  payload: { name?: string; description?: string | null; is_active?: boolean },
): Promise<PayrollComponentTemplate> {
  const response = await apiClient.patch(
    `/hr/payroll/component-templates/${templateId}`, payload,
  );
  return response.data as PayrollComponentTemplate;
}

export async function replaceTemplateItems(
  templateId: number,
  items: TemplateItemPayload[],
): Promise<PayrollComponentTemplate> {
  const response = await apiClient.put(
    `/hr/payroll/component-templates/${templateId}/items`, { items },
  );
  return response.data as PayrollComponentTemplate;
}

export async function applyComponentTemplate(
  templateId: number,
  payload: { staff_profile_ids: number[]; effective_from?: string },
): Promise<{
  template_id: number;
  applied: { staff_profile_id: number; staff_salary_id: number }[];
  skipped: { staff_profile_id: number; reason: string }[];
}> {
  const response = await apiClient.post(
    `/hr/payroll/component-templates/${templateId}/apply`, payload,
  );
  return response.data as any;
}

export async function listLineComponents(lineId: number): Promise<PayrollLineComponent[]> {
  const response = await apiClient.get<unknown>(`/hr/payroll/lines/${lineId}/components`);
  return asArray<PayrollLineComponent>(response.data);
}

// ---------- Payroll runs ----------

export async function listPayrollRuns(
  params: { run_status?: PayrollRunStatus } = {},
): Promise<PayrollRun[]> {
  const response = await apiClient.get<unknown>("/hr/payroll/runs", { params });
  return asArray<Record<string, unknown>>(response.data).map(normalizeRun);
}

export async function listPayrollLines(runId: number): Promise<PayrollLine[]> {
  const response = await apiClient.get<unknown>(`/hr/payroll/runs/${runId}/lines`);
  return asArray<Record<string, unknown>>(response.data).map(normalizeLine);
}

export async function createPayrollRun(payload: CreatePayrollRunPayload): Promise<PayrollRun> {
  const response = await apiClient.post<Record<string, unknown>>("/hr/payroll/runs", payload);
  return normalizeRun(response.data ?? {});
}

/** Calculate payroll lines for a DRAFT run (moves it to CALCULATED). */
export async function calculatePayrollRun(runId: number): Promise<PayrollRun> {
  const response = await apiClient.post<Record<string, unknown>>(
    `/hr/payroll/runs/${runId}/calculate`,
  );
  return normalizeRun(response.data ?? {});
}

/** Submit a CALCULATED run into the approval engine (creates an ApprovalRequest). */
export async function submitPayrollForApproval(runId: number): Promise<PayrollRun> {
  const response = await apiClient.post<Record<string, unknown>>(
    `/hr/payroll/runs/${runId}/submit-approval`,
  );
  return normalizeRun(response.data ?? {});
}

/** Lock an APPROVED run and its timesheets (post-payment). */
export async function lockPayrollRun(runId: number): Promise<PayrollRun> {
  const response = await apiClient.post<Record<string, unknown>>(`/hr/payroll/runs/${runId}/lock`);
  return normalizeRun(response.data ?? {});
}

// ---------- Payroll configuration reads ----------

function normalizeAllowanceType(raw: Record<string, unknown>): AllowanceType {
  return {
    ...(raw as unknown as AllowanceType),
    default_amount: toNullableNumber(raw.default_amount),
    default_percent_of_base: toNullableNumber(raw.default_percent_of_base),
  };
}

function normalizeDeductionType(raw: Record<string, unknown>): DeductionType {
  return {
    ...(raw as unknown as DeductionType),
    default_amount: toNullableNumber(raw.default_amount),
    default_percent_of_base: toNullableNumber(raw.default_percent_of_base),
  };
}

function normalizeStatutoryConfig(raw: Record<string, unknown>): StatutoryDeductionConfig {
  return {
    ...(raw as unknown as StatutoryDeductionConfig),
    rate_percent: toNullableNumber(raw.rate_percent),
    employer_rate_percent: toNullableNumber(raw.employer_rate_percent),
  };
}

export async function listAllowanceTypes(): Promise<AllowanceType[]> {
  const response = await apiClient.get<unknown>("/hr/payroll-config/allowance-types");
  return asArray<Record<string, unknown>>(response.data).map(normalizeAllowanceType);
}

export async function listDeductionTypes(): Promise<DeductionType[]> {
  const response = await apiClient.get<unknown>("/hr/payroll-config/deduction-types");
  return asArray<Record<string, unknown>>(response.data).map(normalizeDeductionType);
}

export async function listStatutoryConfigs(): Promise<StatutoryDeductionConfig[]> {
  const response = await apiClient.get<unknown>("/hr/payroll-config/statutory-configs");
  return asArray<Record<string, unknown>>(response.data).map(normalizeStatutoryConfig);
}

/** Read the whole payroll configuration in one call for settings panels. */
export async function getPayrollConfig(): Promise<PayrollConfig> {
  const [allowanceTypes, deductionTypes, statutoryConfigs] = await Promise.all([
    listAllowanceTypes(),
    listDeductionTypes(),
    listStatutoryConfigs(),
  ]);
  return { allowanceTypes, deductionTypes, statutoryConfigs };
}

// ====================================================================
// Salary grades & steps (lookups) — /hr/payroll-config
// ====================================================================

export type SalaryGrade = {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  is_active: boolean;
};

export type SalaryStep = {
  id: number;
  grade_id: number;
  code: string;
  base_amount: number;
  currency: string;
  is_active: boolean;
};

export type CreateSalaryGradePayload = {
  code: string;
  name: string;
  description?: string;
  is_active?: boolean;
};

export type CreateSalaryStepPayload = {
  grade_id: number;
  code: string;
  base_amount: number;
  currency?: string;
  is_active?: boolean;
};

export async function listSalaryGrades(): Promise<SalaryGrade[]> {
  const response = await apiClient.get<unknown>("/hr/payroll-config/salary-grades");
  return asArray<SalaryGrade>(response.data);
}

export async function createSalaryGrade(payload: CreateSalaryGradePayload): Promise<SalaryGrade> {
  const response = await apiClient.post<SalaryGrade>("/hr/payroll-config/salary-grades", payload);
  return response.data;
}

export async function listSalarySteps(gradeId?: number): Promise<SalaryStep[]> {
  const response = await apiClient.get<unknown>("/hr/payroll-config/salary-steps", {
    params: gradeId ? { grade_id: gradeId } : {},
  });
  return asArray<Record<string, unknown>>(response.data).map((r) => ({
    ...(r as unknown as SalaryStep),
    base_amount: toNumber(r.base_amount),
  }));
}

export async function createSalaryStep(payload: CreateSalaryStepPayload): Promise<SalaryStep> {
  const response = await apiClient.post<SalaryStep>("/hr/payroll-config/salary-steps", payload);
  return response.data;
}

// ---------- Lookup creators (allowance / deduction / statutory) ----------

export type CreateAllowanceTypePayload = {
  code: string;
  name: string;
  is_taxable?: boolean;
  default_amount?: number | null;
  default_percent_of_base?: number | null;
  description?: string;
  is_active?: boolean;
};

export type CreateDeductionTypePayload = {
  code: string;
  name: string;
  is_statutory?: boolean;
  default_amount?: number | null;
  default_percent_of_base?: number | null;
  description?: string;
  is_active?: boolean;
};

export type CreateStatutoryConfigPayload = {
  code: string;
  name: string;
  rate_percent?: number | null;
  employer_rate_percent?: number | null;
  effective_from: string;
  effective_to?: string | null;
  note?: string;
};

export async function createAllowanceType(payload: CreateAllowanceTypePayload): Promise<AllowanceType> {
  const response = await apiClient.post<AllowanceType>("/hr/payroll-config/allowance-types", payload);
  return response.data;
}

export async function createDeductionType(payload: CreateDeductionTypePayload): Promise<DeductionType> {
  const response = await apiClient.post<DeductionType>("/hr/payroll-config/deduction-types", payload);
  return response.data;
}

export async function createStatutoryConfig(
  payload: CreateStatutoryConfigPayload,
): Promise<StatutoryDeductionConfig> {
  const response = await apiClient.post<StatutoryDeductionConfig>(
    "/hr/payroll-config/statutory-configs",
    payload,
  );
  return response.data;
}

// ====================================================================
// Staff salary mapping — /hr/payroll/salary
// ====================================================================

export type PayComponent = { type_code?: string; label?: string; amount: number };

export type StaffSalaryRow = {
  staff_profile_id: number;
  staff_no?: string | null;
  staff_name?: string | null;
  job_title?: string | null;
  department_id?: number | null;
  has_salary: boolean;
  salary_id?: number | null;
  grade_id?: number | null;
  step_id?: number | null;
  base_amount: number;
  currency: string;
  allowances: PayComponent[];
  deductions: PayComponent[];
  effective_from?: string | null;
  annual_rent?: number | string | null;
};

export type SetStaffSalaryPayload = {
  staff_profile_id: number;
  base_amount: number;
  grade_id?: number | null;
  step_id?: number | null;
  currency?: string;
  allowances?: PayComponent[];
  deductions?: PayComponent[];
  effective_from: string;
  annual_rent?: number | null;
  effective_to?: string | null;
};

export async function listStaffSalaries(): Promise<StaffSalaryRow[]> {
  const response = await apiClient.get<unknown>("/hr/payroll/salary");
  return asArray<Record<string, unknown>>(response.data).map((r) => ({
    ...(r as unknown as StaffSalaryRow),
    base_amount: toNumber(r.base_amount),
    allowances: Array.isArray(r.allowances) ? (r.allowances as PayComponent[]) : [],
    deductions: Array.isArray(r.deductions) ? (r.deductions as PayComponent[]) : [],
  }));
}

export async function setStaffSalary(payload: SetStaffSalaryPayload): Promise<unknown> {
  const response = await apiClient.post("/hr/payroll/salary", payload);
  return response.data;
}

// ---------- Run: mark paid ----------

export async function payPayrollRun(runId: number): Promise<PayrollRun> {
  const response = await apiClient.post<Record<string, unknown>>(`/hr/payroll/runs/${runId}/pay`);
  return normalizeRun(response.data ?? {});
}

// ---------- One-off earnings / deductions ----------

export type PayrollOneOff = {
  id: number;
  staff_profile_id: number;
  staff_no?: string;
  kind: "BONUS" | "ARREARS" | "THIRTEENTH_MONTH" | "OTHER_EARNING" | "OTHER_DEDUCTION";
  amount: string;
  is_taxable: boolean;
  note?: string | null;
};

export async function listOneOffs(runId: number): Promise<PayrollOneOff[]> {
  const response = await apiClient.get<{ items?: PayrollOneOff[] }>(`/hr/payroll/runs/${runId}/one-offs`);
  return response.data?.items ?? [];
}

export async function addOneOff(runId: number, payload: {
  staff_profile_id: number; kind: string; amount: number; is_taxable?: boolean; note?: string;
}): Promise<void> {
  await apiClient.post(`/hr/payroll/runs/${runId}/one-offs`, payload);
}

export async function deleteOneOff(oneOffId: number): Promise<void> {
  await apiClient.delete(`/hr/payroll/one-offs/${oneOffId}`);
}

// ---------- Documents: payslip + remittance schedules ----------

async function downloadBlob(url: string, filename: string): Promise<void> {
  const response = await apiClient.get(url, { responseType: "blob" });
  const objectUrl = URL.createObjectURL(response.data as Blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
}

export const payrollExports = {
  bankSchedule: (runId: number, code: string) =>
    downloadBlob(`/hr/payroll/runs/${runId}/exports/bank-schedule`, `bank-schedule-${code}.csv`),
  paye: (runId: number, code: string) =>
    downloadBlob(`/hr/payroll/runs/${runId}/exports/paye`, `paye-schedule-${code}.csv`),
  pension: (runId: number, code: string) =>
    downloadBlob(`/hr/payroll/runs/${runId}/exports/pension`, `pension-schedule-${code}.csv`),
  nhf: (runId: number, code: string) =>
    downloadBlob(`/hr/payroll/runs/${runId}/exports/nhf`, `nhf-schedule-${code}.csv`),
  nsitf: (runId: number, code: string) =>
    downloadBlob(`/hr/payroll/runs/${runId}/exports/nsitf`, `nsitf-schedule-${code}.csv`),
  payslip: async (lineId: number) => {
    const response = await apiClient.get(`/hr/payroll/lines/${lineId}/payslip`, { responseType: "blob" });
    const url = URL.createObjectURL(response.data as Blob);
    window.open(url, "_blank", "noopener");
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  },
};
