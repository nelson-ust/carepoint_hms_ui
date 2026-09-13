import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/feedback/ToastProvider";
import { useCreateRequestType } from "../hooks/use-approvals";

type Props = { isOpen: boolean; onClose: () => void; onCreated?: (code: string) => void };

export function RequestTypeModal({ isOpen, onClose, onCreated }: Props) {
  const toast = useToast();
  const create = useCreateRequestType();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (isOpen) { setCode(""); setName(""); setDescription(""); }
  }, [isOpen]);

  async function submit() {
    const c = code.trim().toUpperCase().replace(/\s+/g, "_");
    if (!c || !name.trim()) {
      toast.error("Missing fields", "Code and name are required.");
      return;
    }
    try {
      await create.mutateAsync({ code: c, name: name.trim(), description: description.trim() || undefined });
      toast.success("Request type created", `${name.trim()} (${c})`);
      onCreated?.(c);
      onClose();
    } catch (err: any) {
      const d = err?.response?.data?.detail ?? err?.response?.data?.message;
      toast.error("Couldn't create request type", typeof d === "string" ? d : "Please try again.");
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="New Request Type"
      size="md"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={create.isPending}>Cancel</Button>
          <Button onClick={submit} isLoading={create.isPending}>Create type</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Input label="Code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="EQUIPMENT_REQUEST" hint="Uppercase, unique. Spaces become underscores." />
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Equipment Request" />
        <Textarea label="Description (optional)" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
    </Modal>
  );
}
