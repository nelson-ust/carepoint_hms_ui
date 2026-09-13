import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { approvalsApi, type ApprovalRequestStatus, type CreateFlowPayload, type LogAction } from "../api/approvals.api";

export const approvalKeys = {
  all: ["approvals"] as const,
  requestTypes: ["approvals", "request-types"] as const,
  flows: (rt?: string) => ["approvals", "flows", rt ?? "all"] as const,
  requests: (f: object) => ["approvals", "requests", f] as const,
  mine: ["approvals", "requests", "mine"] as const,
  pending: ["approvals", "requests", "pending"] as const,
  request: (id: number) => ["approvals", "request", id] as const,
};

export function useRequestTypes(onlyActive = false) {
  return useQuery({ queryKey: [...approvalKeys.requestTypes, onlyActive], queryFn: () => approvalsApi.listRequestTypes(onlyActive) });
}

export function useFlows(requestType?: string) {
  return useQuery({ queryKey: approvalKeys.flows(requestType), queryFn: () => approvalsApi.listFlows(requestType) });
}

export function useCreateFlow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: CreateFlowPayload) => approvalsApi.createFlow(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["approvals", "flows"] }),
  });
}

export function useUpdateFlow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<CreateFlowPayload> }) => approvalsApi.updateFlow(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["approvals", "flows"] }),
  });
}

export function useDeleteFlow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => approvalsApi.deleteFlow(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["approvals", "flows"] }),
  });
}

export function useCreateRequestType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: { code: string; name: string; description?: string }) => approvalsApi.createRequestType(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: approvalKeys.requestTypes }),
  });
}

export function useApprovalRequests(params: { request_type?: string; request_status?: ApprovalRequestStatus; skip?: number; limit?: number } = {}) {
  return useQuery({ queryKey: approvalKeys.requests(params), queryFn: () => approvalsApi.listRequests(params), placeholderData: keepPreviousData });
}

export function useMyPendingApprovals() {
  return useQuery({ queryKey: approvalKeys.pending, queryFn: () => approvalsApi.listPending() });
}

export function useMyApprovalRequests() {
  return useQuery({ queryKey: approvalKeys.mine, queryFn: () => approvalsApi.listMine() });
}

export function useApprovalRequest(id: number | undefined) {
  return useQuery({
    queryKey: approvalKeys.request(id ?? 0),
    queryFn: () => approvalsApi.get(id as number),
    enabled: typeof id === "number" && id > 0,
  });
}

export function useDecideApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action, comment }: { id: number; action: LogAction; comment?: string }) => approvalsApi.decide(id, action, comment),
    onSuccess: () => qc.invalidateQueries({ queryKey: approvalKeys.all }),
  });
}

export function useCancelApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => approvalsApi.cancel(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: approvalKeys.all }),
  });
}
