import { DxPopup, DxButton, DxBadge } from "@/components/dx";
import { Check, Trash2, Clock } from "lucide-react";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/api/api-error";
import {
  useCreateShiftAssignment,
  useUpdateShiftAssignment,
  useDeleteShiftAssignment,
} from "../hooks/use-hr";
import type { ShiftAssignment, ShiftDefinition } from "../api/hr.api";

function hhmm(t?: string | null): string {
  return t ? t.slice(0, 5) : "";
}

function prettyDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
}

export function AssignShiftModal({
  isOpen,
  onClose,
  staffId,
  staffName,
  date,
  definitions,
  existing,
}: {
  isOpen: boolean;
  onClose: () => void;
  staffId: number;
  staffName: string;
  date: string; // YYYY-MM-DD
  definitions: ShiftDefinition[];
  /** The staff member's current assignment on this date, if any. */
  existing: ShiftAssignment | null;
}) {
  const toast = useToast();
  const createMut = useCreateShiftAssignment();
  const updateMut = useUpdateShiftAssignment();
  const deleteMut = useDeleteShiftAssignment();

  const busy = createMut.isPending || updateMut.isPending || deleteMut.isPending;

  const pick = async (def: ShiftDefinition) => {
    try {
      if (existing) {
        if (existing.shift_definition_id === def.id) {
          onClose();
          return;
        }
        await updateMut.mutateAsync({ id: existing.id, payload: { shift_definition_id: def.id } });
        toast.success("Shift changed", `${staffName} → ${def.name}.`);
      } else {
        await createMut.mutateAsync({ staff_profile_id: staffId, shift_definition_id: def.id, shift_date: date });
        toast.success("Shift assigned", `${staffName} → ${def.name}.`);
      }
      onClose();
    } catch (err) {
      toast.error("Couldn't assign shift", apiErrorMessage(err, "Please try again."));
    }
  };

  const remove = async () => {
    if (!existing) return;
    try {
      await deleteMut.mutateAsync(existing.id);
      toast.success("Removed from roster", `${staffName} cleared for this day.`);
      onClose();
    } catch (err) {
      toast.error("Couldn't remove shift", apiErrorMessage(err, "Please try again."));
    }
  };

  return (
    <DxPopup
      isOpen={isOpen}
      onClose={onClose}
      title="Assign Shift"
      size="md"
      locked={busy}
      footer={
        existing ? (
          <div className="flex w-full items-center justify-between gap-3">
            <DxButton variant="danger" onClick={remove} isLoading={deleteMut.isPending} leftIcon={<Trash2 className="h-4 w-4" />}>Remove</DxButton>
            <DxButton onClick={onClose} disabled={busy}>Done</DxButton>
          </div>
        ) : (
          <DxButton onClick={onClose} disabled={busy}>Cancel</DxButton>
        )
      }
    >
      <div className="space-y-5">
        <div className="rounded-md bg-[var(--dx-surface-sunken)] px-4 py-3">
          <p className="text-[14px] font-semibold text-[var(--dx-text)]">{staffName}</p>
          <p className="text-[12px] font-semibold text-[var(--dx-text-muted)]">{prettyDate(date)}</p>
        </div>

        {definitions.length === 0 ? (
          <p className="rounded-md border border-dashed border-[var(--dx-border)] px-4 py-6 text-center text-[13px] text-[var(--dx-text-muted)]">
            No shifts configured for this scope yet. Add shifts first.
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--dx-text-muted)]">{existing ? "Change to" : "Pick a shift"}</p>
            {definitions.map((def) => {
              const selected = existing?.shift_definition_id === def.id;
              return (
                <button
                  key={def.id}
                  type="button"
                  disabled={busy}
                  onClick={() => pick(def)}
                  className="flex w-full items-center justify-between rounded-md border-2 px-4 py-3 text-left transition-colors disabled:opacity-50"
                  style={selected ? { borderColor: "var(--dx-accent)", background: "var(--dx-accent-soft)" } : { borderColor: "var(--dx-border)" }}
                >
                  <span className="flex items-center gap-3">
                    <span className="h-8 w-1.5 rounded-full" style={{ backgroundColor: def.color_hex || "#94a3b8" }} />
                    <span>
                      <span className="block text-[14px] font-semibold text-[var(--dx-text)]">{def.name}</span>
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-[var(--dx-text-muted)]">
                        <Clock className="h-3 w-3" />
                        {hhmm(def.start_time)}–{hhmm(def.end_time)}
                      </span>
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <DxBadge tone="neutral">{def.code}</DxBadge>
                    {selected ? <Check className="h-4 w-4" style={{ color: "var(--dx-accent)" }} /> : null}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </DxPopup>
  );
}
