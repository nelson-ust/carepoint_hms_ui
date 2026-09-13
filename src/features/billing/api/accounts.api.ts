import { apiClient } from "@/lib/api/api-client";

export type AccountType = "REVENUE" | "ASSET" | "LIABILITY" | "EXPENSE" | "EQUITY";

export type Account = {
  id: number;
  code: string;
  name: string;
  account_type: AccountType;
  description?: string | null;
  is_active?: boolean | null;
};

export type AccountPayload = {
  code: string;
  name: string;
  account_type?: AccountType;
  description?: string;
};

export const ACCOUNT_TYPE_OPTIONS: { value: AccountType; label: string }[] = [
  { value: "REVENUE", label: "Revenue" },
  { value: "ASSET", label: "Asset" },
  { value: "LIABILITY", label: "Liability" },
  { value: "EXPENSE", label: "Expense" },
  { value: "EQUITY", label: "Equity" },
];

export type PageMeta = {
  total: number;
  total_pages: number;
  current_page: number;
  page_size: number;
};

export type Paged<T> = { items: T[]; meta?: PageMeta };

export const accountsApi = {
  list: (params: { search?: string; account_type?: string } = {}) =>
    apiClient
      .get<{ items: Account[]; count: number }>("/billing/accounts", { params })
      .then((res) => res.data.items ?? []),

  listPaged: (
    params: { skip?: number; limit?: number; search?: string; account_type?: string } = {},
  ) =>
    apiClient
      .get<{ items: Account[]; meta?: PageMeta }>("/billing/accounts", { params })
      .then((res) => ({ items: res.data.items ?? [], meta: res.data.meta })),

  create: (payload: AccountPayload) =>
    apiClient
      .post<{ account: Account }>("/billing/accounts", payload)
      .then((res) => res.data.account),

  update: (id: number, payload: Partial<AccountPayload> & { is_active?: boolean }) =>
    apiClient
      .put<{ account: Account }>(`/billing/accounts/${id}`, payload)
      .then((res) => res.data.account),

  remove: (id: number) => apiClient.delete(`/billing/accounts/${id}`).then((res) => res.data),
};

import { downloadTemplate, uploadTemplate } from "@/lib/api/bulk-upload";

export const downloadAccountsTemplate = () =>
  downloadTemplate("/billing/accounts/template", "chart_of_accounts_template.xlsx");

export const bulkUploadAccounts = (file: File) =>
  uploadTemplate("/billing/accounts/bulk-upload", file);
