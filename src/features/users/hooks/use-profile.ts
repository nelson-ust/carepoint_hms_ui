import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  changeMyPassword,
  getMyProfile,
  listUserSessions,
  removeMyProfilePhoto,
  uploadMyProfilePhoto,
  uploadMySignature,
  removeMySignature,
  revokeAllUserSessions,
  setupTwoFactor,
  updateMyProfile,
} from "../api/users.api";
import type {
  ChangePasswordPayload,
  MyProfileUpdatePayload,
  TwoFactorSetupPayload,
} from "../api/users.api";

export const profileKeys = {
  all: ["my-profile"] as const,
  me: () => [...profileKeys.all, "me"] as const,
  sessions: (userId: number) => [...profileKeys.all, "sessions", userId] as const,
};

// =====================================================================
// Queries
// =====================================================================

export function useMyProfile() {
  return useQuery({
    queryKey: profileKeys.me(),
    queryFn: getMyProfile,
  });
}

/**
 * Sessions come from the admin surface (`/users/{id}/sessions`); non-admin
 * users get a 403 — the caller should treat an error as "not available".
 */
export function useMySessions(userId: number | undefined) {
  return useQuery({
    queryKey: profileKeys.sessions(userId ?? -1),
    queryFn: () => listUserSessions(userId as number),
    enabled: userId != null,
    retry: false,
  });
}

// =====================================================================
// Mutations
// =====================================================================

export function useUpdateMyProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: MyProfileUpdatePayload) => updateMyProfile(payload),
    onSuccess: (profile) => {
      queryClient.setQueryData(profileKeys.me(), profile);
      queryClient.invalidateQueries({ queryKey: profileKeys.me() });
    },
  });
}

export function useUploadMyPhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadMyProfilePhoto(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileKeys.me() });
    },
  });
}

export function useRemoveMyPhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: removeMyProfilePhoto,
    onSuccess: (profile) => {
      queryClient.setQueryData(profileKeys.me(), profile);
    },
  });
}

export function useUploadMySignature() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadMySignature(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileKeys.me() });
    },
  });
}

export function useRemoveMySignature() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: removeMySignature,
    onSuccess: (profile) => {
      queryClient.setQueryData(profileKeys.me(), profile);
    },
  });
}

export function useChangeMyPassword() {
  return useMutation({
    mutationFn: (payload: ChangePasswordPayload) => changeMyPassword(payload),
  });
}

export function useSetupTwoFactor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: TwoFactorSetupPayload) => setupTwoFactor(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileKeys.me() });
    },
  });
}

export function useRevokeAllMySessions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: number) => revokeAllUserSessions(userId),
    onSuccess: (_result, userId) => {
      queryClient.invalidateQueries({ queryKey: profileKeys.sessions(userId) });
    },
  });
}
