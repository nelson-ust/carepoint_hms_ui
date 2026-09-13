import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CalendarPlus, Stethoscope } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/feedback/ToastProvider";
import { getStoredPortalSession, portalErrorMessage } from "../api/portal.api";
import { usePortalClinicians, useRequestPortalAppointment } from "../hooks/use-portal";

const appointmentSchema = z.object({
  requested_date: z
    .string()
    .min(1, "Choose a preferred date and time")
    .refine((v) => !Number.isNaN(new Date(v).getTime()), "Enter a valid date")
    .refine(
      (v) => new Date(v).getTime() > Date.now(),
      "The requested date must be in the future",
    ),
  reason: z.string().min(5, "Tell us briefly why you need the appointment"),
  priority: z.string().min(1, "Select a priority"),
  requested_clinician_id: z.string().optional(),
});

type AppointmentFormValues = z.infer<typeof appointmentSchema>;

const priorityOptions = [
  { value: "NORMAL", label: "Normal" },
  { value: "URGENT", label: "Urgent" },
  { value: "EMERGENCY", label: "Emergency" },
];

interface AppointmentRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * POST /portal/{account_id}/appointment-requests
 * { requested_date (ISO datetime), reason, priority } — the optional
 * requested_sdp_id / requested_clinician_id are omitted (patients pick
 * neither; the hospital triages the request).
 */
export function AppointmentRequestModal({ isOpen, onClose }: AppointmentRequestModalProps) {
  const toast = useToast();
  const requestAppointment = useRequestPortalAppointment();
  const session = getStoredPortalSession();
  const [needsDoctor, setNeedsDoctor] = useState(false);

  // Only load the doctor list once the patient says the visit needs one.
  const cliniciansQuery = usePortalClinicians(session?.patient_id, isOpen && needsDoctor);
  const clinicians = cliniciansQuery.data ?? [];

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AppointmentFormValues>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: { priority: "NORMAL" },
  });

  function handleClose() {
    reset({ priority: "NORMAL", requested_date: "", reason: "", requested_clinician_id: "" });
    setNeedsDoctor(false);
    onClose();
  }

  function onSubmit(values: AppointmentFormValues) {
    if (!session) {
      toast.error("Session expired", "Please sign in again to request an appointment.");
      return;
    }

    const clinicianId =
      needsDoctor && values.requested_clinician_id
        ? Number(values.requested_clinician_id)
        : undefined;

    requestAppointment.mutate(
      {
        accountId: session.patient_id,
        payload: {
          requested_date: new Date(values.requested_date).toISOString(),
          reason: values.reason.trim(),
          priority: values.priority,
          ...(clinicianId ? { requested_clinician_id: clinicianId } : {}),
        },
      },
      {
        onSuccess: () => {
          toast.success(
            "Appointment scheduled",
            "Your appointment has been booked for your requested time. The hospital may reach out to confirm details.",
          );
          handleClose();
        },
        onError: (err) => {
          toast.error(
            "Could not send request",
            portalErrorMessage(err, "Please try again in a moment."),
          );
        },
      },
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Request an appointment" size="md">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Input
          label="Preferred date & time"
          type="datetime-local"
          error={errors.requested_date?.message}
          {...register("requested_date")}
        />

        <Select
          label="Priority"
          options={priorityOptions}
          error={errors.priority?.message}
          {...register("priority")}
        />

        <Textarea
          label="Reason for visit"
          rows={4}
          placeholder="e.g. Follow-up on my blood pressure medication"
          error={errors.reason?.message}
          {...register("reason")}
        />

        {/* Optional: does this visit need to see a specific doctor? */}
        <div className="rounded-2xl border border-secondary-200 p-4 dark:border-white/10">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
              checked={needsDoctor}
              onChange={(e) => setNeedsDoctor(e.target.checked)}
            />
            <span>
              <span className="flex items-center gap-1.5 text-sm font-bold text-secondary-900">
                <Stethoscope className="h-4 w-4 text-primary-500" />
                This visit requires seeing a doctor
              </span>
              <span className="mt-0.5 block text-xs font-medium text-secondary-500">
                Optionally choose a preferred doctor. Leave it to the hospital to assign one otherwise.
              </span>
            </span>
          </label>

          {needsDoctor ? (
            <div className="mt-4">
              <Select
                label="Preferred doctor (optional)"
                error={errors.requested_clinician_id?.message}
                {...register("requested_clinician_id")}
                options={[
                  {
                    value: "",
                    label: cliniciansQuery.isLoading ? "Loading doctors…" : "No preference — hospital decides",
                  },
                  ...clinicians.map((c) => ({
                    value: String(c.id),
                    label: c.specialty ? `${c.name} · ${c.specialty}` : c.name,
                  })),
                ]}
              />
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            isLoading={requestAppointment.isPending}
            leftIcon={<CalendarPlus className="h-4 w-4" />}
          >
            Send request
          </Button>
        </div>
      </form>
    </Modal>
  );
}
