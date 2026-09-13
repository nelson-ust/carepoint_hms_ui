import { apiClient } from "@/lib/api/api-client";

// Mirrors TenantDashboardService.overview() (tenant_dashboard_routes.py → GET /dashboard/overview).
export type TenantOverviewData = {
  today: {
    date: string;
    new_patients_today: number;
    visits_today: number;
    appointments_today: number;
    revenue_today: number;
  };
  patients: { total: number; new_this_month: number };
  visits: { total_today: number; in_progress: number; completed_today: number };
  appointments: { scheduled: number; completed: number; cancelled: number; no_show: number };
  inpatient: {
    admitted: number;
    discharged_today: number;
    total_beds: number;
    occupied_beds: number;
    utilisation_pct: number;
  };
  billing: {
    billed_this_month: number;
    collected_this_month: number;
    outstanding_total: number;
    unpaid_invoice_count: number;
  };
  lab_pharmacy_backlog: {
    lab_orders_pending: number;
    prescriptions_pending: number;
    dispenses_pending: number;
  };
  inventory_alerts: { low_stock_count: number; expiring_soon_count: number };
};

export type TenantActivityEvent = {
  type: string;
  label?: string;
  patient_id?: number | null;
  amount?: number;
  method?: string | null;
  occurred_at?: string | null;
};

export type DashboardMetrics = {
  success: boolean;
  data: TenantOverviewData;
};

export async function getDashboardOverview() {
  const response = await apiClient.get<DashboardMetrics>("/dashboard/overview");
  return response.data;
}

export async function getRecentActivity(limit = 10) {
  const response = await apiClient.get<{ success: boolean; data: TenantActivityEvent[] }>(
    "/dashboard/recent-activity",
    { params: { limit } },
  );
  return response.data.data ?? [];
}
