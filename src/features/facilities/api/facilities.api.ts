import { apiClient } from "@/lib/api/api-client";

export type FacilityType =
  | "HEAD_OFFICE"
  | "MAIN_HOSPITAL"
  | "BRANCH_HOSPITAL"
  | "CLINIC"
  | "DIAGNOSTIC_CENTER"
  | "PHARMACY_OUTLET"
  | "WAREHOUSE"
  | "OTHER";

export type FacilityStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "UNDER_CONSTRUCTION"
  | "DECOMMISSIONED";

export type FacilityNetwork = {
  id: number;
  name: string;
  code: string;
  description?: string | null;
  head_office_facility_id?: number | null;
};

export type FacilityServiceArea = {
  id: number;
  facility_id: number;
  area_name: string;
  region_code?: string | null;
  notes?: string | null;
};

export type Facility = {
  id: number;
  code: string;
  name: string;
  facility_type: FacilityType;
  status: FacilityStatus;
  phone_number?: string | null;
  email?: string | null;
  website?: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postal_code?: string | null;
  timezone?: string | null;
  network_id?: number | null;
  parent_facility_id?: number | null;
  network?: FacilityNetwork | null;
  service_areas: FacilityServiceArea[];
};

export type FacilityCreatePayload = {
  code: string;
  name: string;
  facility_type: FacilityType;
  status: FacilityStatus;
  phone_number?: string | null;
  email?: string | null;
  website?: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postal_code?: string | null;
  timezone?: string | null;
  network_id?: number | null;
  parent_facility_id?: number | null;
};

// `code` is immutable; everything else is editable.
export type FacilityUpdatePayload = Partial<Omit<FacilityCreatePayload, "code">>;

// The facility endpoints return bare arrays / objects; tolerate an envelope too.
function asArray<T>(data: any): T[] {
  if (Array.isArray(data)) return data as T[];
  if (Array.isArray(data?.items)) return data.items as T[];
  if (Array.isArray(data?.data)) return data.data as T[];
  return [];
}

function unwrap<T>(data: any): T {
  if (data && typeof data === "object" && "data" in data && !("id" in data)) {
    return data.data as T;
  }
  return data as T;
}

export const facilitiesApi = {
  list: () =>
    apiClient.get<Facility[]>("/facilities").then((res) => asArray<Facility>(res.data)),

  get: (id: number) =>
    apiClient.get<Facility>(`/facilities/${id}`).then((res) => unwrap<Facility>(res.data)),

  create: (payload: FacilityCreatePayload) =>
    apiClient.post<Facility>("/facilities", payload).then((res) => unwrap<Facility>(res.data)),

  update: (id: number, payload: FacilityUpdatePayload) =>
    apiClient.put<Facility>(`/facilities/${id}`, payload).then((res) => unwrap<Facility>(res.data)),

  remove: (id: number) => apiClient.delete(`/facilities/${id}`).then((res) => res.data),

  networks: () =>
    apiClient
      .get<FacilityNetwork[]>("/facilities/networks/all")
      .then((res) => asArray<FacilityNetwork>(res.data)),
};

export const FACILITY_TYPE_OPTIONS: { value: FacilityType; label: string }[] = [
  { value: "MAIN_HOSPITAL", label: "Main hospital" },
  { value: "BRANCH_HOSPITAL", label: "Branch hospital" },
  { value: "HEAD_OFFICE", label: "Head office" },
  { value: "CLINIC", label: "Clinic" },
  { value: "DIAGNOSTIC_CENTER", label: "Diagnostic center" },
  { value: "PHARMACY_OUTLET", label: "Pharmacy outlet" },
  { value: "WAREHOUSE", label: "Warehouse" },
  { value: "OTHER", label: "Other" },
];

export const FACILITY_STATUS_OPTIONS: { value: FacilityStatus; label: string }[] = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "UNDER_CONSTRUCTION", label: "Under construction" },
  { value: "DECOMMISSIONED", label: "Decommissioned" },
];

export function facilityTypeLabel(t?: FacilityType | null): string {
  return FACILITY_TYPE_OPTIONS.find((o) => o.value === t)?.label ?? (t || "—");
}

export function facilityStatusLabel(s?: FacilityStatus | null): string {
  return FACILITY_STATUS_OPTIONS.find((o) => o.value === s)?.label ?? (s || "—");
}
