import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { listRoles } from "@/features/roles/api/roles.api";
import { listServiceDeliveryPoints } from "@/features/service-delivery-points/api/service-delivery-points.api";
import {
  activateUser,
  assignUserRoles,
  createAdminUser,
  deactivateUser,
  getAdminUser,
  getUserAccessSummary,
  listAdminUsers,
  listDepartments,
  listUserSessions,
  removeUserRoles,
  replaceUserRoles,
  resetUserPassword,
  revokeUserSessions,
  toggleUserMfa,
  updateAdminUser,
} from "../api/staff-admin.api";
import type {
  ListUsersParams,
  PasswordResetPayload,
  UserCreatePayload,
  UserUpdatePayload,
} from "../api/staff-admin.api";

// =====================================================================
// Query keys
// =====================================================================

export const staffAdminKeys = {
  all: ["staff-admin"] as const,
  lists: () => [...staffAdminKeys.all, "users"] as const,
  list: (params: ListUsersParams) => [...staffAdminKeys.lists(), params] as const,
  counts: () => [...staffAdminKeys.all, "count"] as const,
  count: (status?: string) => [...staffAdminKeys.counts(), status ?? "ALL"] as const,
  details: () => [...staffAdminKeys.all, "detail"] as const,
  detail: (userId: number) => [...staffAdminKeys.details(), userId] as const,
  sessions: (userId: number) => [...staffAdminKeys.all, "sessions", userId] as const,
  access: (userId: number) => [...staffAdminKeys.all, "access", userId] as const,
  departments: () => [...staffAdminKeys.all, "departments"] as const,
  roles: () => [...staffAdminKeys.all, "roles"] as const,
  sdps: () => [...staffAdminKeys.all, "sdps"] as const,
};

// =====================================================================
// Queries
// =====================================================================

/** Server-driven user list — search, status and pagination in the key. */
export function useStaffUsers(params: ListUsersParams) {
  return useQuery({
    queryKey: staffAdminKeys.list(params),
    queryFn: () => listAdminUsers(params),
    placeholderData: keepPreviousData,
  });
}

/**
 * Server-side total for a given status (limit=1 probe, reads meta.total).
 * Powers the honest status metric cards without pulling every row.
 */
export function useStaffUserCount(status?: string) {
  return useQuery({
    queryKey: staffAdminKeys.count(status),
    queryFn: async () => {
      const page = await listAdminUsers({ skip: 0, limit: 1, status });
      return page.meta.total;
    },
    staleTime: 30 * 1000,
  });
}

export function useStaffUser(userId: number | null) {
  return useQuery({
    queryKey: staffAdminKeys.detail(userId ?? -1),
    queryFn: () => getAdminUser(userId as number),
    enabled: userId != null,
  });
}

export function useUserSessions(userId: number | null, enabled = true) {
  return useQuery({
    queryKey: staffAdminKeys.sessions(userId ?? -1),
    queryFn: () => listUserSessions(userId as number, { skip: 0, limit: 50 }),
    enabled: userId != null && enabled,
  });
}

export function useUserAccessSummary(userId: number | null, enabled = true) {
  return useQuery({
    queryKey: staffAdminKeys.access(userId ?? -1),
    queryFn: () => getUserAccessSummary(userId as number),
    enabled: userId != null && enabled,
  });
}

// ---------------------------------------------------------------------
// Supporting selects (departments / roles / service delivery points)
// ---------------------------------------------------------------------

export function useDepartmentOptions() {
  return useQuery({
    queryKey: staffAdminKeys.departments(),
    queryFn: () => listDepartments({ skip: 0, limit: 100 }),
    staleTime: 5 * 60 * 1000,
  });
}

export function useRoleOptions() {
  return useQuery({
    queryKey: staffAdminKeys.roles(),
    queryFn: async () => (await listRoles({ skip: 0, limit: 100 })).items,
    staleTime: 5 * 60 * 1000,
  });
}

export function useServicePointOptions() {
  return useQuery({
    queryKey: staffAdminKeys.sdps(),
    queryFn: async () => (await listServiceDeliveryPoints({ skip: 0, limit: 100 })).items,
    staleTime: 5 * 60 * 1000,
  });
}

// =====================================================================
// Mutations — every write invalidates the list + counts, and the detail /
// access / session caches for the affected user.
// =====================================================================

function useInvalidateStaffAdmin() {
  const queryClient = useQueryClient();
  return (userId?: number) => {
    queryClient.invalidateQueries({ queryKey: staffAdminKeys.lists() });
    queryClient.invalidateQueries({ queryKey: staffAdminKeys.counts() });
    if (userId != null) {
      queryClient.invalidateQueries({ queryKey: staffAdminKeys.detail(userId) });
      queryClient.invalidateQueries({ queryKey: staffAdminKeys.access(userId) });
      queryClient.invalidateQueries({ queryKey: staffAdminKeys.sessions(userId) });
    }
  };
}

export function useOnboardStaff() {
  const invalidate = useInvalidateStaffAdmin();
  return useMutation({
    mutationFn: (payload: UserCreatePayload) => createAdminUser(payload),
    onSuccess: (user) => invalidate(user.id),
  });
}

export function useUpdateStaffUser() {
  const invalidate = useInvalidateStaffAdmin();
  return useMutation({
    mutationFn: ({ userId, payload }: { userId: number; payload: UserUpdatePayload }) =>
      updateAdminUser(userId, payload),
    onSuccess: (_user, variables) => invalidate(variables.userId),
  });
}

export function useActivateUser() {
  const invalidate = useInvalidateStaffAdmin();
  return useMutation({
    mutationFn: (userId: number) => activateUser(userId),
    onSuccess: (_user, userId) => invalidate(userId),
  });
}

export function useDeactivateUser() {
  const invalidate = useInvalidateStaffAdmin();
  return useMutation({
    mutationFn: (userId: number) => deactivateUser(userId),
    onSuccess: (_user, userId) => invalidate(userId),
  });
}

export function useAssignUserRoles() {
  const invalidate = useInvalidateStaffAdmin();
  return useMutation({
    mutationFn: ({ userId, roleIds }: { userId: number; roleIds: number[] }) =>
      assignUserRoles(userId, roleIds),
    onSuccess: (_user, variables) => invalidate(variables.userId),
  });
}

/**
 * Persist an access-tab edit. The backend's RoleAssignmentSchema requires a
 * non-empty role_ids list, so "clear everything" is expressed as a DELETE of
 * the user's current roles rather than a replace-with-empty.
 */
export function useSaveUserRoles() {
  const invalidate = useInvalidateStaffAdmin();
  return useMutation({
    mutationFn: async ({
      userId,
      roleIds,
      currentRoleIds,
    }: {
      userId: number;
      roleIds: number[];
      currentRoleIds: number[];
    }) => {
      if (roleIds.length > 0) {
        return replaceUserRoles(userId, roleIds);
      }
      if (currentRoleIds.length > 0) {
        return removeUserRoles(userId, currentRoleIds);
      }
      return getAdminUser(userId);
    },
    onSuccess: (_user, variables) => invalidate(variables.userId),
  });
}

export function useResetUserPassword() {
  const invalidate = useInvalidateStaffAdmin();
  return useMutation({
    mutationFn: ({ userId, payload }: { userId: number; payload: PasswordResetPayload }) =>
      resetUserPassword(userId, payload),
    onSuccess: (_user, variables) => invalidate(variables.userId),
  });
}

export function useToggleUserMfa() {
  const invalidate = useInvalidateStaffAdmin();
  return useMutation({
    mutationFn: ({ userId, enabled }: { userId: number; enabled: boolean }) =>
      toggleUserMfa(userId, enabled),
    onSuccess: (_user, variables) => invalidate(variables.userId),
  });
}

export function useRevokeUserSessions() {
  const invalidate = useInvalidateStaffAdmin();
  return useMutation({
    mutationFn: ({ userId, sessionIds }: { userId: number; sessionIds: number[] }) =>
      revokeUserSessions(userId, sessionIds),
    onSuccess: (_result, variables) => invalidate(variables.userId),
  });
}
