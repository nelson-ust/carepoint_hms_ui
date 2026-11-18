import { useState } from "react";
import {
  Clock,
  RotateCcw,
  Plus,
  Trash2,
  Activity,
  Cpu,
  Pause,
  Play,
  CalendarClock,
  Zap,
  AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";
import {
  DxPage,
  DxPageHeader,
  DxPanel,
  DxBadge,
  DxButton,
  DxInput,
  DxSelect,
  DxCheckbox,
  DxPopup,
  DxMessage,
  type DxBadgeTone,
} from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/api/api-error";
import {
  useTenantJobs,
  useJobHandlers,
  useCreateJob,
  useUpdateJob,
  useDeleteJob,
  useRunJob,
} from "../hooks/use-tenant-jobs";
import type { TenantJob, JobCreatePayload } from "../api/tenant-jobs.api";

// ---------------------------------------------------------------------------
// Admin-friendly helpers — keep cron/slug jargon out of the Tenant Admin's way
// ---------------------------------------------------------------------------

type Frequency = "minutes" | "hourly" | "daily" | "weekly" | "monthly" | "cron";

const WEEKDAYS = [
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
  { value: "0", label: "Sunday" },
];
const WEEKDAY_NAME = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const FREQUENCY_OPTIONS = [
  { value: "daily", label: "Every day" },
  { value: "weekly", label: "Every week" },
  { value: "monthly", label: "Every month" },
  { value: "hourly", label: "Every hour" },
  { value: "minutes", label: "Every N minutes" },
  { value: "cron", label: "Advanced (cron expression)" },
];

const TIMEZONE_OPTIONS = [
  { value: "Africa/Lagos", label: "Africa/Lagos (WAT)" },
  { value: "UTC", label: "UTC" },
  { value: "Africa/Nairobi", label: "Africa/Nairobi (EAT)" },
  { value: "Africa/Johannesburg", label: "Africa/Johannesburg (SAST)" },
  { value: "Europe/London", label: "Europe/London" },
  { value: "America/New_York", label: "America/New_York" },
];

/** Turn an internal handler slug into a readable title: appointment_reminders → "Appointment Reminders". */
function prettyHandler(name: string): string {
  return (name || "")
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

const hhmm = (h: string | number, m: string | number) =>
  `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

/** Plain-language description of a job's schedule for the cards. */
function describeSchedule(job: TenantJob): string {
  if (job.schedule_interval_minutes != null) {
    const n = job.schedule_interval_minutes;
    if (n >= 60 && n % 60 === 0) {
      const h = n / 60;
      return `Every ${h} hour${h === 1 ? "" : "s"}`;
    }
    return `Every ${n} minute${n === 1 ? "" : "s"}`;
  }
  const c = (job.schedule_cron || "").trim();
  if (!c) return "No schedule";
  const p = c.split(/\s+/);
  if (p.length === 5) {
    const [mn, hr, dom, mon, dow] = p;
    const numeric = (v: string) => /^\d+$/.test(v);
    if (c === "0 * * * *") return "Every hour";
    if (dom === "*" && mon === "*" && dow === "*" && numeric(mn) && numeric(hr))
      return `Every day at ${hhmm(hr, mn)}`;
    if (dom === "*" && mon === "*" && numeric(dow) && numeric(mn) && numeric(hr))
      return `Every ${WEEKDAY_NAME[Number(dow) % 7]} at ${hhmm(hr, mn)}`;
    if (mon === "*" && dow === "*" && numeric(dom) && numeric(mn) && numeric(hr))
      return `Monthly on day ${dom} at ${hhmm(hr, mn)}`;
  }
  return `Cron · ${c}`;
}

function statusTone(status?: string | null): DxBadgeTone {
  switch ((status || "").toUpperCase()) {
    case "SUCCESS":
    case "COMPLETED":
      return "success";
    case "FAILED":
    case "ERROR":
      return "danger";
    case "RUNNING":
      return "info";
    case "STALE":
      return "warning";
    default:
      return "neutral";
  }
}

export function TenantJobsPage() {
  const toast = useToast();
  const { data, isLoading, isFetching, refetch } = useTenantJobs();
  const { data: handlers } = useJobHandlers();
  const createJob = useCreateJob();
  const updateJob = useUpdateJob();
  const deleteJob = useDeleteJob();
  const runJob = useRunJob();

  const jobs: TenantJob[] = Array.isArray(data) ? data : [];
  const handlerList = Array.isArray(handlers) ? handlers : [];

  // ---- Create form ----
  const [showCreate, setShowCreate] = useState(false);
  const [handler, setHandler] = useState("");
  const [jobCode, setJobCode] = useState("");
  const [codeEdited, setCodeEdited] = useState(false);
  const [frequency, setFrequency] = useState<Frequency>("daily");
  const [timeOfDay, setTimeOfDay] = useState("01:00");
  const [weekday, setWeekday] = useState("1");
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [everyMinutes, setEveryMinutes] = useState("60");
  const [cronExpr, setCronExpr] = useState("0 1 * * *");
  const [isEnabled, setIsEnabled] = useState(true);
  const [timezone, setTimezone] = useState("Africa/Lagos");
  const [maxFailures, setMaxFailures] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // ---- Delete ----
  const [deleteTarget, setDeleteTarget] = useState<TenantJob | null>(null);

  const openCreate = () => {
    const first = handlerList[0]?.name ?? "";
    setHandler(first);
    setJobCode(first);
    setCodeEdited(false);
    setFrequency("daily");
    setTimeOfDay("01:00");
    setWeekday("1");
    setDayOfMonth("1");
    setEveryMinutes("60");
    setCronExpr("0 1 * * *");
    setIsEnabled(true);
    setTimezone("Africa/Lagos");
    setMaxFailures("");
    setFormError(null);
    setShowCreate(true);
  };

  // Keep the job code in sync with the handler until the admin edits it.
  const onHandlerChange = (value: string) => {
    setHandler(value);
    if (!codeEdited) setJobCode(value);
  };

  /** Compile the friendly builder into the backend's cron / interval fields. */
  const buildSchedule = ():
    | { schedule_cron?: string; schedule_interval_minutes?: number }
    | { error: string } => {
    const [hh, mm] = timeOfDay.split(":");
    switch (frequency) {
      case "minutes": {
        const n = Number(everyMinutes);
        if (!Number.isFinite(n) || n < 1) return { error: "Enter an interval of at least 1 minute." };
        return { schedule_interval_minutes: n };
      }
      case "hourly":
        return { schedule_cron: "0 * * * *" };
      case "daily":
        return { schedule_cron: `${Number(mm)} ${Number(hh)} * * *` };
      case "weekly":
        return { schedule_cron: `${Number(mm)} ${Number(hh)} * * ${weekday}` };
      case "monthly": {
        const dom = Number(dayOfMonth);
        if (!Number.isFinite(dom) || dom < 1 || dom > 31) return { error: "Day of month must be 1–31." };
        return { schedule_cron: `${Number(mm)} ${Number(hh)} ${dom} * *` };
      }
      case "cron":
        if (!cronExpr.trim()) return { error: "Enter a cron expression (e.g. 0 1 * * *)." };
        return { schedule_cron: cronExpr.trim() };
      default:
        return { error: "Choose how often this job should run." };
    }
  };

  const submitCreate = async () => {
    setFormError(null);
    if (!handler) {
      setFormError("Choose what this job should do.");
      return;
    }
    if (!jobCode.trim()) {
      setFormError("A job name is required.");
      return;
    }
    const schedule = buildSchedule();
    if ("error" in schedule) {
      setFormError(schedule.error);
      return;
    }
    let maxFailuresValue: number | undefined;
    if (maxFailures.trim() !== "") {
      const n = Number(maxFailures);
      if (!Number.isInteger(n) || n < 1) {
        setFormError("Auto-pause threshold must be a whole number of 1 or more.");
        return;
      }
      maxFailuresValue = n;
    }
    const payload: JobCreatePayload = {
      job_code: jobCode.trim(),
      handler,
      is_enabled: isEnabled,
      ...(frequency === "minutes" ? {} : { timezone }),
      ...(maxFailuresValue !== undefined ? { max_failures: maxFailuresValue } : {}),
      ...schedule,
    };
    try {
      await createJob.mutateAsync(payload);
      toast.success("Job scheduled", `"${payload.job_code}" has been created.`);
      setShowCreate(false);
    } catch (err) {
      setFormError(apiErrorMessage(err, "Could not create the job. Check the details and retry."));
    }
  };

  const toggleEnabled = (job: TenantJob) => {
    updateJob.mutate(
      { id: job.id, payload: { is_enabled: !job.is_enabled } },
      {
        onSuccess: () => toast.success(job.is_enabled ? "Job paused" : "Job resumed"),
        onError: (err) => toast.error("Couldn't update job", apiErrorMessage(err, "Please try again.")),
      },
    );
  };

  const runNow = (job: TenantJob) => {
    runJob.mutate(job.id, {
      onSuccess: () =>
        toast.success("Run queued", "The job will run on the next dispatcher tick (within ~1 min)."),
      onError: (err) => toast.error("Couldn't queue run", apiErrorMessage(err, "Please try again.")),
    });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteJob.mutateAsync(deleteTarget.id);
      toast.success("Job deleted", `"${deleteTarget.job_code}" has been removed.`);
      setDeleteTarget(null);
    } catch (err) {
      toast.error("Couldn't delete job", apiErrorMessage(err, "Please try again."));
    }
  };

  const handlerOptions = handlerList.map((h) => ({ value: h.name, label: prettyHandler(h.name) }));
  const selectedHandler = handlerList.find((h) => h.name === handler);

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Settings" }, { label: "Scheduled Jobs" }]}
        title="Scheduled Jobs"
        subtitle="Set up automatic tasks — reminders, backups and reports — on the schedule you choose."
        actions={
          <DxButton variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>
            New scheduled job
          </DxButton>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* What jobs can do */}
        <div className="lg:col-span-1">
          <DxPanel title="What can be automated" icon={<Cpu className="h-5 w-5 text-[var(--dx-accent)]" />}>
            <div className="space-y-3">
              {handlerList.length > 0 ? (
                handlerList.map((h) => (
                  <div key={h.name} className="rounded-md border border-[var(--dx-border)] p-4">
                    <p className="text-[13px] font-bold text-[var(--dx-text)]">{prettyHandler(h.name)}</p>
                    {h.description ? (
                      <p className="mt-1 text-[12px] text-[var(--dx-text-muted)]">{h.description}</p>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="text-[13px] text-[var(--dx-text-muted)]">No automations are available yet.</p>
              )}
            </div>
          </DxPanel>
        </div>

        {/* Active schedules */}
        <div className="space-y-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-[15px] font-bold text-[var(--dx-text)]">
              <Activity className="h-5 w-5 text-[var(--dx-accent)]" />
              Your scheduled jobs
            </h3>
            <DxButton icon title="Refresh" variant="text" onClick={() => refetch()} isLoading={isFetching}>
              <RotateCcw />
            </DxButton>
          </div>

          <div className="space-y-4">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => <div key={i} className="dx-skeleton h-28 w-full" />)
            ) : jobs.length > 0 ? (
              jobs.map((job) => (
                <div
                  key={job.id}
                  className="rounded-lg border border-[var(--dx-border)] bg-[var(--dx-surface)] p-5 transition-colors hover:border-[var(--dx-border-strong)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--dx-accent-soft)] text-[var(--dx-accent)]">
                        <Clock className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-[14px] font-bold text-[var(--dx-text)]">
                            {prettyHandler(job.handler)}
                          </h4>
                          <DxBadge tone={job.is_enabled ? "success" : "neutral"} dot>
                            {job.is_enabled ? "Active" : "Paused"}
                          </DxBadge>
                          {job.last_status ? (
                            <DxBadge tone={statusTone(job.last_status)}>Last: {job.last_status}</DxBadge>
                          ) : null}
                        </div>
                        <p className="mt-1 text-[12px] font-medium text-[var(--dx-text)]">
                          {describeSchedule(job)}
                        </p>
                        <p className="dx-mono mt-0.5 text-[11px] text-[var(--dx-text-muted)]">{job.job_code}</p>
                        {job.last_status === "FAILED" && job.last_error ? (
                          <p className="mt-1 flex items-start gap-1 text-[11px] text-rose-600 dark:text-rose-400">
                            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                            <span className="line-clamp-2">{job.last_error}</span>
                          </p>
                        ) : null}
                        {job.consecutive_failures && job.consecutive_failures > 1 ? (
                          <p className="mt-0.5 text-[11px] text-rose-600 dark:text-rose-400">
                            {job.consecutive_failures} consecutive failures
                            {job.max_failures ? ` (auto-pauses at ${job.max_failures})` : ""}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="hidden text-right sm:block">
                        {job.is_enabled && job.next_run_at ? (
                          <>
                            <p className="flex items-center justify-end gap-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--dx-text-muted)]">
                              <CalendarClock className="h-3 w-3" /> Next Run
                            </p>
                            <p className="text-[12px] font-bold text-[var(--dx-text)]">
                              {format(new Date(job.next_run_at), "MMM d, HH:mm")}
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--dx-text-muted)]">
                              Last Run
                            </p>
                            <p className="text-[12px] font-bold text-[var(--dx-text)]">
                              {job.last_run_at ? format(new Date(job.last_run_at), "MMM d, HH:mm") : "Never"}
                            </p>
                          </>
                        )}
                      </div>
                      <DxButton
                        icon
                        size="sm"
                        variant="text"
                        title="Run now"
                        disabled={runJob.isPending || !job.is_enabled}
                        onClick={() => runNow(job)}
                      >
                        <Zap />
                      </DxButton>
                      <DxButton
                        icon
                        size="sm"
                        variant="text"
                        title={job.is_enabled ? "Pause job" : "Resume job"}
                        disabled={updateJob.isPending}
                        onClick={() => toggleEnabled(job)}
                      >
                        {job.is_enabled ? <Pause /> : <Play />}
                      </DxButton>
                      <DxButton
                        icon
                        size="sm"
                        variant="outline-danger"
                        title="Delete job"
                        onClick={() => setDeleteTarget(job)}
                      >
                        <Trash2 />
                      </DxButton>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <DxPanel>
                <div className="py-14 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-[var(--dx-surface-sunken)]">
                    <Clock className="h-8 w-8 text-[var(--dx-text-faint)]" />
                  </div>
                  <h4 className="text-[16px] font-bold text-[var(--dx-text)]">No scheduled jobs yet</h4>
                  <p className="mx-auto mt-1 max-w-sm text-[13px] text-[var(--dx-text-muted)]">
                    Create your first job to automate reminders, backups and reports.
                  </p>
                  <DxButton className="mx-auto mt-4" variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>
                    New scheduled job
                  </DxButton>
                </div>
              </DxPanel>
            )}
          </div>
        </div>
      </div>

      {/* Create job modal */}
      <DxPopup
        isOpen={showCreate}
        onClose={() => !createJob.isPending && setShowCreate(false)}
        title="New scheduled job"
        size="md"
        locked={createJob.isPending}
        footer={
          <>
            <DxButton onClick={() => setShowCreate(false)} disabled={createJob.isPending}>
              Cancel
            </DxButton>
            <DxButton variant="primary" onClick={submitCreate} isLoading={createJob.isPending} leftIcon={<Plus className="h-4 w-4" />}>
              Schedule job
            </DxButton>
          </>
        }
      >
        <div className="space-y-4">
          {formError ? <DxMessage tone="danger">{formError}</DxMessage> : null}

          {/* What it does */}
          <DxSelect
            label="What should this job do?"
            required
            value={handler}
            onChange={(e) => onHandlerChange(e.target.value)}
            options={handlerOptions}
            placeholder={handlerOptions.length ? undefined : "No automations available"}
            hint={selectedHandler?.description || undefined}
          />

          {/* Schedule builder */}
          <DxSelect
            label="How often?"
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as Frequency)}
            options={FREQUENCY_OPTIONS}
          />

          {frequency === "minutes" ? (
            <DxInput
              label="Run every (minutes)"
              type="number"
              min={1}
              value={everyMinutes}
              onChange={(e) => setEveryMinutes(e.target.value)}
              placeholder="60"
            />
          ) : null}

          {frequency === "daily" ? (
            <DxInput
              label="At what time?"
              type="time"
              value={timeOfDay}
              onChange={(e) => setTimeOfDay(e.target.value)}
            />
          ) : null}

          {frequency === "weekly" ? (
            <div className="grid grid-cols-2 gap-4">
              <DxSelect
                label="On which day?"
                value={weekday}
                onChange={(e) => setWeekday(e.target.value)}
                options={WEEKDAYS}
              />
              <DxInput
                label="At what time?"
                type="time"
                value={timeOfDay}
                onChange={(e) => setTimeOfDay(e.target.value)}
              />
            </div>
          ) : null}

          {frequency === "monthly" ? (
            <div className="grid grid-cols-2 gap-4">
              <DxInput
                label="Day of month"
                type="number"
                min={1}
                max={31}
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(e.target.value)}
                placeholder="1"
              />
              <DxInput
                label="At what time?"
                type="time"
                value={timeOfDay}
                onChange={(e) => setTimeOfDay(e.target.value)}
              />
            </div>
          ) : null}

          {frequency === "hourly" ? (
            <DxMessage tone="info">Runs once an hour, at the top of the hour.</DxMessage>
          ) : null}

          {frequency === "cron" ? (
            <DxInput
              label="Cron expression"
              mono
              value={cronExpr}
              onChange={(e) => setCronExpr(e.target.value)}
              placeholder="0 1 * * *"
              hint="Minute Hour Day Month Weekday — e.g. 0 1 * * * runs daily at 01:00."
            />
          ) : null}

          {frequency !== "minutes" ? (
            <DxSelect
              label="Timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              options={TIMEZONE_OPTIONS}
              hint="The time(s) above are interpreted in this timezone."
            />
          ) : null}

          <DxInput
            label="Auto-pause after failures (optional)"
            type="number"
            min={1}
            value={maxFailures}
            onChange={(e) => setMaxFailures(e.target.value)}
            placeholder="Leave blank to never auto-pause"
            hint="Pause the job automatically after this many consecutive failed runs."
          />

          {/* Name — auto-filled from the automation, editable */}
          <DxInput
            label="Job name"
            required
            mono
            value={jobCode}
            onChange={(e) => {
              setJobCode(e.target.value);
              setCodeEdited(true);
            }}
            placeholder="e.g. nightly_invoice_run"
            hint="A short identifier for this schedule. We filled one in — change it if you like."
          />

          <div className="rounded-md border border-[var(--dx-border)] px-4 py-3">
            <DxCheckbox
              label="Start active"
              description="Leave on to run on schedule. You can pause it any time."
              checked={isEnabled}
              onChange={(e) => setIsEnabled(e.target.checked)}
            />
          </div>
        </div>
      </DxPopup>

      {/* Delete confirm */}
      <DxPopup
        isOpen={deleteTarget !== null}
        onClose={() => !deleteJob.isPending && setDeleteTarget(null)}
        title="Delete scheduled job"
        size="sm"
        locked={deleteJob.isPending}
        footer={
          <>
            <DxButton onClick={() => setDeleteTarget(null)} disabled={deleteJob.isPending}>
              Cancel
            </DxButton>
            <DxButton variant="danger" onClick={confirmDelete} isLoading={deleteJob.isPending} leftIcon={<Trash2 className="h-4 w-4" />}>
              Delete job
            </DxButton>
          </>
        }
      >
        <DxMessage tone="danger">
          {deleteTarget ? (
            <>
              Delete <strong>{prettyHandler(deleteTarget.handler)}</strong> (
              <span className="dx-mono">{deleteTarget.job_code}</span>)? The schedule will stop
              running. This can't be undone — to pause it instead, use the pause button.
            </>
          ) : null}
        </DxMessage>
      </DxPopup>
    </DxPage>
  );
}
