import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertCircle, CheckCircle2, KeyRound, ShieldCheck, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAcceptInvitation } from "../hooks/use-invitations";

const schema = z
  .object({
    username: z.string().min(3, "At least 3 characters").max(64),
    first_name: z.string().max(100).optional().or(z.literal("")),
    last_name: z.string().max(100).optional().or(z.literal("")),
    phone_number: z.string().max(30).optional().or(z.literal("")),
    password: z
      .string()
      .min(8, "At least 8 characters")
      .regex(/[A-Z]/, "Needs an uppercase letter")
      .regex(/[a-z]/, "Needs a lowercase letter")
      .regex(/\d/, "Needs a digit"),
    confirm_password: z.string(),
  })
  .refine((v) => v.password === v.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

type FormValues = z.infer<typeof schema>;

/**
 * Public landing page for staff invitation links
 * (`/invitations/accept?token=…` — the URL embedded in invite emails).
 */
export function AcceptInvitationPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") ?? "";
  const tenantCode = params.get("tenant") ?? "";
  const acceptMutation = useAcceptInvitation();
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await acceptMutation.mutateAsync({
        tenantCode: tenantCode || undefined,
        token,
        username: values.username,
        password: values.password,
        first_name: values.first_name || undefined,
        last_name: values.last_name || undefined,
        phone_number: values.phone_number || undefined,
      });
      setDone(true);
      window.setTimeout(() => navigate("/login"), 2500);
    } catch (err: any) {
      setServerError(
        err?.response?.data?.message ||
          (err?.response
            ? "This invitation link is invalid, expired, or already used."
            : "Cannot reach the server. Please try again shortly."),
      );
    }
  });

  return (
    <main className="ambient-bg relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 p-6 transition-colors duration-500 dark:bg-secondary-950">
      <div className="pointer-events-none absolute -top-[10%] -left-[10%] h-[45%] w-[45%] rounded-full bg-emerald-500/10 blur-[130px]" />
      <div className="pointer-events-none absolute -bottom-[10%] -right-[10%] h-[45%] w-[45%] rounded-full bg-cyan-500/10 blur-[130px]" />

      <div className="glass-card relative z-10 w-full max-w-lg p-10">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-primary-500/10 text-primary-500 shadow-glow-sm">
            <UserPlus className="h-7 w-7" />
          </div>
          <h1 className="mt-4 font-display text-2xl font-bold text-secondary-900">Join your hospital team</h1>
          <p className="mt-2 text-sm font-medium text-secondary-500">
            You've been invited to CarePoint HMS. Choose your sign-in credentials to finish setting up your account.
          </p>
        </div>

        {!token ? (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-5 py-4">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
            <p className="text-sm font-medium text-secondary-700">
              This link is missing its invitation token. Open the exact link from your invitation
              email, or ask your administrator to resend it.
            </p>
          </div>
        ) : done ? (
          <div className="space-y-6 text-center animate-fade-in">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-500/10 text-emerald-500">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <p className="text-sm font-medium text-secondary-600">
              Your account is ready. Redirecting you to sign in…
            </p>
            <Link to="/login" className="btn-primary mx-auto inline-flex text-xs">
              Go to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-5">
            {serverError ? (
              <div className="flex items-start gap-3 rounded-2xl border border-rose-500/25 bg-rose-500/10 px-5 py-4">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
                <p className="text-sm font-medium text-rose-600 dark:text-rose-300">{serverError}</p>
              </div>
            ) : null}

            <Input
              label="Username"
              placeholder="e.g. ada.obi"
              autoComplete="username"
              leftIcon={<ShieldCheck className="h-4 w-4" />}
              {...register("username")}
              error={errors.username?.message}
            />
            <div className="grid gap-5 sm:grid-cols-2">
              <Input label="First name" placeholder="Optional" {...register("first_name")} error={errors.first_name?.message} />
              <Input label="Last name" placeholder="Optional" {...register("last_name")} error={errors.last_name?.message} />
            </div>
            <Input label="Phone number" placeholder="Optional" autoComplete="tel" {...register("phone_number")} error={errors.phone_number?.message} />
            <Input
              label="Password"
              type="password"
              autoComplete="new-password"
              leftIcon={<KeyRound className="h-4 w-4" />}
              {...register("password")}
              error={errors.password?.message}
            />
            <Input
              label="Confirm password"
              type="password"
              autoComplete="new-password"
              {...register("confirm_password")}
              error={errors.confirm_password?.message}
            />

            <Button type="submit" className="w-full" isLoading={acceptMutation.isPending}>
              Create my account
            </Button>
            <p className="text-center text-[11px] text-secondary-400">
              Already have an account? <Link to="/login" className="font-bold text-primary-500 hover:underline">Sign in</Link>
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
