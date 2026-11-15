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

// ============================================================
// Dispatches + extended EMS processes (crew, PCR, fuel, billing, analytics)
// ============================================================

export type DispatchStatus = "PENDING" | "ASSIGNED" | "EN_ROUTE" | "ARRIVED" | "PATIENT_PICKED" | "COMPLETED" | "CANCELLED";

export type AmbulanceDispatch = {
  id: number; dispatch_no: string; ambulance_id: number | null; driver_id: number | null;
  patient_id: number | null; visit_id: number | null; dispatch_status: DispatchStatus;
  pickup_location?: string | null; destination_location?: string | null; incident_description?: string | null;
  requested_at?: string | null; assigned_at?: string | null; departed_at?: string | null;
  arrived_at?: string | null; completed_at?: string | null;
};

export type AmbulanceCrew = { id: number; dispatch_id: number; role: string; staff_profile_id?: number | null; member_name?: string | null; notes?: string | null };
export type AmbulancePCR = {
  id?: number; dispatch_id?: number; chief_complaint?: string | null; blood_pressure?: string | null;
  pulse_rate?: number | null; temperature_celsius?: number | string | null; oxygen_saturation?: number | null;
  respiratory_rate?: number | null; interventions?: string | null; medications_given?: string | null;
  condition_on_handover?: string | null; receiving_facility?: string | null; receiving_staff?: string | null; narrative?: string | null;
};
export type FuelLog = { id: number; ambulance_id: number; logged_at?: string | null; litres: number | string; cost?: number | string | null; odometer?: number | string | null; station?: string | null; filled_by?: string | null; notes?: string | null };
export type TripCharge = { id: number; dispatch_id: number; description?: string | null; amount: number | string; status: "PENDING" | "PAID" | "WAIVED"; payer_name?: string | null; charged_at?: string | null };
export type EmsAnalytics = {
  fleet_total: number; trips_total: number; trips_completed: number; trips_active: number;
  avg_response_minutes: number; avg_transport_minutes: number; by_status: Record<string, number>;
  trip_trend: { month: string; trips: number }[]; fuel_litres: string; fuel_cost: string;
  revenue_billed: string; revenue_collected: string;
};

const extData = <T,>(p: Promise<{ data: { data: T } }>) => p.then((r) => r.data.data);

export const dispatchApi = {
  list: (params: { skip?: number; limit?: number; status?: string; active_only?: boolean } = {}) =>
    apiClient.get<PaginatedResponse<AmbulanceDispatch>>("/ambulance-dispatches/", { params }).then((r) => r.data),
  get: (id: number) => apiClient.get<AmbulanceDispatch>(`/ambulance-dispatches/${id}`).then((r) => r.data),
  create: (payload: Record<string, unknown>) =>
    apiClient.post<{ dispatch: AmbulanceDispatch }>("/ambulance-dispatches/", payload).then((r) => r.data.dispatch),
  transition: (id: number, action: "assign" | "depart" | "arrive" | "patient-picked" | "complete" | "cancel", payload: Record<string, unknown> = {}) =>
    apiClient.post<{ dispatch: AmbulanceDispatch }>(`/ambulance-dispatches/${id}/${action}`, payload).then((r) => r.data.dispatch),

  // crew
  listCrew: (dispatchId: number) => apiClient.get<PaginatedResponse<AmbulanceCrew>>(`/ambulance-ext/dispatches/${dispatchId}/crew`).then((r) => r.data),
  addCrew: (dispatchId: number, payload: Record<string, unknown>) => extData<AmbulanceCrew>(apiClient.post(`/ambulance-ext/dispatches/${dispatchId}/crew`, payload)),
  removeCrew: (crewId: number) => apiClient.delete(`/ambulance-ext/crew/${crewId}`).then((r) => r.data),

  // PCR
  getPcr: (dispatchId: number) => extData<AmbulancePCR>(apiClient.get(`/ambulance-ext/dispatches/${dispatchId}/pcr`)),
  savePcr: (dispatchId: number, payload: Record<string, unknown>) => extData<AmbulancePCR>(apiClient.put(`/ambulance-ext/dispatches/${dispatchId}/pcr`, payload)),

  // charges
  listCharges: (dispatchId: number) => apiClient.get<PaginatedResponse<TripCharge>>(`/ambulance-ext/dispatches/${dispatchId}/charges`).then((r) => r.data),
  addCharge: (dispatchId: number, payload: Record<string, unknown>) => extData<TripCharge>(apiClient.post(`/ambulance-ext/dispatches/${dispatchId}/charges`, payload)),
  setChargeStatus: (chargeId: number, chargeStatus: "PAID" | "WAIVED") => extData<TripCharge>(apiClient.post(`/ambulance-ext/trip-charges/${chargeId}/status`, { status: chargeStatus })),

  // analytics
  analytics: (months = 6) => extData<EmsAnalytics>(apiClient.get("/ambulance-ext/analytics", { params: { months } })),
};

export const fuelApi = {
  list: (ambulanceId: number) => apiClient.get<PaginatedResponse<FuelLog>>(`/ambulance-ext/ambulances/${ambulanceId}/fuel`).then((r) => r.data),
  add: (ambulanceId: number, payload: Record<string, unknown>) => extData<FuelLog>(apiClient.post(`/ambulance-ext/ambulances/${ambulanceId}/fuel`, payload)),
};
