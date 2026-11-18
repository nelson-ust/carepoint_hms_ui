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
import {
  DxPage, DxPageHeader, DxPanel, DxKpi, DxBadge, DxButton, DxSelect,
} from "@/components/dx";
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
        res.count > 0 ? `${res.count} shift${res.count > 1 ? "s" : ""} created.` : "Those shifts already exist for this scope.",
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
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "HR" }, { label: "Duty Roster" }]}
        title="Duty Roster"
        subtitle="Configure shifts per department or unit, then assign staff across the week."
        actions={
          <>
            <DxButton size="sm" onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d); }} leftIcon={<ChevronLeft className="h-4 w-4" />}>Prev</DxButton>
            <DxButton size="sm" onClick={() => setWeekStart(startOfWeek(new Date()))}>This week</DxButton>
            <DxButton size="sm" onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d); }} rightIcon={<ChevronRight className="h-4 w-4" />}>Next</DxButton>
          </>
        }
      />

      {/* Scope selectors */}
      <DxPanel>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <DxSelect label="Department" value={departmentId ?? ""} onChange={(e) => setDepartmentId(e.target.value ? Number(e.target.value) : null)} placeholder={departmentsQuery.isLoading ? "Loading…" : "Select department"}>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </DxSelect>
          <DxSelect label="Unit (optional)" value={sdpId ?? ""} onChange={(e) => setSdpId(e.target.value ? Number(e.target.value) : null)} disabled={!departmentId}>
            <option value="">All units in department</option>
            {unitsForDept.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </DxSelect>
          <div className="flex items-end">
            <DxBadge tone="info"><Building2 className="mr-1.5 inline h-3.5 w-3.5" />{scopeLabel}</DxBadge>
          </div>
          <div className="flex items-end justify-end gap-2">
            <DxButton size="sm" disabled={!departmentId} leftIcon={<Plus className="h-4 w-4" />} onClick={() => { setEditingDef(null); setDefModalOpen(true); }}>Add shift</DxButton>
          </div>
        </div>
      </DxPanel>

      {/* Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <DxKpi label="Staff Rostered" value={staffRostered} icon={Users} tone="accent" isLoading={isLoading} />
        <DxKpi label="Shifts This Week" value={totalShifts} icon={CalendarRange} tone="info" isLoading={isLoading} />
        <DxKpi label="Night / On-call" value={nightCount} icon={CalendarClock} tone="neutral" isLoading={isLoading} />
      </div>

      {/* Shift configuration */}
      <DxPanel
        title="Shifts"
        description="These are the shift blocks staff can be assigned to for this scope."
        actions={<DxButton size="sm" variant="text" disabled={!departmentId} leftIcon={<Plus className="h-4 w-4" />} onClick={() => { setEditingDef(null); setDefModalOpen(true); }}>Add shift</DxButton>}
      >
        {!departmentId ? (
          <div className="py-10 text-center">
            <Layers className="mx-auto mb-3 h-9 w-9 text-[var(--dx-text-faint)]" />
            <p className="text-[14px] font-semibold text-[var(--dx-text)]">Pick a department</p>
            <p className="mt-1 text-[13px] text-[var(--dx-text-muted)]">Choose a department above to configure its shifts.</p>
          </div>
        ) : definitionsQuery.isLoading ? (
          <div className="flex flex-wrap gap-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="dx-skeleton h-16 w-40" />)}</div>
        ) : definitions.length === 0 ? (
          <div className="rounded-md border border-dashed border-[var(--dx-border-strong)] p-8 text-center">
            <Wand2 className="mx-auto mb-3 h-8 w-8 text-[var(--dx-accent)]" />
            <p className="text-[16px] font-bold text-[var(--dx-text)]">Set up the shifts for this scope</p>
            <p className="mx-auto mt-1 max-w-md text-[13px] text-[var(--dx-text-muted)]">Start with a standard rotation — you can edit the times and colours afterwards — or add your own.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <DxButton variant="primary" onClick={() => runQuickSetup("TWO")} isLoading={quickSetupMut.isPending} leftIcon={<Wand2 className="h-4 w-4" />}>Set up 2 shifts (Day / Night)</DxButton>
              <DxButton onClick={() => runQuickSetup("THREE")} isLoading={quickSetupMut.isPending} leftIcon={<Wand2 className="h-4 w-4" />}>Set up 3 shifts (Morning / Afternoon / Night)</DxButton>
              <DxButton variant="text" leftIcon={<Plus className="h-4 w-4" />} onClick={() => { setEditingDef(null); setDefModalOpen(true); }}>Custom shift</DxButton>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            {definitions.map((def) => (
              <div key={def.id} className="group relative flex items-center gap-3 rounded-md border border-[var(--dx-border)] bg-[var(--dx-surface)] px-4 py-3">
                <span className="h-9 w-1.5 rounded-full" style={{ backgroundColor: def.color_hex || "#94a3b8" }} />
                <div className="pr-14">
                  <p className="text-[14px] font-semibold text-[var(--dx-text)]">{def.name}</p>
                  <p className="text-[11px] font-semibold text-[var(--dx-text-muted)]">{def.code} · {fmtTime(def.start_time)}–{fmtTime(def.end_time)}</p>
                </div>
                <div className="absolute right-2 top-1/2 flex -translate-y-1/2 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <DxButton icon size="sm" variant="text" title="Edit shift" onClick={() => { setEditingDef(def); setDefModalOpen(true); }}><Pencil /></DxButton>
                  <DxButton icon size="sm" variant="outline-danger" title="Delete shift" onClick={() => removeDefinition(def)}><Trash2 /></DxButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </DxPanel>

      {/* Weekly grid */}
      <DxPanel title={`Week of ${fmtShort(weekDays[0])} — ${fmtShort(weekDays[6])}`} description="Click any cell to assign, change or remove a shift." flush>
        {!departmentId ? (
          <div className="px-4 py-10 text-center">
            <CalendarRange className="mx-auto mb-3 h-9 w-9 text-[var(--dx-text-faint)]" />
            <p className="text-[14px] font-semibold text-[var(--dx-text)]">Select a department</p>
            <p className="mt-1 text-[13px] text-[var(--dx-text-muted)]">Pick a department to build its weekly roster.</p>
          </div>
        ) : isLoading ? (
          <div className="space-y-3 px-4 py-4">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="dx-skeleton h-14 w-full" />)}</div>
        ) : deptStaff.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <Users className="mx-auto mb-3 h-9 w-9 text-[var(--dx-text-faint)]" />
            <p className="text-[14px] font-semibold text-[var(--dx-text)]">No staff in this department</p>
            <p className="mt-1 text-[13px] text-[var(--dx-text-muted)]">Assign staff to this department first, then they'll appear here to be rostered.</p>
          </div>
        ) : (
          <div className="overflow-x-auto px-4 py-4">
            <table className="w-full min-w-[920px] border-separate border-spacing-1">
              <thead>
                <tr>
                  <th className="w-52 px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--dx-text-muted)]">Staff</th>
                  {weekDays.map((d, i) => (
                    <th key={weekKeys[i]} className={cn("px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.15em]")} style={weekKeys[i] === todayKey ? { color: "var(--dx-accent)" } : { color: "var(--dx-text-muted)" }}>
                      {d.toLocaleDateString(undefined, { weekday: "short" })}
                      <span className="dx-mono mt-0.5 block text-[10px] font-bold">{fmtShort(d)}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {deptStaff.map((s) => {
                  const days = assignmentIndex.get(s.id);
                  return (
                    <tr key={s.id}>
                      <td className="rounded-md bg-[var(--dx-surface-sunken)] px-3 py-2">
                        <p className="truncate text-[13px] font-semibold text-[var(--dx-text)]">{nameMap.get(s.id) ?? `Staff #${s.id}`}</p>
                        <p className="dx-mono text-[10px] text-[var(--dx-text-muted)]">{s.designation || `SP-${s.id}`}</p>
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
                                className="w-full rounded-md border px-2 py-1.5 text-center transition-all hover:brightness-95"
                                style={{ backgroundColor: `${def.color_hex || "#64748b"}1a`, borderColor: `${def.color_hex || "#64748b"}55`, color: def.color_hex || "#475569" }}
                                title={`${def.name} (${fmtTime(def.start_time)}–${fmtTime(def.end_time)})`}
                              >
                                <p className="truncate text-[10px] font-bold uppercase tracking-widest">{def.code}</p>
                                <p className="dx-mono text-[10px] font-bold">{fmtTime(def.start_time)}–{fmtTime(def.end_time)}</p>
                              </button>
                            ) : (
                              <button
                                onClick={() => openAssign(s.id, key)}
                                className="group flex h-full min-h-[52px] w-full items-center justify-center rounded-md border border-dashed border-[var(--dx-border)] text-[var(--dx-text-faint)] transition-colors hover:border-[var(--dx-accent)] hover:text-[var(--dx-accent)]"
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
          <div className="flex flex-wrap items-center gap-2 border-t border-[var(--dx-border)] px-4 py-4">
            {definitions.map((def) => (
              <span key={def.id} className="inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold" style={{ borderColor: `${def.color_hex || "#94a3b8"}66`, color: def.color_hex || undefined }}>
                {def.code} · {fmtTime(def.start_time)}–{fmtTime(def.end_time)}
              </span>
            ))}
          </div>
        ) : null}
      </DxPanel>

      {/* Modals */}
      {departmentId ? (
        <ShiftDefinitionModal
          isOpen={defModalOpen}
          onClose={() => { setDefModalOpen(false); setEditingDef(null); }}
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
    </DxPage>
  );
}
