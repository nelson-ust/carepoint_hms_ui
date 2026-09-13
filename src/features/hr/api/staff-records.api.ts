import { apiClient } from "@/lib/api/api-client";

// =====================================================================
// HR Staff Records (hr_routes.py — /hr/staff-records)
// The HR directory: one row per staff member with employment, banking
// and compensation fields that an HR administrator can update.
// =====================================================================

export type EmploymentType =
  | "PERMANENT" | "CONTRACT" | "LOCUM" | "CONSULTANT" | "INTERN" | "VOLUNTEER";

export type EmploymentStatus =
  | "ACTIVE" | "ON_LEAVE" | "PROBATION" | "SUSPENDED"
  | "RESIGNED" | "TERMINATED" | "RETIRED" | "TRANSFERRED";

export const EMPLOYMENT_TYPES: EmploymentType[] = [
  "PERMANENT", "CONTRACT", "LOCUM", "CONSULTANT", "INTERN", "VOLUNTEER",
];

export const EMPLOYMENT_STATUSES: EmploymentStatus[] = [
  "ACTIVE", "ON_LEAVE", "PROBATION", "SUSPENDED",
  "RESIGNED", "TERMINATED", "RETIRED", "TRANSFERRED",
];

/** One earning or deduction line in the salary structure. */
export type PayComponent = {
  type_code?: string | null;
  label?: string | null;
  amount: number;
};

export type StaffRecord = {
  staff_profile_id: number;
  user_id?: number | null;
  staff_no: string;
  staff_name?: string | null;
  email?: string | null;
  job_title?: string | null;
  designation?: string | null;
  specialty?: string | null;
  department_id?: number | null;
  department_name?: string | null;
  employment_type?: EmploymentType | null;
  employment_status?: EmploymentStatus | null;
  hire_date?: string | null;
  confirmation_date?: string | null;
  probation_end_date?: string | null;
  contract_start_date?: string | null;
  contract_end_date?: string | null;
  exit_date?: string | null;
  exit_reason?: string | null;
  supervisor_staff_id?: number | null;
  date_of_birth?: string | null;
  gender?: string | null;
  marital_status?: string | null;
  nationality?: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  state_region?: string | null;
  country?: string | null;
  personal_email?: string | null;
  personal_phone?: string | null;
  next_of_kin_name?: string | null;
  next_of_kin_relationship?: string | null;
  next_of_kin_phone?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  has_salary: boolean;
  salary_grade_id?: number | null;
  salary_step_id?: number | null;
  salary_grade?: string | null;
  salary_step?: string | null;
  /** Decimal serialized as string by the API. */
  base_salary_amount?: string | null;
  salary_currency: string;
  salary_effective_from?: string | null;
  allowances?: PayComponent[] | null;
  deductions?: PayComponent[] | null;
  bank_name?: string | null;
  bank_account_no?: string | null;
  bank_account_name?: string | null;
  tax_id?: string | null;
  pension_pin?: string | null;
  pension_provider_id?: number | null;
  pension_provider_name?: string | null;
  nhf_no?: string | null;
};

/** Only send the fields that actually changed — a base_salary_amount in the
 *  payload creates a NEW versioned salary record on the backend. */
export type StaffRecordUpdate = Partial<{
  job_title: string;
  designation: string;
  specialty: string;
  department_id: number;
  employment_type: EmploymentType;
  employment_status: EmploymentStatus;
  hire_date: string;
  confirmation_date: string;
  probation_end_date: string;
  contract_start_date: string;
  contract_end_date: string;
  exit_date: string;
  exit_reason: string;
  supervisor_staff_id: number;
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
  pension_provider_id: number;
  nhf_no: string;
  base_salary_amount: string;
  salary_currency: string;
  salary_grade_id: number;
  salary_step_id: number;
  salary_effective_from: string;
  allowances: PayComponent[];
  deductions: PayComponent[];
}>;

export async function listStaffRecords(search?: string): Promise<StaffRecord[]> {
  const response = await apiClient.get<unknown>("/hr/staff-records", {
    params: search ? { search } : {},
  });
  const data = response.data;
  if (Array.isArray(data)) return data as StaffRecord[];
  const items = (data as { items?: unknown })?.items;
  return Array.isArray(items) ? (items as StaffRecord[]) : [];
}

export async function updateStaffRecord(
  staffProfileId: number,
  payload: StaffRecordUpdate,
): Promise<Record<string, unknown>> {
  const response = await apiClient.patch(`/hr/staff-records/${staffProfileId}`, payload);
  return response.data as Record<string, unknown>;
}
