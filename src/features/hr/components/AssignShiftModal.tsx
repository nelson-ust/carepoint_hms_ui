import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
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
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
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
        await updateMut.mutateAsync({
          id: existing.id,
          payload: { shift_definition_id: def.id },
        });
        toast.success("Shift changed", `${staffName} → ${def.name}.`);
      } else {
        await createMut.mutateAsync({
          staff_profile_id: staffId,
          shift_definition_id: def.id,
          shift_date: date,
        });
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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Assign Shift"
      size="md"
      footer={
        existing ? (
          <div className="flex items-center justify-between gap-3">
            <Button
              variant="danger"
              onClick={remove}
              isLoading={deleteMut.isPending}
              leftIcon={<Trash2 className="h-4 w-4" />}
            >
              Remove
            </Button>
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Done
            </Button>
          </div>
        ) : (
          <div className="flex justify-end">
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
          </div>
        )
      }
    >
      <div className="space-y-5">
        <div className="rounded-2xl bg-secondary-50 px-4 py-3 dark:bg-white/5">
          <p className="text-sm font-black text-secondary-900 dark:text-secondary-100">
            {staffName}
          </p>
          <p className="text-xs font-semibold text-secondary-500">{prettyDate(date)}</p>
        </div>

        {definitions.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-secondary-200 px-4 py-6 text-center text-sm text-secondary-400 dark:border-white/10">
            No shifts configured for this scope yet. Add shifts first.
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-secondary-400">
              {existing ? "Change to" : "Pick a shift"}
            </p>
            {definitions.map((def) => {
              const selected = existing?.shift_definition_id === def.id;
              return (
                <button
                  key={def.id}
                  type="button"
                  disabled={busy}
                  onClick={() => pick(def)}
                  className={`flex w-full items-center justify-between rounded-2xl border-2 px-4 py-3 text-left transition-all disabled:opacity-50 ${
                    selected
                      ? "border-primary-500 bg-primary-50 dark:bg-primary-500/10"
                      : "border-secondary-200 hover:border-primary-300 dark:border-white/10"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <span
                      className="h-8 w-1.5 rounded-full"
                      style={{ backgroundColor: def.color_hex || "#94a3b8" }}
                    />
                    <span>
                      <span className="block text-sm font-black text-secondary-900 dark:text-secondary-100">
                        {def.name}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] font-bold text-secondary-400">
                        <Clock className="h-3 w-3" />
                        {hhmm(def.start_time)}–{hhmm(def.end_time)}
                      </span>
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <Badge variant="secondary">{def.code}</Badge>
                    {selected ? <Check className="h-4 w-4 text-primary-500" /> : null}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}
