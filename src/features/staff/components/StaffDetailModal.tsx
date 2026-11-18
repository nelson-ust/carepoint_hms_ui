import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  AlertCircle,
  KeyRound,
  Laptop,
  Power,
  PowerOff,
  RotateCcw,
  Save,
  ShieldCheck,
  ShieldOff,
} from "lucide-react";
import {
  DxPopup, DxButton, DxInput, DxSelect, DxBadge, DxTabs,
  type DxBadgeTone,
} from "@/components/dx";
import { FormField } from "@/components/forms/FormField";
import { useToast } from "@/components/feedback/ToastProvider";
import { groupPermissionsByModule } from "@/features/roles/api/roles.api";
import {
  adminUserDisplayName,
  adminUserInitials,
  generateStrongPassword,
  getStaffAdminErrorMessage,
  relativeTime,
} from "../api/staff-admin.api";
import type { AdminUser, UserSession, UserUpdatePayload } from "../api/staff-admin.api";
import {
  useActivateUser,
  useDeactivateUser,
  useDepartmentOptions,
  useResetUserPassword,
  useRevokeUserSessions,
  useRoleOptions,
  useSaveUserRoles,
  useServicePointOptions,
  useStaffUser,
  useToggleUserMfa,
  useUpdateStaffUser,
  useUserAccessSummary,
  useUserSessions,
} from "../hooks/use-staff-admin";
import { CheckboxRow, CopyField } from "./OnboardStaffModal";

type DetailTab = "profile" | "access" | "security" | "danger";

const TABS: { id: DetailTab; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "access", label: "Access" },
  { id: "security", label: "Security" },
  { id: "danger", label: "Danger Zone" },
];

function statusTone(status?: string | null): DxBadgeTone {
  switch ((status ?? "").toUpperCase()) {
    case "ACTIVE": return "success";
    case "SUSPENDED": return "warning";
    case "LOCKED": return "danger";
    case "PENDING": return "info";
    default: return "neutral";
  }
}

/** Shared confirmation popup (replaces the legacy ConfirmDialog). */
function ConfirmPopup({
  isOpen, onClose, onConfirm, title, description, confirmLabel, tone = "primary", isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description?: string;
  confirmLabel: string;
  tone?: "primary" | "danger";
  isLoading?: boolean;
}) {
  return (
    <DxPopup
      isOpen={isOpen} onClose={onClose} title={title} size="sm" locked={isLoading}
      footer={
        <>
          <DxButton onClick={onClose} disabled={isLoading}>Cancel</DxButton>
          <DxButton variant={tone === "danger" ? "danger" : "primary"} isLoading={isLoading} onClick={async () => { await onConfirm(); onClose(); }}>{confirmLabel}</DxButton>
        </>
      }
    >
      {description ? <p className="text-[13px] text-[var(--dx-text-muted)]">{description}</p> : null}
    </DxPopup>
  );
}

// ============================================================
// Profile tab — editable form → PUT /staff-profiles/users/{id}
// ============================================================

const profileSchema = z.object({
  first_name: z.string().trim().min(1, "First name is required").max(100),
  last_name: z.string().trim().min(1, "Last name is required").max(100),
  middle_name: z.string().trim().max(100).optional(),
  username: z.string().trim().min(3, "At least 3 characters").max(100),
  email: z.string().trim().email("Enter a valid email address"),
  phone_number: z.string().trim().max(30).optional(),
  staff_no: z.string().trim().min(2, "Min 2 characters").max(100).optional().or(z.literal("")),
  job_title: z.string().trim().max(150).optional(),
  specialty: z.string().trim().max(150).optional(),
  professional_license_no: z.string().trim().max(100).optional(),
  department_id: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

function ProfileTab({ user }: { user: AdminUser }) {
  const toast = useToast();
  const updateUser = useUpdateStaffUser();
  const departmentsQuery = useDepartmentOptions();
  const sdpsQuery = useServicePointOptions();
  const [sdpIds, setSdpIds] = React.useState<number[]>(
    user.staff_profile?.service_delivery_point_ids ?? [],
  );

  React.useEffect(() => {
    setSdpIds(user.staff_profile?.service_delivery_point_ids ?? []);
  }, [user]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.input<typeof profileSchema>, unknown, ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    values: {
      first_name: user.first_name ?? "",
      last_name: user.last_name ?? "",
      middle_name: user.middle_name ?? "",
      username: user.username ?? "",
      email: user.email ?? "",
      phone_number: user.phone_number ?? "",
      staff_no: user.staff_profile?.staff_no ?? "",
      job_title: user.staff_profile?.job_title ?? "",
      specialty: user.staff_profile?.specialty ?? "",
      professional_license_no: user.staff_profile?.professional_license_no ?? "",
      department_id: user.staff_profile?.department_id
        ? String(user.staff_profile.department_id)
        : "",
    },
  });

  const onSubmit = (values: ProfileFormValues) => {
    const payload: UserUpdatePayload = {
      first_name: values.first_name,
      last_name: values.last_name,
      middle_name: values.middle_name?.trim() || null,
      username: values.username,
      email: values.email,
      phone_number: values.phone_number?.trim() || null,
    };
    if (user.staff_profile) {
      payload.staff_profile = {
        staff_no: values.staff_no?.trim() || undefined,
        job_title: values.job_title?.trim() || undefined,
        specialty: values.specialty?.trim() || undefined,
        professional_license_no: values.professional_license_no?.trim() || undefined,
        department_id: values.department_id ? Number(values.department_id) : undefined,
        service_delivery_point_ids: sdpIds,
      };
    }
    updateUser.mutate(
      { userId: user.id, payload },
      {
        onSuccess: () => toast.success("Profile updated", "Staff details saved successfully."),
        onError: (error) =>
          toast.error("Update failed", getStaffAdminErrorMessage(error, "Unable to save profile changes.")),
      },
    );
  };

  const departmentOptions = (departmentsQuery.data ?? []).map((d) => ({
    value: String(d.id),
    label: `${d.name} (${d.code})`,
  }));

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      <div className="grid gap-4 sm:grid-cols-3">
        <DxInput label="First Name" error={errors.first_name?.message} {...register("first_name")} />
        <DxInput label="Middle Name" error={errors.middle_name?.message} {...register("middle_name")} />
        <DxInput label="Last Name" error={errors.last_name?.message} {...register("last_name")} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <DxInput label="Username" error={errors.username?.message} {...register("username")} />
        <DxInput label="Email" type="email" error={errors.email?.message} {...register("email")} />
        <DxInput label="Phone Number" error={errors.phone_number?.message} {...register("phone_number")} />
      </div>
      {user.staff_profile ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <DxInput label="Staff Number" error={errors.staff_no?.message} {...register("staff_no")} />
            <DxInput label="Job Title" error={errors.job_title?.message} {...register("job_title")} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <DxInput label="Specialty" error={errors.specialty?.message} {...register("specialty")} />
            <DxInput label="License No" error={errors.professional_license_no?.message} {...register("professional_license_no")} />
            <DxSelect
              label="Department"
              placeholder={departmentsQuery.isLoading ? "Loading…" : "Select department"}
              options={departmentOptions}
              error={errors.department_id?.message}
              {...register("department_id")}
            />
          </div>
          <FormField label="Service Delivery Points">
            {sdpsQuery.isLoading ? (
              <div className="dx-skeleton h-20 w-full" />
            ) : (sdpsQuery.data ?? []).length === 0 ? (
              <p className="text-[12px] font-medium text-[var(--dx-text-muted)]">No service delivery points available.</p>
            ) : (
              <div className="grid max-h-40 gap-1 overflow-y-auto rounded-md border border-[var(--dx-border)] p-2 sm:grid-cols-2">
                {(sdpsQuery.data ?? []).map((sdp) => (
                  <CheckboxRow
                    key={sdp.id}
                    checked={sdpIds.includes(sdp.id)}
                    onToggle={() =>
                      setSdpIds((current) =>
                        current.includes(sdp.id) ? current.filter((v) => v !== sdp.id) : [...current, sdp.id],
                      )
                    }
                    label={sdp.name}
                    sublabel={sdp.code}
                  />
                ))}
              </div>
            )}
          </FormField>
        </>
      ) : (
        <p className="text-[12px] font-medium text-[var(--dx-text-muted)]">
          No staff profile is linked to this account, so employment fields are unavailable.
        </p>
      )}
      <div className="flex justify-end">
        <DxButton type="submit" variant="primary" leftIcon={<Save className="h-4 w-4" />} isLoading={updateUser.isPending}>Save changes</DxButton>
      </div>
    </form>
  );
}

// ============================================================
// Access tab
// ============================================================

function AccessTab({ user, active }: { user: AdminUser; active: boolean }) {
  const toast = useToast();
  const rolesQuery = useRoleOptions();
  const accessQuery = useUserAccessSummary(user.id, active);
  const saveRoles = useSaveUserRoles();

  const currentRoleIds = React.useMemo(() => user.roles.map((r) => r.id), [user.roles]);
  const [selected, setSelected] = React.useState<number[]>(currentRoleIds);

  React.useEffect(() => {
    setSelected(currentRoleIds);
  }, [currentRoleIds]);

  const dirty =
    selected.length !== currentRoleIds.length ||
    selected.some((id) => !currentRoleIds.includes(id));

  const handleSave = () => {
    saveRoles.mutate(
      { userId: user.id, roleIds: selected, currentRoleIds },
      {
        onSuccess: () => toast.success("Roles updated", "The user's role assignments were replaced."),
        onError: (error) =>
          toast.error("Role update failed", getStaffAdminErrorMessage(error, "Unable to update role assignments.")),
      },
    );
  };

  const groups = React.useMemo(
    () => groupPermissionsByModule(accessQuery.data?.permissions ?? []),
    [accessQuery.data?.permissions],
  );

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h4 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--dx-text-muted)]">Assigned Roles</h4>
          <DxButton variant="primary" size="sm" onClick={handleSave} disabled={!dirty} isLoading={saveRoles.isPending} leftIcon={<Save className="h-3.5 w-3.5" />}>Save roles</DxButton>
        </div>
        {rolesQuery.isLoading ? (
          <div className="dx-skeleton h-24 w-full" />
        ) : (
          <div className="grid max-h-48 gap-1 overflow-y-auto rounded-md border border-[var(--dx-border)] p-2 sm:grid-cols-2">
            {(rolesQuery.data ?? []).map((role) => (
              <CheckboxRow
                key={role.id}
                checked={selected.includes(role.id)}
                onToggle={() =>
                  setSelected((current) =>
                    current.includes(role.id) ? current.filter((v) => v !== role.id) : [...current, role.id],
                  )
                }
                label={role.name}
                sublabel={role.code}
              />
            ))}
          </div>
        )}
        {selected.length === 0 ? (
          <p className="mt-2 text-[12px] font-semibold" style={{ color: "var(--dx-warning)" }}>Saving with no roles removes all of this user's role assignments.</p>
        ) : null}
      </section>

      <section>
        <h4 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--dx-text-muted)]">Effective Permissions</h4>
        {accessQuery.isLoading ? (
          <div className="space-y-3"><div className="dx-skeleton h-6 w-48" /><div className="dx-skeleton h-16 w-full" /></div>
        ) : accessQuery.isError ? (
          <p className="text-[12px] font-semibold" style={{ color: "var(--dx-danger)" }}>Could not load the access summary.</p>
        ) : groups.length === 0 ? (
          <p className="text-[12px] font-medium text-[var(--dx-text-muted)]">This user has no effective permissions.</p>
        ) : (
          <div className="space-y-4">
            {groups.map((group) => (
              <div key={group.module}>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[var(--dx-text-muted)]">{group.module}</p>
                <div className="flex flex-wrap gap-2">
                  {group.permissions.map((permission) => (
                    <DxBadge key={permission.id} tone="info" title={permission.description ?? undefined}>{permission.name}</DxBadge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ============================================================
// Security tab
// ============================================================

function sessionIsActive(session: UserSession): boolean {
  if (session.revoked_at) return false;
  if (session.expires_at && new Date(session.expires_at).getTime() < Date.now()) return false;
  return true;
}

function SecurityTab({ user, active }: { user: AdminUser; active: boolean }) {
  const toast = useToast();
  const sessionsQuery = useUserSessions(user.id, active);
  const resetPassword = useResetUserPassword();
  const toggleMfa = useToggleUserMfa();
  const revokeSessions = useRevokeUserSessions();

  const [confirmReset, setConfirmReset] = React.useState(false);
  const [confirmRevokeAll, setConfirmRevokeAll] = React.useState(false);
  const [tempPassword, setTempPassword] = React.useState<string | null>(null);

  const handleReset = async () => {
    const password = generateStrongPassword();
    try {
      await resetPassword.mutateAsync({
        userId: user.id,
        payload: { new_password: password, force_password_change_on_next_login: true },
      });
      setTempPassword(password);
      toast.success("Password reset", "All active sessions were revoked. Share the temporary password securely.");
    } catch (error) {
      toast.error("Password reset failed", getStaffAdminErrorMessage(error, "Unable to reset the password."));
    }
  };

  const handleToggleMfa = () => {
    toggleMfa.mutate(
      { userId: user.id, enabled: !user.is_two_factor_enabled },
      {
        onSuccess: (updated) =>
          toast.success(
            updated.is_two_factor_enabled ? "MFA enabled" : "MFA disabled",
            `Multi-factor authentication is now ${updated.is_two_factor_enabled ? "required" : "off"} for ${adminUserDisplayName(updated)}.`,
          ),
        onError: (error) => toast.error("MFA update failed", getStaffAdminErrorMessage(error, "Unable to update MFA.")),
      },
    );
  };

  const revoke = (sessionIds: number[]) => {
    revokeSessions.mutate(
      { userId: user.id, sessionIds },
      {
        onSuccess: (result) => toast.success("Sessions revoked", result.message),
        onError: (error) => toast.error("Revoke failed", getStaffAdminErrorMessage(error, "Unable to revoke sessions.")),
      },
    );
  };

  const sessions = sessionsQuery.data ?? [];
  const activeSessions = sessions.filter(sessionIsActive);

  return (
    <div className="space-y-8">
      {/* ---- Password ---- */}
      <section className="rounded-md border border-[var(--dx-border)] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-[var(--dx-text)]">Reset Password</p>
            <p className="mt-1 text-[12px] font-medium text-[var(--dx-text-muted)]">Generates a strong temporary password, revokes all active sessions, and forces a change at next login.</p>
            {user.password_changed_at ? <p className="mt-1 text-[12px] text-[var(--dx-text-muted)]">Last changed {relativeTime(user.password_changed_at)}.</p> : null}
          </div>
          <DxButton size="sm" leftIcon={<KeyRound className="h-4 w-4" />} onClick={() => setConfirmReset(true)} isLoading={resetPassword.isPending}>Reset password</DxButton>
        </div>
        {tempPassword ? <div className="mt-4"><CopyField label="Temporary password (shown once)" value={tempPassword} /></div> : null}
      </section>

      {/* ---- MFA ---- */}
      <section className="rounded-md border border-[var(--dx-border)] p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            {user.is_two_factor_enabled ? (
              <ShieldCheck className="h-5 w-5 shrink-0" style={{ color: "var(--dx-success)" }} aria-hidden />
            ) : (
              <ShieldOff className="h-5 w-5 shrink-0 text-[var(--dx-text-muted)]" aria-hidden />
            )}
            <div className="min-w-0">
              <p className="text-[14px] font-semibold text-[var(--dx-text)]">Multi-Factor Authentication</p>
              <p className="mt-0.5 text-[12px] font-medium text-[var(--dx-text-muted)]">
                {user.is_two_factor_enabled ? "MFA is currently required for this account." : "MFA is currently disabled for this account."}
              </p>
            </div>
          </div>
          <DxButton variant={user.is_two_factor_enabled ? "default" : "primary"} size="sm" onClick={handleToggleMfa} isLoading={toggleMfa.isPending}>
            {user.is_two_factor_enabled ? "Disable MFA" : "Enable MFA"}
          </DxButton>
        </div>
      </section>

      {/* ---- Sessions ---- */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h4 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--dx-text-muted)]">Sessions & Login History</h4>
          <DxButton variant="danger" size="sm" onClick={() => setConfirmRevokeAll(true)} disabled={activeSessions.length === 0} isLoading={revokeSessions.isPending}>Revoke all active</DxButton>
        </div>
        {sessionsQuery.isLoading ? (
          <div className="space-y-2"><div className="dx-skeleton h-14 w-full" /><div className="dx-skeleton h-14 w-full" /></div>
        ) : sessionsQuery.isError ? (
          <div className="flex items-center gap-2 text-[12px] font-semibold" style={{ color: "var(--dx-danger)" }}>
            <AlertCircle className="h-4 w-4" /> Could not load sessions.
            <DxButton variant="text" size="sm" onClick={() => sessionsQuery.refetch()} leftIcon={<RotateCcw className="h-3.5 w-3.5" />}>Retry</DxButton>
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-[12px] font-medium text-[var(--dx-text-muted)]">No sessions recorded.</p>
        ) : (
          <ul className="space-y-2">
            {sessions.map((session) => {
              const isActive = sessionIsActive(session);
              return (
                <li key={session.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[var(--dx-border)] px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Laptop className="h-4 w-4 shrink-0 text-[var(--dx-text-muted)]" aria-hidden />
                    <div className="min-w-0">
                      <p className="flex items-center truncate text-[13px] font-semibold text-[var(--dx-text)]">
                        <span className="dx-mono text-[12px]">{session.ip_address ?? "Unknown IP"}</span>
                        {session.is_current ? <DxBadge tone="info" className="ml-2">Current</DxBadge> : null}
                      </p>
                      <p className="mt-0.5 max-w-md truncate text-[12px] font-medium text-[var(--dx-text-muted)]">
                        {session.user_agent ?? "Unknown device"} · signed in {relativeTime(session.login_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <DxBadge tone={isActive ? "success" : "neutral"}>{session.revoked_at ? "Revoked" : isActive ? "Active" : "Expired"}</DxBadge>
                    {isActive ? <DxButton variant="text" size="sm" onClick={() => revoke([session.id])} disabled={revokeSessions.isPending}>Revoke</DxButton> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <ConfirmPopup
        isOpen={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={handleReset}
        title="Reset this user's password?"
        description={`A strong temporary password will be generated for ${adminUserDisplayName(user)}. All of their active sessions will be revoked and they must change the password at next login.`}
        confirmLabel="Reset Password"
        tone="danger"
        isLoading={resetPassword.isPending}
      />
      <ConfirmPopup
        isOpen={confirmRevokeAll}
        onClose={() => setConfirmRevokeAll(false)}
        onConfirm={() => revoke(activeSessions.map((s) => s.id))}
        title="Revoke all active sessions?"
        description={`${adminUserDisplayName(user)} will be signed out of ${activeSessions.length} active session(s) immediately and will need to log in again.`}
        confirmLabel="Revoke All"
        tone="danger"
        isLoading={revokeSessions.isPending}
      />
    </div>
  );
}

// ============================================================
// Danger zone tab
// ============================================================

function DangerTab({ user }: { user: AdminUser }) {
  const toast = useToast();
  const activate = useActivateUser();
  const deactivate = useDeactivateUser();
  const [confirmAction, setConfirmAction] = React.useState<"activate" | "deactivate" | null>(null);

  const isActive = user.status?.toUpperCase() === "ACTIVE";

  const handleConfirm = async () => {
    try {
      if (confirmAction === "activate") {
        await activate.mutateAsync(user.id);
        toast.success("Account activated", `${adminUserDisplayName(user)} can now sign in.`);
      } else if (confirmAction === "deactivate") {
        await deactivate.mutateAsync(user.id);
        toast.success("Account deactivated", "The account was set to INACTIVE and all active sessions were revoked.");
      }
    } catch (error) {
      toast.error(
        confirmAction === "activate" ? "Activation failed" : "Deactivation failed",
        getStaffAdminErrorMessage(
          error,
          confirmAction === "activate" ? "Unable to activate the account." : "Unable to deactivate the account.",
        ),
      );
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-md border p-5" style={{ borderColor: "var(--dx-success)", background: "var(--dx-success-soft)" }}>
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-[var(--dx-text)]">Activate Account</p>
          <p className="mt-1 text-[12px] font-medium text-[var(--dx-text-muted)]">Restores sign-in access. The user keeps their existing roles, profile, and password.</p>
        </div>
        <DxButton size="sm" leftIcon={<Power className="h-4 w-4" />} disabled={isActive} isLoading={activate.isPending} onClick={() => setConfirmAction("activate")}>
          {isActive ? "Already Active" : "Activate"}
        </DxButton>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4 rounded-md border p-5" style={{ borderColor: "var(--dx-danger)", background: "var(--dx-danger-soft)" }}>
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-[var(--dx-text)]">Deactivate Account</p>
          <p className="mt-1 text-[12px] font-medium text-[var(--dx-text-muted)]">Sets the account to INACTIVE, blocks all sign-ins, and immediately revokes every active session. Records created by this user are preserved.</p>
        </div>
        <DxButton variant="danger" size="sm" leftIcon={<PowerOff className="h-4 w-4" />} disabled={!isActive} isLoading={deactivate.isPending} onClick={() => setConfirmAction("deactivate")}>Deactivate</DxButton>
      </div>

      <ConfirmPopup
        isOpen={confirmAction !== null}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleConfirm}
        title={confirmAction === "activate" ? "Activate this account?" : "Deactivate this account?"}
        description={
          confirmAction === "activate"
            ? `${adminUserDisplayName(user)} will regain access to the system with their current roles and permissions.`
            : `${adminUserDisplayName(user)} will be signed out everywhere and blocked from logging in until the account is re-activated.`
        }
        confirmLabel={confirmAction === "activate" ? "Activate" : "Deactivate"}
        tone={confirmAction === "activate" ? "primary" : "danger"}
        isLoading={activate.isPending || deactivate.isPending}
      />
    </div>
  );
}

// ============================================================
// Modal shell — header + tabs
// ============================================================

export function StaffDetailModal({
  userId,
  isOpen,
  onClose,
}: {
  userId: number | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [tab, setTab] = React.useState<DetailTab>("profile");
  const userQuery = useStaffUser(isOpen ? userId : null);
  const user = userQuery.data;

  React.useEffect(() => {
    if (isOpen) setTab("profile");
  }, [isOpen, userId]);

  return (
    <DxPopup isOpen={isOpen} onClose={onClose} title="Staff Profile" size="xl">
      {userQuery.isLoading ? (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="dx-skeleton h-16 w-16 rounded-lg" />
            <div className="flex-1 space-y-2">
              <div className="dx-skeleton h-6 w-56" />
              <div className="dx-skeleton h-4 w-40" />
            </div>
          </div>
          <div className="dx-skeleton h-10 w-full" />
          <div className="dx-skeleton h-48 w-full" />
        </div>
      ) : userQuery.isError || !user ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-lg" style={{ background: "var(--dx-danger-soft)", color: "var(--dx-danger)" }}>
            <AlertCircle className="h-7 w-7" aria-hidden />
          </div>
          <p className="text-[14px] font-semibold text-[var(--dx-text)]">Could not load this staff member.</p>
          <DxButton size="sm" onClick={() => userQuery.refetch()} leftIcon={<RotateCcw className="h-3.5 w-3.5" />}>Retry</DxButton>
        </div>
      ) : (
        <div className="space-y-6">
          {/* ---- Header ---- */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-[var(--dx-accent-soft)] text-[20px] font-bold text-[var(--dx-accent)]">
              {adminUserInitials(user)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate text-[20px] font-bold text-[var(--dx-text)]">{adminUserDisplayName(user)}</h3>
                <DxBadge tone={statusTone(user.status)}>{user.status}</DxBadge>
                {user.is_superuser ? <DxBadge tone="warning">Superuser</DxBadge> : null}
              </div>
              <p className="mt-1 truncate text-[13px] font-medium text-[var(--dx-text-muted)]">
                {user.email}
                {user.staff_profile?.staff_no ? <>{" · "}<span className="dx-mono text-[12px]">{user.staff_profile.staff_no}</span></> : null}
                {user.staff_profile?.job_title ? ` · ${user.staff_profile.job_title}` : ""}
              </p>
            </div>
          </div>

          {/* ---- Tabs ---- */}
          <DxTabs items={TABS.map((t) => ({ key: t.id, label: t.label }))} value={tab} onChange={setTab} />

          {/* ---- Active tab ---- */}
          {tab === "profile" ? <ProfileTab user={user} /> : null}
          {tab === "access" ? <AccessTab user={user} active={tab === "access"} /> : null}
          {tab === "security" ? <SecurityTab user={user} active={tab === "security"} /> : null}
          {tab === "danger" ? <DangerTab user={user} /> : null}
        </div>
      )}
    </DxPopup>
  );
}
