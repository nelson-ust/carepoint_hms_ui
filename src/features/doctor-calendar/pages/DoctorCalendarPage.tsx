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

import {
  DxPage,
  DxPageHeader,
  DxPanel,
  DxKpi,
  DxButton,
  DxInput,
  DxSelect,
  DxTextarea,
  DxPopup,
  DxMessage,
} from "@/components/dx";
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
// Slot tone mapping — dx tokens, data-driven inline styles so the
// coloured calendar blocks stay theme-aware in light and dark.
// ============================================================

type SlotToneSpec = {
  block: React.CSSProperties;
  dot: string;
  label: string;
};

const SLOT_TONES: Record<AppointmentSlotStatus, SlotToneSpec> = {
  OPEN: {
    block: {
      background: "var(--dx-success-soft)",
      borderColor: "var(--dx-success)",
      color: "var(--dx-success)",
    },
    dot: "var(--dx-success)",
    label: "Open",
  },
  BOOKED: {
    block: {
      background: "var(--dx-info-soft)",
      borderColor: "var(--dx-info)",
      color: "var(--dx-info)",
    },
    dot: "var(--dx-info)",
    label: "Booked",
  },
  BLOCKED: {
    block: {
      background: "var(--dx-danger-soft)",
      borderColor: "var(--dx-danger)",
      color: "var(--dx-danger)",
    },
    dot: "var(--dx-danger)",
    label: "Blocked",
  },
  EXPIRED: {
    block: {
      background: "var(--dx-surface-sunken)",
      borderColor: "var(--dx-border)",
      color: "var(--dx-text-muted)",
    },
    dot: "var(--dx-text-faint)",
    label: "Expired",
  },
};

function slotTone(status: string): SlotToneSpec {
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
    <DxPopup
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Weekly Availability"
      size="lg"
      locked={createTemplate.isPending}
      footer={
        <>
          <DxButton onClick={handleClose} disabled={createTemplate.isPending}>
            Cancel
          </DxButton>
          <DxButton
            variant="primary"
            leftIcon={<CalendarPlus className="h-4 w-4" />}
            isLoading={createTemplate.isPending}
            onClick={handleSubmit(onSubmit)}
          >
            Save Availability
          </DxButton>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <DxSelect
          label="Weekday"
          options={WEEKDAY_OPTIONS}
          error={errors.weekday?.message}
          {...register("weekday")}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <DxInput
            label="Start Time"
            type="time"
            error={errors.start_time?.message}
            {...register("start_time")}
          />
          <DxInput
            label="End Time"
            type="time"
            error={errors.end_time?.message}
            {...register("end_time")}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <DxInput
            label="Slot Duration (minutes)"
            type="number"
            error={errors.slot_duration_minutes?.message}
            {...register("slot_duration_minutes")}
          />
          <DxInput
            label="Max Patients per Slot"
            type="number"
            error={errors.max_patients_per_slot?.message}
            {...register("max_patients_per_slot")}
          />
        </div>
        <DxInput
          label="Appointment Type (optional)"
          placeholder="e.g. CONSULTATION"
          error={errors.appointment_type?.message}
          {...register("appointment_type")}
        />
        <DxTextarea
          label="Notes (optional)"
          rows={2}
          error={errors.notes?.message}
          {...register("notes")}
        />
      </form>
    </DxPopup>
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
    <DxPopup
      isOpen={isOpen}
      onClose={handleClose}
      title="Block Calendar Time"
      size="md"
      locked={addTimeOff.isPending}
      footer={
        <>
          <DxButton onClick={handleClose} disabled={addTimeOff.isPending}>
            Cancel
          </DxButton>
          <DxButton
            variant="danger"
            leftIcon={<ShieldBan className="h-4 w-4" />}
            isLoading={addTimeOff.isPending}
            onClick={handleSubmit(onSubmit)}
          >
            Block Time
          </DxButton>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <DxInput
          label="From"
          type="datetime-local"
          error={errors.starts_at?.message}
          {...register("starts_at")}
        />
        <DxInput
          label="Until"
          type="datetime-local"
          error={errors.ends_at?.message}
          {...register("ends_at")}
        />
        <DxTextarea
          label="Reason (optional)"
          rows={2}
          placeholder="Leave, conference, theatre list…"
          error={errors.reason?.message}
          {...register("reason")}
        />
      </form>
    </DxPopup>
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
          "absolute inset-x-1 overflow-hidden rounded-md border px-2 py-1 text-left transition-opacity hover:opacity-80",
          clickable ? "cursor-pointer" : "cursor-default",
        )}
        style={{ ...tone.block, top: `${top + 2}px`, height: `${Math.max(22, bottom - top - 4)}px` }}
      >
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: tone.dot }} />
          <span className="truncate text-[10px] font-bold uppercase tracking-wider">
            {tone.label}
            {slot.status === "BOOKED" ? ` ${slot.booked_count}/${slot.capacity}` : ""}
          </span>
        </span>
        <span className="dx-mono block truncate text-[10px] opacity-80">
          {formatTime(start)}–{formatTime(end)}
        </span>
      </button>
    );
  }

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Scheduling" }, { label: "Doctor Calendar" }]}
        title="Doctor Calendar"
        subtitle="Weekly availability, bookings and blocked time per clinician."
        actions={
          <>
            <DxButton
              leftIcon={<ShieldBan className="h-4 w-4" />}
              onClick={blockTimeModal.open}
              disabled={!staffProfileId}
            >
              Block Time
            </DxButton>
            <DxButton
              variant="primary"
              leftIcon={<Plus className="h-4 w-4" />}
              onClick={availabilityModal.open}
              disabled={!staffProfileId}
            >
              Add Availability
            </DxButton>
          </>
        }
      />

      {/* KPI row — derived from the visible week */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DxKpi
          label="Open Slots"
          value={counts.OPEN}
          icon={CheckCircle2}
          tone="success"
          isLoading={slotsQuery.isLoading && staffProfileId > 0}
        />
        <DxKpi
          label="Booked"
          value={counts.BOOKED}
          icon={Users}
          tone="info"
          isLoading={slotsQuery.isLoading && staffProfileId > 0}
        />
        <DxKpi
          label="Blocked"
          value={counts.BLOCKED}
          icon={ShieldBan}
          tone="danger"
          isLoading={slotsQuery.isLoading && staffProfileId > 0}
        />
        <DxKpi
          label="Total This Week"
          value={slots.length}
          icon={CalendarDays}
          tone="accent"
          isLoading={slotsQuery.isLoading && staffProfileId > 0}
        />
      </div>

      {/* Toolbar: doctor picker + week navigation */}
      <DxPanel>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-64">
              <DxSelect
                options={doctorOptions}
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                placeholder={doctorsQuery.isLoading ? "Loading doctors…" : "Select doctor…"}
                aria-label="Select doctor"
              />
            </div>
            <DxButton
              size="sm"
              leftIcon={<Sparkles className="h-3.5 w-3.5" />}
              isLoading={materialise.isPending}
              disabled={!staffProfileId}
              onClick={handleGenerateSlots}
            >
              Generate Slots
            </DxButton>
          </div>
          <div className="flex items-center gap-2">
            <DxButton
              icon
              size="sm"
              variant="text"
              onClick={() => setWeekStart((w) => addDays(w, -7))}
              title="Previous week"
            >
              <ChevronLeft />
            </DxButton>
            <span className="dx-mono min-w-[180px] text-center text-[12px] font-semibold text-[var(--dx-text-muted)]">
              {weekLabel}
            </span>
            <DxButton
              icon
              size="sm"
              variant="text"
              onClick={() => setWeekStart((w) => addDays(w, 7))}
              title="Next week"
            >
              <ChevronRight />
            </DxButton>
            <DxButton size="sm" onClick={() => setWeekStart(startOfWeek(new Date()))}>
              Today
            </DxButton>
          </div>
        </div>
      </DxPanel>

      {/* Week grid */}
      <DxPanel flush className="overflow-hidden">
        {doctors.length === 0 && !doctorsQuery.isLoading ? (
          <div className="py-16 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-[var(--dx-surface-sunken)]">
              <Users className="h-8 w-8 text-[var(--dx-text-faint)]" />
            </div>
            <h4 className="text-[16px] font-bold text-[var(--dx-text)]">No doctors found</h4>
            <p className="mx-auto mt-1 max-w-sm text-[13px] text-[var(--dx-text-muted)]">
              Add staff members with clinical profiles to manage their calendars.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[860px]">
              {/* Day headers */}
              <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))] border-b border-[var(--dx-border)]">
                <div className="px-2 py-3" />
                {weekDays.map((day) => {
                  const isToday = isSameDay(day, today);
                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        "border-l border-[var(--dx-border)] px-2 py-3 text-center",
                        isToday && "bg-[var(--dx-accent-soft)]",
                      )}
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--dx-text-muted)]">
                        {day.toLocaleDateString(undefined, { weekday: "short" })}
                      </p>
                      <p
                        className={cn(
                          "dx-mono mt-0.5 text-[14px] font-bold",
                          isToday ? "text-[var(--dx-accent)]" : "text-[var(--dx-text)]",
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
                    <div key={h} className="dx-skeleton h-10 w-full" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))]">
                  {/* Time gutter */}
                  <div>
                    {HOURS.map((hour) => (
                      <div
                        key={hour}
                        className="flex items-start justify-end border-b border-[var(--dx-border)] pr-2 pt-1"
                        style={{ height: `${HOUR_HEIGHT_PX}px` }}
                      >
                        <span className="dx-mono text-[10px] font-semibold text-[var(--dx-text-muted)]">
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
                          "relative border-l border-[var(--dx-border)]",
                          isToday && "bg-[var(--dx-accent-soft)]",
                        )}
                        style={{ height: `${gridBodyHeight}px` }}
                      >
                        {HOURS.map((hour) => (
                          <div
                            key={hour}
                            className="border-b border-[var(--dx-border)]"
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
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[var(--dx-border)] px-6 py-4">
          <div className="flex flex-wrap items-center gap-4">
            {(Object.keys(SLOT_TONES) as AppointmentSlotStatus[]).map((status) => (
              <span key={status} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: SLOT_TONES[status].dot }} />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--dx-text-muted)]">
                  {SLOT_TONES[status].label}
                </span>
              </span>
            ))}
          </div>
          {staffProfileId > 0 && !slotsQuery.isLoading && slots.length === 0 ? (
            <span className="flex items-center gap-2 text-[12px] font-medium text-[var(--dx-text-muted)]">
              <Clock className="h-3.5 w-3.5" />
              No slots this week — add availability, then generate slots.
            </span>
          ) : null}
          {slotsQuery.isError ? (
            <span className="text-[12px] font-semibold" style={{ color: "var(--dx-danger)" }}>
              {errorMessage(slotsQuery.error)}
            </span>
          ) : null}
        </div>
      </DxPanel>

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

      {/* Release confirm */}
      <DxPopup
        isOpen={slotToRelease !== null}
        onClose={() => setSlotToRelease(null)}
        title="Release this slot?"
        size="sm"
        locked={releaseSlotMutation.isPending}
        footer={
          <>
            <DxButton onClick={() => setSlotToRelease(null)} disabled={releaseSlotMutation.isPending}>
              Cancel
            </DxButton>
            <DxButton
              variant="danger"
              isLoading={releaseSlotMutation.isPending}
              onClick={async () => {
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
            >
              Release Slot
            </DxButton>
          </>
        }
      >
        <DxMessage tone="warning">
          {slotToRelease
            ? `The booking on ${new Date(slotToRelease.starts_at).toLocaleString()} for ${selectedDoctor ? `${selectedDoctor.first_name} ${selectedDoctor.last_name}` : "this doctor"} will be released and the slot reopened.`
            : null}
        </DxMessage>
      </DxPopup>
    </DxPage>
  );
}
