import { apiClient } from "@/lib/api/api-client";

export type Patient = {
  id: number;
  hospital_number: string;
  first_name: string;
  last_name: string;
  middle_name?: string;
  date_of_birth: string;
  gender: string;
  email?: string;
  phone_number: string;
  address?: string;
  city?: string;
  state?: string;
  patient_type: string; // INDIVIDUAL, CORPORATE, etc.
  payer_type: string; // CASH, INSURANCE, etc.
  status: string;
  created_at: string;
};

export type CreatePatientPayload = {
  first_name: string;
  last_name: string;
  middle_name?: string;
  date_of_birth: string;
  gender: string;
  marital_status?: string;
  phone_number: string;
  alternate_phone_number?: string;
  email?: string;
  address: string;
  city: string;
  state: string;
  country: string;
  blood_group?: string;
  genotype?: string;
  allergies?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relationship?: string;
  next_of_kin_name?: string;
  next_of_kin_phone?: string;
  next_of_kin_relationship?: string;
  next_of_kin_address?: string;
  patient_type: string;
  preferred_payer_id?: number;
  payer_type: string;
  national_identifier?: string;
  national_identifier_type?: string;
  identification_details?: Record<string, any>;
  hospital_number?: string;
  registration_notes?: string;
  previous_identifiers?: Array<{
    identifier_type: string;
    identifier_value: string;
    issuing_authority?: string;
    is_primary?: boolean;
    is_active?: boolean;
    note?: string;
  }>;
  insurance_enrollment?: {
    insurance_provider_id: number;
    policy_number: string;
    member_id?: string;
    plan_name?: string;
    coverage_details?: Record<string, any>;
    status?: string;
    valid_from?: string;
    valid_to?: string;
    note?: string;
  };
  loyalty_enrollment?: {
    loyalty_program_id: number;
    membership_no: string;
    points_balance?: number;
    joined_date?: string;
    note?: string;
  };
};

export type LoyaltyProgram = {
  id: number;
  name: string;
  code: string;
  description: string;
  points_per_currency_unit: string;
  minimum_redemption_points: string;
  is_auto_enroll: boolean;
};



export type PaginatedResponse<T> = {
  success: boolean;
  message: string;
  items: T[];
  count: number;
  meta: {
    total: number;
    skip: number;
    limit: number;
    current_page: number;
    total_pages: number;
  };
};

export async function getPatients(skip = 0, limit = 20) {
  const response = await apiClient.get<PaginatedResponse<Patient>>("/patients/", {
    params: { skip, limit },
  });
  return response.data;
}

export async function createPatient(
  payload: CreatePatientPayload,
  options: { forceCreateIfPossibleDuplicate?: boolean } = {},
): Promise<Patient> {
  const { forceCreateIfPossibleDuplicate = false } = options;
  const response = await apiClient.post<
    { success: boolean; data?: Patient; patient?: Patient } | Patient
  >("/patients/", payload, {
    params: { force_create_if_possible_duplicate: forceCreateIfPossibleDuplicate },
  });
  // Different backend deployments wrap the patient differently — accept all shapes.
  const data = response.data as any;
  return (data?.data ?? data?.patient ?? data) as Patient;
}

export async function searchPatients(query: string) {
  const response = await apiClient.get<PaginatedResponse<Patient>>("/patients/search", {
    params: { full_name: query },
  });
  return response.data;
}


export async function getPatientById(id: number) {
  const response = await apiClient.get<Patient>(`/patients/${id}`);
  return response.data;
}

export async function getLoyaltyPrograms() {
  const response = await apiClient.get<LoyaltyProgram[]>("/loyalty-network/programs");
  return response.data;
}
