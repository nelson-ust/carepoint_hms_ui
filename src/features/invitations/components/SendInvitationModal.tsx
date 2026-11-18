import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { Check, Copy, Link2, Send } from "lucide-react";
import { DxPopup, DxButton, DxInput, DxSelect } from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import { listRoles } from "@/features/roles/api/roles.api";
import { useCreateInvitation } from "../hooks/use-invitations";
import { buildAcceptUrl } from "../api/invitations.api";
import type { InvitationCreateResponse } from "../api/invitations.api";

const schema = z
  .object({
    first_name: z.string().max(100).optional().or(z.literal("")),
    last_name: z.string().max(100).optional().or(z.literal("")),
    email: z.string().email("Enter a valid email").optional().or(z.literal("")),
    phone_number: z.string().max(30).optional().or(z.literal("")),
    expiry_days: z.string(),
  })
  .refine((v) => (v.email && v.email !== "") || (v.phone_number && v.phone_number !== ""), {
    message: "Provide an email address or a phone number.",
    path: ["email"],
  });

type FormValues = z.infer<typeof schema>;

export function SendInvitationModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const createMutation = useCreateInvitation();
  const [roleIds, setRoleIds] = useState<number[]>([]);
  const [result, setResult] = useState<InvitationCreateResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const rolesQuery = useQuery({
    queryKey: ["roles", "options"],
    queryFn: () => listRoles({ limit: 100 }),
    enabled: isOpen,
    staleTime: 5 * 60 * 1000,
  });
  const roles = rolesQuery.data?.items ?? [];

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { expiry_days: "7" },
  });

  const acceptLink = useMemo(
    () => (result ? buildAcceptUrl(result.token, result.accept_url) : null),
    [result],
  );

  const toggleRole = (id: number) =>
    setRoleIds((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]));

  const close = () => {
    if (createMutation.isPending) return;
    reset();
    setRoleIds([]);
    setResult(null);
    setCopied(false);
    onClose();
  };

  const onSubmit = handleSubmit(async (values) => {
    try {
      const res = await createMutation.mutateAsync({
        email: values.email || undefined,
        phone_number: values.phone_number || undefined,
        first_name: values.first_name || undefined,
        last_name: values.last_name || undefined,
        role_ids: roleIds.length ? roleIds : undefined,
        expiry_days: Number(values.expiry_days) || undefined,
      });
      setResult(res);
      toast.success("Invitation created", "The invite email is dispatched when SMTP is configured.");
    } catch (err: any) {
      toast.error("Could not create invitation", err?.response?.data?.message || "Please review the details and try again.");
    }
  });

  const copyLink = async () => {
    if (!acceptLink) return;
    try {
      await navigator.clipboard.writeText(acceptLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copy failed", "Select and copy the link manually.");
    }
  };

  return (
    <DxPopup isOpen={isOpen} onClose={close} title="Send Staff Invitation" size="lg">
      {result ? (
        <div className="space-y-6">
          <div className="flex items-center gap-3 rounded-md border px-5 py-4" style={{ borderColor: "var(--dx-success)", background: "var(--dx-success-soft)" }}>
            <Check className="h-5 w-5 shrink-0" style={{ color: "var(--dx-success)" }} />
            <p className="text-[13px] font-semibold text-[var(--dx-text)]">Invitation created for {result.invitation.email || result.invitation.phone_number}.</p>
          </div>
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[var(--dx-text-muted)]">Shareable accept link</p>
            <div className="flex items-center gap-2">
              <div className="dx-mono flex-1 overflow-x-auto whitespace-nowrap rounded-md border border-[var(--dx-border)] bg-[var(--dx-surface-sunken)] px-4 py-3 text-[12px]">{acceptLink}</div>
              <DxButton size="sm" onClick={copyLink} leftIcon={copied ? <Check className="h-4 w-4" style={{ color: "var(--dx-success)" }} /> : <Copy className="h-4 w-4" />}>{copied ? "Copied" : "Copy"}</DxButton>
            </div>
            <p className="mt-2 text-[12px] text-[var(--dx-text-muted)]">
              The same link is emailed automatically when outgoing email is configured. It expires on {new Date(result.invitation.expires_at).toLocaleString()}.
            </p>
          </div>
          <div className="flex justify-end">
            <DxButton variant="primary" onClick={close}>Done</DxButton>
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="grid gap-5 sm:grid-cols-2">
            <DxInput label="First name" placeholder="Ada" {...register("first_name")} error={errors.first_name?.message} />
            <DxInput label="Last name" placeholder="Obi" {...register("last_name")} error={errors.last_name?.message} />
            <DxInput label="Email" type="email" placeholder="ada.obi@hospital.com" {...register("email")} error={errors.email?.message} />
            <DxInput label="Phone number" placeholder="0803…" {...register("phone_number")} error={errors.phone_number?.message} hint="Email or phone is required." />
          </div>

          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[var(--dx-text-muted)]">Roles on acceptance</p>
            <div className="grid max-h-48 gap-2 overflow-y-auto rounded-md border border-[var(--dx-border)] p-4 sm:grid-cols-2">
              {rolesQuery.isLoading ? (
                <p className="text-[12px] text-[var(--dx-text-muted)]">Loading roles…</p>
              ) : roles.length === 0 ? (
                <p className="text-[12px] text-[var(--dx-text-muted)]">No roles defined yet — the invitee joins with defaults.</p>
              ) : (
                roles.map((role) => (
                  <label key={role.id} className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-[var(--dx-surface-sunken)]">
                    <input type="checkbox" checked={roleIds.includes(role.id)} onChange={() => toggleRole(role.id)} className="h-4 w-4 rounded" style={{ accentColor: "var(--dx-accent)" }} />
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-semibold text-[var(--dx-text)]">{role.name}</span>
                      <span className="dx-mono block text-[10px] text-[var(--dx-text-muted)]">{role.code}</span>
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>

          <DxSelect
            label="Expires after"
            {...register("expiry_days")}
            options={[
              { value: "3", label: "3 days" },
              { value: "7", label: "7 days" },
              { value: "14", label: "14 days" },
              { value: "30", label: "30 days" },
            ]}
          />

          <div className="flex justify-end gap-3 pt-2">
            <DxButton onClick={close} disabled={createMutation.isPending}>Cancel</DxButton>
            <DxButton type="submit" variant="primary" isLoading={createMutation.isPending} leftIcon={<Send className="h-4 w-4" />}>Create invitation</DxButton>
          </div>
        </form>
      )}
      {!result ? (
        <p className="mt-4 flex items-center gap-1.5 text-[11px] text-[var(--dx-text-muted)]">
          <Link2 className="h-3.5 w-3.5" />
          A copyable accept link is shown after creation — handy while email delivery is not configured.
        </p>
      ) : null}
    </DxPopup>
  );
}
