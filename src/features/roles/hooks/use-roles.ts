import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  assignRolePermissions,
  createRole,
  deleteRole,
  getMyPermissions,
  getRole,
  groupPermissionsByModule,
  listAllPermissions,
  listPermissionModules,
  listRoles,
  revokeRolePermissions,
  updateRole,
} from "../api/roles.api";
import type { RoleCreatePayload, RoleUpdatePayload } from "../api/roles.api";

export const roleKeys = {
  all: ["roles"] as const,
  lists: () => [...roleKeys.all, "list"] as const,
  list: (params: { skip?: number; limit?: number }) => [...roleKeys.lists(), params] as const,
  details: () => [...roleKeys.all, "detail"] as const,
  detail: (roleId: number) => [...roleKeys.details(), roleId] as const,
};

export const permissionKeys = {
  all: ["permissions"] as const,
  catalog: () => [...permissionKeys.all, "catalog"] as const,
  modules: () => [...permissionKeys.all, "modules"] as const,
  mine: () => [...permissionKeys.all, "me"] as const,
};

// =====================================================================
// Queries
// =====================================================================

export function useRoles(params: { skip?: number; limit?: number } = { skip: 0, limit: 100 }) {
  return useQuery({
    queryKey: roleKeys.list(params),
    queryFn: () => listRoles(params),
  });
}

export function useRole(roleId: number | null) {
  return useQuery({
    queryKey: roleKeys.detail(roleId ?? -1),
    queryFn: () => getRole(roleId as number),
    enabled: roleId != null,
  });
}

/** Full permission catalog, grouped by module for the permission matrix. */
export function usePermissionCatalog() {
  return useQuery({
    queryKey: permissionKeys.catalog(),
    queryFn: async () => {
      const permissions = await listAllPermissions();
      return { permissions, groups: groupPermissionsByModule(permissions) };
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function usePermissionModules() {
  return useQuery({
    queryKey: permissionKeys.modules(),
    queryFn: listPermissionModules,
    staleTime: 5 * 60 * 1000,
  });
}

export function useMyPermissions() {
  return useQuery({
    queryKey: permissionKeys.mine(),
    queryFn: getMyPermissions,
    staleTime: 5 * 60 * 1000,
  });
}

// =====================================================================
// Mutations
// =====================================================================

export function useCreateRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: RoleCreatePayload) => createRole(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: roleKeys.lists() });
    },
  });
}

export function useUpdateRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roleId, payload }: { roleId: number; payload: RoleUpdatePayload }) =>
      updateRole(roleId, payload),
    onSuccess: (_role, variables) => {
      queryClient.invalidateQueries({ queryKey: roleKeys.lists() });
      queryClient.invalidateQueries({ queryKey: roleKeys.detail(variables.roleId) });
    },
  });
}

export function useDeleteRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (roleId: number) => deleteRole(roleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: roleKeys.all });
    },
  });
}

/**
 * Persist a permission-matrix edit: assigns the newly checked permissions
 * and revokes the unchecked ones in a single mutation.
 */
export function useSaveRolePermissions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      roleId,
      toAssign,
      toRevoke,
    }: {
      roleId: number;
      toAssign: number[];
      toRevoke: number[];
    }) => {
      if (toAssign.length > 0) {
        await assignRolePermissions(roleId, toAssign);
      }
      if (toRevoke.length > 0) {
        await revokeRolePermissions(roleId, toRevoke);
      }
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: roleKeys.lists() });
      queryClient.invalidateQueries({ queryKey: roleKeys.detail(variables.roleId) });
    },
  });
}
