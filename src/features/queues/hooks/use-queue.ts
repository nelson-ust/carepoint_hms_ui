import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  callTicket,
  cancelTicket,
  completeAndEndVisitTicket,
  completeAndRouteTicket,
  completeTicket,
  getDisplayBoard,
  getMyWorklist,
  getQueueStats,
  getServicePointWorklist,
  getTicket,
  listServicePointTickets,
  listBillableServices,
  recordVisitServices,
  missTicket,
  serveTicket,
  transferTicket,
} from "../api/queues.api";
import type { ListServicePointTicketsParams } from "../api/queues.api";
import { listActiveServiceDeliveryPoints } from "@/features/service-delivery-points/api/service-delivery-points.api";

const WORKLIST_REFETCH_MS = 30_000;
const DISPLAY_BOARD_REFETCH_MS = 20_000;
const STATS_REFETCH_MS = 90_000;

export const queueKeys = {
  all: ["queue"] as const,
  worklists: () => [...queueKeys.all, "worklist"] as const,
  myWorklist: (sdpId?: number) => [...queueKeys.worklists(), "my", sdpId ?? "default"] as const,
  servicePointWorklist: (sdpId: number) => [...queueKeys.worklists(), "sdp", sdpId] as const,
  tickets: () => [...queueKeys.all, "tickets"] as const,
  ticket: (ticketId: number) => [...queueKeys.tickets(), ticketId] as const,
  servicePointTickets: (sdpId: number, params: ListServicePointTicketsParams) =>
    [...queueKeys.tickets(), "sdp", sdpId, params] as const,
  stats: (dateFrom?: string, dateTo?: string) =>
    [...queueKeys.all, "stats", dateFrom ?? null, dateTo ?? null] as const,
  displayBoard: (waitingLimit: number) =>
    [...queueKeys.all, "display-board", waitingLimit] as const,
};

// ============================================================
// Reads
// ============================================================

/** Worklist for the caller's assigned SDP (window-focus refetch stays on). */
export function useMyWorklist(sdpId?: number, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queueKeys.myWorklist(sdpId),
    queryFn: () => getMyWorklist(sdpId),
    refetchInterval: WORKLIST_REFETCH_MS,
    enabled: options.enabled ?? true,
  });
}

export function useServicePointWorklist(
  serviceDeliveryPointId: number,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: queueKeys.servicePointWorklist(serviceDeliveryPointId),
    queryFn: () => getServicePointWorklist(serviceDeliveryPointId),
    refetchInterval: WORKLIST_REFETCH_MS,
    enabled: (options.enabled ?? true) && serviceDeliveryPointId > 0,
  });
}

export function useServicePointTickets(
  serviceDeliveryPointId: number,
  params: ListServicePointTicketsParams = {},
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: queueKeys.servicePointTickets(serviceDeliveryPointId, params),
    queryFn: () => listServicePointTickets(serviceDeliveryPointId, params),
    enabled: (options.enabled ?? true) && serviceDeliveryPointId > 0,
    placeholderData: (previous) => previous,
  });
}

export function useQueueTicket(ticketId: number) {
  return useQuery({
    queryKey: queueKeys.ticket(ticketId),
    queryFn: () => getTicket(ticketId),
    enabled: ticketId > 0,
  });
}

export function useDisplayBoard(waitingLimit = 5) {
  return useQuery({
    queryKey: queueKeys.displayBoard(waitingLimit),
    queryFn: () => getDisplayBoard(waitingLimit),
    refetchInterval: DISPLAY_BOARD_REFETCH_MS,
  });
}

export function useQueueStats(dateFrom?: string, dateTo?: string) {
  return useQuery({
    queryKey: queueKeys.stats(dateFrom, dateTo),
    queryFn: () => getQueueStats({ dateFrom, dateTo }),
    refetchInterval: STATS_REFETCH_MS,
    placeholderData: (previous) => previous,
  });
}

/** Active SDPs for scope/target selects (read-only cross-feature import). */
export function useActiveServicePoints() {
  return useQuery({
    queryKey: ["service-delivery-points", "active", "queue-select"],
    queryFn: () => listActiveServiceDeliveryPoints({ skip: 0, limit: 200 }),
    staleTime: 5 * 60_000,
  });
}

// ============================================================
// Mutations — every action invalidates worklists, ticket lists,
// stats and the display board so all live views converge.
// ============================================================

function useInvalidateQueue() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queueKeys.all });
}

export function useCallTicket() {
  const invalidate = useInvalidateQueue();
  return useMutation({
    mutationFn: ({ ticketId, note }: { ticketId: number; note?: string }) =>
      callTicket(ticketId, note),
    onSuccess: invalidate,
  });
}

export function useServeTicket() {
  const invalidate = useInvalidateQueue();
  return useMutation({
    mutationFn: ({ ticketId, note }: { ticketId: number; note?: string }) =>
      serveTicket(ticketId, note),
    onSuccess: invalidate,
  });
}

export function useCompleteTicket() {
  const invalidate = useInvalidateQueue();
  return useMutation({
    mutationFn: ({ ticketId, note }: { ticketId: number; note?: string }) =>
      completeTicket(ticketId, note),
    onSuccess: invalidate,
  });
}

export function useCompleteAndRouteTicket() {
  const invalidate = useInvalidateQueue();
  return useMutation({
    mutationFn: ({
      ticketId,
      targetServiceDeliveryPointId,
      notes,
    }: {
      ticketId: number;
      targetServiceDeliveryPointId: number;
      notes?: string;
    }) => completeAndRouteTicket(ticketId, targetServiceDeliveryPointId, notes),
    onSuccess: invalidate,
  });
}

export function useCompleteAndEndVisitTicket() {
  const invalidate = useInvalidateQueue();
  return useMutation({
    mutationFn: ({ ticketId, note }: { ticketId: number; note?: string }) =>
      completeAndEndVisitTicket(ticketId, note),
    onSuccess: invalidate,
  });
}

export function useMissTicket() {
  const invalidate = useInvalidateQueue();
  return useMutation({
    mutationFn: ({ ticketId }: { ticketId: number }) => missTicket(ticketId),
    onSuccess: invalidate,
  });
}

export function useCancelTicket() {
  const invalidate = useInvalidateQueue();
  return useMutation({
    mutationFn: ({ ticketId, reason }: { ticketId: number; reason: string }) =>
      cancelTicket(ticketId, reason),
    onSuccess: invalidate,
  });
}

export function useTransferTicket() {
  const invalidate = useInvalidateQueue();
  return useMutation({
    mutationFn: ({
      ticketId,
      targetServiceDeliveryPointId,
      reason,
    }: {
      ticketId: number;
      targetServiceDeliveryPointId: number;
      reason?: string;
    }) => transferTicket(ticketId, targetServiceDeliveryPointId, reason),
    onSuccess: invalidate,
  });
}


// ============================================================
// Billable services + record services rendered (SDP capture)
// ============================================================

export function useBillableServices(search?: string) {
  return useQuery({
    queryKey: [...queueKeys.all, "billable-services", search ?? ""],
    queryFn: () => listBillableServices(search),
    staleTime: 60_000,
  });
}

export function useRecordVisitServices() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ visitId, payload }: { visitId: number; payload: import("../api/queues.api").RecordServicesPayload }) =>
      recordVisitServices(visitId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queueKeys.worklists() });
      queryClient.invalidateQueries({ queryKey: queueKeys.tickets() });
    },
  });
}
