import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Mail, Shield, RefreshCw } from "lucide-react";
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
    }
  });

  const onSubmit = (data: EmailFormValues) => {
    mutate(data, {
      onSuccess: () => {
        onSuccess();
      },
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-2 col-span-2">
          <label className="text-xs font-bold text-secondary-500 uppercase tracking-widest ml-1">Provider Name</label>
          <input
            {...register("provider_name")}
            className={`w-full bg-secondary-50 border-none rounded-2xl px-5 py-4 text-sm focus:ring-2 focus:ring-primary-500/50 transition-all font-medium ${errors.provider_name ? 'ring-2 ring-rose-500/50' : ''}`}
            placeholder="e.g. SendGrid Production"
          />
        </div>

        <div className="space-y-2 col-span-2 sm:col-span-1">
          <label className="text-xs font-bold text-secondary-500 uppercase tracking-widest ml-1">SMTP Host</label>
          <input
            {...register("smtp_host")}
            className="w-full bg-secondary-50 border-none rounded-2xl px-5 py-4 text-sm focus:ring-2 focus:ring-primary-500/50 transition-all font-medium"
            placeholder="smtp.sendgrid.net"
          />
        </div>

        <div className="space-y-2 col-span-2 sm:col-span-1">
          <label className="text-xs font-bold text-secondary-500 uppercase tracking-widest ml-1">SMTP Port</label>
          <input
            type="number"
            {...register("smtp_port", { valueAsNumber: true })}
            className="w-full bg-secondary-50 border-none rounded-2xl px-5 py-4 text-sm focus:ring-2 focus:ring-primary-500/50 transition-all font-medium"
          />
        </div>

        <div className="space-y-2 col-span-2 sm:col-span-1">
          <label className="text-xs font-bold text-secondary-500 uppercase tracking-widest ml-1">SMTP Username</label>
          <input
            {...register("smtp_user")}
            className="w-full bg-secondary-50 border-none rounded-2xl px-5 py-4 text-sm focus:ring-2 focus:ring-primary-500/50 transition-all font-medium"
          />
        </div>

        <div className="space-y-2 col-span-2 sm:col-span-1">
          <label className="text-xs font-bold text-secondary-500 uppercase tracking-widest ml-1">SMTP Password</label>
          <input
            type="password"
            {...register("smtp_password")}
            className="w-full bg-secondary-50 border-none rounded-2xl px-5 py-4 text-sm focus:ring-2 focus:ring-primary-500/50 transition-all font-medium"
          />
        </div>

        <div className="space-y-2 col-span-2 sm:col-span-1">
          <label className="text-xs font-bold text-secondary-500 uppercase tracking-widest ml-1">Sender Email</label>
          <input
            {...register("sender_email")}
            className="w-full bg-secondary-50 border-none rounded-2xl px-5 py-4 text-sm focus:ring-2 focus:ring-primary-500/50 transition-all font-medium"
            placeholder="noreply@hospital.com"
          />
        </div>

        <div className="space-y-2 col-span-2 sm:col-span-1">
          <label className="text-xs font-bold text-secondary-500 uppercase tracking-widest ml-1">Sender Name</label>
          <input
            {...register("sender_name")}
            className="w-full bg-secondary-50 border-none rounded-2xl px-5 py-4 text-sm focus:ring-2 focus:ring-primary-500/50 transition-all font-medium"
            placeholder="Carepoint HMS"
          />
        </div>
      </div>

      <div className="flex gap-4 pt-6 border-t border-secondary-100">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-8 py-4 rounded-2xl bg-secondary-100 text-secondary-600 text-sm font-bold hover:bg-secondary-200 transition-all"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="flex-3 px-8 py-4 rounded-2xl bg-secondary-900 text-white text-sm font-bold shadow-lg shadow-secondary-900/10 hover:bg-black transition-all flex items-center justify-center gap-2"
        >
          {isPending ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Mail className="h-4 w-4" />
          )}
          <span>{isPending ? 'Connecting...' : 'Save Configuration'}</span>
        </button>
      </div>
    </form>
  );
}
