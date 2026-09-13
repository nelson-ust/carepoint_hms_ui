import { useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Scissors,
  ShieldCheck,
  ListChecks,
  Syringe,
  StickyNote,
  Users,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Boxes,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils/cn";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/api/api-error";
import { routes } from "@/config/routes";
import { getPatientById } from "@/features/patients/api/patients.api";
import { getStaff, staffDisplayName, type Staff } from "@/features/staff/api/staff.api";
import { listActiveServiceDeliveryPoints } from "@/features/service-delivery-points/api/service-delivery-points.api";
import {
  useSurgicalCase,
  useCaseTeam,
  useCaseConsents,
  useCaseChecklists,
  useCaseAnaesthesia,
  useCaseNotes,
  useProcedures,
  useTheatres,
  useInvalidateSurgery,
} from "../hooks/use-surgery";
import {
  transitionCase,
  completeCase,
  addTeamMember,
  removeTeamMember,
  recordConsent,
  recordChecklist,
  recordAnaesthesia,
  addNote,
  listInstrumentSets,
  caseStatusLabel,
  fmtDateTime,
  CASE_LIFECYCLE,
  SURGICAL_ROLE_OPTIONS,
  ANAESTHESIA_OPTIONS,
  type SurgicalCaseStatus,
} from "../api/surgery.api";

const CHECKLIST_ITEMS: Record<string, string[]> = {
  SIGN_IN: [
    "Patient identity, site & procedure confirmed",
    "Site marked",
    "Anaesthesia safety check complete",
    "Pulse oximeter on & functioning",
    "Known allergy reviewed",
    "Difficult airway / aspiration risk assessed",
    "Risk of >500ml blood loss assessed",
  ],
  TIME_OUT: [
    "All team members introduced by name & role",
    "Patient, site & procedure confirmed",
    "Antibiotic prophylaxis given (last 60 min)",
    "Essential imaging displayed",
    "Anticipated critical events reviewed",
  ],
  SIGN_OUT: [
    "Procedure name recorded",
    "Instrument, sponge & needle counts correct",
    "Specimen labelled",
    "Equipment problems addressed",
    "Recovery & management key concerns reviewed",
  ],
};

type ActionKey =
  | "confirm"
  | "start-pre-op"
  | "into-theatre"
  | "incision"
  | "closure"
  | "post-op"
  | "complete"
  | "cancel";

const ACTION_LABEL: Record<ActionKey, string> = {
  confirm: "Confirm Case",
  "start-pre-op": "Start Pre-op",
  "into-theatre": "Bring Into Theatre",
  incision: "Mark Incision",
  closure: "Mark Closure",
  "post-op": "Move to Post-op",
  complete: "Complete Case",
  cancel: "Cancel Case",
};

const ACTIONS_BY_STATUS: Record<string, ActionKey[]> = {
  BOOKED: ["confirm", "cancel"],
  CONFIRMED: ["start-pre-op", "cancel"],
  PRE_OP: ["into-theatre", "cancel"],
  IN_THEATRE: ["incision", "cancel"],
  PROCEDURE_STARTED: ["closure"],
  PROCEDURE_ENDED: ["post-op"],
  POST_OP: ["complete"],
};

const ACTION_HINT: Partial<Record<ActionKey, string>> = {
  "into-theatre": "Complete the WHO Sign-In before bringing the patient in.",
  incision: "Complete the WHO Time-Out before incision.",
  "post-op": "Complete the WHO Sign-Out before moving to post-op.",
};

export function SurgicalCaseDetailPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const id = Number(caseId);
  const navigate = useNavigate();
  const toast = useToast();
  const invalidate = useInvalidateSurgery();

  const caseQuery = useSurgicalCase(id);
  const teamQuery = useCaseTeam(id);
  const consentsQuery = useCaseConsents(id);
  const checklistsQuery = useCaseChecklists(id);
  const anaesthesiaQuery = useCaseAnaesthesia(id);
  const notesQuery = useCaseNotes(id);
  const proceduresQuery = useProcedures();
  const theatresQuery = useTheatres();

  const c = caseQuery.data;

  const patientQuery = useQuery({
    queryKey: ["patient", c?.patient_id],
    queryFn: () => getPatientById(c!.patient_id),
    enabled: !!c?.patient_id,
  });
  const staffQuery = useQuery({
    queryKey: ["staff", "directory"],
    queryFn: () => getStaff(0, 1000),
    staleTime: 5 * 60 * 1000,
  });
  const sdpQuery = useQuery({
    queryKey: ["sdp", "active", "surgery"],
    queryFn: () => listActiveServiceDeliveryPoints({ limit: 300 }),
    staleTime: 5 * 60 * 1000,
  });
  const instrumentsQuery = useQuery({
    queryKey: ["instrument-sets", "for-case", id],
    queryFn: () => listInstrumentSets({ limit: 300 }),
    enabled: !!id,
  });

  const staffName = (sid?: number | null) => {
    if (!sid) return "—";
    const s = (staffQuery.data ?? []).find((x: Staff) => x.id === sid);
    return s ? staffDisplayName(s) : `Staff #${sid}`;
  };

  const procedureName = useMemo(() => {
    if (!c) return "";
    return proceduresQuery.data?.items.find((p) => p.id === c.procedure_catalog_id)?.name ?? `#${c.procedure_catalog_id}`;
  }, [c, proceduresQuery.data]);
  const theatreName = useMemo(() => {
    if (!c?.operating_theatre_id) return "Unassigned";
    return theatresQuery.data?.items.find((t) => t.id === c.operating_theatre_id)?.name ?? `#${c.operating_theatre_id}`;
  }, [c, theatresQuery.data]);

  const assignedInstruments = useMemo(
    () => (instrumentsQuery.data?.items ?? []).filter((s) => s.surgical_case_id === id),
    [instrumentsQuery.data, id],
  );

  // ---- Transition modal ----
  const [action, setAction] = useState<ActionKey | null>(null);
  const [note, setNote] = useState("");
  const [findings, setFindings] = useState("");
  const [routeSdp, setRouteSdp] = useState("");
  const [busy, setBusy] = useState(false);

  const openAction = (a: ActionKey) => {
    setAction(a);
    setNote("");
    setFindings("");
    setRouteSdp("");
  };

  const runAction = async () => {
    if (!action || !c) return;
    setBusy(true);
    try {
      if (action === "complete") {
        await completeCase(c.id, { note: note || undefined, findings: findings || undefined }, routeSdp ? Number(routeSdp) : undefined);
      } else {
        await transitionCase(c.id, action, {
          note: note || undefined,
          findings: findings || undefined,
        });
      }
      toast.success(ACTION_LABEL[action], "Case updated.");
      setAction(null);
      invalidate(c.id);
    } catch (err) {
      toast.error("Action failed", apiErrorMessage(err, "Please try again."));
    } finally {
      setBusy(false);
    }
  };

  if (caseQuery.isLoading) {
    return (
      <div className="space-y-6 p-2">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (caseQuery.isError || !c) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-secondary-500">Could not load this surgical case.</p>
        <Button className="mt-4" variant="secondary" onClick={() => navigate(routes.surgery)}>
          Back to worklist
        </Button>
      </div>
    );
  }

  const status = String(c.status);
  const availableActions = ACTIONS_BY_STATUS[status] ?? [];
  const currentIdx = CASE_LIFECYCLE.indexOf(status as SurgicalCaseStatus);
  const showFindings = action === "incision" || action === "closure";

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      <button onClick={() => navigate(routes.surgery)} className="flex items-center gap-2 text-sm font-bold text-secondary-500 hover:text-primary-600">
        <ArrowLeft className="h-4 w-4" /> Back to worklist
      </button>

      <PageHeader
        title={c.case_no}
        description={`${procedureName} · ${patientQuery.data ? `${patientQuery.data.first_name} ${patientQuery.data.last_name}` : `Patient #${c.patient_id}`}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {c.is_emergency && <Badge variant="soft-danger">EMERGENCY</Badge>}
            {availableActions.map((a) => (
              <Button
                key={a}
                size="sm"
                variant={a === "cancel" ? "danger" : "primary"}
                onClick={() => openAction(a)}
              >
                {ACTION_LABEL[a]}
              </Button>
            ))}
            {availableActions.length === 0 && (
              <Badge variant={status === "COMPLETED" ? "soft-success" : "soft-danger"}>
                {caseStatusLabel(status)}
              </Badge>
            )}
          </div>
        }
      />

      {/* Lifecycle stepper */}
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          {CASE_LIFECYCLE.map((stage, i) => {
            const done = currentIdx >= 0 && i < currentIdx;
            const active = i === currentIdx;
            return (
              <div key={stage} className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-widest",
                    active
                      ? "bg-primary-600 text-white"
                      : done
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
                        : "bg-secondary-100 text-secondary-400 dark:bg-white/5",
                  )}
                >
                  {done && <CheckCircle2 className="h-3 w-3" />}
                  {caseStatusLabel(stage)}
                </span>
                {i < CASE_LIFECYCLE.length - 1 && <span className="text-secondary-300">›</span>}
              </div>
            );
          })}
          {(status === "CANCELLED" || status === "POSTPONED") && (
            <Badge variant="soft-danger" className="ml-2">{caseStatusLabel(status)}</Badge>
          )}
        </div>
      </Card>

      {/* Overview */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Case Overview" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Detail label="Theatre" value={theatreName} />
            <Detail label="Status" value={caseStatusLabel(status)} />
            <Detail label="ASA class" value={c.asa_class ? c.asa_class.replace("_", " ") : "—"} />
            <Detail label="Anaesthesia" value={c.anaesthesia_type ?? "—"} />
            <Detail label="Scheduled start" value={fmtDateTime(c.scheduled_start_at)} />
            <Detail label="Scheduled end" value={fmtDateTime(c.scheduled_end_at)} />
            <Detail label="Pre-op started" value={fmtDateTime(c.pre_op_started_at)} />
            <Detail label="Incision" value={fmtDateTime(c.incision_at)} />
            <Detail label="Closure" value={fmtDateTime(c.closure_at)} />
            <Detail label="Out of theatre" value={fmtDateTime(c.out_of_theatre_at)} />
          </div>
          {c.diagnosis_text && <Detail className="mt-4" label="Pre-op diagnosis" value={c.diagnosis_text} />}
          {c.findings_text && <Detail className="mt-4" label="Operative findings" value={c.findings_text} />}
          {c.cancellation_reason && (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-500/20 dark:bg-rose-500/10">
              <AlertTriangle className="mr-2 inline h-4 w-4" />
              Cancelled: {c.cancellation_reason}
            </div>
          )}
        </Card>

        {/* Assigned instruments */}
        <Card>
          <CardHeader
            title="Instruments"
            actions={<Boxes className="h-5 w-5 text-secondary-400" />}
          />
          {assignedInstruments.length === 0 ? (
            <p className="text-sm text-secondary-400">
              No instrument sets assigned. Assign from the{" "}
              <Link to={routes.instrumentSets} className="font-bold text-primary-600 underline">Instruments</Link> page.
            </p>
          ) : (
            <div className="space-y-2">
              {assignedInstruments.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-xl border border-secondary-200 px-3 py-2 dark:border-white/10">
                  <span className="text-sm font-bold text-secondary-900 dark:text-secondary-100">{s.name}</span>
                  <Badge variant={String(s.sterilization_status) === "READY" ? "soft-success" : "soft-warning"}>
                    {String(s.sterilization_status)}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Team */}
      <TeamPanel
        caseId={id}
        team={teamQuery.data ?? []}
        loading={teamQuery.isLoading}
        staff={staffQuery.data ?? []}
        staffName={staffName}
        onChanged={() => invalidate(id)}
      />

      {/* WHO checklist */}
      <ChecklistPanel
        caseId={id}
        recorded={checklistsQuery.data ?? []}
        loading={checklistsQuery.isLoading}
        onChanged={() => invalidate(id)}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <ConsentPanel
          caseId={id}
          consents={consentsQuery.data ?? []}
          loading={consentsQuery.isLoading}
          staff={staffQuery.data ?? []}
          staffName={staffName}
          onChanged={() => invalidate(id)}
        />
        <AnaesthesiaPanel
          caseId={id}
          records={anaesthesiaQuery.data ?? []}
          loading={anaesthesiaQuery.isLoading}
          staff={staffQuery.data ?? []}
          staffName={staffName}
          onChanged={() => invalidate(id)}
        />
      </div>

      <NotesPanel
        caseId={id}
        notes={notesQuery.data ?? []}
        loading={notesQuery.isLoading}
        staffName={staffName}
        onChanged={() => invalidate(id)}
      />

      {/* Transition modal */}
      <Modal
        isOpen={!!action}
        onClose={() => setAction(null)}
        title={action ? ACTION_LABEL[action] : ""}
        size="md"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setAction(null)} disabled={busy}>Cancel</Button>
            <Button variant={action === "cancel" ? "danger" : "primary"} onClick={runAction} isLoading={busy}>
              {action ? ACTION_LABEL[action] : "Confirm"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {action && ACTION_HINT[action] && (
            <p className="rounded-2xl bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
              {ACTION_HINT[action]}
            </p>
          )}
          <Textarea
            label={action === "cancel" ? "Reason" : "Note (optional)"}
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          {showFindings && (
            <Textarea
              label="Operative findings (optional)"
              rows={3}
              value={findings}
              onChange={(e) => setFindings(e.target.value)}
            />
          )}
          {action === "complete" && (
            <Select label="Route patient to (optional)" value={routeSdp} onChange={(e) => setRouteSdp(e.target.value)}>
              <option value="">Don't route</option>
              {(sdpQuery.data?.items ?? []).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          )}
        </div>
      </Modal>
    </div>
  );
}

function Detail({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <p className="text-[10px] font-black uppercase tracking-widest text-secondary-400">{label}</p>
      <p className="mt-0.5 text-sm font-bold text-secondary-900 dark:text-secondary-100">{value}</p>
    </div>
  );
}

// ============================================================
// TEAM
// ============================================================
function TeamPanel({ caseId, team, loading, staff, staffName, onChanged }: any) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [staffId, setStaffId] = useState("");
  const [role, setRole] = useState("PRIMARY_SURGEON");
  const [isLead, setIsLead] = useState(false);
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (!staffId) { toast.error("Pick a staff member"); return; }
    setBusy(true);
    try {
      await addTeamMember({ surgical_case_id: caseId, staff_profile_id: Number(staffId), role, is_lead: isLead });
      toast.success("Team member added");
      setOpen(false); setStaffId(""); setIsLead(false);
      onChanged();
    } catch (err) { toast.error("Couldn't add member", apiErrorMessage(err, "Retry.")); }
    finally { setBusy(false); }
  };
  const remove = async (mid: number) => {
    try { await removeTeamMember(mid); toast.success("Removed"); onChanged(); }
    catch (err) { toast.error("Couldn't remove", apiErrorMessage(err, "Retry.")); }
  };

  return (
    <Card>
      <CardHeader
        title="Surgical Team"
        actions={<Button size="sm" variant="ghost" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>Add</Button>}
      />
      {loading ? (
        <Skeleton className="h-16 w-full" />
      ) : team.length === 0 ? (
        <p className="text-sm text-secondary-400">No team members assigned yet.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {team.map((m: any) => (
            <div key={m.id} className="flex items-center justify-between rounded-2xl border border-secondary-200 px-4 py-3 dark:border-white/10">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-secondary-400" />
                <div>
                  <p className="text-sm font-black text-secondary-900 dark:text-secondary-100">{staffName(m.staff_profile_id)}</p>
                  <p className="text-[11px] font-bold text-secondary-400">
                    {String(m.role).replace(/_/g, " ")}{m.is_lead ? " · Lead" : ""}
                  </p>
                </div>
              </div>
              <button onClick={() => remove(m.id)} className="rounded-lg p-1.5 text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10" title="Remove">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
      <Modal isOpen={open} onClose={() => setOpen(false)} title="Add Team Member" size="md"
        footer={<div className="flex justify-end gap-3"><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={add} isLoading={busy}>Add</Button></div>}>
        <div className="space-y-4">
          <Select label="Staff" value={staffId} onChange={(e) => setStaffId(e.target.value)} placeholder="Select staff">
            {(staff as Staff[]).map((s) => <option key={s.id} value={s.id}>{staffDisplayName(s)}</option>)}
          </Select>
          <Select label="Role" value={role} onChange={(e) => setRole(e.target.value)} options={SURGICAL_ROLE_OPTIONS} />
          <label className="flex cursor-pointer items-center gap-3">
            <input type="checkbox" className="h-5 w-5 rounded accent-primary-600" checked={isLead} onChange={(e) => setIsLead(e.target.checked)} />
            <span className="text-sm font-bold text-secondary-900 dark:text-secondary-100">Lead for this role</span>
          </label>
        </div>
      </Modal>
    </Card>
  );
}

// ============================================================
// WHO CHECKLIST
// ============================================================
function ChecklistPanel({ caseId, recorded, loading, onChanged }: any) {
  const toast = useToast();
  const [phase, setPhase] = useState<string | null>(null);
  const [items, setItems] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const recordedPhases = new Set((recorded ?? []).map((r: any) => String(r.phase)));

  const openPhase = (p: string) => {
    setPhase(p);
    const seed: Record<string, boolean> = {};
    for (const it of CHECKLIST_ITEMS[p]) seed[it] = false;
    setItems(seed);
    setNotes("");
  };
  const save = async () => {
    if (!phase) return;
    setBusy(true);
    try {
      await recordChecklist({ surgical_case_id: caseId, phase: phase as any, items, notes: notes || undefined });
      toast.success("Checklist recorded", `${phase.replace("_", " ")} saved.`);
      setPhase(null); onChanged();
    } catch (err) { toast.error("Couldn't save checklist", apiErrorMessage(err, "Retry.")); }
    finally { setBusy(false); }
  };

  return (
    <Card>
      <CardHeader title="WHO Surgical Safety Checklist" actions={<ListChecks className="h-5 w-5 text-secondary-400" />} />
      {loading ? <Skeleton className="h-16 w-full" /> : (
        <div className="grid gap-3 sm:grid-cols-3">
          {["SIGN_IN", "TIME_OUT", "SIGN_OUT"].map((p) => {
            const done = recordedPhases.has(p);
            const rec = (recorded ?? []).find((r: any) => String(r.phase) === p);
            return (
              <button
                key={p}
                onClick={() => openPhase(p)}
                className={cn(
                  "rounded-2xl border-2 p-4 text-left transition-all",
                  done ? "border-emerald-500/40 bg-emerald-500/10" : "border-secondary-200 hover:border-primary-300 dark:border-white/10",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-black text-secondary-900 dark:text-secondary-100">
                    {p.replace("_", " ")}
                  </span>
                  {done ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Clock className="h-4 w-4 text-secondary-300" />}
                </div>
                <p className="mt-1 text-[11px] font-bold text-secondary-400">
                  {done ? `Recorded ${fmtDateTime(rec?.completed_at)}` : "Tap to record"}
                </p>
              </button>
            );
          })}
        </div>
      )}
      <Modal isOpen={!!phase} onClose={() => setPhase(null)} title={phase ? `WHO ${phase.replace("_", " ")}` : ""} size="md"
        footer={<div className="flex justify-end gap-3"><Button variant="secondary" onClick={() => setPhase(null)}>Cancel</Button><Button onClick={save} isLoading={busy}>Record</Button></div>}>
        <div className="space-y-3">
          {phase && CHECKLIST_ITEMS[phase].map((it) => (
            <label key={it} className="flex cursor-pointer items-start gap-3 rounded-xl border border-secondary-200 px-3 py-2 dark:border-white/10">
              <input type="checkbox" className="mt-0.5 h-5 w-5 rounded accent-emerald-600" checked={!!items[it]} onChange={(e) => setItems({ ...items, [it]: e.target.checked })} />
              <span className="text-sm text-secondary-800 dark:text-secondary-200">{it}</span>
            </label>
          ))}
          <Textarea label="Notes (optional)" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </Modal>
    </Card>
  );
}

// ============================================================
// CONSENT
// ============================================================
function ConsentPanel({ caseId, consents, loading, staff, staffName, onChanged }: any) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [signedBy, setSignedBy] = useState("");
  const [relationship, setRelationship] = useState("");
  const [witness, setWitness] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!text.trim()) { toast.error("Consent text is required"); return; }
    setBusy(true);
    try {
      await recordConsent({
        surgical_case_id: caseId,
        consent_text: text.trim(),
        consent_signed_by: signedBy.trim() || undefined,
        relationship_to_patient: relationship.trim() || undefined,
        witnessed_by_staff_id: witness ? Number(witness) : undefined,
      });
      toast.success("Consent recorded");
      setOpen(false); setText(""); setSignedBy(""); setRelationship(""); setWitness("");
      onChanged();
    } catch (err) { toast.error("Couldn't record consent", apiErrorMessage(err, "Retry.")); }
    finally { setBusy(false); }
  };

  return (
    <Card>
      <CardHeader title="Consent" actions={<Button size="sm" variant="ghost" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>Record</Button>} />
      {loading ? <Skeleton className="h-16 w-full" /> : consents.length === 0 ? (
        <p className="text-sm text-secondary-400">No consent recorded.</p>
      ) : (
        <div className="space-y-2">
          {consents.map((c: any) => (
            <div key={c.id} className="rounded-2xl border border-secondary-200 p-4 dark:border-white/10">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                <span className="text-sm font-black text-secondary-900 dark:text-secondary-100">
                  {c.consent_signed_by || "Signed"}{c.relationship_to_patient ? ` (${c.relationship_to_patient})` : ""}
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-secondary-500">{c.consent_text}</p>
              <p className="mt-1 text-[11px] font-bold text-secondary-400">
                {fmtDateTime(c.signed_at)}{c.witnessed_by_staff_id ? ` · witnessed by ${staffName(c.witnessed_by_staff_id)}` : ""}
              </p>
            </div>
          ))}
        </div>
      )}
      <Modal isOpen={open} onClose={() => setOpen(false)} title="Record Consent" size="md"
        footer={<div className="flex justify-end gap-3"><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} isLoading={busy}>Record</Button></div>}>
        <div className="space-y-4">
          <Textarea label="Consent statement" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Patient consents to the described procedure, risks and alternatives having been explained…" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Signed by" value={signedBy} onChange={(e) => setSignedBy(e.target.value)} placeholder="Patient / guardian name" />
            <Input label="Relationship" value={relationship} onChange={(e) => setRelationship(e.target.value)} placeholder="Self / parent / spouse" />
          </div>
          <Select label="Witnessed by (staff)" value={witness} onChange={(e) => setWitness(e.target.value)}>
            <option value="">None</option>
            {(staff as Staff[]).map((s) => <option key={s.id} value={s.id}>{staffDisplayName(s)}</option>)}
          </Select>
        </div>
      </Modal>
    </Card>
  );
}

// ============================================================
// ANAESTHESIA
// ============================================================
function AnaesthesiaPanel({ caseId, records, loading, staff, staffName, onChanged }: any) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("GENERAL");
  const [anaesthetist, setAnaesthetist] = useState("");
  const [complications, setComplications] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await recordAnaesthesia({
        surgical_case_id: caseId,
        anaesthesia_type: type,
        anaesthetist_staff_id: anaesthetist ? Number(anaesthetist) : undefined,
        complications: complications.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      toast.success("Anaesthesia recorded");
      setOpen(false); setComplications(""); setNotes("");
      onChanged();
    } catch (err) { toast.error("Couldn't record", apiErrorMessage(err, "Retry.")); }
    finally { setBusy(false); }
  };

  return (
    <Card>
      <CardHeader title="Anaesthesia" actions={<Button size="sm" variant="ghost" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>Record</Button>} />
      {loading ? <Skeleton className="h-16 w-full" /> : records.length === 0 ? (
        <p className="text-sm text-secondary-400">No anaesthesia record.</p>
      ) : (
        <div className="space-y-2">
          {records.map((r: any) => (
            <div key={r.id} className="rounded-2xl border border-secondary-200 p-4 dark:border-white/10">
              <div className="flex items-center gap-2">
                <Syringe className="h-4 w-4 text-violet-500" />
                <span className="text-sm font-black text-secondary-900 dark:text-secondary-100">{String(r.anaesthesia_type)}</span>
              </div>
              <p className="mt-1 text-[11px] font-bold text-secondary-400">Anaesthetist: {staffName(r.anaesthetist_staff_id)}</p>
              {r.complications && <p className="mt-1 text-xs text-rose-500">Complications: {r.complications}</p>}
              {r.notes && <p className="mt-1 text-xs text-secondary-500">{r.notes}</p>}
            </div>
          ))}
        </div>
      )}
      <Modal isOpen={open} onClose={() => setOpen(false)} title="Record Anaesthesia" size="md"
        footer={<div className="flex justify-end gap-3"><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} isLoading={busy}>Record</Button></div>}>
        <div className="space-y-4">
          <Select label="Type" value={type} onChange={(e) => setType(e.target.value)} options={ANAESTHESIA_OPTIONS} />
          <Select label="Anaesthetist" value={anaesthetist} onChange={(e) => setAnaesthetist(e.target.value)}>
            <option value="">Unassigned</option>
            {(staff as Staff[]).map((s) => <option key={s.id} value={s.id}>{staffDisplayName(s)}</option>)}
          </Select>
          <Textarea label="Complications (optional)" rows={2} value={complications} onChange={(e) => setComplications(e.target.value)} />
          <Textarea label="Notes (optional)" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </Modal>
    </Card>
  );
}

// ============================================================
// NOTES
// ============================================================
function NotesPanel({ caseId, notes, loading, staffName, onChanged }: any) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [noteType, setNoteType] = useState("OPERATIVE");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!text.trim()) { toast.error("Note is required"); return; }
    setBusy(true);
    try {
      await addNote({ surgical_case_id: caseId, note: text.trim(), note_type: noteType });
      toast.success("Note added");
      setOpen(false); setText("");
      onChanged();
    } catch (err) { toast.error("Couldn't add note", apiErrorMessage(err, "Retry.")); }
    finally { setBusy(false); }
  };

  return (
    <Card>
      <CardHeader title="Theatre Notes" actions={<Button size="sm" variant="ghost" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>Add note</Button>} />
      {loading ? <Skeleton className="h-16 w-full" /> : notes.length === 0 ? (
        <p className="text-sm text-secondary-400">No notes yet.</p>
      ) : (
        <div className="space-y-3">
          {notes.map((n: any) => (
            <div key={n.id} className="rounded-2xl border border-secondary-200 p-4 dark:border-white/10">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-secondary-400">
                  <StickyNote className="h-3.5 w-3.5" />
                  {n.note_type || "Note"}
                </span>
                <span className="text-[11px] text-secondary-400">{fmtDateTime(n.captured_at)}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-secondary-800 dark:text-secondary-200">{n.note}</p>
              <p className="mt-1 text-[11px] text-secondary-400">— {staffName(n.author_staff_id)}</p>
            </div>
          ))}
        </div>
      )}
      <Modal isOpen={open} onClose={() => setOpen(false)} title="Add Theatre Note" size="md"
        footer={<div className="flex justify-end gap-3"><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} isLoading={busy}>Add</Button></div>}>
        <div className="space-y-4">
          <Select label="Type" value={noteType} onChange={(e) => setNoteType(e.target.value)}>
            <option value="OPERATIVE">Operative note</option>
            <option value="PRE_OP">Pre-op note</option>
            <option value="POST_OP">Post-op note</option>
            <option value="NURSING">Nursing note</option>
            <option value="GENERAL">General</option>
          </Select>
          <Textarea label="Note" rows={5} value={text} onChange={(e) => setText(e.target.value)} />
        </div>
      </Modal>
    </Card>
  );
}
