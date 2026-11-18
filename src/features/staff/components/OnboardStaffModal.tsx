import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check, Copy, KeyRound, Sparkles, UserPlus } from "lucide-react";
import { DxPopup, DxButton, DxInput, DxSelect } from "@/components/dx";
import { FormField } from "@/components/forms/FormField";
import { useToast } from "@/components/feedback/ToastProvider";
import {
  generateStrongPassword,
  getStaffAdminErrorMessage,
} from "../api/staff-admin.api";
import type { UserCreatePayload } from "../api/staff-admin.api";
import {
  useDepartmentOptions,
  useOnboardStaff,
  useRoleOptions,
  useServicePointOptions,
} from "../hooks/use-staff-admin";

// ============================================================
// Form schema — mirrors UserCreateSchema + StaffProfileCreateSchema
// (app/schemas/staff_profile_schemas.py). role_ids and
// service_delivery_point_ids are managed as checkbox state below.
// ============================================================

const onboardSchema = z.object({
  first_name: z.string().trim().min(1, "First name is required").max(100),
  last_name: z.string().trim().min(1, "Last name is required").max(100),
  middle_name: z.string().trim().max(100).optional(),
  username: z.string().trim().min(3, "At least 3 characters").max(100),
  email: z.string().trim().email("Enter a valid email address"),
  phone_number: z.string().trim().max(30).optional(),
  password: z
    .string()
    .min(8, "At least 8 characters")
    .max(128)
    .regex(/[A-Z]/, "Needs an uppercase letter")
    .regex(/[a-z]/, "Needs a lowercase letter")
    .regex(/[0-9]/, "Needs a digit")
    .regex(/[^A-Za-z0-9]/, "Needs a special character"),
  staff_no: z.string().trim().min(2, "Staff number is required (min 2 chars)").max(100),
  job_title: z.string().trim().max(150).optional(),
  specialty: z.string().trim().max(150).optional(),
  professional_license_no: z.string().trim().max(100).optional(),
  department_id: z.string().optional(),
});

type OnboardFormValues = z.infer<typeof onboardSchema>;

type CreatedCredentials = {
  name: string;
  username: string;
  email: string;
  password: string;
};

function SectionTitle({ step, children }: { step: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[var(--dx-accent-soft)] text-[10px] font-bold text-[var(--dx-accent)]">
        {step}
      </span>
      <h4 className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--dx-text-muted)]">{children}</h4>
      <span className="h-px flex-1 bg-[var(--dx-border)]" />
    </div>
  );
}

/** Section shell for the onboarding form. */
function FormSection({ children }: { children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-md border border-[var(--dx-border)] bg-[var(--dx-surface-sunken)] p-5">
      {children}
    </section>
  );
}

export function CheckboxRow({
  checked,
  onToggle,
  label,
  sublabel,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
  sublabel?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-md px-3 py-2 transition-colors hover:bg-[var(--dx-surface-sunken)]">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="mt-0.5 h-4 w-4 shrink-0 rounded"
        style={{ accentColor: "var(--dx-accent)" }}
      />
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-semibold text-[var(--dx-text)]">{label}</span>
        {sublabel ? <span className="block truncate text-[12px] font-medium text-[var(--dx-text-muted)]">{sublabel}</span> : null}
      </span>
    </label>
  );
}

export function CopyField({ label, value }: { label: string; value: string }) {
  const toast = useToast();
  const [copied, setCopied] = React.useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success("Copied to clipboard");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy", "Select and copy the value manually.");
    }
  };

  return (
    <div>
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--dx-text-muted)]">{label}</p>
      <div className="flex items-center gap-2 rounded-md border border-[var(--dx-border)] bg-[var(--dx-surface-sunken)] px-4 py-3">
        <span className="dx-mono min-w-0 flex-1 truncate text-[13px] font-bold text-[var(--dx-text)]">{value}</span>
        <DxButton icon size="sm" variant="text" onClick={copy} aria-label={`Copy ${label}`}>
          {copied ? <Check style={{ color: "var(--dx-success)" }} /> : <Copy />}
        </DxButton>
      </div>
    </div>
  );
}

export function OnboardStaffModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const onboard = useOnboardStaff();
  const departmentsQuery = useDepartmentOptions();
  const rolesQuery = useRoleOptions();
  const sdpsQuery = useServicePointOptions();

  const [roleIds, setRoleIds] = React.useState<number[]>([]);
  const [sdpIds, setSdpIds] = React.useState<number[]>([]);
  const [created, setCreated] = React.useState<CreatedCredentials | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<z.input<typeof onboardSchema>, unknown, OnboardFormValues>({
    resolver: zodResolver(onboardSchema),
    defaultValues: { password: "" },
  });

  const passwordValue = watch("password") ?? "";

  const toggleId = (setter: React.Dispatch<React.SetStateAction<number[]>>, id: number) => {
    setter((current) =>
      current.includes(id) ? current.filter((v) => v !== id) : [...current, id],
    );
  };

  const resetAll = () => {
    reset({ password: "" });
    setRoleIds([]);
    setSdpIds([]);
    setCreated(null);
  };

  const handleClose = () => {
    resetAll();
    onClose();
  };

  const onSubmit = (values: OnboardFormValues) => {
    const payload: UserCreatePayload = {
      username: values.username,
      email: values.email,
      first_name: values.first_name,
      last_name: values.last_name,
      middle_name: values.middle_name?.trim() || undefined,
      phone_number: values.phone_number?.trim() || undefined,
      password: values.password,
      role_ids: roleIds,
      staff_profile: {
        staff_no: values.staff_no,
        job_title: values.job_title?.trim() || undefined,
        specialty: values.specialty?.trim() || undefined,
        professional_license_no: values.professional_license_no?.trim() || undefined,
        department_id: values.department_id ? Number(values.department_id) : undefined,
        service_delivery_point_ids: sdpIds,
      },
    };

    onboard.mutate(payload, {
      onSuccess: (user) => {
        toast.success(
          "Staff member onboarded",
          `${user.first_name} ${user.last_name} can now sign in.`,
        );
        setCreated({
          name: `${user.first_name} ${user.last_name}`.trim(),
          username: user.username,
          email: user.email,
          password: values.password,
        });
      },
      onError: (error) => {
        toast.error(
          "Onboarding failed",
          getStaffAdminErrorMessage(error, "Unable to create the staff account."),
        );
      },
    });
  };

  const departmentOptions = (departmentsQuery.data ?? []).map((d) => ({
    value: String(d.id),
    label: `${d.name} (${d.code})`,
  }));

  const selectsLoading = rolesQuery.isLoading || sdpsQuery.isLoading;

  // ---------- Success view: surface credentials copyably before closing ----------
  if (created) {
    return (
      <DxPopup
        isOpen={isOpen}
        onClose={handleClose}
        title="Staff Account Created"
        size="md"
        footer={<DxButton variant="primary" onClick={handleClose}>Done</DxButton>}
      >
        <div className="space-y-6">
          <div className="flex items-start gap-4 rounded-md border p-4" style={{ borderColor: "var(--dx-success)", background: "var(--dx-success-soft)" }}>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-white" style={{ background: "var(--dx-success)" }}>
              <Check className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-[14px] font-semibold text-[var(--dx-text)]">{created.name} has been onboarded.</p>
              <p className="mt-1 text-[12px] font-medium text-[var(--dx-text-muted)]">
                Share these initial credentials securely. The password below is the one set at onboarding — it will not be shown again after this dialog closes.
              </p>
            </div>
          </div>
          <div className="space-y-4">
            <CopyField label="Username" value={created.username} />
            <CopyField label="Email" value={created.email} />
            <CopyField label="Initial password" value={created.password} />
          </div>
        </div>
      </DxPopup>
    );
  }

  return (
    <DxPopup
      isOpen={isOpen}
      onClose={handleClose}
      title="Onboard Staff Member"
      size="xl"
      locked={onboard.isPending}
      footer={
        <>
          <DxButton onClick={handleClose} disabled={onboard.isPending}>Cancel</DxButton>
          <DxButton variant="primary" leftIcon={<UserPlus className="h-4 w-4" />} isLoading={onboard.isPending} onClick={handleSubmit(onSubmit)}>Create account</DxButton>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
        {/* -------- Account details -------- */}
        <FormSection>
          <SectionTitle step="01">Account Details</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-3">
            <DxInput label="First Name" placeholder="Jane" error={errors.first_name?.message} {...register("first_name")} />
            <DxInput label="Middle Name" placeholder="Optional" error={errors.middle_name?.message} {...register("middle_name")} />
            <DxInput label="Last Name" placeholder="Doe" error={errors.last_name?.message} {...register("last_name")} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <DxInput label="Username" placeholder="jdoe" error={errors.username?.message} {...register("username")} />
            <DxInput label="Email" type="email" placeholder="jane.doe@hospital.org" error={errors.email?.message} {...register("email")} />
            <DxInput label="Phone Number" placeholder="Optional" error={errors.phone_number?.message} {...register("phone_number")} />
          </div>
          <div>
            <div className="grid items-start gap-3 sm:grid-cols-[1fr_auto]">
              <DxInput
                label="Initial Password"
                type="text"
                autoComplete="new-password"
                placeholder="Min 8 chars — upper, lower, digit, special"
                leftIcon={<KeyRound className="h-4 w-4" />}
                error={errors.password?.message}
                {...register("password")}
              />
              <DxButton
                className="self-start sm:mt-6"
                leftIcon={<Sparkles className="h-4 w-4" />}
                onClick={() => setValue("password", generateStrongPassword(), { shouldValidate: true })}
              >
                Generate
              </DxButton>
            </div>
            {!passwordValue && !errors.password ? (
              <p className="mt-1.5 text-[12px] text-[var(--dx-text-muted)]">Use the generator for a policy-compliant random password.</p>
            ) : null}
          </div>
        </FormSection>

        {/* -------- Staff profile -------- */}
        <FormSection>
          <SectionTitle step="02">Staff Profile</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <DxInput label="Staff Number" placeholder="e.g. CP-0042" error={errors.staff_no?.message} {...register("staff_no")} />
            <DxInput label="Job Title" placeholder="e.g. Senior Nurse" error={errors.job_title?.message} {...register("job_title")} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <DxInput label="Specialty" placeholder="Optional" error={errors.specialty?.message} {...register("specialty")} />
            <DxInput label="Professional License No" placeholder="Optional" error={errors.professional_license_no?.message} {...register("professional_license_no")} />
            <DxSelect
              label="Department"
              placeholder={departmentsQuery.isLoading ? "Loading…" : "Select department"}
              options={departmentOptions}
              defaultValue=""
              error={errors.department_id?.message}
              {...register("department_id")}
            />
          </div>
          <FormField label="Service Delivery Points" hint="Assign the service points this staff member operates from.">
            {sdpsQuery.isLoading ? (
              <div className="dx-skeleton h-24 w-full" />
            ) : (sdpsQuery.data ?? []).length === 0 ? (
              <p className="text-[12px] font-medium text-[var(--dx-text-muted)]">No service delivery points available.</p>
            ) : (
              <div className="grid max-h-44 gap-1 overflow-y-auto rounded-md border border-[var(--dx-border)] p-2 sm:grid-cols-2">
                {(sdpsQuery.data ?? []).map((sdp) => (
                  <CheckboxRow key={sdp.id} checked={sdpIds.includes(sdp.id)} onToggle={() => toggleId(setSdpIds, sdp.id)} label={sdp.name} sublabel={sdp.code} />
                ))}
              </div>
            )}
          </FormField>
        </FormSection>

        {/* -------- Roles -------- */}
        <FormSection>
          <SectionTitle step="03">System Roles</SectionTitle>
          <FormField label="Assigned Roles" hint="Roles determine the modules and actions this account can access.">
            {selectsLoading ? (
              <div className="dx-skeleton h-24 w-full" />
            ) : (rolesQuery.data ?? []).length === 0 ? (
              <p className="text-[12px] font-medium text-[var(--dx-text-muted)]">No roles found.</p>
            ) : (
              <div className="grid max-h-44 gap-1 overflow-y-auto rounded-md border border-[var(--dx-border)] p-2 sm:grid-cols-2">
                {(rolesQuery.data ?? []).map((role) => (
                  <CheckboxRow key={role.id} checked={roleIds.includes(role.id)} onToggle={() => toggleId(setRoleIds, role.id)} label={role.name} sublabel={role.code} />
                ))}
              </div>
            )}
          </FormField>
        </FormSection>
      </form>
    </DxPopup>
  );
}
