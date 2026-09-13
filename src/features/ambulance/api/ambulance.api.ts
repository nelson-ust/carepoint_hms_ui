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
  status: "AVAILABLE" | "DISPATCHED" | "IN_TRANSIT" | "OUT_OF_SERVICE" | "UNDER_MAINTENANCE";
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

export type AmbulanceFleetStats = {
  fleet_total: number;
  by_status: Record<string, number>;
  ready_count: number;
  drivers_total: number;
  maintenance_open: number;
};

export type AmbulanceReadiness = {
  ambulance_id: number;
  ready: boolean;
  reasons: string[];
  primary_driver_id: number | null;
  expired_equipment_ids: number[];
  open_maintenance_ids: number[];
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
    apiClient
      .get<{ success: boolean; message: string } & AmbulanceReadiness>(`/ambulances/${id}/readiness`)
      .then((res) => {
        // Normalize the {success, message, ...fields} envelope to a plain readiness object.
        const { success: _s, message: _m, ...readiness } = res.data;
        return { ...readiness, reasons: readiness.reasons ?? [] } as AmbulanceReadiness;
      }),

  getStats: () =>
    apiClient
      .get<{ success: boolean; message: string } & AmbulanceFleetStats>("/ambulances/stats")
      .then((res) => {
        const { success: _s, message: _m, ...stats } = res.data;
        return { ...stats, by_status: stats.by_status ?? {} } as AmbulanceFleetStats;
      }),

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
