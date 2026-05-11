import { apiClient } from "@/lib/api/api-client";
import type { PaginatedResponse } from "@/features/visits/api/visits.api";

export type LabTest = {
  id: number;
  code: string;
  name: string;
  sample_type?: string;
  unit_of_measure?: string;
  reference_range?: string;
  default_price?: number;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CreateLabTestPayload = {
  code: string;
  name: string;
  sample_type?: string;
  unit_of_measure?: string;
  reference_range?: string;
  default_price?: number;
  description?: string;
};

export type UpdateLabTestPayload = {
  name?: string;
  sample_type?: string;
  unit_of_measure?: string;
  reference_range?: string;
  default_price?: number;
  description?: string;
};

export type LabTestActionResponse = {
  success: boolean;
  message: string;
  lab_test: LabTest;
};

// Common sample types used by labs (free-text on the backend; this is just a
// suggestion list for the UI selector).
export const SAMPLE_TYPES = [
  "Blood (Whole)",
  "Blood (Serum)",
  "Blood (Plasma)",
  "Urine",
  "Stool",
  "Sputum",
  "Swab",
  "CSF",
  "Tissue",
  "Other",
] as const;

// ---------- Endpoints ----------

export async function listLabTests(
  params: { skip?: number; limit?: number } = {},
): Promise<PaginatedResponse<LabTest>> {
  const { skip = 0, limit = 200 } = params;
  const response = await apiClient.get<PaginatedResponse<LabTest>>("/lab/tests/", {
    params: { skip, limit },
  });
  return response.data;
}

export async function getLabTest(testId: number): Promise<LabTest> {
  const response = await apiClient.get<LabTest>(`/lab/tests/${testId}`);
  return response.data;
}

export async function createLabTest(
  payload: CreateLabTestPayload,
): Promise<LabTestActionResponse> {
  const response = await apiClient.post<LabTestActionResponse>("/lab/tests/", payload);
  return response.data;
}

export async function updateLabTest(
  testId: number,
  payload: UpdateLabTestPayload,
): Promise<LabTestActionResponse> {
  const response = await apiClient.put<LabTestActionResponse>(`/lab/tests/${testId}`, payload);
  return response.data;
}

export async function deleteLabTest(testId: number): Promise<{ success: boolean; message: string }> {
  const response = await apiClient.delete<{ success: boolean; message: string }>(
    `/lab/tests/${testId}`,
  );
  return response.data;
}
