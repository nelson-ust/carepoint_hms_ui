import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fundPortalCard,
  getPortalAppointments,
  getPortalBranding,
  getPortalClinicians,
  getPortalDashboard,
  getPortalBaselineDiagnostics,
  getPortalNotifications,
  getPortalPaymentConfig,
  getPortalProfile,
  hasPortalSession,
  listMyManualCardFunding,
  markAllPortalNotificationsRead,
  getPortalMessages,
  getPortalMessagesUnreadCount,
  markPortalMessageRead,
  markAllPortalMessagesRead,
  markPortalNotificationRead,
  registerPortalAccount,
  requestPortalAppointment,
  requestPortalOtp,
  resendPortalOtp,
  sendPortalMessage,
  sharePortalDocument,
  submitManualCardFunding,
  updatePortalProfile,
  uploadPortalProfilePhoto,
  verifyPortalOtp,
} from "../api/portal.api";
import type {
  AppointmentRequestPayload,
  DocumentSharePayload,
  FundCardPayload,
  ManualFundingPayload,
  PortalAccountCreatePayload,
  PortalMessagePayload,
  PortalProfileUpdatePayload,
  RequestPortalOtpPayload,
  ResendPortalOtpPayload,
  VerifyPortalOtpPayload,
} from "../api/portal.api";

// =====================================================================
// Query keys
// =====================================================================

export const portalKeys = {
  all: ["patient-portal"] as const,
  dashboard: ["patient-portal", "dashboard"] as const,
  profile: ["patient-portal", "profile"] as const,
  notifications: (skip: number, limit: number, unreadOnly: boolean) =>
    ["patient-portal", "notifications", skip, limit, unreadOnly] as const,
  manualFunding: ["patient-portal", "manual-funding"] as const,
  appointments: ["patient-portal", "appointments"] as const,
  messages: (skip: number, limit: number, unreadOnly: boolean) =>
    ["patient-portal", "messages", skip, limit, unreadOnly] as const,
  messagesUnread: ["patient-portal", "messages", "unread-count"] as const,
};

// =====================================================================
// Auth (OTP) mutations — tenant code is passed explicitly because it is
// not yet in localStorage when the login page fires the first request.
// =====================================================================

export function useRequestPortalOtp() {
  return useMutation({
    mutationFn: ({
      payload,
      tenantCode,
    }: {
      payload: RequestPortalOtpPayload;
      tenantCode: string;
    }) => requestPortalOtp(payload, tenantCode),
  });
}

export function useVerifyPortalOtp() {
  return useMutation({
    mutationFn: ({
      payload,
      tenantCode,
    }: {
      payload: VerifyPortalOtpPayload;
      tenantCode: string;
    }) => verifyPortalOtp(payload, tenantCode),
  });
}

export function useResendPortalOtp() {
  return useMutation({
    mutationFn: ({
      payload,
      tenantCode,
    }: {
      payload: ResendPortalOtpPayload;
      tenantCode: string;
    }) => resendPortalOtp(payload, tenantCode),
  });
}

// =====================================================================
// Reads
// =====================================================================

export function usePortalDashboard() {
  return useQuery({
    queryKey: portalKeys.dashboard,
    queryFn: getPortalDashboard,
    enabled: hasPortalSession(),
  });
}

export function usePortalBaselineDiagnostics() {
  return useQuery({
    queryKey: ["patient-portal", "baseline-diagnostics"],
    queryFn: getPortalBaselineDiagnostics,
    enabled: hasPortalSession(),
  });
}

export function usePortalProfile() {
  return useQuery({
    queryKey: portalKeys.profile,
    queryFn: getPortalProfile,
    enabled: hasPortalSession(),
  });
}

/** Self-service update of the patient's editable profile fields. */
export function useUpdatePortalProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: PortalProfileUpdatePayload) => updatePortalProfile(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: portalKeys.profile });
      queryClient.invalidateQueries({ queryKey: portalKeys.dashboard });
    },
  });
}

/** Upload / replace the patient's profile picture. */
export function useUploadPortalPhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadPortalProfilePhoto(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: portalKeys.profile });
      queryClient.invalidateQueries({ queryKey: portalKeys.dashboard });
    },
  });
}

export function usePortalAppointments() {
  return useQuery({
    queryKey: portalKeys.appointments,
    queryFn: getPortalAppointments,
    enabled: hasPortalSession(),
  });
}

export function usePortalBranding() {
  return useQuery({
    queryKey: ["patient-portal", "branding"],
    queryFn: getPortalBranding,
    enabled: hasPortalSession(),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

export function usePortalNotifications(skip = 0, limit = 20, unreadOnly = true) {
  return useQuery({
    queryKey: portalKeys.notifications(skip, limit, unreadOnly),
    queryFn: () => getPortalNotifications(skip, limit, unreadOnly),
    enabled: hasPortalSession(),
  });
}

/** Mark a single notification read; refreshes the feed and the unread badge. */
export function useMarkPortalNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: number) => markPortalNotificationRead(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-portal", "notifications"] });
      queryClient.invalidateQueries({ queryKey: portalKeys.dashboard });
    },
  });
}

/** Mark every unread notification read (clears the feed at once). */
export function useMarkAllPortalNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => markAllPortalNotificationsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-portal", "notifications"] });
      queryClient.invalidateQueries({ queryKey: portalKeys.dashboard });
    },
  });
}

// =====================================================================
// Actions
// =====================================================================

export function useFundPortalCard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: FundCardPayload) => fundPortalCard(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: portalKeys.dashboard });
    },
  });
}

export function useSubmitManualCardFunding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ManualFundingPayload) => submitManualCardFunding(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: portalKeys.dashboard });
      queryClient.invalidateQueries({ queryKey: portalKeys.manualFunding });
    },
  });
}

export function useMyManualCardFunding() {
  return useQuery({
    queryKey: portalKeys.manualFunding,
    queryFn: listMyManualCardFunding,
    enabled: hasPortalSession(),
  });
}

export function usePortalPaymentConfig() {
  return useQuery({
    queryKey: ["patient-portal", "payment-config"],
    queryFn: getPortalPaymentConfig,
    enabled: hasPortalSession(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useRegisterPortalAccount() {
  return useMutation({
    mutationFn: ({
      payload,
      tenantCode,
    }: {
      payload: PortalAccountCreatePayload;
      tenantCode?: string;
    }) => registerPortalAccount(payload, tenantCode),
  });
}

export function useRequestPortalAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      accountId,
      payload,
    }: {
      accountId: number;
      payload: AppointmentRequestPayload;
    }) => requestPortalAppointment(accountId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: portalKeys.dashboard });
      queryClient.invalidateQueries({ queryKey: portalKeys.appointments });
    },
  });
}

export function usePortalClinicians(patientId: number | undefined, enabled = true) {
  return useQuery({
    queryKey: ["portal", "clinicians", patientId],
    queryFn: () => getPortalClinicians(patientId as number),
    enabled: !!patientId && enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSendPortalMessage() {
  return useMutation({
    mutationFn: ({
      accountId,
      payload,
    }: {
      accountId: number;
      payload: PortalMessagePayload;
    }) => sendPortalMessage(accountId, payload),
  });
}

export function useSharePortalDocument() {
  return useMutation({
    mutationFn: ({
      accountId,
      payload,
    }: {
      accountId: number;
      payload: DocumentSharePayload;
    }) => sharePortalDocument(accountId, payload),
  });
}


// =====================================================================
// Hospital -> patient messages (inbox)
// =====================================================================

export function usePortalMessages(skip = 0, limit = 20, unreadOnly = false) {
  return useQuery({
    queryKey: portalKeys.messages(skip, limit, unreadOnly),
    queryFn: () => getPortalMessages(skip, limit, unreadOnly),
    enabled: hasPortalSession(),
  });
}

export function usePortalMessagesUnreadCount() {
  return useQuery({
    queryKey: portalKeys.messagesUnread,
    queryFn: getPortalMessagesUnreadCount,
    enabled: hasPortalSession(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

export function useMarkPortalMessageRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (recipientId: number) => markPortalMessageRead(recipientId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-portal", "messages"] });
    },
  });
}

export function useMarkAllPortalMessagesRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => markAllPortalMessagesRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-portal", "messages"] });
    },
  });
}
