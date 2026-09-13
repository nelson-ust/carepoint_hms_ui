import { apiClient } from "@/lib/api/api-client";
import { hydrateBlobError } from "@/lib/api/api-error";

// ── Enums (mirror app/core/enums.py) ─────────────────────────────────
export type ApprovalRequestStatus =
  | "DRAFT" | "PENDING" | "IN_PROGRESS" | "APPROVED" | "REJECTED" | "CANCELLED" | "RETURNED" | "EXPIRED";
export type ApproverKind = "USER" | "ROLE" | "DEPARTMENT" | "DYNAMIC";
export type DecisionRule = "ANY_OF" | "ALL_OF" | "N_OF_M";
export type DynamicToken =
  | "REQUESTER_MANAGER" | "DEPARTMENT_HEAD" | "FACILITY_HEAD" | "HR_HEAD" | "FINANCE_HEAD";
export type LogAction = "SUBMIT" | "APPROVE" | "REJECT" | "COMMENT" | "CANCEL" | "DELEGATE" | "RETURN";

export const APPROVER_KINDS: ApproverKind[] = ["ROLE", "DYNAMIC", "USER", "DEPARTMENT"];
export const DECISION_RULES: DecisionRule[] = ["ANY_OF", "ALL_OF", "N_OF_M"];
export const DYNAMIC_TOKENS: DynamicToken[] = [
  "REQUESTER_MANAGER", "DEPARTMENT_HEAD", "FACILITY_HEAD", "HR_HEAD", "FINANCE_HEAD",
];

export type RequestType = {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  is_active: boolean;
};

export type ApprovalStep = {
  id?: number;
  flow_id?: number;
  step_order: number;
  name: string;
  approver_kind: ApproverKind;
  approver_user_id?: number | null;
  approver_role_id?: number | null;
  approver_department_id?: number | null;
  dynamic_token?: DynamicToken | null;
  decision_rule: DecisionRule;
  required_approvals: number;
  allow_self_approval: boolean;
  is_active: boolean;
};

export type ApprovalFlow = {
  id: number;
  request_type_id: number;
  request_type_code?: string | null;
  code: string;
  name: string;
  description?: string | null;
  is_default: boolean;
  is_active: boolean;
  steps: ApprovalStep[];
};

export type ApprovalLog = {
  id: number;
  step_order?: number | null;
  step_name?: string | null;
  action: LogAction;
  actor_user_id?: number | null;
  actor_name?: string | null;
  actor_photo_url?: string | null;
  actor_signature_url?: string | null;
  comment?: string | null;
  resulting_status?: string | null;
  created_at?: string | null;
};

export type ApprovalRequest = {
  id: number;
  request_type_code: string;
  flow_id?: number | null;
  flow_name?: string | null;
  subject_id?: number | null;
  requester_user_id: number;
  requester_name?: string | null;
  requester_photo_url?: string | null;
  requester_signature_url?: string | null;
  assigned_approver_user_id?: number | null;
  assigned_approver_name?: string | null;
  assigned_approver_photo_url?: string | null;
  assigned_approver_signature_url?: string | null;
  title: string;
  description?: string | null;
  payload?: Record<string, unknown> | null;
  status: ApprovalRequestStatus;
  current_step_order?: number | null;
  current_step_name?: string | null;
  submitted_at?: string | null;
  completed_at?: string | null;
  decision_summary?: string | null;
  steps: ApprovalStep[];
  logs: ApprovalLog[];
  created_at?: string | null;
};

export type CreateFlowPayload = {
  request_type: string;
  code: string;
  name: string;
  description?: string;
  is_default?: boolean;
  is_active?: boolean;
  steps: Array<Omit<ApprovalStep, "id" | "flow_id">>;
};

function asArray<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  const items = (data as { items?: unknown })?.items;
  return Array.isArray(items) ? (items as T[]) : [];
}

export const approvalsApi = {
  // Request types
  listRequestTypes: (onlyActive = false) =>
    apiClient.get<RequestType[]>("/approvals/request-types", { params: { only_active: onlyActive } })
      .then((r) => asArray<RequestType>(r.data)),
  createRequestType: (payload: { code: string; name: string; description?: string }) =>
    apiClient.post<RequestType>("/approvals/request-types", payload).then((r) => r.data),

  // Flows
  listFlows: (requestType?: string) =>
    apiClient.get<ApprovalFlow[]>("/approvals/flows", { params: requestType ? { request_type: requestType } : {} })
      .then((r) => asArray<ApprovalFlow>(r.data)),
  createFlow: (payload: CreateFlowPayload) =>
    apiClient.post<ApprovalFlow>("/approvals/flows", payload).then((r) => r.data),
  updateFlow: (id: number, payload: Partial<CreateFlowPayload>) =>
    apiClient.put<ApprovalFlow>(`/approvals/flows/${id}`, payload).then((r) => r.data),
  deleteFlow: (id: number) => apiClient.delete(`/approvals/flows/${id}`).then((r) => r.data),

  // Requests
  listRequests: (params: { request_type?: string; request_status?: ApprovalRequestStatus; skip?: number; limit?: number } = {}) =>
    apiClient.get<{ items: ApprovalRequest[]; count: number; meta: any }>("/approvals/requests", { params })
      .then((r) => ({ items: r.data.items ?? [], count: r.data.count ?? 0, meta: r.data.meta ?? {} })),
  listMine: () =>
    apiClient.get<ApprovalRequest[]>("/approvals/requests/mine").then((r) => asArray<ApprovalRequest>(r.data)),
  listPending: () =>
    apiClient.get<ApprovalRequest[]>("/approvals/requests/pending").then((r) => asArray<ApprovalRequest>(r.data)),
  get: (id: number) =>
    apiClient.get<ApprovalRequest>(`/approvals/requests/${id}`).then((r) => r.data),
  decide: (id: number, action: LogAction, comment?: string) =>
    apiClient.post<ApprovalRequest>(`/approvals/requests/${id}/decisions`, { action, comment })
      .then((r) => r.data),
  cancel: (id: number) =>
    apiClient.post<ApprovalRequest>(`/approvals/requests/${id}/cancel`).then((r) => r.data),
};


// ── Bulk upload (Excel) ──────────────────────────────────────────────
export type BulkUploadRowError = { row?: number | null; message: string };
export type BulkUploadResult = {
  success: boolean;
  message: string;
  total_rows: number;
  created: number;
  failed: number;
  errors: BulkUploadRowError[];
};

function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function downloadTemplate(path: string, filename: string): Promise<void> {
  let response;
  try {
    response = await apiClient.get(path, { responseType: "blob" });
  } catch (err) {
    throw await hydrateBlobError(err);
  }
  const blob = response.data as Blob;
  if (blob.type && blob.type.includes("application/json")) {
    let parsed: any = undefined;
    try { parsed = JSON.parse(await blob.text()); } catch { /* ignore */ }
    throw { response: { data: parsed } };
  }
  triggerBrowserDownload(blob, filename);
}

async function uploadTemplate(path: string, file: File): Promise<BulkUploadResult> {
  const form = new FormData();
  form.append("file", file);
  const res = await apiClient.post<BulkUploadResult>(path, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

export const downloadRequestTypeTemplate = () =>
  downloadTemplate("/approvals/request-types/template", "request_types_template.xlsx");
export const bulkUploadRequestTypes = (file: File) =>
  uploadTemplate("/approvals/request-types/bulk-upload", file);

export const downloadFlowTemplate = () =>
  downloadTemplate("/approvals/flows/template", "approval_flows_template.xlsx");
export const bulkUploadFlows = (file: File) =>
  uploadTemplate("/approvals/flows/bulk-upload", file);

export const downloadStepTemplate = () =>
  downloadTemplate("/approvals/steps/template", "approval_steps_template.xlsx");
export const bulkUploadSteps = (file: File) =>
  uploadTemplate("/approvals/steps/bulk-upload", file);


// ── First-step approvers (submit-time selection) ─────────────────────
export type EligibleApprover = { user_id: number; name: string; email: string };
export type FirstStepApprovers = {
  flow_id: number;
  flow_name: string;
  step_order: number | null;
  step_name: string | null;
  approvers: EligibleApprover[];
};

export const firstStepApprovers = (requestType: string, flowId?: number) =>
  apiClient
    .get<FirstStepApprovers>(`/approvals/request-types/${requestType}/first-step-approvers`, {
      params: flowId ? { flow_id: flowId } : {},
    })
    .then((r) => r.data);
