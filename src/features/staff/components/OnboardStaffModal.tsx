import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check, Copy, KeyRound, Sparkles, UserPlus } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { SuiteEyebrow } from "@/components/layout/SuiteEyebrow";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { FormField } from "@/components/forms/FormField";
import { Skeleton } from "@/components/ui/Skeleton";
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
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary-500 to-cyan-500 text-[10px] font-black text-white shadow-[0_0_12px_-2px_rgba(6,182,212,0.7)]">
        {step}
      </span>
      <h4 className="bg-gradient-to-r from-primary-600 to-cyan-500 bg-clip-text text-[10px] font-black uppercase tracking-[0.22em] text-transparent">
        {children}
      </h4>
      <span className="h-px flex-1 bg-gradient-to-r from-cyan-400/50 via-primary-500/20 to-transparent" />
    </div>
  );
}

/** Glass panel with a gradient hairline ring — the modal's section shell. */
function HoloSection({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-gradient-to-br from-primary-500/25 via-secondary-200/40 to-cyan-400/25 p-[1px] dark:from-primary-500/30 dark:via-white/5 dark:to-cyan-400/30">
      <div className="space-y-4 rounded-2xl bg-white/80 p-5 backdrop-blur-xl dark:bg-secondary-950/70">
        {children}
      </div>
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
    <label className="flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-primary-500/5">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-secondary-300 text-primary-600 focus:ring-primary-500 dark:border-white/20"
      />
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-secondary-900">{label}</span>
        {sublabel ? (
          <span className="block truncate text-xs font-medium text-secondary-400">{sublabel}</span>
        ) : null}
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
      <p className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-secondary-400">
        {label}
      </p>
      <div className="flex items-center gap-2 rounded-2xl border border-secondary-200 bg-secondary-50/60 px-4 py-3 dark:border-white/10 dark:bg-white/5">
        <span className="data-mono min-w-0 flex-1 truncate text-sm font-bold text-secondary-900">
          {value}
        </span>
        <Button variant="ghost" size="sm" onClick={copy} aria-label={`Copy ${label}`}>
          {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
        </Button>
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
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        title="Staff Account Created"
        size="md"
        footer={
          <div className="flex justify-end">
            <Button variant="primary" onClick={handleClose}>
              Done
            </Button>
          </div>
        }
      >
        <div className="space-y-6">
          <SuiteEyebrow label="HR & Payroll Suite" />
          <div className="rounded-2xl bg-gradient-to-br from-emerald-400/40 via-transparent to-cyan-400/40 p-[1px]">
            <div className="flex items-start gap-4 rounded-2xl bg-emerald-500/10 p-4 backdrop-blur-xl">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 text-white shadow-[0_0_16px_-4px_rgba(16,185,129,0.8)]">
                <Check className="h-5 w-5" aria-hidden />
              </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-secondary-900">
                {created.name} has been onboarded.
              </p>
              <p className="mt-1 text-xs font-medium text-secondary-500">
                Share these initial credentials securely. The password below is the one set at
                onboarding — it will not be shown again after this dialog closes.
              </p>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <CopyField label="Username" value={created.username} />
            <CopyField label="Email" value={created.email} />
            <CopyField label="Initial password" value={created.password} />
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Onboard Staff Member"
      size="xl"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={handleClose} disabled={onboard.isPending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            leftIcon={<UserPlus className="h-4 w-4" />}
            isLoading={onboard.isPending}
            onClick={handleSubmit(onSubmit)}
          >
            Create Account
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
        {/* -------- Suite identity strip -------- */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SuiteEyebrow label="HR & Payroll Suite" />
          <span className="data-mono text-[10px] font-bold uppercase tracking-[0.2em] text-secondary-400">
            Staff Onboarding Console
          </span>
        </div>

        {/* -------- Account details -------- */}
        <HoloSection>
          <SectionTitle step="01">Account Details</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              label="First Name"
              placeholder="Jane"
              error={errors.first_name?.message}
              {...register("first_name")}
            />
            <Input
              label="Middle Name"
              placeholder="Optional"
              error={errors.middle_name?.message}
              {...register("middle_name")}
            />
            <Input
              label="Last Name"
              placeholder="Doe"
              error={errors.last_name?.message}
              {...register("last_name")}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              label="Username"
              placeholder="jdoe"
              error={errors.username?.message}
              {...register("username")}
            />
            <Input
              label="Email"
              type="email"
              placeholder="jane.doe@hospital.org"
              error={errors.email?.message}
              {...register("email")}
            />
            <Input
              label="Phone Number"
              placeholder="Optional"
              error={errors.phone_number?.message}
              {...register("phone_number")}
            />
          </div>
          <div>
            <div className="grid items-start gap-3 sm:grid-cols-[1fr_auto]">
              <Input
                label="Initial Password"
                type="text"
                autoComplete="new-password"
                placeholder="Min 8 chars — upper, lower, digit, special"
                leftIcon={<KeyRound className="h-4 w-4" />}
                error={errors.password?.message}
                {...register("password")}
              />
              {/* mt-6 = the input label's line + margin, h matches .input-field,
                  so the button tracks the field itself — hints and errors below
                  the input can no longer push it out of line. */}
              <Button
                variant="outline"
                className="h-[46px] self-start sm:mt-6 border-cyan-400/50 text-primary-600 shadow-[0_0_14px_-6px_rgba(6,182,212,0.5)] hover:shadow-[0_0_18px_-4px_rgba(6,182,212,0.7)] dark:text-cyan-300"
                leftIcon={<Sparkles className="h-4 w-4" />}
                onClick={() =>
                  setValue("password", generateStrongPassword(), { shouldValidate: true })
                }
              >
                Generate
              </Button>
            </div>
            {!passwordValue && !errors.password && (
              <p className="mt-1.5 text-xs text-secondary-400">
                Use the generator for a policy-compliant random password.
              </p>
            )}
          </div>
        </HoloSection>

        {/* -------- Staff profile -------- */}
        <HoloSection>
          <SectionTitle step="02">Staff Profile</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Staff Number"
              placeholder="e.g. CP-0042"
              error={errors.staff_no?.message}
              {...register("staff_no")}
            />
            <Input
              label="Job Title"
              placeholder="e.g. Senior Nurse"
              error={errors.job_title?.message}
              {...register("job_title")}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              label="Specialty"
              placeholder="Optional"
              error={errors.specialty?.message}
              {...register("specialty")}
            />
            <Input
              label="Professional License No"
              placeholder="Optional"
              error={errors.professional_license_no?.message}
              {...register("professional_license_no")}
            />
            <Select
              label="Department"
              placeholder={departmentsQuery.isLoading ? "Loading…" : "Select department"}
              options={departmentOptions}
              defaultValue=""
              error={errors.department_id?.message}
              {...register("department_id")}
            />
          </div>
          <FormField
            label="Service Delivery Points"
            hint="Assign the service points this staff member operates from."
          >
            {sdpsQuery.isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : (sdpsQuery.data ?? []).length === 0 ? (
              <p className="text-xs font-medium text-secondary-400">
                No service delivery points available.
              </p>
            ) : (
              <div className="grid max-h-44 gap-1 overflow-y-auto rounded-2xl border border-secondary-200 p-2 sm:grid-cols-2 dark:border-white/10">
                {(sdpsQuery.data ?? []).map((sdp) => (
                  <CheckboxRow
                    key={sdp.id}
                    checked={sdpIds.includes(sdp.id)}
                    onToggle={() => toggleId(setSdpIds, sdp.id)}
                    label={sdp.name}
                    sublabel={sdp.code}
                  />
                ))}
              </div>
            )}
          </FormField>
        </HoloSection>

        {/* -------- Roles -------- */}
        <HoloSection>
          <SectionTitle step="03">System Roles</SectionTitle>
          <FormField
            label="Assigned Roles"
            hint="Roles determine the modules and actions this account can access."
          >
            {selectsLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : (rolesQuery.data ?? []).length === 0 ? (
              <p className="text-xs font-medium text-secondary-400">No roles found.</p>
            ) : (
              <div className="grid max-h-44 gap-1 overflow-y-auto rounded-2xl border border-secondary-200 p-2 sm:grid-cols-2 dark:border-white/10">
                {(rolesQuery.data ?? []).map((role) => (
                  <CheckboxRow
                    key={role.id}
                    checked={roleIds.includes(role.id)}
                    onToggle={() => toggleId(setRoleIds, role.id)}
                    label={role.name}
                    sublabel={role.code}
                  />
                ))}
              </div>
            )}
          </FormField>
        </HoloSection>
      </form>
    </Modal>
  );
}
