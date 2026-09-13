import { apiClient } from "@/lib/api/api-client";

export type BillableService = {
  id: number;
  code: string;
  name: string;
  category?: string | null;
  default_price: number | string;
  account_id?: number | null;
  account_code?: string | null;
  account_name?: string | null;
  description?: string | null;
};

export type BillableServiceCreatePayload = {
  code: string;
  name: string;
  category?: string;
  default_price: number;
  account_id: number;
  description?: string;
};

export type BillableServiceUpdatePayload = {
  name?: string;
  category?: string;
  default_price?: number;
  account_id?: number;
  description?: string;
  is_active?: boolean;
};

export type PageMeta = {
  total: number;
  total_pages: number;
  current_page: number;
  page_size: number;
};

export const billableServicesApi = {
  list: (params: { search?: string; category?: string } = {}) =>
    apiClient
      .get<{ items: BillableService[]; count: number }>("/billing/services", { params })
      .then((res) => res.data.items ?? []),

  listPaged: (
    params: { skip?: number; limit?: number; search?: string; category?: string } = {},
  ) =>
    apiClient
      .get<{ items: BillableService[]; meta?: PageMeta }>("/billing/services", { params })
      .then((res) => ({ items: res.data.items ?? [], meta: res.data.meta })),

  create: (payload: BillableServiceCreatePayload) =>
    apiClient
      .post<{ service: BillableService }>("/billing/services", payload)
      .then((res) => res.data.service),

  update: (id: number, payload: BillableServiceUpdatePayload) =>
    apiClient
      .put<{ service: BillableService }>(`/billing/services/${id}`, payload)
      .then((res) => res.data.service),

  remove: (id: number) => apiClient.delete(`/billing/services/${id}`).then((res) => res.data),

  mappingHealth: () =>
    apiClient
      .get<BillingMappingHealth>("/billing/services/mapping-health")
      .then((res) => res.data),
};

export type BillingMappingHealth = {
  success: boolean;
  total_services: number;
  missing_account: number;
  items: { id: number; code: string; name: string; category?: string | null }[];
};

import { downloadTemplate, uploadTemplate } from "@/lib/api/bulk-upload";

export const downloadServicesTemplate = () =>
  downloadTemplate("/billing/services/template", "billable_services_template.xlsx");

export const bulkUploadServices = (file: File) =>
  uploadTemplate("/billing/services/bulk-upload", file);
