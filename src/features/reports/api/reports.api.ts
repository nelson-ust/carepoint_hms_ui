import { apiClient } from "@/lib/api/api-client";

// ====================================================================
// Types (mirror app/schemas/report_schemas.py)
// The summary endpoints return bare resources (no {success,…} envelope);
// arrays and numbers are still normalized defensively below.
// ====================================================================

export type FinancialSummary = {
  total_revenue: number;
  total_invoiced: number;
  total_paid: number;
  currency: string;
};

export type OperationalSummary = {
  total_patients: number;
  total_active_visits: number;
  total_admissions: number;
  total_staff: number;
};

export type NameCount = { name: string; count: number };

export type VisitTrendPoint = { date: string; count: number };

export type ClinicalSummary = {
  total_diagnoses: number;
  top_diagnoses: NameCount[];
  visit_trends: VisitTrendPoint[];
  mortality_rate: number;
};

export type StockMovementEntry = {
  item_id?: number;
  type?: string;
  quantity?: number;
  date?: string;
};

export type InventorySummary = {
  total_items: number;
  low_stock_items: number;
  total_stock_value: number;
  recent_stock_movements: StockMovementEntry[];
};

export type WorkforceSummary = {
  total_staff: number;
  staff_by_department: NameCount[];
  active_shifts_today: number;
  attendance_rate: number;
};

export type AggregationSummary = {
  generated_at: string;
  financial: FinancialSummary;
  clinical: ClinicalSummary;
  inventory: InventorySummary;
  workforce: WorkforceSummary;
  tenant_logo_url?: string | null;
};

export type PlatformOverview = {
  total_tenants: number;
  active_tenants: number;
  total_revenue_platform: number;
  total_api_calls: number;
  system_health_status: string;
};

// ---------- Report generation (POST /reports/generate) ----------

export const REPORT_TYPES = [
  "financial",
  "clinical",
  "inventory",
  "workforce",
  "comprehensive",
] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export const REPORT_FILE_TYPES = ["pdf", "excel"] as const;
export type ReportFileType = (typeof REPORT_FILE_TYPES)[number];

export type GeneratedReport = {
  blob: Blob;
  filename: string;
};

/** Static catalog of the on-the-fly reports the backend can generate. */
export type ReportDefinition = {
  type: ReportType;
  label: string;
  description: string;
};

export const REPORT_DEFINITIONS: ReportDefinition[] = [
  {
    type: "financial",
    label: "Financial Performance",
    description: "Revenue, invoicing and collections across billing.",
  },
  {
    type: "clinical",
    label: "Clinical Analytics",
    description: "Diagnoses, visit trends and clinical registries.",
  },
  {
    type: "inventory",
    label: "Inventory & Supply",
    description: "Stock levels, valuations and recent movements.",
  },
  {
    type: "workforce",
    label: "Workforce Report",
    description: "Staff counts, departments and shift coverage.",
  },
  {
    type: "comprehensive",
    label: "Comprehensive Audit",
    description: "Full operational snapshot across every module.",
  },
];

// ====================================================================
// Normalizers
// ====================================================================

function num(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function arr<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function normalizeFinancial(data: Partial<FinancialSummary> | undefined): FinancialSummary {
  return {
    total_revenue: num(data?.total_revenue),
    total_invoiced: num(data?.total_invoiced),
    total_paid: num(data?.total_paid),
    currency: data?.currency || "NGN",
  };
}

function normalizeClinical(data: Partial<ClinicalSummary> | undefined): ClinicalSummary {
  return {
    total_diagnoses: num(data?.total_diagnoses),
    top_diagnoses: arr<NameCount>(data?.top_diagnoses),
    visit_trends: arr<VisitTrendPoint>(data?.visit_trends),
    mortality_rate: num(data?.mortality_rate),
  };
}

function normalizeInventory(data: Partial<InventorySummary> | undefined): InventorySummary {
  return {
    total_items: num(data?.total_items),
    low_stock_items: num(data?.low_stock_items),
    total_stock_value: num(data?.total_stock_value),
    recent_stock_movements: arr<StockMovementEntry>(data?.recent_stock_movements),
  };
}

function normalizeWorkforce(data: Partial<WorkforceSummary> | undefined): WorkforceSummary {
  return {
    total_staff: num(data?.total_staff),
    staff_by_department: arr<NameCount>(data?.staff_by_department),
    active_shifts_today: num(data?.active_shifts_today),
    attendance_rate: num(data?.attendance_rate),
  };
}

// ====================================================================
// Endpoints (app/api/v1/endpoints/report_routes.py)
// ====================================================================

/** GET /reports/financial-summary (optional YYYY-MM-DD date range). */
export async function getFinancialSummary(
  params: { startDate?: string; endDate?: string } = {},
): Promise<FinancialSummary> {
  const response = await apiClient.get<FinancialSummary>("/reports/financial-summary", {
    params: { start_date: params.startDate, end_date: params.endDate },
  });
  return normalizeFinancial(response.data);
}

/** GET /reports/clinical-summary */
export async function getClinicalSummary(): Promise<ClinicalSummary> {
  const response = await apiClient.get<ClinicalSummary>("/reports/clinical-summary");
  return normalizeClinical(response.data);
}

/** GET /reports/inventory-summary */
export async function getInventorySummary(): Promise<InventorySummary> {
  const response = await apiClient.get<InventorySummary>("/reports/inventory-summary");
  return normalizeInventory(response.data);
}

/** GET /reports/workforce-summary */
export async function getWorkforceSummary(): Promise<WorkforceSummary> {
  const response = await apiClient.get<WorkforceSummary>("/reports/workforce-summary");
  return normalizeWorkforce(response.data);
}

/** GET /reports/operational-summary */
export async function getOperationalSummary(): Promise<OperationalSummary> {
  const response = await apiClient.get<OperationalSummary>("/reports/operational-summary");
  const data = response.data;
  return {
    total_patients: num(data?.total_patients),
    total_active_visits: num(data?.total_active_visits),
    total_admissions: num(data?.total_admissions),
    total_staff: num(data?.total_staff),
  };
}

/** GET /reports/aggregation-summary — the dashboard's one-shot payload. */
export async function getAggregationSummary(): Promise<AggregationSummary> {
  const response = await apiClient.get<AggregationSummary>("/reports/aggregation-summary");
  const data = response.data;
  return {
    generated_at: data?.generated_at ?? new Date().toISOString(),
    financial: normalizeFinancial(data?.financial),
    clinical: normalizeClinical(data?.clinical),
    inventory: normalizeInventory(data?.inventory),
    workforce: normalizeWorkforce(data?.workforce),
    tenant_logo_url: data?.tenant_logo_url ?? null,
  };
}

/** GET /reports/platform-overview — SaaS admin only. */
export async function getPlatformOverview(): Promise<PlatformOverview> {
  const response = await apiClient.get<PlatformOverview>("/reports/platform-overview");
  const data = response.data;
  return {
    total_tenants: num(data?.total_tenants),
    active_tenants: num(data?.active_tenants),
    total_revenue_platform: num(data?.total_revenue_platform),
    total_api_calls: num(data?.total_api_calls),
    system_health_status: data?.system_health_status ?? "UNKNOWN",
  };
}

/**
 * POST /reports/generate?report_type=…&file_type=… — the backend generates
 * the report on the fly and streams the file back (no S3 round-trip, no
 * server-side run history endpoint), so runs are tracked client-side.
 */
export async function generateReport(
  reportType: ReportType,
  fileType: ReportFileType = "pdf",
): Promise<GeneratedReport> {
  const response = await apiClient.post<Blob>("/reports/generate", undefined, {
    params: { report_type: reportType, file_type: fileType },
    responseType: "blob",
  });

  // Filename comes back in the Content-Disposition header.
  const disposition = String(response.headers?.["content-disposition"] ?? "");
  const match = /filename\*?=(?:UTF-8''|")?([^";]+)"?/i.exec(disposition);
  const extension = fileType === "excel" ? "xlsx" : "pdf";
  const filename = match?.[1]?.trim() || `${reportType}-report.${extension}`;

  return { blob: response.data, filename };
}

/** Trigger a browser download for a generated report file. */
export function saveReportFile({ blob, filename }: GeneratedReport): void {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}
