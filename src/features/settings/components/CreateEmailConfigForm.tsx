import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Mail } from "lucide-react";
import { DxButton, DxInput } from "@/components/dx";
import { useCreateEmailConfig } from "../hooks/use-email-settings";

const emailSchema = z.object({
  provider_name: z.string().min(2, "Provider name is required"),
  smtp_host: z.string().min(3, "SMTP host is required"),
  smtp_port: z.number().min(1).max(65535),
  smtp_user: z.string().min(1, "SMTP user is required"),
  smtp_password: z.string().min(1, "SMTP password is required"),
  sender_email: z.string().email("Invalid sender email"),
  sender_name: z.string().min(1, "Sender name is required"),
  use_tls: z.boolean(),
  is_active: z.boolean(),
});

type EmailFormValues = z.infer<typeof emailSchema>;

interface CreateEmailConfigFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function CreateEmailConfigForm({ onSuccess, onCancel }: CreateEmailConfigFormProps) {
  const { mutate, isPending } = useCreateEmailConfig();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(emailSchema),
    defaultValues: {
      smtp_port: 587,
      use_tls: true,
      is_active: true,
    },
  });

  const onSubmit = (data: EmailFormValues) => {
    mutate(data, {
      onSuccess: () => {
        onSuccess();
      },
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <DxInput
            label="Provider Name"
            placeholder="e.g. SendGrid Production"
            error={errors.provider_name?.message}
            {...register("provider_name")}
          />
        </div>

        <div className="col-span-2 sm:col-span-1">
          <DxInput
            label="SMTP Host"
            placeholder="smtp.sendgrid.net"
            error={errors.smtp_host?.message}
            {...register("smtp_host")}
          />
        </div>

        <div className="col-span-2 sm:col-span-1">
          <DxInput
            label="SMTP Port"
            type="number"
            error={errors.smtp_port?.message}
            {...register("smtp_port", { valueAsNumber: true })}
          />
        </div>

        <div className="col-span-2 sm:col-span-1">
          <DxInput
            label="SMTP Username"
            error={errors.smtp_user?.message}
            {...register("smtp_user")}
          />
        </div>

        <div className="col-span-2 sm:col-span-1">
          <DxInput
            label="SMTP Password"
            type="password"
            error={errors.smtp_password?.message}
            {...register("smtp_password")}
          />
        </div>

        <div className="col-span-2 sm:col-span-1">
          <DxInput
            label="Sender Email"
            placeholder="noreply@hospital.com"
            error={errors.sender_email?.message}
            {...register("sender_email")}
          />
        </div>

        <div className="col-span-2 sm:col-span-1">
          <DxInput
            label="Sender Name"
            placeholder="Carepoint HMS"
            error={errors.sender_name?.message}
            {...register("sender_name")}
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 border-t border-[var(--dx-border)] pt-5">
        <DxButton type="button" onClick={onCancel} disabled={isPending}>
          Cancel
        </DxButton>
        <DxButton
          type="submit"
          variant="primary"
          isLoading={isPending}
          leftIcon={<Mail className="h-4 w-4" />}
        >
          {isPending ? "Connecting…" : "Save Configuration"}
        </DxButton>
      </div>
    </form>
  );
}
