import { apiClient } from "@/lib/api/api-client";
import type { PaginatedResponse } from "@/features/visits/api/visits.api";

// ---------- Types ----------

export type Ambulance = {
  id: number;
  code: string;
  plate_number: string;
  model: string;
  manufacturer: string;
  year_of_manufacture: number;
  color: string;
  status: "AVAILABLE" | "ON_MISSION" | "MAINTENANCE" | "OUT_OF_SERVICE";
  current_mileage: number;
  notes?: string;
  created_at: string;
  updated_at: string;
};

export type AmbulanceDriver = {
  id: number;
  staff_profile_id: number;
  ambulance_id: number;
  driver_license_no: string;
  license_expiry_date: string;
  is_primary_driver: boolean;
  emergency_response_certified: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
};

export type AmbulanceEquipment = {
  id: number;
  ambulance_id: number;
  equipment_name: string;
  equipment_code: string;
  quantity: number;
  condition_status: string;
  expiry_date?: string;
  notes?: string;
  created_at: string;
};

export type AmbulanceMaintenance = {
  id: number;
  ambulance_id: number;
  maintenance_status: string;
  maintenance_type: string;
  issue_description: string;
  service_provider: string;
  maintenance_date: string;
  completed_date?: string;
  cost: number;
  mileage_at_service: number;
};

// ---------- Payloads ----------

export type CreateAmbulancePayload = Omit<Ambulance, "id" | "status" | "created_at" | "updated_at">;
export type UpdateAmbulancePayload = Partial<CreateAmbulancePayload>;

export type CreateDriverPayload = Omit<AmbulanceDriver, "id" | "created_at" | "updated_at">;
export type UpdateDriverPayload = Partial<CreateDriverPayload>;

export type CreateEquipmentPayload = Omit<AmbulanceEquipment, "id" | "created_at">;
export type UpdateEquipmentPayload = Partial<CreateEquipmentPayload>;

export type CreateMaintenancePayload = Omit<AmbulanceMaintenance, "id" | "maintenance_status">;
export type UpdateMaintenancePayload = Partial<AmbulanceMaintenance>;

// ---------- Endpoints ----------

export const ambulanceApi = {
  // Core Ambulance
  list: (params: { skip?: number; limit?: number } = {}) =>
    apiClient.get<PaginatedResponse<Ambulance>>("/ambulances/", { params }).then((res) => res.data),
  
  get: (id: number) =>
    apiClient.get<Ambulance>(`/ambulances/${id}`).then((res) => res.data),
  
  create: (payload: CreateAmbulancePayload) =>
    apiClient.post<{ success: boolean; message: string; ambulance: Ambulance }>("/ambulances/", payload).then((res) => res.data),
  
  update: (id: number, payload: UpdateAmbulancePayload) =>
    apiClient.put<{ success: boolean; message: string; ambulance: Ambulance }>(`/ambulances/${id}`, payload).then((res) => res.data),
  
  updateStatus: (id: number, status: string, reason?: string) =>
    apiClient.post<{ success: boolean; message: string; ambulance: Ambulance }>(`/ambulances/${id}/status`, { new_status: status, reason }).then((res) => res.data),
  
  delete: (id: number) =>
    apiClient.delete(`/ambulances/${id}`).then((res) => res.data),
  
  getReadiness: (id: number) =>
    apiClient.get<{ success: boolean; message: string; ready: boolean; reasons?: string }>(`/ambulances/${id}/readiness`).then((res) => res.data),

  // Drivers
  listDrivers: () =>
    apiClient.get<PaginatedResponse<AmbulanceDriver>>("/ambulances/drivers/").then((res) => res.data),
  
  createDriver: (payload: CreateDriverPayload) =>
    apiClient.post<{ success: boolean; message: string; driver: AmbulanceDriver }>("/ambulances/drivers/", payload).then((res) => res.data),
  
  updateDriver: (id: number, payload: UpdateDriverPayload) =>
    apiClient.put<{ success: boolean; message: string; driver: AmbulanceDriver }>(`/ambulances/drivers/${id}`, payload).then((res) => res.data),
  
  deleteDriver: (id: number) =>
    apiClient.delete(`/ambulances/drivers/${id}`).then((res) => res.data),

  // Equipment
  listEquipment: (ambulanceId: number) =>
    apiClient.get<PaginatedResponse<AmbulanceEquipment>>(`/ambulances/${ambulanceId}/equipment`).then((res) => res.data),
  
  createEquipment: (ambulanceId: number, payload: CreateEquipmentPayload) =>
    apiClient.post<{ success: boolean; message: string; equipment: AmbulanceEquipment }>(`/ambulances/${ambulanceId}/equipment`, payload).then((res) => res.data),
  
  updateEquipment: (id: number, payload: UpdateEquipmentPayload) =>
    apiClient.put<{ success: boolean; message: string; equipment: AmbulanceEquipment }>(`/ambulances/equipment/${id}`, payload).then((res) => res.data),
  
  deleteEquipment: (id: number) =>
    apiClient.delete(`/ambulances/equipment/${id}`).then((res) => res.data),

  // Maintenance
  listMaintenance: (ambulanceId: number) =>
    apiClient.get<PaginatedResponse<AmbulanceMaintenance>>(`/ambulances/${ambulanceId}/maintenance`).then((res) => res.data),
  
  createMaintenance: (ambulanceId: number, payload: CreateMaintenancePayload) =>
    apiClient.post<{ success: boolean; message: string; maintenance: AmbulanceMaintenance }>(`/ambulances/${ambulanceId}/maintenance`, payload).then((res) => res.data),
  
  updateMaintenance: (id: number, payload: UpdateMaintenancePayload) =>
    apiClient.put<{ success: boolean; message: string; maintenance: AmbulanceMaintenance }>(`/ambulances/maintenance/${id}`, payload).then((res) => res.data),
};
