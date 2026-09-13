import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  KeyRound,
  Pencil,
  Plus,
  Save,
  Shield,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { useToast } from "@/components/feedback/ToastProvider";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { Textarea } from "@/components/ui/Textarea";
import { useDisclosure } from "@/hooks/useDisclosure";
import { cn } from "@/lib/utils/cn";

import { getApiErrorMessage, isSystemRole } from "../api/roles.api";
import type { PermissionGroup, Role, RoleListItem } from "../api/roles.api";
import {
  useCreateRole,
  useDeleteRole,
  usePermissionCatalog,
  useRole,
  useRoles,
  useSaveRolePermissions,
  useUpdateRole,
} from "../hooks/use-roles";

// =====================================================================
// Role form (create / edit)
// =====================================================================

const roleFormSchema = z.object({
  name: z.string().trim().min(2, "Role name must be at least 2 characters."),
  code: z
    .string()
    .trim()
    .min(2, "Role code must be at least 2 characters.")
    .regex(/^[A-Za-z0-9_ -]+$/, "Use letters, numbers, underscores or hyphens."),
  description: z.string().optional(),
});

type RoleFormValues = z.infer<typeof roleFormSchema>;

function RoleFormModal({
  isOpen,
  onClose,
  role,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  /** When provided the modal edits this role instead of creating one. */
  role?: Role | null;
  onCreated?: (roleId: number) => void;
}) {
  const toast = useToast();
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();
  const isEdit = Boolean(role);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RoleFormValues>({
    resolver: zodResolver(roleFormSchema),
    defaultValues: { name: "", code: "", description: "" },
  });

  React.useEffect(() => {
    if (isOpen) {
      reset({
        name: role?.name ?? "",
        code: role?.code ?? "",
        description: role?.description ?? "",
      });
    }
  }, [isOpen, role, reset]);

  const onSubmit = handleSubmit(async (values) => {
    const payload = {
      name: values.name.trim(),
      code: values.code.trim().toUpperCase().replace(/\s+/g, "_"),
      description: values.description?.trim() || undefined,
    };
    try {
      if (isEdit && role) {
        await updateRole.mutateAsync({ roleId: role.id, payload });
        toast.success("Role updated", `"${payload.name}" was saved successfully.`);
      } else {
        const created = await createRole.mutateAsync(payload);
        toast.success("Role created", `"${payload.name}" is ready for permissions.`);
        if (created?.id) onCreated?.(created.id);
      }
      onClose();
    } catch (error) {
      toast.error(
        isEdit ? "Failed to update role" : "Failed to create role",
        getApiErrorMessage(error, "Please try again.")
      );
    }
  });

  const isBusy = createRole.isPending || updateRole.isPending;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? "Edit Role" : "Create Role"} size="md">
      <form onSubmit={onSubmit} className="space-y-5">
        <Input
          label="Role Name"
          placeholder="e.g. Triage Nurse"
          error={errors.name?.message}
          {...register("name")}
        />
        <Input
          label="Role Code"
          placeholder="e.g. TRIAGE_NURSE"
          hint="Stored uppercase — used as the stable identifier."
          className="data-mono uppercase"
          error={errors.code?.message}
          {...register("code")}
        />
        <Textarea
          label="Description"
          placeholder="What can members of this role do?"
          rows={3}
          error={errors.description?.message}
          {...register("description")}
        />
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={isBusy}>
            Cancel
          </Button>
          <Button type="submit" size="sm" isLoading={isBusy} leftIcon={<Save className="h-4 w-4" />}>
            {isEdit ? "Save Changes" : "Create Role"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// =====================================================================
// Roles list (left column)
// =====================================================================

function RoleListCard({
  role,
  isSelected,
  onSelect,
}: {
  role: RoleListItem;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "glass-card w-full p-5 text-left transition-all duration-200",
        isSelected
          ? "border-primary-500/60 ring-2 ring-primary-500/40 shadow-glow-sm"
          : "hover:border-primary-500/30"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-display text-base font-bold text-secondary-900 dark:text-secondary-100">
            {role.name}
          </p>
          <p className="data-mono mt-0.5 text-[11px] uppercase tracking-wider text-secondary-400 dark:text-secondary-500">
            {role.code}
          </p>
        </div>
        {isSystemRole(role) ? <Badge variant="soft-info">System</Badge> : null}
      </div>
      {role.description ? (
        <p className="mt-2 line-clamp-2 text-xs font-medium text-secondary-500 dark:text-secondary-400">
          {role.description}
        </p>
      ) : null}
      <div className="mt-4 flex items-center gap-4 border-t border-secondary-100 pt-3 text-xs font-semibold text-secondary-500 dark:border-white/5 dark:text-secondary-400">
        <span className="inline-flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-primary-500" aria-hidden />
          {role.user_count} member{role.user_count === 1 ? "" : "s"}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <KeyRound className="h-3.5 w-3.5 text-primary-500" aria-hidden />
          {role.permission_count} permission{role.permission_count === 1 ? "" : "s"}
        </span>
      </div>
    </button>
  );
}

// =====================================================================
// Permission matrix (right column)
// =====================================================================

function PermissionModuleGroup({
  group,
  checkedIds,
  onToggle,
  onToggleAll,
}: {
  group: PermissionGroup;
  checkedIds: Set<number>;
  onToggle: (permissionId: number) => void;
  onToggleAll: (permissionIds: number[], check: boolean) => void;
}) {
  const ids = group.permissions.map((p) => p.id);
  const checkedCount = ids.filter((id) => checkedIds.has(id)).length;
  const allChecked = checkedCount === ids.length && ids.length > 0;

  return (
    <div className="rounded-2xl border border-secondary-100 p-4 dark:border-white/10">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black uppercase tracking-widest text-secondary-500 dark:text-secondary-400">
            {group.module}
          </span>
          <Badge variant={checkedCount > 0 ? "soft-success" : "secondary"}>
            {checkedCount}/{ids.length}
          </Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={() => onToggleAll(ids, !allChecked)}>
          {allChecked ? "Clear all" : "Select all"}
        </Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {group.permissions.map((permission) => {
          const checked = checkedIds.has(permission.id);
          return (
            <label
              key={permission.id}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors",
                checked
                  ? "border-primary-500/40 bg-primary-500/5"
                  : "border-secondary-100 hover:border-primary-500/20 dark:border-white/10"
              )}
              title={permission.description ?? undefined}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(permission.id)}
                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded accent-primary-500"
              />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-secondary-900 dark:text-secondary-100">
                  {permission.name}
                </span>
                <span className="data-mono block truncate text-[10px] uppercase tracking-wider text-secondary-400 dark:text-secondary-500">
                  {permission.code}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function RoleDetailPanel({ roleId, onDeleted }: { roleId: number; onDeleted: () => void }) {
  const toast = useToast();
  const roleQuery = useRole(roleId);
  const catalogQuery = usePermissionCatalog();
  const savePermissions = useSaveRolePermissions();
  const deleteRole = useDeleteRole();
  const editModal = useDisclosure();
  const deleteDialog = useDisclosure();

  const role = roleQuery.data;
  const originalIds = React.useMemo(
    () => new Set((role?.permissions ?? []).map((p) => p.id)),
    [role]
  );
  const [checkedIds, setCheckedIds] = React.useState<Set<number>>(new Set());

  // Re-seed the checkbox state whenever a (re)fetched role arrives.
  React.useEffect(() => {
    setCheckedIds(new Set(originalIds));
  }, [originalIds]);

  const toggle = (permissionId: number) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(permissionId)) next.delete(permissionId);
      else next.add(permissionId);
      return next;
    });
  };

  const toggleAll = (permissionIds: number[], check: boolean) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      for (const id of permissionIds) {
        if (check) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  };

  const toAssign = [...checkedIds].filter((id) => !originalIds.has(id));
  const toRevoke = [...originalIds].filter((id) => !checkedIds.has(id));
  const isDirty = toAssign.length > 0 || toRevoke.length > 0;

  const handleSave = async () => {
    try {
      await savePermissions.mutateAsync({ roleId, toAssign, toRevoke });
      toast.success(
        "Permissions saved",
        `${toAssign.length} assigned, ${toRevoke.length} revoked.`
      );
    } catch (error) {
      toast.error("Failed to save permissions", getApiErrorMessage(error, "Please try again."));
    }
  };

  const handleDelete = async () => {
    try {
      await deleteRole.mutateAsync(roleId);
      toast.success("Role deleted", role ? `"${role.name}" has been removed.` : undefined);
      onDeleted();
    } catch (error) {
      toast.error("Failed to delete role", getApiErrorMessage(error, "Please try again."));
      throw error;
    }
  };

  if (roleQuery.isLoading) {
    return (
      <Card className="space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </Card>
    );
  }

  if (roleQuery.isError || !role) {
    return (
      <Card>
        <EmptyState
          icon={Shield}
          title="Unable to load role"
          description={getApiErrorMessage(
            roleQuery.error,
            "The role details could not be fetched."
          )}
          action={
            <Button variant="secondary" size="sm" onClick={() => roleQuery.refetch()}>
              Retry
            </Button>
          }
        />
      </Card>
    );
  }

  const systemRole = isSystemRole(role);

  return (
    <Card>
      <CardHeader
        title={
          <span className="inline-flex items-center gap-3">
            {role.name}
            {systemRole ? <Badge variant="soft-info">System</Badge> : null}
          </span>
        }
        description={
          <span>
            <span className="data-mono text-xs uppercase tracking-wider">{role.code}</span>
            {role.description ? <span> — {role.description}</span> : null}
          </span>
        }
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Pencil className="h-4 w-4" />}
              onClick={editModal.open}
            >
              Edit
            </Button>
            <Button
              variant="danger"
              size="sm"
              leftIcon={<Trash2 className="h-4 w-4" />}
              onClick={deleteDialog.open}
              disabled={systemRole}
              title={systemRole ? "System roles cannot be deleted." : undefined}
            >
              Delete
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary-500" aria-hidden />
          <span className="text-sm font-semibold text-secondary-600 dark:text-secondary-400">
            {checkedIds.size} permission{checkedIds.size === 1 ? "" : "s"} selected
          </span>
          {isDirty ? <Badge variant="soft-warning">Unsaved changes</Badge> : null}
        </div>
        <Button
          size="sm"
          leftIcon={<Save className="h-4 w-4" />}
          onClick={handleSave}
          disabled={!isDirty}
          isLoading={savePermissions.isPending}
        >
          Save Permissions
        </Button>
      </div>

      {catalogQuery.isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-36 w-full" />
        </div>
      ) : catalogQuery.isError ? (
        <EmptyState
          icon={KeyRound}
          title="Unable to load permissions"
          description={getApiErrorMessage(
            catalogQuery.error,
            "The permission catalog could not be fetched."
          )}
          action={
            <Button variant="secondary" size="sm" onClick={() => catalogQuery.refetch()}>
              Retry
            </Button>
          }
        />
      ) : (catalogQuery.data?.groups.length ?? 0) === 0 ? (
        <EmptyState
          icon={KeyRound}
          title="No permissions defined"
          description="Seed the permission catalog on the backend to start assigning access."
        />
      ) : (
        <div className="space-y-4">
          {catalogQuery.data?.groups.map((group) => (
            <PermissionModuleGroup
              key={group.module}
              group={group}
              checkedIds={checkedIds}
              onToggle={toggle}
              onToggleAll={toggleAll}
            />
          ))}
        </div>
      )}

      <RoleFormModal isOpen={editModal.isOpen} onClose={editModal.close} role={role} />

      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={deleteDialog.close}
        onConfirm={handleDelete}
        title="Delete Role"
        description={`This will remove the "${role.name}" role. Roles that are still assigned to users cannot be deleted.`}
        confirmLabel="Delete Role"
        tone="danger"
      />
    </Card>
  );
}

// =====================================================================
// Page
// =====================================================================

export function RolesPage() {
  const [selectedRoleId, setSelectedRoleId] = React.useState<number | null>(null);
  const rolesQuery = useRoles({ skip: 0, limit: 100 });
  const createModal = useDisclosure();

  const roles = rolesQuery.data?.items ?? [];

  // Auto-select the first role once the list arrives.
  React.useEffect(() => {
    if (selectedRoleId == null && roles.length > 0) {
      setSelectedRoleId(roles[0].id);
    }
  }, [roles, selectedRoleId]);

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Roles & Permissions"
        description="Define access roles and fine-tune what each role can see and do."
        actions={
          <Button leftIcon={<Plus className="h-4 w-4" />} onClick={createModal.open}>
            New Role
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left — roles list */}
        <div className="space-y-4 lg:col-span-1">
          {rolesQuery.isLoading ? (
            <>
              <Skeleton className="h-36 w-full rounded-[2rem]" />
              <Skeleton className="h-36 w-full rounded-[2rem]" />
              <Skeleton className="h-36 w-full rounded-[2rem]" />
            </>
          ) : rolesQuery.isError ? (
            <Card>
              <EmptyState
                icon={Shield}
                title="Unable to load roles"
                description={getApiErrorMessage(
                  rolesQuery.error,
                  "The roles list could not be fetched."
                )}
                action={
                  <Button variant="secondary" size="sm" onClick={() => rolesQuery.refetch()}>
                    Retry
                  </Button>
                }
              />
            </Card>
          ) : roles.length === 0 ? (
            <Card>
              <EmptyState
                icon={Shield}
                title="No roles yet"
                description="Create your first role to start granting access."
                action={
                  <Button
                    size="sm"
                    leftIcon={<Plus className="h-4 w-4" />}
                    onClick={createModal.open}
                  >
                    New Role
                  </Button>
                }
              />
            </Card>
          ) : (
            roles.map((role) => (
              <RoleListCard
                key={role.id}
                role={role}
                isSelected={role.id === selectedRoleId}
                onSelect={() => setSelectedRoleId(role.id)}
              />
            ))
          )}
        </div>

        {/* Right — selected role detail + permission matrix */}
        <div className="lg:col-span-2">
          {selectedRoleId != null ? (
            <RoleDetailPanel roleId={selectedRoleId} onDeleted={() => setSelectedRoleId(null)} />
          ) : !rolesQuery.isLoading ? (
            <Card>
              <EmptyState
                icon={ShieldCheck}
                title="Select a role"
                description="Pick a role on the left to review and edit its permission matrix."
              />
            </Card>
          ) : (
            <Skeleton className="h-96 w-full rounded-[2rem]" />
          )}
        </div>
      </div>

      <RoleFormModal
        isOpen={createModal.isOpen}
        onClose={createModal.close}
        onCreated={(roleId) => setSelectedRoleId(roleId)}
      />
    </div>
  );
}

export default RolesPage;
