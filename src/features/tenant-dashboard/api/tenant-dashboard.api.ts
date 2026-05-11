import { apiClient } from "@/lib/api/api-client";

export type DashboardMetrics = {
  success: boolean;
  data: {
    total_patients: number;
    active_visits: number;
    total_revenue: number;
    pending_appointments: number;
    recent_activities: Array<{
      id: number;
      type: string;
      detail: string;
      time: string;
      user: string;
    }>;

    visit_trends: Array<{
      date: string;
      count: number;
    }>;
  };
};

export async function getDashboardOverview() {
  const response = await apiClient.get<DashboardMetrics>("/tenant-dashboard/overview");
  return response.data;
}

export async function getClinicalStats() {
  const response = await apiClient.get<any>("/tenant-dashboard/clinical");
  return response.data;
}
