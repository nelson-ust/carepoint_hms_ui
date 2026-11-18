import { useEffect, useState } from "react";
import { DxPopup, DxButton, DxInput, DxSelect, DxTextarea } from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/api/api-error";
import {
  useCreateShiftDefinition,
  useUpdateShiftDefinition,
} from "../hooks/use-hr";
import type { ShiftDefinition, StaffShiftType } from "../api/hr.api";

const SHIFT_TYPES: { value: StaffShiftType; label: string }[] = [
  { value: "MORNING", label: "Morning" },
  { value: "AFTERNOON", label: "Afternoon" },
  { value: "NIGHT", label: "Night" },
  { value: "WEEKEND", label: "Weekend" },
  { value: "EMERGENCY", label: "Emergency" },
  { value: "ON_CALL", label: "On-call" },
  { value: "OFF_DUTY", label: "Off-duty" },
];

const DEFAULT_COLOR = "#0ea5e9";

function hhmm(t?: string | null): string {
  if (!t) return "";
  return t.slice(0, 5);
}

export function ShiftDefinitionModal({
  isOpen,
  onClose,
  departmentId,
  serviceDeliveryPointId,
  scopeLabel,
  existing,
}: {
  isOpen: boolean;
  onClose: () => void;
  departmentId: number;
  serviceDeliveryPointId: number | null;
  /** Human label of the current dept/unit scope, shown for context. */
  scopeLabel: string;
  /** When set, the modal edits this definition instead of creating a new one. */
  existing?: ShiftDefinition | null;
}) {
  const toast = useToast();
  const createMut = useCreateShiftDefinition();
  const updateMut = useUpdateShiftDefinition();
  const isEdit = !!existing;

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [shiftType, setShiftType] = useState<StaffShiftType>("MORNING");
  const [startTime, setStartTime] = useState("07:00");
  const [endTime, setEndTime] = useState("14:00");
  const [breakMinutes, setBreakMinutes] = useState("0");
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    if (existing) {
      setName(existing.name);
      setCode(existing.code);
      setShiftType(existing.shift_type);
      setStartTime(hhmm(existing.start_time));
      setEndTime(hhmm(existing.end_time));
      setBreakMinutes(String(existing.break_duration_minutes ?? 0));
      setColor(existing.color_hex || DEFAULT_COLOR);
      setDescription(existing.description || "");
    } else {
      setName("");
      setCode("");
      setShiftType("MORNING");
      setStartTime("07:00");
      setEndTime("14:00");
      setBreakMinutes("0");
      setColor(DEFAULT_COLOR);
      setDescription("");
    }
  }, [isOpen, existing]);

  const isSubmitting = createMut.isPending || updateMut.isPending;

  const handleSubmit = async () => {
    if (!name.trim() || !startTime || !endTime) {
      toast.error("Missing details", "Name, start time and end time are required.");
      return;
    }
    if (!isEdit && !code.trim()) {
      toast.error("Missing code", "A short shift code is required.");
      return;
    }
    try {
      if (isEdit && existing) {
        await updateMut.mutateAsync({
          id: existing.id,
          payload: {
            name: name.trim(),
            shift_type: shiftType,
            start_time: startTime,
            end_time: endTime,
            break_duration_minutes: Number(breakMinutes) || 0,
            color_hex: color,
            description: description.trim() || null,
          },
        });
        toast.success("Shift updated", `${name.trim()} saved.`);
      } else {
        await createMut.mutateAsync({
          department_id: departmentId,
          service_delivery_point_id: serviceDeliveryPointId,
          name: name.trim(),
          code: code.trim().toUpperCase(),
          shift_type: shiftType,
          start_time: startTime,
          end_time: endTime,
          break_duration_minutes: Number(breakMinutes) || 0,
          color_hex: color,
          description: description.trim() || null,
        });
        toast.success("Shift created", `${name.trim()} added to the roster.`);
      }
      onClose();
    } catch (err) {
      toast.error("Couldn't save shift", apiErrorMessage(err, "Please try again."));
    }
  };

  return (
    <DxPopup
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? "Edit Shift" : "New Shift"}
      size="lg"
      locked={isSubmitting}
      footer={
        <>
          <DxButton onClick={onClose} disabled={isSubmitting}>Cancel</DxButton>
          <DxButton variant="primary" onClick={handleSubmit} isLoading={isSubmitting}>{isEdit ? "Save changes" : "Create shift"}</DxButton>
        </>
      }
    >
      <div className="space-y-5">
        <p className="rounded-md bg-[var(--dx-surface-sunken)] px-4 py-3 text-[12px] font-semibold text-[var(--dx-text-muted)]">
          Scope: <span className="text-[var(--dx-text)]">{scopeLabel}</span>
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <DxInput label="Shift name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Morning Shift" />
          <DxInput label="Code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. MORN" disabled={isEdit} hint={isEdit ? "Code can't be changed" : "Short unique label"} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <DxSelect label="Shift type" value={shiftType} onChange={(e) => setShiftType(e.target.value as StaffShiftType)} options={SHIFT_TYPES} />
          <div>
            <span className="dx-field-label">Colour</span>
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="mt-1 h-10 w-full cursor-pointer rounded-md border border-[var(--dx-border)] bg-[var(--dx-surface)] p-1" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <DxInput label="Start time" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          <DxInput label="End time" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          <DxInput label="Break (min)" type="number" min={0} value={breakMinutes} onChange={(e) => setBreakMinutes(e.target.value)} />
        </div>

        <DxTextarea label="Notes (optional)" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Anything the team should know about this shift" rows={2} />
      </div>
    </DxPopup>
  );
}
