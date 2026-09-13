import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarClock,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Plus,
  Users,
  Trash2,
  Pencil,
  Wand2,
  Building2,
  Layers,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { MetricCard } from "@/components/charts/MetricCard";
import { cn } from "@/lib/utils/cn";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/api/api-error";
import { useStaffNameMap } from "@/features/staff/hooks/use-staff";
import { listDepartments } from "@/features/staff/api/staff-admin.api";
import { listActiveServiceDeliveryPoints } from "@/features/service-delivery-points/api/service-delivery-points.api";
import {
  useShiftAssignments,
  useShiftDefinitions,
  useQuickSetupShifts,
  useDeleteShiftDefinition,
} from "../hooks/use-hr";
import type { ShiftAssignment, ShiftDefinition } from "../api/hr.api";
import { ShiftDefinitionModal } from "../components/ShiftDefinitionModal";
import { AssignShiftModal } from "../components/AssignShiftModal";

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function startOfWeek(base: Date): Date {
  const d = new Date(base);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function fmtShort(d: Date): string {
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short" });
}

function fmtTime(t?: string | null): string {
  return t ? t.slice(0, 5) : "";
}

type AssignTarget = {
  staffId: number;
  staffName: string;
  date: string;
  existing: ShiftAssignment | null;
};

export function RosterPage() {
  const toast = useToast();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [departmentId, setDepartmentId] = useState<number | null>(null);
  const [sdpId, setSdpId] = useState<number | null>(null);

  const [defModalOpen, setDefModalOpen] = useState(false);
  const [editingDef, setEditingDef] = useState<ShiftDefinition | null>(null);
  const [assignTarget, setAssignTarget] = useState<AssignTarget | null>(null);

  const weekDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        return d;
      }),
    [weekStart],
  );
  const weekKeys = useMemo(() => weekDays.map(isoDate), [weekDays]);

  // ── Reference data ────────────────────────────────────────────────
  const departmentsQuery = useQuery({
    queryKey: ["departments", "for-roster"],
    queryFn: () => listDepartments({ limit: 200 }),
    staleTime: 5 * 60 * 1000,
  });
  const sdpQuery = useQuery({
    queryKey: ["sdp", "active", "for-roster"],
    queryFn: () => listActiveServiceDeliveryPoints({ limit: 500 }),
    staleTime: 5 * 60 * 1000,
  });
  const { nameMap, staff, isLoading: staffLoading } = useStaffNameMap();

  const departments = departmentsQuery.data ?? [];
  const allSdps = sdpQuery.data?.items ?? [];

  // Auto-select the first department once loaded.
  useEffect(() => {
    if (departmentId === null && departments.length > 0) {
      setDepartmentId(departments[0].id);
    }
  }, [departments, departmentId]);

  // Units (SDPs) belonging to the chosen department.
  const unitsForDept = useMemo(
    () => allSdps.filter((s) => s.department_id === departmentId),
    [allSdps, departmentId],
  );

  // If the selected unit no longer belongs to the department, clear it.
  useEffect(() => {
    if (sdpId !== null && !unitsForDept.some((u) => u.id === sdpId)) {
      setSdpId(null);
    }
  }, [unitsForDept, sdpId]);

  const scopeFilter = useMemo(
    () => ({
      department_id: departmentId ?? undefined,
      service_delivery_point_id: sdpId ?? undefined,
    }),
    [departmentId, sdpId],
  );

  const definitionsQuery = useShiftDefinitions(scopeFilter);
  const assignmentsQuery = useShiftAssignments({
    ...scopeFilter,
    date_from: weekKeys[0],
    date_to: weekKeys[6],
    limit: 500,
  });

  const quickSetupMut = useQuickSetupShifts();
  const deleteDefMut = useDeleteShiftDefinition();

  const definitions = definitionsQuery.data?.items ?? [];
  const definitionMap = useMemo(() => {
    const m = new Map<number, ShiftDefinition>();
    for (const d of definitions) m.set(d.id, d);
    return m;
  }, [definitions]);

  const currentDept = departments.find((d) => d.id === departmentId) ?? null;
  const currentUnit = unitsForDept.find((u) => u.id === sdpId) ?? null;
  const scopeLabel = currentDept
    ? `${currentDept.name}${currentUnit ? ` · ${currentUnit.name}` : " · All units"}`
    : "Select a department";

  // Staff belonging to the selected department (match by id, fall back to name).
  const deptStaff = useMemo(() => {
    if (!currentDept) return [];
    return staff.filter(
      (s) =>
        s.department_id === currentDept.id ||
        (typeof s.department === "string" && s.department === currentDept.name),
    );
  }, [staff, currentDept]);

  // assignments keyed by staffId → date → assignment (prefer non-cancelled).
  const assignmentIndex = useMemo(() => {
    const byStaff = new Map<number, Map<string, ShiftAssignment>>();
    for (const a of assignmentsQuery.data?.items ?? []) {
      const key = a.shift_date?.slice(0, 10);
      if (!key) continue;
      if (!byStaff.has(a.staff_profile_id)) byStaff.set(a.staff_profile_id, new Map());
      const days = byStaff.get(a.staff_profile_id)!;
      const prev = days.get(key);
      if (!prev || (prev.status === "CANCELLED" && a.status !== "CANCELLED")) {
        days.set(key, a);
      }
    }
    return byStaff;
  }, [assignmentsQuery.data]);

  const totalShifts = useMemo(() => {
    let n = 0;
    for (const days of assignmentIndex.values()) {
      for (const a of days.values()) if (a.status !== "CANCELLED") n += 1;
    }
    return n;
  }, [assignmentIndex]);

  const staffRostered = useMemo(() => {
    let n = 0;
    for (const days of assignmentIndex.values()) {
      if (Array.from(days.values()).some((a) => a.status !== "CANCELLED")) n += 1;
    }
    return n;
  }, [assignmentIndex]);

  const nightCount = useMemo(() => {
    let n = 0;
    for (const days of assignmentIndex.values()) {
      for (const a of days.values()) {
        const def = definitionMap.get(a.shift_definition_id);
        if (def?.shift_type === "NIGHT" || def?.shift_type === "ON_CALL") n += 1;
      }
    }
    return n;
  }, [assignmentIndex, definitionMap]);

  const todayKey = isoDate(new Date());
  const isLoading =
    departmentsQuery.isLoading || definitionsQuery.isLoading || staffLoading;

  const runQuickSetup = async (preset: "TWO" | "THREE") => {
    if (!departmentId) return;
    try {
      const res = await quickSetupMut.mutateAsync({
        department_id: departmentId,
        service_delivery_point_id: sdpId,
        preset,
      });
      toast.success(
        "Shifts ready",
        res.count > 0
          ? `${res.count} shift${res.count > 1 ? "s" : ""} created.`
          : "Those shifts already exist for this scope.",
      );
    } catch (err) {
      toast.error("Quick setup failed", apiErrorMessage(err, "Please try again."));
    }
  };

  const removeDefinition = async (def: ShiftDefinition) => {
    try {
      await deleteDefMut.mutateAsync(def.id);
      toast.success("Shift removed", `${def.name} deleted.`);
    } catch (err) {
      toast.error("Couldn't delete shift", apiErrorMessage(err, "It may still be in use."));
    }
  };

  const openAssign = (staffId: number, date: string) => {
    const existing = assignmentIndex.get(staffId)?.get(date) ?? null;
    setAssignTarget({
      staffId,
      staffName: nameMap.get(staffId) ?? `Staff #${staffId}`,
      date,
      existing: existing && existing.status !== "CANCELLED" ? existing : null,
    });
  };

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      <PageHeader
        title="Duty Roster"
        description="Configure shifts per department or unit, then assign staff across the week."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                const d = new Date(weekStart);
                d.setDate(d.getDate() - 7);
                setWeekStart(d);
              }}
              leftIcon={<ChevronLeft className="h-4 w-4" />}
            >
              Prev
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setWeekStart(startOfWeek(new Date()))}>
              This Week
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                const d = new Date(weekStart);
                d.setDate(d.getDate() + 7);
                setWeekStart(d);
              }}
              rightIcon={<ChevronRight className="h-4 w-4" />}
            >
              Next
            </Button>
          </div>
        }
      />

      {/* Scope selectors */}
      <Card>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Select
            label="Department"
            value={departmentId ?? ""}
            onChange={(e) => setDepartmentId(e.target.value ? Number(e.target.value) : null)}
            placeholder={departmentsQuery.isLoading ? "Loading…" : "Select department"}
          >
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
          <Select
            label="Unit (optional)"
            value={sdpId ?? ""}
            onChange={(e) => setSdpId(e.target.value ? Number(e.target.value) : null)}
            disabled={!departmentId}
          >
            <option value="">All units in department</option>
            {unitsForDept.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
          <div className="flex items-end">
            <Badge variant="soft-info" className="gap-1.5 px-3 py-2">
              <Building2 className="h-3.5 w-3.5" />
              {scopeLabel}
            </Badge>
          </div>
          <div className="flex items-end justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!departmentId}
              leftIcon={<Plus className="h-4 w-4" />}
              onClick={() => {
                setEditingDef(null);
                setDefModalOpen(true);
              }}
            >
              Add shift
            </Button>
          </div>
        </div>
      </Card>

      {/* Metrics */}
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard label="Staff Rostered" value={staffRostered} icon={Users} tone="primary" isLoading={isLoading} />
        <MetricCard label="Shifts This Week" value={totalShifts} icon={CalendarRange} tone="cyan" isLoading={isLoading} />
        <MetricCard label="Night / On-call" value={nightCount} icon={CalendarClock} tone="violet" isLoading={isLoading} />
      </div>

      {/* Shift configuration */}
      <Card>
        <CardHeader
          title="Shifts"
          description="These are the shift blocks staff can be assigned to for this scope."
          actions={
            <Button
              size="sm"
              variant="ghost"
              disabled={!departmentId}
              leftIcon={<Plus className="h-4 w-4" />}
              onClick={() => {
                setEditingDef(null);
                setDefModalOpen(true);
              }}
            >
              Add shift
            </Button>
          }
        />
        {!departmentId ? (
          <EmptyState icon={Layers} title="Pick a department" description="Choose a department above to configure its shifts." />
        ) : definitionsQuery.isLoading ? (
          <div className="flex flex-wrap gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-40" />
            ))}
          </div>
        ) : definitions.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-secondary-200 p-8 text-center dark:border-white/10">
            <Wand2 className="mx-auto mb-3 h-8 w-8 text-primary-500" />
            <p className="text-base font-black text-secondary-900 dark:text-secondary-100">
              Set up the shifts for this scope
            </p>
            <p className="mx-auto mt-1 max-w-md text-sm text-secondary-400">
              Start with a standard rotation — you can edit the times and colours afterwards — or add your own.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <Button onClick={() => runQuickSetup("TWO")} isLoading={quickSetupMut.isPending} leftIcon={<Wand2 className="h-4 w-4" />}>
                Set up 2 shifts (Day / Night)
              </Button>
              <Button variant="secondary" onClick={() => runQuickSetup("THREE")} isLoading={quickSetupMut.isPending} leftIcon={<Wand2 className="h-4 w-4" />}>
                Set up 3 shifts (Morning / Afternoon / Night)
              </Button>
              <Button
                variant="ghost"
                leftIcon={<Plus className="h-4 w-4" />}
                onClick={() => {
                  setEditingDef(null);
                  setDefModalOpen(true);
                }}
              >
                Custom shift
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            {definitions.map((def) => (
              <div
                key={def.id}
                className="group relative flex items-center gap-3 rounded-2xl border border-secondary-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-white/5"
              >
                <span className="h-9 w-1.5 rounded-full" style={{ backgroundColor: def.color_hex || "#94a3b8" }} />
                <div className="pr-14">
                  <p className="text-sm font-black text-secondary-900 dark:text-secondary-100">{def.name}</p>
                  <p className="text-[11px] font-bold text-secondary-400">
                    {def.code} · {fmtTime(def.start_time)}–{fmtTime(def.end_time)}
                  </p>
                </div>
                <div className="absolute right-2 top-1/2 flex -translate-y-1/2 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    className="rounded-lg p-1.5 text-secondary-400 hover:bg-secondary-100 hover:text-secondary-700 dark:hover:bg-white/10"
                    title="Edit shift"
                    onClick={() => {
                      setEditingDef(def);
                      setDefModalOpen(true);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    className="rounded-lg p-1.5 text-rose-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                    title="Delete shift"
                    onClick={() => removeDefinition(def)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Weekly grid */}
      <Card padding="none">
        <CardHeader
          className="px-6 pt-6"
          title={`Week of ${fmtShort(weekDays[0])} — ${fmtShort(weekDays[6])}`}
          description="Click any cell to assign, change or remove a shift."
        />
        {!departmentId ? (
          <div className="px-6 pb-8">
            <EmptyState icon={CalendarRange} title="Select a department" description="Pick a department to build its weekly roster." />
          </div>
        ) : isLoading ? (
          <div className="space-y-3 px-6 pb-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : deptStaff.length === 0 ? (
          <div className="px-6 pb-8">
            <EmptyState
              icon={Users}
              title="No staff in this department"
              description="Assign staff to this department first, then they'll appear here to be rostered."
            />
          </div>
        ) : (
          <div className="overflow-x-auto px-6 pb-6">
            <table className="w-full min-w-[920px] border-separate border-spacing-1">
              <thead>
                <tr>
                  <th className="w-52 px-3 py-2 text-left text-[10px] font-black uppercase tracking-[0.15em] text-secondary-400">
                    Staff
                  </th>
                  {weekDays.map((d, i) => (
                    <th
                      key={weekKeys[i]}
                      className={cn(
                        "px-2 py-2 text-center text-[10px] font-black uppercase tracking-[0.15em]",
                        weekKeys[i] === todayKey ? "text-primary-500" : "text-secondary-400",
                      )}
                    >
                      {d.toLocaleDateString(undefined, { weekday: "short" })}
                      <span className="mt-0.5 block data-mono text-[10px] font-bold">{fmtShort(d)}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {deptStaff.map((s) => {
                  const days = assignmentIndex.get(s.id);
                  return (
                    <tr key={s.id}>
                      <td className="rounded-xl bg-secondary-500/5 px-3 py-2 dark:bg-white/5">
                        <p className="truncate text-sm font-bold text-secondary-900 dark:text-secondary-100">
                          {nameMap.get(s.id) ?? `Staff #${s.id}`}
                        </p>
                        <p className="data-mono text-[10px] text-secondary-400">
                          {s.designation || `SP-${s.id}`}
                        </p>
                      </td>
                      {weekKeys.map((key) => {
                        const a = days?.get(key);
                        const live = a && a.status !== "CANCELLED" ? a : null;
                        const def = live ? definitionMap.get(live.shift_definition_id) : null;
                        return (
                          <td key={key} className="min-w-[112px] align-top">
                            {live && def ? (
                              <button
                                onClick={() => openAssign(s.id, key)}
                                className="w-full rounded-xl border px-2 py-1.5 text-center transition-all hover:brightness-95"
                                style={{
                                  backgroundColor: `${def.color_hex || "#64748b"}1a`,
                                  borderColor: `${def.color_hex || "#64748b"}55`,
                                  color: def.color_hex || "#475569",
                                }}
                                title={`${def.name} (${fmtTime(def.start_time)}–${fmtTime(def.end_time)})`}
                              >
                                <p className="truncate text-[10px] font-black uppercase tracking-widest">{def.code}</p>
                                <p className="data-mono text-[10px] font-bold">
                                  {fmtTime(def.start_time)}–{fmtTime(def.end_time)}
                                </p>
                              </button>
                            ) : (
                              <button
                                onClick={() => openAssign(s.id, key)}
                                className="group flex h-full min-h-[52px] w-full items-center justify-center rounded-xl border border-dashed border-secondary-200/70 text-secondary-300 transition-all hover:border-primary-400 hover:text-primary-500 dark:border-white/10"
                                title="Assign a shift"
                              >
                                <Plus className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
                              </button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {/* Legend */}
        {definitions.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-secondary-100 px-6 py-4 dark:border-white/5">
            {definitions.map((def) => (
              <Badge
                key={def.id}
                variant="outline"
                style={{ borderColor: `${def.color_hex || "#94a3b8"}66`, color: def.color_hex || undefined }}
              >
                {def.code} · {fmtTime(def.start_time)}–{fmtTime(def.end_time)}
              </Badge>
            ))}
          </div>
        ) : null}
      </Card>

      {/* Modals */}
      {departmentId ? (
        <ShiftDefinitionModal
          isOpen={defModalOpen}
          onClose={() => {
            setDefModalOpen(false);
            setEditingDef(null);
          }}
          departmentId={departmentId}
          serviceDeliveryPointId={sdpId}
          scopeLabel={scopeLabel}
          existing={editingDef}
        />
      ) : null}

      {assignTarget ? (
        <AssignShiftModal
          isOpen={!!assignTarget}
          onClose={() => setAssignTarget(null)}
          staffId={assignTarget.staffId}
          staffName={assignTarget.staffName}
          date={assignTarget.date}
          definitions={definitions}
          existing={assignTarget.existing}
        />
      ) : null}
    </div>
  );
}
