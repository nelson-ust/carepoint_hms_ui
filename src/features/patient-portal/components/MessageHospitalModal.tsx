import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Send } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/feedback/ToastProvider";
import { getStoredPortalSession, portalErrorMessage } from "../api/portal.api";
import { useSendPortalMessage } from "../hooks/use-portal";

const messageSchema = z.object({
  subject: z.string().min(3, "Add a short subject"),
  body: z.string().min(5, "Write your message"),
});

type MessageFormValues = z.infer<typeof messageSchema>;

interface MessageHospitalModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * POST /portal/{account_id}/messages { subject, body } — sends a secure
 * message from the patient to the hospital care team.
 */
export function MessageHospitalModal({ isOpen, onClose }: MessageHospitalModalProps) {
  const toast = useToast();
  const sendMessage = useSendPortalMessage();
  const session = getStoredPortalSession();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<MessageFormValues>({
    resolver: zodResolver(messageSchema),
  });

  function handleClose() {
    reset();
    onClose();
  }

  function onSubmit(values: MessageFormValues) {
    if (!session) {
      toast.error("Session expired", "Please sign in again to message the hospital.");
      return;
    }

    sendMessage.mutate(
      {
        accountId: session.patient_id,
        payload: {
          subject: values.subject.trim(),
          body: values.body.trim(),
        },
      },
      {
        onSuccess: () => {
          toast.success(
            "Message sent",
            "The hospital care team will get back to you shortly.",
          );
          handleClose();
        },
        onError: (err) => {
          toast.error(
            "Could not send message",
            portalErrorMessage(err, "Please try again in a moment."),
          );
        },
      },
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Message the hospital" size="md">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Input
          label="Subject"
          placeholder="e.g. Question about my prescription"
          error={errors.subject?.message}
          {...register("subject")}
        />

        <Textarea
          label="Message"
          rows={6}
          placeholder="Write your message to the care team…"
          error={errors.body?.message}
          {...register("body")}
        />

        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            isLoading={sendMessage.isPending}
            leftIcon={<Send className="h-4 w-4" />}
          >
            Send message
          </Button>
        </div>
      </form>
    </Modal>
  );
}
