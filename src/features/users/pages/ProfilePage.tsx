import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Building2,
  CheckCircle2,
  KeyRound,
  LogOut,
  MailCheck,
  Moon,
  MonitorSmartphone,
  Save,
  ShieldCheck,
  ShieldOff,
  Sun,
  UserRound,
  Camera,
  PenLine,
  Trash2,
  Loader2,
  Upload,
  Eraser,
} from "lucide-react";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { useToast } from "@/components/feedback/ToastProvider";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { CardSkeleton, Skeleton } from "@/components/ui/Skeleton";
import { Textarea } from "@/components/ui/Textarea";
import { useDisclosure } from "@/hooks/useDisclosure";
import { resolveTenantCode } from "@/lib/tenant/tenant-resolver";

import { getApiErrorMessage, getInitials } from "../api/users.api";
import type { MyProfile, TwoFactorSetupResult, UserSession } from "../api/users.api";
import {
  useChangeMyPassword,
  useMyProfile,
  useUploadMyPhoto,
  useRemoveMyPhoto,
  useUploadMySignature,
  useRemoveMySignature,
  useMySessions,
  useRevokeAllMySessions,
  useSetupTwoFactor,
  useUpdateMyProfile,
} from "../hooks/use-profile";

// =====================================================================
// Helpers
// =====================================================================

function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// =====================================================================
// Draw-your-signature pad
// =====================================================================

function SignaturePadModal({ isOpen, onClose, onSave, saving }: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (file: File) => void;
  saving: boolean;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const drawing = React.useRef(false);
  const [hasInk, setHasInk] = React.useState(false);

  // Fresh pad every time it opens (the canvas itself remounts with the Modal).
  React.useEffect(() => {
    if (isOpen) setHasInk(false);
  }, [isOpen]);

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (c.width / r.width),
      y: (e.clientY - r.top) * (c.height / r.height),
    };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    drawing.current = true;
    const p = getPos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111827";
    const p = getPos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    setHasInk(true);
  };

  const end = () => { drawing.current = false; };

  const clear = () => {
    const c = canvasRef.current;
    if (!c) return;
    c.getContext("2d")?.clearRect(0, 0, c.width, c.height);
    setHasInk(false);
  };

  const save = () => {
    canvasRef.current?.toBlob((blob) => {
      if (!blob) return;
      onSave(new File([blob], "signature.png", { type: "image/png" }));
    }, "image/png");
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Draw your signature"
      size="md"
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <Button variant="ghost" onClick={clear} disabled={!hasInk || saving} leftIcon={<Eraser className="h-4 w-4" />}>
            Clear
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button onClick={save} disabled={!hasInk} isLoading={saving} leftIcon={<PenLine className="h-4 w-4" />}>
              Save signature
            </Button>
          </div>
        </div>
      }
    >
      <p className="mb-3 text-xs text-secondary-500 dark:text-secondary-400">
        Sign inside the box using your mouse, trackpad or finger. It's stored securely and shown on
        every request you approve, return or reject.
      </p>
      <canvas
        ref={canvasRef}
        width={560}
        height={200}
        className="w-full touch-none rounded-2xl border-2 border-dashed border-secondary-200 bg-white dark:border-white/20"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
      />
      <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-secondary-300 dark:text-secondary-500">
        Tip: a wide, steady stroke reproduces best on documents.
      </p>
    </Modal>
  );
}

// =====================================================================
// Profile header
// =====================================================================

function ProfileHeaderCard({ profile }: { profile: MyProfile }) {
  const tenantCode = resolveTenantCode();
  const fullName = [profile.first_name, profile.middle_name, profile.last_name]
    .filter(Boolean)
    .join(" ");

  const fileRef = React.useRef<HTMLInputElement>(null);
  const toast = useToast();
  const upload = useUploadMyPhoto();
  const removePhoto = useRemoveMyPhoto();
  const [photoError, setPhotoError] = React.useState<string | null>(null);

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!/\.(png|jpe?g|webp|gif)$/i.test(file.name)) {
      setPhotoError("Only PNG, JPG, WEBP or GIF images are supported.");
      toast.error("Unsupported file", "Choose a PNG, JPG, WEBP or GIF image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError("Please choose an image under 5 MB.");
      toast.error("Image too large", "Please choose an image under 5 MB.");
      return;
    }
    setPhotoError(null);
    toast.info?.("Uploading photo…", "Sending your picture to secure storage.");
    upload.mutate(file, {
      onSuccess: () => {
        setPhotoError(null);
        toast.success("Profile photo updated", "Your new picture now shows across the app.");
      },
      onError: (err: any) => {
        const msg = getApiErrorMessage(err, "Could not upload the photo.");
        setPhotoError(msg);
        toast.error("Upload failed", msg);
      },
    });
  };

  const onRemovePhoto = () => {
    removePhoto.mutate(undefined, {
      onSuccess: () => { setPhotoError(null); toast.success("Photo removed", "Your initials are shown instead."); },
      onError: (err: any) => toast.error("Couldn't remove photo", getApiErrorMessage(err, "Please try again.")),
    });
  };

  const busy = upload.isPending || removePhoto.isPending;

  const sigRef = React.useRef<HTMLInputElement>(null);
  const uploadSig = useUploadMySignature();
  const removeSig = useRemoveMySignature();
  const sigBusy = uploadSig.isPending || removeSig.isPending;
  const [sigPadOpen, setSigPadOpen] = React.useState(false);

  const onDrawSave = (file: File) => {
    uploadSig.mutate(file, {
      onSuccess: () => {
        setSigPadOpen(false);
        toast.success("Signature saved", "It will appear on your approval actions.");
      },
      onError: (err: any) => toast.error("Upload failed", getApiErrorMessage(err, "Could not save the signature.")),
    });
  };

  const onPickSignature = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!/\.(png|jpe?g|webp|gif)$/i.test(file.name)) {
      toast.error("Unsupported file", "Choose a PNG, JPG, WEBP or GIF image of your signature.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image too large", "Please choose a signature image under 2 MB.");
      return;
    }
    toast.info("Uploading signature…", "Sending your signature to secure storage.");
    uploadSig.mutate(file, {
      onSuccess: () => toast.success("Signature saved", "It will appear on your approval actions."),
      onError: (err: any) => toast.error("Upload failed", getApiErrorMessage(err, "Could not upload the signature.")),
    });
  };

  return (
    <Card variant="panel">
      <div className="flex flex-wrap items-center gap-6">
        <div className="group relative h-20 w-20 shrink-0">
          {profile.profile_photo_display_url ? (
            <img
              src={profile.profile_photo_display_url}
              alt={fullName || profile.username}
              className="h-20 w-20 rounded-3xl object-cover shadow-glow-sm ring-1 ring-secondary-200"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-primary-500 to-cyan-500 text-2xl font-black text-white shadow-glow-sm">
              {getInitials(profile)}
            </div>
          )}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            title={profile.profile_photo_display_url ? "Change profile photo" : "Upload profile photo"}
            className="absolute inset-0 flex items-center justify-center rounded-3xl bg-secondary-900/0 text-white opacity-0 transition-all group-hover:bg-secondary-900/50 group-hover:opacity-100 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <Camera className="h-6 w-6" />}
          </button>
          {profile.profile_photo_display_url && !busy && (
            <button
              type="button"
              onClick={onRemovePhoto}
              title="Remove photo"
              className="absolute -bottom-1.5 -right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-white text-rose-500 shadow-md ring-1 ring-secondary-200 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-rose-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          <span className="pointer-events-none absolute -bottom-1.5 -left-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-primary-500 text-white shadow-md ring-2 ring-white">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
          </span>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={onPickFile}
          />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-2xl font-bold text-secondary-900 dark:text-secondary-100">
            {fullName || profile.username}
          </h2>
          <p className="mt-0.5 text-sm font-medium text-secondary-500 dark:text-secondary-400">
            {profile.job_title ? `${profile.job_title} · ` : ""}
            {profile.email}
          </p>
          {photoError && (
            <p className="mt-1 text-xs font-bold text-rose-500">{photoError}</p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {profile.roles.map((role, index) => (
              <Badge key={role.id ?? role.code ?? index} variant="soft-info">
                {role.name ?? role.code ?? "Role"}
              </Badge>
            ))}
            {tenantCode ? (
              <Badge variant="secondary">
                <Building2 className="h-3 w-3" aria-hidden />
                {tenantCode.toUpperCase()}
              </Badge>
            ) : null}
            {profile.is_email_verified ? (
              <Badge variant="soft-success">
                <MailCheck className="h-3 w-3" aria-hidden />
                Email verified
              </Badge>
            ) : (
              <Badge variant="soft-warning">Email unverified</Badge>
            )}
            {profile.is_two_factor_enabled ? (
              <Badge variant="soft-success">
                <ShieldCheck className="h-3 w-3" aria-hidden />
                2FA on
              </Badge>
            ) : (
              <Badge variant="soft-warning">
                <ShieldOff className="h-3 w-3" aria-hidden />
                2FA off
              </Badge>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs font-bold uppercase tracking-widest text-secondary-400 dark:text-secondary-500">
            Profile completion
          </p>
          <p className="mt-1 font-display text-3xl font-bold text-primary-500">
            {profile.profile_completion}%
          </p>
          <p className="mt-1 text-xs font-medium text-secondary-400 dark:text-secondary-500">
            Last login {formatDateTime(profile.last_login_at)}
          </p>
        </div>
      </div>

      {/* ── My signature (used on approval actions) ── */}
      <div className="mt-6 flex flex-wrap items-center gap-4 rounded-2xl border border-secondary-100 bg-secondary-50/60 p-4 dark:border-white/10 dark:bg-white/5">
        <div className="flex h-14 w-40 items-center justify-center overflow-hidden rounded-xl bg-white ring-1 ring-secondary-200 dark:bg-secondary-100">
          {profile.signature_display_url ? (
            <img src={profile.signature_display_url} alt="My signature" className="max-h-12 max-w-[9.5rem] object-contain" />
          ) : (
            <span className="text-[10px] font-bold uppercase tracking-widest text-secondary-300">No signature</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-secondary-900 dark:text-secondary-100">My Signature</p>
          <p className="text-xs text-secondary-500 dark:text-secondary-400">
            Shown alongside your profile picture when you approve, return or reject requests.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSigPadOpen(true)}
            disabled={sigBusy}
            className="flex items-center gap-1.5 rounded-xl bg-secondary-900 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white shadow-md hover:bg-black disabled:opacity-60 dark:bg-primary-500 dark:hover:bg-primary-600"
          >
            {sigBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PenLine className="h-3.5 w-3.5" />}
            Draw
          </button>
          <button
            type="button"
            onClick={() => sigRef.current?.click()}
            disabled={sigBusy}
            className="flex items-center gap-1.5 rounded-xl border border-secondary-200 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-secondary-600 hover:bg-secondary-50 disabled:opacity-60 dark:border-white/10 dark:text-secondary-300 dark:hover:bg-white/5"
          >
            <Upload className="h-3.5 w-3.5" />
            {profile.signature_display_url ? "Replace" : "Upload"}
          </button>
          {profile.signature_display_url && !sigBusy && (
            <button
              type="button"
              onClick={() => removeSig.mutate(undefined, {
                onSuccess: () => toast.success("Signature removed"),
                onError: (err: any) => toast.error("Couldn't remove signature", getApiErrorMessage(err, "Please try again.")),
              })}
              className="flex items-center gap-1.5 rounded-xl border border-rose-200 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-rose-500 hover:bg-rose-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove
            </button>
          )}
        </div>
        <input ref={sigRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={onPickSignature} />
      </div>

      <SignaturePadModal
        isOpen={sigPadOpen}
        onClose={() => setSigPadOpen(false)}
        onSave={onDrawSave}
        saving={uploadSig.isPending}
      />
    </Card>
  );
}

// =====================================================================
// Editable profile form
// =====================================================================

const profileFormSchema = z.object({
  first_name: z.string().trim().min(1, "First name is required."),
  last_name: z.string().trim().min(1, "Last name is required."),
  middle_name: z.string().optional(),
  phone_number: z.string().optional(),
  job_title: z.string().optional(),
  gender: z.string().optional(),
  date_of_birth: z.string().optional(),
  bio: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

const GENDER_OPTIONS = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "OTHER", label: "Other" },
];

function ProfileDetailsCard({ profile }: { profile: MyProfile }) {
  const toast = useToast();
  const updateProfile = useUpdateMyProfile();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      first_name: profile.first_name ?? "",
      last_name: profile.last_name ?? "",
      middle_name: profile.middle_name ?? "",
      phone_number: profile.phone_number ?? "",
      job_title: profile.job_title ?? "",
      gender: profile.gender?.toUpperCase() ?? "",
      date_of_birth: profile.date_of_birth ?? "",
      bio: profile.bio ?? "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    // Backend expects omitted keys for fields we don't want to change —
    // strip empty optional values instead of sending "".
    const payload = {
      first_name: values.first_name.trim(),
      last_name: values.last_name.trim(),
      middle_name: values.middle_name?.trim() || undefined,
      phone_number: values.phone_number?.trim() || undefined,
      job_title: values.job_title?.trim() || undefined,
      gender: values.gender || undefined,
      date_of_birth: values.date_of_birth || undefined,
      bio: values.bio?.trim() || undefined,
    };
    try {
      const updated = await updateProfile.mutateAsync(payload);
      toast.success("Profile updated", "Your changes have been saved.");
      reset({
        first_name: updated.first_name ?? "",
        last_name: updated.last_name ?? "",
        middle_name: updated.middle_name ?? "",
        phone_number: updated.phone_number ?? "",
        job_title: updated.job_title ?? "",
        gender: updated.gender?.toUpperCase() ?? "",
        date_of_birth: updated.date_of_birth ?? "",
        bio: updated.bio ?? "",
      });
    } catch (error) {
      toast.error("Failed to update profile", getApiErrorMessage(error, "Please try again."));
    }
  });

  return (
    <Card>
      <CardHeader
        title="Personal Information"
        description="Details visible to your care team. Email and role changes are managed by an administrator."
      />
      <form onSubmit={onSubmit} className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Input label="First Name" error={errors.first_name?.message} {...register("first_name")} />
          <Input label="Last Name" error={errors.last_name?.message} {...register("last_name")} />
          <Input
            label="Middle Name"
            error={errors.middle_name?.message}
            {...register("middle_name")}
          />
          <Input
            label="Phone Number"
            placeholder="+233 20 000 0000"
            error={errors.phone_number?.message}
            {...register("phone_number")}
          />
          <Input label="Job Title" error={errors.job_title?.message} {...register("job_title")} />
          <Select
            label="Gender"
            options={GENDER_OPTIONS}
            placeholder="Select gender"
            error={errors.gender?.message}
            {...register("gender")}
          />
          <Input
            label="Date of Birth"
            type="date"
            error={errors.date_of_birth?.message}
            {...register("date_of_birth")}
          />
          <Input label="Email" value={profile.email} disabled hint="Managed by your administrator." />
        </div>
        <Textarea
          label="Bio"
          placeholder="A short professional summary."
          rows={3}
          error={errors.bio?.message}
          {...register("bio")}
        />
        <div className="flex justify-end">
          <Button
            type="submit"
            size="sm"
            leftIcon={<Save className="h-4 w-4" />}
            disabled={!isDirty}
            isLoading={updateProfile.isPending}
          >
            Save Changes
          </Button>
        </div>
      </form>
    </Card>
  );
}

// =====================================================================
// Change password
// =====================================================================

const passwordFormSchema = z
  .object({
    current_password: z.string().min(1, "Enter your current password."),
    new_password: z.string().min(8, "New password must be at least 8 characters."),
    confirm_new_password: z.string().min(8, "Confirm your new password."),
  })
  .refine((values) => values.new_password === values.confirm_new_password, {
    message: "New password and confirmation do not match.",
    path: ["confirm_new_password"],
  });

type PasswordFormValues = z.infer<typeof passwordFormSchema>;

function ChangePasswordCard() {
  const toast = useToast();
  const changePassword = useChangeMyPassword();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: { current_password: "", new_password: "", confirm_new_password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const result = await changePassword.mutateAsync(values);
      toast.success("Password changed", result.message);
      reset();
    } catch (error) {
      toast.error("Failed to change password", getApiErrorMessage(error, "Please try again."));
    }
  });

  return (
    <Card>
      <CardHeader
        title="Change Password"
        description="Use at least 8 characters. You may be signed out of other devices."
      />
      <form onSubmit={onSubmit} className="space-y-5">
        <Input
          label="Current Password"
          type="password"
          autoComplete="current-password"
          error={errors.current_password?.message}
          {...register("current_password")}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            label="New Password"
            type="password"
            autoComplete="new-password"
            error={errors.new_password?.message}
            {...register("new_password")}
          />
          <Input
            label="Confirm New Password"
            type="password"
            autoComplete="new-password"
            error={errors.confirm_new_password?.message}
            {...register("confirm_new_password")}
          />
        </div>
        <div className="flex justify-end">
          <Button
            type="submit"
            size="sm"
            leftIcon={<KeyRound className="h-4 w-4" />}
            isLoading={changePassword.isPending}
          >
            Update Password
          </Button>
        </div>
      </form>
    </Card>
  );
}

// =====================================================================
// Two-factor authentication
// =====================================================================

const TWO_FACTOR_METHODS = [
  { value: "EMAIL", label: "Email OTP" },
  { value: "SMS", label: "SMS OTP" },
  { value: "AUTHENTICATOR", label: "Authenticator App" },
];

function TwoFactorCard({ profile }: { profile: MyProfile }) {
  const toast = useToast();
  const setupTwoFactor = useSetupTwoFactor();
  const [method, setMethod] = React.useState("EMAIL");
  const [setupResult, setSetupResult] = React.useState<TwoFactorSetupResult | null>(null);
  const enabled = profile.is_two_factor_enabled;

  const handleToggle = async (enable: boolean) => {
    try {
      const result = await setupTwoFactor.mutateAsync({
        enable_two_factor: enable,
        method,
        enable_email: enable && method === "EMAIL",
        enable_sms: enable && method === "SMS",
        enable_authenticator: enable && method === "AUTHENTICATOR",
      });
      setSetupResult(enable ? result : null);
      toast.success(
        enable ? "Two-factor enabled" : "Two-factor disabled",
        result.message
      );
    } catch (error) {
      toast.error(
        "Failed to update two-factor settings",
        getApiErrorMessage(error, "Please try again.")
      );
    }
  };

  return (
    <Card>
      <CardHeader
        title="Two-Factor Authentication"
        description="Add a second verification step when signing in."
        actions={
          enabled ? (
            <Badge variant="soft-success">
              <CheckCircle2 className="h-3 w-3" aria-hidden />
              Enabled
            </Badge>
          ) : (
            <Badge variant="soft-warning">Disabled</Badge>
          )
        }
      />
      <div className="space-y-5">
        {!enabled ? (
          <div className="flex flex-wrap items-end gap-4">
            <div className="w-56">
              <Select
                label="Delivery Method"
                options={TWO_FACTOR_METHODS}
                value={method}
                onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                  setMethod(event.target.value)
                }
              />
            </div>
            <Button
              size="sm"
              leftIcon={<ShieldCheck className="h-4 w-4" />}
              onClick={() => handleToggle(true)}
              isLoading={setupTwoFactor.isPending}
            >
              Enable 2FA
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm font-medium text-secondary-600 dark:text-secondary-400">
              Two-factor authentication is protecting your account.
            </p>
            <Button
              variant="danger"
              size="sm"
              leftIcon={<ShieldOff className="h-4 w-4" />}
              onClick={() => handleToggle(false)}
              isLoading={setupTwoFactor.isPending}
            >
              Disable 2FA
            </Button>
          </div>
        )}

        {setupResult?.setup_secret || setupResult?.provisioning_uri ? (
          <div className="rounded-2xl border border-primary-500/30 bg-primary-500/5 p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-secondary-500 dark:text-secondary-400">
              Authenticator setup
            </p>
            {setupResult.setup_secret ? (
              <p className="data-mono mt-2 break-all text-sm text-secondary-900 dark:text-secondary-100">
                Secret: {setupResult.setup_secret}
              </p>
            ) : null}
            {setupResult.provisioning_uri ? (
              <p className="data-mono mt-1 break-all text-xs text-secondary-500 dark:text-secondary-400">
                {setupResult.provisioning_uri}
              </p>
            ) : null}
            <p className="mt-2 text-xs font-medium text-secondary-500 dark:text-secondary-400">
              Scan or enter this secret in your authenticator app, then verify at your next sign-in.
            </p>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

// =====================================================================
// Sessions
// =====================================================================

function SessionRow({ session }: { session: UserSession }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-secondary-100 px-4 py-3 dark:border-white/10">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-500/10 text-primary-500">
          <MonitorSmartphone className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-secondary-900 dark:text-secondary-100">
            {session.user_agent || "Unknown device"}
          </p>
          <p className="data-mono mt-0.5 text-xs text-secondary-400 dark:text-secondary-500">
            {session.ip_address || "Unknown IP"} · signed in {formatDateTime(session.login_at)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {session.is_current ? <Badge variant="soft-success">This device</Badge> : null}
        {session.revoked_at ? <Badge variant="soft-danger">Revoked</Badge> : null}
      </div>
    </div>
  );
}

function SessionsCard({ profile }: { profile: MyProfile }) {
  const toast = useToast();
  const sessionsQuery = useMySessions(profile.id);
  const revokeAll = useRevokeAllMySessions();
  const revokeDialog = useDisclosure();

  const handleRevokeAll = async () => {
    try {
      const result = await revokeAll.mutateAsync(profile.id);
      toast.success("Sessions revoked", result.message);
    } catch (error) {
      toast.error("Failed to revoke sessions", getApiErrorMessage(error, "Please try again."));
      throw error;
    }
  };

  const sessions = sessionsQuery.data ?? [];

  return (
    <Card>
      <CardHeader
        title="Active Sessions"
        description="Devices currently signed in to your account."
        actions={
          sessions.length > 0 ? (
            <Button
              variant="danger"
              size="sm"
              leftIcon={<LogOut className="h-4 w-4" />}
              onClick={revokeDialog.open}
            >
              Revoke All
            </Button>
          ) : undefined
        }
      />
      {sessionsQuery.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : sessionsQuery.isError ? (
        <p className="text-sm font-medium text-secondary-500 dark:text-secondary-400">
          Session management is only available to administrators on this account.
        </p>
      ) : sessions.length === 0 ? (
        <EmptyState
          icon={MonitorSmartphone}
          title="No active sessions"
          description="Sessions will appear here after you sign in."
        />
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => (
            <SessionRow key={session.id} session={session} />
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={revokeDialog.isOpen}
        onClose={revokeDialog.close}
        onConfirm={handleRevokeAll}
        title="Revoke All Sessions"
        description="Every device signed in to your account — including this one — will be logged out."
        confirmLabel="Revoke All"
        tone="danger"
      />
    </Card>
  );
}

// =====================================================================
// Page
// =====================================================================

function AppearanceCard() {
  const { theme, setTheme } = useTheme();
  const options: { value: "light" | "dark"; label: string; icon: typeof Sun; hint: string }[] = [
    { value: "light", label: "Light", icon: Sun, hint: "Bright, high-contrast interface." },
    { value: "dark", label: "Dark", icon: Moon, hint: "Dimmed interface, easier at night." },
  ];

  return (
    <Card>
      <CardHeader
        title="Appearance"
        description="Choose your theme. Your choice is saved to your profile and follows you on every device."
      />
      <div className="grid gap-4 p-6 pt-0 sm:grid-cols-2">
        {options.map((opt) => {
          const active = theme === opt.value;
          const Icon = opt.icon;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setTheme(opt.value)}
              aria-pressed={active}
              className={`flex items-start gap-4 rounded-2xl border-2 p-5 text-left transition-all ${
                active
                  ? "border-primary-500 bg-primary-500/5 shadow-md"
                  : "border-secondary-200 hover:border-primary-300 dark:border-white/10"
              }`}
            >
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                  active ? "bg-primary-500 text-white" : "bg-secondary-100 text-secondary-500 dark:bg-white/5"
                }`}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-secondary-900">{opt.label}</span>
                  {active && <CheckCircle2 className="h-4 w-4 text-primary-500" />}
                </div>
                <p className="mt-1 text-xs font-medium text-secondary-500">{opt.hint}</p>
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

export function ProfilePage() {
  const profileQuery = useMyProfile();
  const profile = profileQuery.data;

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="My Profile"
        description="Manage your personal information and account security."
      />

      {profileQuery.isLoading ? (
        <div className="space-y-6">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : profileQuery.isError || !profile ? (
        <Card>
          <EmptyState
            icon={UserRound}
            title="Unable to load your profile"
            description={getApiErrorMessage(
              profileQuery.error,
              "Your profile could not be fetched. Please try again."
            )}
            action={
              <Button variant="secondary" size="sm" onClick={() => profileQuery.refetch()}>
                Retry
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <ProfileHeaderCard profile={profile} />
          <ProfileDetailsCard key={`details-${profile.id}`} profile={profile} />
          <AppearanceCard />
          <div className="grid gap-6 xl:grid-cols-2">
            <ChangePasswordCard />
            <TwoFactorCard profile={profile} />
          </div>
          <SessionsCard profile={profile} />
        </>
      )}
    </div>
  );
}

export default ProfilePage;
