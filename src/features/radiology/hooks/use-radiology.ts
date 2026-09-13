import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  cancelRadiologyOrder,
  completeRadiologyExam,
  createRadiologyOrder,
  draftRadiologyReport,
  finalizeRadiologyReport,
  getRadiologyOrder,
  getRadiologyProcedure,
  getRadiologyReport,
  getRadiologyReportForExam,
  listRadiologyExamImages,
  listRadiologyOrdersForVisit,
  listRadiologyProcedures,
  listRadiologyWorklist,
  releaseRadiologyReport,
  scheduleRadiologyExam,
  startRadiologyExam,
} from "../api/radiology.api";
import type {
  CompleteExamPayload,
  CreateRadiologyOrderPayload,
  DraftReportPayload,
  FinalizeReportPayload,
  ReleaseReportPayload,
  ScheduleExamPayload,
  StartExamPayload,
} from "../api/radiology.api";

export const radiologyKeys = {
  all: ["radiology"] as const,
  procedures: () => [...radiologyKeys.all, "procedures"] as const,
  procedureList: (filters: Record<string, unknown>) =>
    [...radiologyKeys.procedures(), filters] as const,
  procedure: (id: number) => [...radiologyKeys.procedures(), id] as const,
  orders: () => [...radiologyKeys.all, "orders"] as const,
  worklist: (filters: Record<string, unknown>) =>
    [...radiologyKeys.orders(), "worklist", filters] as const,
  visitOrders: (visitId: number, filters: Record<string, unknown>) =>
    [...radiologyKeys.orders(), "visit", visitId, filters] as const,
  order: (id: number) => [...radiologyKeys.orders(), id] as const,
  exams: () => [...radiologyKeys.all, "exams"] as const,
  examImages: (examId: number) => [...radiologyKeys.exams(), examId, "images"] as const,
  reports: () => [...radiologyKeys.all, "reports"] as const,
  report: (id: number) => [...radiologyKeys.reports(), id] as const,
  reportForExam: (examId: number) => [...radiologyKeys.reports(), "exam", examId] as const,
};

// ============================================================
// Procedures catalog
// ============================================================

export function useRadiologyProcedures(
  params: { skip?: number; limit?: number; modality?: string; search?: string } = {},
) {
  return useQuery({
    queryKey: radiologyKeys.procedureList(params),
    queryFn: () => listRadiologyProcedures(params),
  });
}

export function useRadiologyProcedure(procedureId: number) {
  return useQuery({
    queryKey: radiologyKeys.procedure(procedureId),
    queryFn: () => getRadiologyProcedure(procedureId),
    enabled: procedureId > 0,
  });
}

// ============================================================
// Orders
// ============================================================

export function useRadiologyWorklist(
  params: { skip?: number; limit?: number; statuses?: string[] } = {},
) {
  return useQuery({
    queryKey: radiologyKeys.worklist(params),
    queryFn: () => listRadiologyWorklist(params),
  });
}

export function useRadiologyOrdersForVisit(
  visitId: number,
  params: { skip?: number; limit?: number } = {},
) {
  return useQuery({
    queryKey: radiologyKeys.visitOrders(visitId, params),
    queryFn: () => listRadiologyOrdersForVisit(visitId, params),
    enabled: visitId > 0,
  });
}

export function useRadiologyOrder(orderId: number) {
  return useQuery({
    queryKey: radiologyKeys.order(orderId),
    queryFn: () => getRadiologyOrder(orderId),
    enabled: orderId > 0,
  });
}

export function useCreateRadiologyOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateRadiologyOrderPayload) => createRadiologyOrder(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: radiologyKeys.orders() });
    },
  });
}

export function useCancelRadiologyOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, reason }: { orderId: number; reason?: string }) =>
      cancelRadiologyOrder(orderId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: radiologyKeys.orders() });
    },
  });
}

// ============================================================
// Exams
// ============================================================

export function useRadiologyExamImages(examId: number) {
  return useQuery({
    queryKey: radiologyKeys.examImages(examId),
    queryFn: () => listRadiologyExamImages(examId),
    enabled: examId > 0,
  });
}

export function useScheduleRadiologyExam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ScheduleExamPayload) => scheduleRadiologyExam(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: radiologyKeys.all });
    },
  });
}

export function useStartRadiologyExam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ examId, payload }: { examId: number; payload?: StartExamPayload }) =>
      startRadiologyExam(examId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: radiologyKeys.all });
    },
  });
}

export function useCompleteRadiologyExam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ examId, payload }: { examId: number; payload?: CompleteExamPayload }) =>
      completeRadiologyExam(examId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: radiologyKeys.all });
    },
  });
}

// ============================================================
// Reports
// ============================================================

export function useRadiologyReport(reportId: number) {
  return useQuery({
    queryKey: radiologyKeys.report(reportId),
    queryFn: () => getRadiologyReport(reportId),
    enabled: reportId > 0,
  });
}

export function useRadiologyReportForExam(examId: number) {
  return useQuery({
    queryKey: radiologyKeys.reportForExam(examId),
    queryFn: () => getRadiologyReportForExam(examId),
    enabled: examId > 0,
    retry: false,
  });
}

export function useDraftRadiologyReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: DraftReportPayload) => draftRadiologyReport(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: radiologyKeys.reports() });
      queryClient.invalidateQueries({ queryKey: radiologyKeys.orders() });
    },
  });
}

export function useFinalizeRadiologyReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ reportId, payload }: { reportId: number; payload?: FinalizeReportPayload }) =>
      finalizeRadiologyReport(reportId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: radiologyKeys.reports() });
      queryClient.invalidateQueries({ queryKey: radiologyKeys.orders() });
    },
  });
}

export function useReleaseRadiologyReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ reportId, payload }: { reportId: number; payload?: ReleaseReportPayload }) =>
      releaseRadiologyReport(reportId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: radiologyKeys.reports() });
      queryClient.invalidateQueries({ queryKey: radiologyKeys.orders() });
    },
  });
}
