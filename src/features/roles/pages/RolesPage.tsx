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

import {
  DxPage,
  DxPageHeader,
  DxPanel,
  DxBadge,
  DxButton,
  DxInput,
  DxTextarea,
  DxCheckbox,
  DxPopup,
  DxMessage,
} from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import { useDisclosure } from "@/hooks/useDisclosure";

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
// Shared empty / error block
// =====================================================================

function EmptyBlock({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ElementType;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="py-14 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-[var(--dx-surface-sunken)]">
        <Icon className="h-8 w-8 text-[var(--dx-text-faint)]" />
      </div>
      <h4 className="text-[16px] font-bold text-[var(--dx-text)]">{title}</h4>
      {description ? (
        <p className="mx-auto mt-1 max-w-sm text-[13px] text-[var(--dx-text-muted)]">{description}</p>
      ) : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

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
    <DxPopup
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? "Edit Role" : "Create Role"}
      size="md"
      locked={isBusy}
      footer={
        <>
          <DxButton type="button" onClick={onClose} disabled={isBusy}>
            Cancel
          </DxButton>
          <DxButton type="submit" variant="primary" isLoading={isBusy} leftIcon={<Save className="h-4 w-4" />} onClick={onSubmit}>
            {isEdit ? "Save Changes" : "Create Role"}
          </DxButton>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <DxInput
          label="Role Name"
          placeholder="e.g. Triage Nurse"
          error={errors.name?.message}
          {...register("name")}
        />
        <DxInput
          label="Role Code"
          mono
          placeholder="e.g. TRIAGE_NURSE"
          hint="Stored uppercase — used as the stable identifier."
          error={errors.code?.message}
          {...register("code")}
        />
        <DxTextarea
          label="Description"
          placeholder="What can members of this role do?"
          rows={3}
          error={errors.description?.message}
          {...register("description")}
        />
      </form>
    </DxPopup>
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
      className="w-full rounded-lg border bg-[var(--dx-surface)] p-5 text-left transition-colors"
      style={{
        borderColor: isSelected ? "var(--dx-accent)" : "var(--dx-border)",
        boxShadow: isSelected ? "inset 0 0 0 1px var(--dx-accent)" : undefined,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-bold text-[var(--dx-text)]">{role.name}</p>
          <p className="dx-mono mt-0.5 text-[11px] uppercase tracking-wider text-[var(--dx-text-muted)]">
            {role.code}
          </p>
        </div>
        {isSystemRole(role) ? <DxBadge tone="info">System</DxBadge> : null}
      </div>
      {role.description ? (
        <p className="mt-2 line-clamp-2 text-[12px] font-medium text-[var(--dx-text-muted)]">
          {role.description}
        </p>
      ) : null}
      <div className="mt-4 flex items-center gap-4 border-t border-[var(--dx-border)] pt-3 text-[12px] font-semibold text-[var(--dx-text-muted)]">
        <span className="inline-flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-[var(--dx-accent)]" aria-hidden />
          {role.user_count} member{role.user_count === 1 ? "" : "s"}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <KeyRound className="h-3.5 w-3.5 text-[var(--dx-accent)]" aria-hidden />
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
    <div className="rounded-lg border border-[var(--dx-border)] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-semibold uppercase tracking-widest text-[var(--dx-text-muted)]">
            {group.module}
          </span>
          <DxBadge tone={checkedCount > 0 ? "success" : "neutral"}>
            {checkedCount}/{ids.length}
          </DxBadge>
        </div>
        <DxButton variant="text" size="sm" onClick={() => onToggleAll(ids, !allChecked)}>
          {allChecked ? "Clear all" : "Select all"}
        </DxButton>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {group.permissions.map((permission) => {
          const checked = checkedIds.has(permission.id);
          return (
            <div
              key={permission.id}
              className="min-w-0 overflow-hidden rounded-md border px-3 py-2.5 transition-colors"
              style={{
                borderColor: checked ? "var(--dx-accent)" : "var(--dx-border)",
                background: checked ? "var(--dx-accent-soft)" : undefined,
              }}
              title={permission.description ?? permission.name}
            >
              <DxCheckbox
                className="!flex w-full min-w-0 items-start"
                checked={checked}
                onChange={() => onToggle(permission.id)}
                label={<span className="block truncate text-[13px] font-semibold text-[var(--dx-text)]">{permission.name}</span>}
                description={
                  <span className="dx-mono block truncate text-[10px] uppercase tracking-wider text-[var(--dx-text-muted)]">
                    {permission.code}
                  </span>
                }
              />
            </div>
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
      <DxPanel>
        <div className="space-y-4">
          <div className="dx-skeleton h-8 w-1/3" />
          <div className="dx-skeleton h-4 w-2/3" />
          <div className="dx-skeleton h-40 w-full" />
          <div className="dx-skeleton h-40 w-full" />
        </div>
      </DxPanel>
    );
  }

  if (roleQuery.isError || !role) {
    return (
      <DxPanel>
        <EmptyBlock
          icon={Shield}
          title="Unable to load role"
          description={getApiErrorMessage(roleQuery.error, "The role details could not be fetched.")}
          action={
            <DxButton size="sm" onClick={() => roleQuery.refetch()}>
              Retry
            </DxButton>
          }
        />
      </DxPanel>
    );
  }

  const systemRole = isSystemRole(role);

  return (
    <DxPanel
      title={
        <span className="inline-flex items-center gap-3">
          {role.name}
          {systemRole ? <DxBadge tone="info">System</DxBadge> : null}
        </span>
      }
      description={
        <span>
          <span className="dx-mono text-[12px] uppercase tracking-wider">{role.code}</span>
          {role.description ? <span> — {role.description}</span> : null}
        </span>
      }
      actions={
        <>
          <DxButton size="sm" leftIcon={<Pencil className="h-4 w-4" />} onClick={editModal.open}>
            Edit
          </DxButton>
          <DxButton
            variant="danger"
            size="sm"
            leftIcon={<Trash2 className="h-4 w-4" />}
            onClick={deleteDialog.open}
            disabled={systemRole}
            title={systemRole ? "System roles cannot be deleted." : undefined}
          >
            Delete
          </DxButton>
        </>
      }
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-[var(--dx-accent)]" aria-hidden />
          <span className="text-[13px] font-semibold text-[var(--dx-text-muted)]">
            {checkedIds.size} permission{checkedIds.size === 1 ? "" : "s"} selected
          </span>
          {isDirty ? <DxBadge tone="warning" dot>Unsaved changes</DxBadge> : null}
        </div>
        <DxButton
          variant="primary"
          size="sm"
          leftIcon={<Save className="h-4 w-4" />}
          onClick={handleSave}
          disabled={!isDirty}
          isLoading={savePermissions.isPending}
        >
          Save Permissions
        </DxButton>
      </div>

      {catalogQuery.isLoading ? (
        <div className="space-y-4">
          <div className="dx-skeleton h-36 w-full" />
          <div className="dx-skeleton h-36 w-full" />
          <div className="dx-skeleton h-36 w-full" />
        </div>
      ) : catalogQuery.isError ? (
        <EmptyBlock
          icon={KeyRound}
          title="Unable to load permissions"
          description={getApiErrorMessage(catalogQuery.error, "The permission catalog could not be fetched.")}
          action={
            <DxButton size="sm" onClick={() => catalogQuery.refetch()}>
              Retry
            </DxButton>
          }
        />
      ) : (catalogQuery.data?.groups.length ?? 0) === 0 ? (
        <EmptyBlock
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

      {/* Delete confirm */}
      <DxPopup
        isOpen={deleteDialog.isOpen}
        onClose={deleteDialog.close}
        title="Delete Role"
        size="sm"
        locked={deleteRole.isPending}
        footer={
          <>
            <DxButton onClick={deleteDialog.close} disabled={deleteRole.isPending}>
              Cancel
            </DxButton>
            <DxButton
              variant="danger"
              isLoading={deleteRole.isPending}
              leftIcon={<Trash2 className="h-4 w-4" />}
              onClick={async () => {
                try {
                  await handleDelete();
                  deleteDialog.close();
                } catch {
                  /* toast already surfaced the error */
                }
              }}
            >
              Delete Role
            </DxButton>
          </>
        }
      >
        <DxMessage tone="danger">
          This will remove the "{role.name}" role. Roles that are still assigned to users cannot be
          deleted.
        </DxMessage>
      </DxPopup>
    </DxPanel>
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
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Administration" }, { label: "Roles & Permissions" }]}
        title="Roles & Permissions"
        subtitle="Define access roles and fine-tune what each role can see and do."
        actions={
          <DxButton variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={createModal.open}>
            New role
          </DxButton>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left — roles list */}
        <div className="space-y-4 lg:col-span-1">
          {rolesQuery.isLoading ? (
            <>
              <div className="dx-skeleton h-36 w-full" />
              <div className="dx-skeleton h-36 w-full" />
              <div className="dx-skeleton h-36 w-full" />
            </>
          ) : rolesQuery.isError ? (
            <DxPanel>
              <EmptyBlock
                icon={Shield}
                title="Unable to load roles"
                description={getApiErrorMessage(rolesQuery.error, "The roles list could not be fetched.")}
                action={
                  <DxButton size="sm" onClick={() => rolesQuery.refetch()}>
                    Retry
                  </DxButton>
                }
              />
            </DxPanel>
          ) : roles.length === 0 ? (
            <DxPanel>
              <EmptyBlock
                icon={Shield}
                title="No roles yet"
                description="Create your first role to start granting access."
                action={
                  <DxButton size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={createModal.open}>
                    New Role
                  </DxButton>
                }
              />
            </DxPanel>
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
            <DxPanel>
              <EmptyBlock
                icon={ShieldCheck}
                title="Select a role"
                description="Pick a role on the left to review and edit its permission matrix."
              />
            </DxPanel>
          ) : (
            <div className="dx-skeleton h-96 w-full" />
          )}
        </div>
      </div>

      <RoleFormModal
        isOpen={createModal.isOpen}
        onClose={createModal.close}
        onCreated={(roleId) => setSelectedRoleId(roleId)}
      />
    </DxPage>
  );
}

export default RolesPage;
