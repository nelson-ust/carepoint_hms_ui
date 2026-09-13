import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  ShieldBan,
  Sparkles,
  Users,
} from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { MetricCard } from "@/components/charts/MetricCard";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { useToast } from "@/components/feedback/ToastProvider";
import { useDisclosure } from "@/hooks/useDisclosure";
import { cn } from "@/lib/utils/cn";

import type { AppointmentSlotStatus, CalendarSlot } from "../api/doctor-calendar.api";
import {
  useAddTimeOff,
  useCalendarSlots,
  useCreateAvailabilityTemplate,
  useDoctors,
  useMaterialiseSlots,
  useReleaseSlot,
  useStaffProfile,
} from "../hooks/use-doctor-calendar";

// ============================================================
// Calendar constants & date helpers
// ============================================================

const DAY_START_HOUR = 7;
const DAY_END_HOUR = 19;
const HOUR_HEIGHT_PX = 56;
const HOURS = Array.from(
  { length: DAY_END_HOUR - DAY_START_HOUR },
  (_, i) => DAY_START_HOUR + i,
);

const WEEKDAY_OPTIONS = [
  { value: "0", label: "Monday" },
  { value: "1", label: "Tuesday" },
  { value: "2", label: "Wednesday" },
  { value: "3", label: "Thursday" },
  { value: "4", label: "Friday" },
  { value: "5", label: "Saturday" },
  { value: "6", label: "Sunday" },
];

function startOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = (d.getDay() + 6) % 7; // 0 = Monday
  d.setDate(d.getDate() - day);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Naive local ISO (no timezone suffix) — matches the backend's naive datetimes. */
function toNaiveIso(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function toDateOnly(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function formatHourLabel(hour: number): string {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric" });
}

function errorMessage(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof Error) return error.message;
  return "Something went wrong while loading data.";
}

// ============================================================
// Slot tone mapping (static classes — no dynamic interpolation)
// ============================================================

const SLOT_TONES: Record<AppointmentSlotStatus, { block: string; dot: string; label: string }> = {
  OPEN: {
    block:
      "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 dark:text-emerald-300",
    dot: "bg-emerald-500",
    label: "Open",
  },
  BOOKED: {
    block:
      "border-cyan-500/40 bg-cyan-500/15 text-cyan-700 hover:bg-cyan-500/25 dark:text-cyan-300",
    dot: "bg-cyan-500",
    label: "Booked",
  },
  BLOCKED: {
    block:
      "border-rose-500/40 bg-rose-500/15 text-rose-700 hover:bg-rose-500/25 dark:text-rose-300",
    dot: "bg-rose-500",
    label: "Blocked",
  },
  EXPIRED: {
    block:
      "border-secondary-400/30 bg-secondary-500/10 text-secondary-500 dark:text-secondary-400",
    dot: "bg-secondary-400",
    label: "Expired",
  },
};

function slotTone(status: string) {
  return SLOT_TONES[status as AppointmentSlotStatus] ?? SLOT_TONES.EXPIRED;
}

// ============================================================
// Add availability modal (weekly template)
// ============================================================

const availabilitySchema = z
  .object({
    weekday: z.string().min(1, "Pick a weekday"),
    start_time: z.string().regex(/^\d{2}:\d{2}$/, "Start time is required"),
    end_time: z.string().regex(/^\d{2}:\d{2}$/, "End time is required"),
    slot_duration_minutes: z.coerce.number().int().min(5, "Min 5 minutes").max(240, "Max 240 minutes"),
    max_patients_per_slot: z.coerce.number().int().min(1, "Min 1").max(20, "Max 20"),
    appointment_type: z.string().max(100).optional(),
    notes: z.string().max(500).optional(),
  })
  .refine((v) => v.end_time > v.start_time, {
    message: "End time must be after start time",
    path: ["end_time"],
  });

type AvailabilityFormValues = z.infer<typeof availabilitySchema>;

function AddAvailabilityModal({
  isOpen,
  onClose,
  staffProfileId,
}: {
  isOpen: boolean;
  onClose: () => void;
  staffProfileId: number;
}) {
  const toast = useToast();
  const createTemplate = useCreateAvailabilityTemplate();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<z.input<typeof availabilitySchema>, unknown, AvailabilityFormValues>({
    resolver: zodResolver(availabilitySchema),
    defaultValues: {
      weekday: "0",
      start_time: "09:00",
      end_time: "17:00",
      slot_duration_minutes: 30,
      max_patients_per_slot: 1,
    },
  });

  const handleClose = () => {
    reset();
    onClose();
  };

  const onSubmit = (values: AvailabilityFormValues) => {
    createTemplate.mutate(
      {
        staff_profile_id: staffProfileId,
        weekday: Number(values.weekday),
        start_time: values.start_time,
        end_time: values.end_time,
        slot_duration_minutes: values.slot_duration_minutes,
        max_patients_per_slot: values.max_patients_per_slot,
        appointment_type: values.appointment_type?.trim() || undefined,
        notes: values.notes?.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success(
            "Availability added",
            "Weekly template saved. Generate slots to publish this week.",
          );
          handleClose();
        },
        onError: (err) => {
          toast.error("Could not save availability", errorMessage(err) ?? undefined);
        },
      },
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Weekly Availability"
      size="lg"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            leftIcon={<CalendarPlus className="h-4 w-4" />}
            isLoading={createTemplate.isPending}
            onClick={handleSubmit(onSubmit)}
          >
            Save Availability
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <Select
          label="Weekday"
          options={WEEKDAY_OPTIONS}
          error={errors.weekday?.message}
          {...register("weekday")}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            label="Start Time"
            type="time"
            error={errors.start_time?.message}
            {...register("start_time")}
          />
          <Input
            label="End Time"
            type="time"
            error={errors.end_time?.message}
            {...register("end_time")}
          />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            label="Slot Duration (minutes)"
            type="number"
            error={errors.slot_duration_minutes?.message}
            {...register("slot_duration_minutes")}
          />
          <Input
            label="Max Patients per Slot"
            type="number"
            error={errors.max_patients_per_slot?.message}
            {...register("max_patients_per_slot")}
          />
        </div>
        <Input
          label="Appointment Type (optional)"
          placeholder="e.g. CONSULTATION"
          error={errors.appointment_type?.message}
          {...register("appointment_type")}
        />
        <Textarea
          label="Notes (optional)"
          rows={2}
          error={errors.notes?.message}
          {...register("notes")}
        />
      </form>
    </Modal>
  );
}

// ============================================================
// Block time modal (time off)
// ============================================================

const blockTimeSchema = z
  .object({
    starts_at: z.string().min(1, "Start is required"),
    ends_at: z.string().min(1, "End is required"),
    reason: z.string().max(500).optional(),
  })
  .refine((v) => new Date(v.ends_at).getTime() > new Date(v.starts_at).getTime(), {
    message: "End must be after start",
    path: ["ends_at"],
  });

type BlockTimeFormValues = z.infer<typeof blockTimeSchema>;

function BlockTimeModal({
  isOpen,
  onClose,
  staffProfileId,
}: {
  isOpen: boolean;
  onClose: () => void;
  staffProfileId: number;
}) {
  const toast = useToast();
  const addTimeOff = useAddTimeOff();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BlockTimeFormValues>({
    resolver: zodResolver(blockTimeSchema),
  });

  const handleClose = () => {
    reset();
    onClose();
  };

  const onSubmit = (values: BlockTimeFormValues) => {
    addTimeOff.mutate(
      {
        staff_profile_id: staffProfileId,
        starts_at: `${values.starts_at}:00`,
        ends_at: `${values.ends_at}:00`,
        availability_type: "BLOCKED",
        reason: values.reason?.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Calendar blocked", "The selected period is now unavailable.");
          handleClose();
        },
        onError: (err) => {
          toast.error("Could not block calendar", errorMessage(err) ?? undefined);
        },
      },
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Block Calendar Time"
      size="md"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            leftIcon={<ShieldBan className="h-4 w-4" />}
            isLoading={addTimeOff.isPending}
            onClick={handleSubmit(onSubmit)}
          >
            Block Time
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <Input
          label="From"
          type="datetime-local"
          error={errors.starts_at?.message}
          {...register("starts_at")}
        />
        <Input
          label="Until"
          type="datetime-local"
          error={errors.ends_at?.message}
          {...register("ends_at")}
        />
        <Textarea
          label="Reason (optional)"
          rows={2}
          placeholder="Leave, conference, theatre list…"
          error={errors.reason?.message}
          {...register("reason")}
        />
      </form>
    </Modal>
  );
}

// ============================================================
// Page
// ============================================================

export function DoctorCalendarPage() {
  const toast = useToast();
  const availabilityModal = useDisclosure();
  const blockTimeModal = useDisclosure();

  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [slotToRelease, setSlotToRelease] = useState<CalendarSlot | null>(null);

  // ---- Doctors (staff module) ----
  const doctorsQuery = useDoctors();
  const doctors = doctorsQuery.data ?? [];

  useEffect(() => {
    if (!selectedUserId && doctors.length > 0) {
      setSelectedUserId(String(doctors[0].id));
    }
  }, [doctors, selectedUserId]);

  const doctorOptions = doctors.map((d) => ({
    value: String(d.id),
    label: `${d.first_name} ${d.last_name}${d.staff_no ? ` · ${d.staff_no}` : ""}`,
  }));

  const selectedDoctor = doctors.find((d) => String(d.id) === selectedUserId);

  // ---- Resolve user -> staff_profile_id (calendar endpoints key on it) ----
  const staffProfileQuery = useStaffProfile(Number(selectedUserId) || 0);
  const staffProfileId = staffProfileQuery.data?.id ?? 0;

  // ---- Week window & slots ----
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );
  const weekEnd = addDays(weekStart, 7);
  const today = new Date();

  const slotsQuery = useCalendarSlots(
    {
      staff_profile_id: staffProfileId,
      from_dt: toNaiveIso(weekStart),
      to_dt: toNaiveIso(weekEnd),
    },
    { enabled: staffProfileId > 0 },
  );
  const slots = slotsQuery.data ?? [];

  const counts = useMemo(() => {
    const acc = { OPEN: 0, BOOKED: 0, BLOCKED: 0, EXPIRED: 0 };
    slots.forEach((s) => {
      const key = s.status as keyof typeof acc;
      if (key in acc) acc[key] += 1;
    });
    return acc;
  }, [slots]);

  const slotsByDay = useMemo(() => {
    const map = new Map<number, CalendarSlot[]>();
    weekDays.forEach((_, i) => map.set(i, []));
    slots.forEach((slot) => {
      const start = new Date(slot.starts_at);
      const dayIndex = weekDays.findIndex((d) => isSameDay(d, start));
      if (dayIndex >= 0) map.get(dayIndex)?.push(slot);
    });
    return map;
  }, [slots, weekDays]);

  // ---- Materialise the visible week ----
  const materialise = useMaterialiseSlots();
  const handleGenerateSlots = () => {
    if (!staffProfileId) return;
    materialise.mutate(
      {
        staff_profile_id: staffProfileId,
        from_date: toDateOnly(weekStart),
        through_date: toDateOnly(addDays(weekStart, 6)),
      },
      {
        onSuccess: ({ created }) => {
          toast.success(
            "Slots generated",
            created > 0
              ? `${created} slot${created === 1 ? "" : "s"} materialised for this week.`
              : "No new slots — templates may already be materialised.",
          );
        },
        onError: (err) => {
          toast.error("Could not generate slots", errorMessage(err) ?? undefined);
        },
      },
    );
  };

  // ---- Release booked slot ----
  const releaseSlotMutation = useReleaseSlot();

  const weekLabel = `${weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${addDays(weekStart, 6).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;

  const gridBodyHeight = HOURS.length * HOUR_HEIGHT_PX;

  function renderSlotBlock(slot: CalendarSlot) {
    const start = new Date(slot.starts_at);
    const end = new Date(slot.ends_at);
    const startOffset = start.getHours() + start.getMinutes() / 60 - DAY_START_HOUR;
    const endOffset = end.getHours() + end.getMinutes() / 60 - DAY_START_HOUR;
    const top = Math.max(0, startOffset) * HOUR_HEIGHT_PX;
    const bottom = Math.min(HOURS.length, Math.max(endOffset, startOffset + 0.35)) * HOUR_HEIGHT_PX;
    if (bottom <= 0 || top >= gridBodyHeight) return null;

    const tone = slotTone(slot.status);
    const clickable = slot.status === "BOOKED";

    return (
      <button
        key={slot.id}
        type="button"
        disabled={!clickable}
        onClick={() => (clickable ? setSlotToRelease(slot) : undefined)}
        title={`${tone.label} · ${formatTime(start)}–${formatTime(end)}${slot.block_reason ? ` · ${slot.block_reason}` : ""}${slot.appointment_type ? ` · ${slot.appointment_type}` : ""}`}
        className={cn(
          "absolute inset-x-1 overflow-hidden rounded-xl border px-2 py-1 text-left backdrop-blur-sm transition-all",
          tone.block,
          clickable ? "cursor-pointer" : "cursor-default",
        )}
        style={{ top: `${top + 2}px`, height: `${Math.max(22, bottom - top - 4)}px` }}
      >
        <span className="flex items-center gap-1.5">
          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", tone.dot)} />
          <span className="truncate text-[10px] font-black uppercase tracking-wider">
            {tone.label}
            {slot.status === "BOOKED" ? ` ${slot.booked_count}/${slot.capacity}` : ""}
          </span>
        </span>
        <span className="data-mono block truncate text-[10px] opacity-80">
          {formatTime(start)}–{formatTime(end)}
        </span>
      </button>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Doctor Calendar"
        description="Weekly availability, bookings and blocked time per clinician."
        actions={
          <>
            <Button
              variant="secondary"
              leftIcon={<ShieldBan className="h-4 w-4" />}
              onClick={blockTimeModal.open}
              disabled={!staffProfileId}
            >
              Block Time
            </Button>
            <Button
              leftIcon={<Plus className="h-4 w-4" />}
              onClick={availabilityModal.open}
              disabled={!staffProfileId}
            >
              Add Availability
            </Button>
          </>
        }
      />

      {/* KPI row — derived from the visible week */}
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Open Slots"
          value={counts.OPEN}
          icon={CheckCircle2}
          tone="primary"
          isLoading={slotsQuery.isLoading && staffProfileId > 0}
        />
        <MetricCard
          label="Booked"
          value={counts.BOOKED}
          icon={Users}
          tone="cyan"
          isLoading={slotsQuery.isLoading && staffProfileId > 0}
        />
        <MetricCard
          label="Blocked"
          value={counts.BLOCKED}
          icon={ShieldBan}
          tone="rose"
          isLoading={slotsQuery.isLoading && staffProfileId > 0}
        />
        <MetricCard
          label="Total This Week"
          value={slots.length}
          icon={CalendarDays}
          tone="violet"
          isLoading={slotsQuery.isLoading && staffProfileId > 0}
        />
      </div>

      {/* Toolbar: doctor picker + week navigation */}
      <Card padding="sm">
        <div className="flex flex-wrap items-center justify-between gap-4 px-2">
          <div className="flex flex-wrap items-center gap-3">
            <Select
              options={doctorOptions}
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              placeholder={doctorsQuery.isLoading ? "Loading doctors…" : "Select doctor…"}
              className="w-64 py-2.5"
              aria-label="Select doctor"
            />
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Sparkles className="h-3.5 w-3.5" />}
              isLoading={materialise.isPending}
              disabled={!staffProfileId}
              onClick={handleGenerateSlots}
            >
              Generate Slots
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setWeekStart((w) => addDays(w, -7))}
              aria-label="Previous week"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="data-mono min-w-[180px] text-center text-xs font-bold text-secondary-600 dark:text-secondary-300">
              {weekLabel}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setWeekStart((w) => addDays(w, 7))}
              aria-label="Next week"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setWeekStart(startOfWeek(new Date()))}>
              Today
            </Button>
          </div>
        </div>
      </Card>

      {/* Week grid */}
      <Card padding="none" className="overflow-hidden">
        {doctors.length === 0 && !doctorsQuery.isLoading ? (
          <EmptyState
            icon={Users}
            title="No doctors found"
            description="Add staff members with clinical profiles to manage their calendars."
            className="py-16"
          />
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[860px]">
              {/* Day headers */}
              <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))] border-b border-secondary-100 dark:border-white/5">
                <div className="px-2 py-3" />
                {weekDays.map((day) => {
                  const isToday = isSameDay(day, today);
                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        "border-l border-secondary-100 px-2 py-3 text-center dark:border-white/5",
                        isToday && "bg-primary-500/10",
                      )}
                    >
                      <p className="text-[10px] font-black uppercase tracking-widest text-secondary-400">
                        {day.toLocaleDateString(undefined, { weekday: "short" })}
                      </p>
                      <p
                        className={cn(
                          "data-mono mt-0.5 text-sm font-bold",
                          isToday
                            ? "text-primary-600 dark:text-primary-300"
                            : "text-secondary-700 dark:text-secondary-200",
                        )}
                      >
                        {day.getDate()}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Hour rows + slot layer */}
              {slotsQuery.isLoading && staffProfileId > 0 ? (
                <div className="space-y-3 p-6">
                  {HOURS.slice(0, 6).map((h) => (
                    <Skeleton key={h} className="h-10 w-full" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))]">
                  {/* Time gutter */}
                  <div>
                    {HOURS.map((hour) => (
                      <div
                        key={hour}
                        className="flex items-start justify-end border-b border-secondary-100 pr-2 pt-1 dark:border-white/5"
                        style={{ height: `${HOUR_HEIGHT_PX}px` }}
                      >
                        <span className="data-mono text-[10px] font-bold text-secondary-400">
                          {formatHourLabel(hour)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Day columns */}
                  {weekDays.map((day, dayIndex) => {
                    const isToday = isSameDay(day, today);
                    return (
                      <div
                        key={day.toISOString()}
                        className={cn(
                          "relative border-l border-secondary-100 dark:border-white/5",
                          isToday && "bg-primary-500/5",
                        )}
                        style={{ height: `${gridBodyHeight}px` }}
                      >
                        {HOURS.map((hour) => (
                          <div
                            key={hour}
                            className="border-b border-secondary-100 dark:border-white/5"
                            style={{ height: `${HOUR_HEIGHT_PX}px` }}
                          />
                        ))}
                        <div className="absolute inset-0">
                          {(slotsByDay.get(dayIndex) ?? []).map((slot) => renderSlotBlock(slot))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer: legend + empty hint */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-secondary-100 px-6 py-4 dark:border-white/5">
          <div className="flex flex-wrap items-center gap-4">
            {(Object.keys(SLOT_TONES) as AppointmentSlotStatus[]).map((status) => (
              <span key={status} className="flex items-center gap-1.5">
                <span className={cn("h-2 w-2 rounded-full", SLOT_TONES[status].dot)} />
                <span className="text-[10px] font-bold uppercase tracking-widest text-secondary-400">
                  {SLOT_TONES[status].label}
                </span>
              </span>
            ))}
          </div>
          {staffProfileId > 0 && !slotsQuery.isLoading && slots.length === 0 ? (
            <span className="flex items-center gap-2 text-xs font-medium text-secondary-400">
              <Clock className="h-3.5 w-3.5" />
              No slots this week — add availability, then generate slots.
            </span>
          ) : null}
          {slotsQuery.isError ? (
            <span className="text-xs font-bold text-rose-500">
              {errorMessage(slotsQuery.error)}
            </span>
          ) : null}
        </div>
      </Card>

      {/* Modals */}
      <AddAvailabilityModal
        isOpen={availabilityModal.isOpen}
        onClose={availabilityModal.close}
        staffProfileId={staffProfileId}
      />
      <BlockTimeModal
        isOpen={blockTimeModal.isOpen}
        onClose={blockTimeModal.close}
        staffProfileId={staffProfileId}
      />

      <ConfirmDialog
        isOpen={slotToRelease !== null}
        onClose={() => setSlotToRelease(null)}
        title="Release this slot?"
        description={
          slotToRelease
            ? `The booking on ${new Date(slotToRelease.starts_at).toLocaleString()} for ${selectedDoctor ? `${selectedDoctor.first_name} ${selectedDoctor.last_name}` : "this doctor"} will be released and the slot reopened.`
            : undefined
        }
        confirmLabel="Release Slot"
        tone="danger"
        onConfirm={async () => {
          if (!slotToRelease) return;
          try {
            await releaseSlotMutation.mutateAsync(slotToRelease.id);
            toast.success("Slot released", "The slot is open for booking again.");
          } catch (err) {
            toast.error("Could not release slot", errorMessage(err) ?? undefined);
          } finally {
            setSlotToRelease(null);
          }
        }}
      />
    </div>
  );
}
