import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, isValid } from "date-fns";
import { ArrowLeft, Video, PlayCircle, CheckCircle2, XCircle, UserX, Save, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/api/api-error";
import { routes } from "@/config/routes";
import { JitsiFrame, JitsiPlaceholder } from "../components/JitsiFrame";
import { SessionChat } from "../components/SessionChat";
import {
  telemedicineApi,
  telemedicineStatusVariant,
  labelize,
  type TelemedicineJoinInfo,
  type TelemedicineNotesPayload,
} from "../api/telemedicine.api";

function fmt(v?: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  return isValid(d) ? format(d, "MMM d, yyyy • h:mm a") : "—";
}

const OPEN_STATUSES = ["SCHEDULED", "WAITING", "IN_PROGRESS"];
const CLOSED = ["COMPLETED", "CANCELLED", "NO_SHOW"];

export function TelemedicineConsolePage() {
  const { sessionId } = useParams();
  const id = Number(sessionId);
  const toast = useToast();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [join, setJoin] = useState<TelemedicineJoinInfo | null>(null);
  const [notes, setNotes] = useState<TelemedicineNotesPayload>({});
  const [notesDirty, setNotesDirty] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const sessionQuery = useQuery({
    queryKey: ["telemedicine", "session", id],
    queryFn: () => telemedicineApi.get(id),
    enabled: Number.isFinite(id),
  });
  const session = sessionQuery.data;

  const messagesQuery = useQuery({
    queryKey: ["telemedicine", "messages", id],
    queryFn: () => telemedicineApi.listMessages(id),
    enabled: Number.isFinite(id),
    refetchInterval: join ? 5000 : false,
  });

  // Seed the notes form once the session loads.
  useEffect(() => {
    if (session && !notesDirty) {
      setNotes({
        subjective_note: session.subjective_note ?? "",
        objective_note: session.objective_note ?? "",
        assessment_note: session.assessment_note ?? "",
        plan_note: session.plan_note ?? "",
        summary: session.summary ?? "",
        follow_up_required: session.follow_up_required ?? false,
        follow_up_notes: session.follow_up_notes ?? "",
      });
    }
  }, [session, notesDirty]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["telemedicine", "session", id] });
    qc.invalidateQueries({ queryKey: ["telemedicine", "list"] });
  };

  const joinMut = useMutation({
    mutationFn: () => telemedicineApi.join(id),
    onSuccess: ({ join }) => {
      setJoin(join);
      invalidate();
      messagesQuery.refetch();
    },
    onError: (err) => toast.error("Couldn't join room", apiErrorMessage(err, "Please try again.")),
  });

  const startMut = useMutation({
    mutationFn: () => telemedicineApi.start(id),
    onSuccess: () => { invalidate(); toast.success("Consultation started"); },
    onError: (err) => toast.error("Couldn't start", apiErrorMessage(err)),
  });

  const notesMut = useMutation({
    mutationFn: () => telemedicineApi.saveNotes(id, notes),
    onSuccess: () => { setNotesDirty(false); invalidate(); toast.success("Notes saved"); },
    onError: (err) => toast.error("Couldn't save notes", apiErrorMessage(err)),
  });

  const completeMut = useMutation({
    mutationFn: () => telemedicineApi.complete(id, notes),
    onSuccess: () => { setNotesDirty(false); invalidate(); toast.success("Consultation completed"); },
    onError: (err) => toast.error("Couldn't complete", apiErrorMessage(err)),
  });

  const cancelMut = useMutation({
    mutationFn: () => telemedicineApi.cancel(id, cancelReason.trim() || undefined),
    onSuccess: () => { setShowCancel(false); setJoin(null); invalidate(); toast.success("Session cancelled"); },
    onError: (err) => toast.error("Couldn't cancel", apiErrorMessage(err)),
  });

  const noShowMut = useMutation({
    mutationFn: () => telemedicineApi.noShow(id),
    onSuccess: () => { setJoin(null); invalidate(); toast.success("Marked as no-show"); },
    onError: (err) => toast.error("Couldn't mark no-show", apiErrorMessage(err)),
  });

  const sendMut = useMutation({
    mutationFn: (body: string) => telemedicineApi.sendMessage(id, body),
    onSuccess: () => messagesQuery.refetch(),
    onError: (err) => toast.error("Couldn't send message", apiErrorMessage(err)),
  });

  const setNote = (k: keyof TelemedicineNotesPayload, v: any) => {
    setNotesDirty(true);
    setNotes((prev) => ({ ...prev, [k]: v }));
  };

  if (sessionQuery.isLoading) {
    return <div className="p-8 text-center text-secondary-500">Loading session…</div>;
  }
  if (sessionQuery.isError || !session) {
    return (
      <div className="p-8 text-center">
        <p className="text-secondary-500">{apiErrorMessage(sessionQuery.error, "Session not found.")}</p>
        <Button className="mt-4" variant="secondary" onClick={() => navigate(routes.telemedicineSessions)}>Back to sessions</Button>
      </div>
    );
  }

  const isClosed = CLOSED.includes(String(session.status));
  const isOpen = OPEN_STATUSES.includes(String(session.status));
  const canVideo = String(session.modality) !== "CHAT";

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Telemedicine • ${session.session_code}`}
        description={session.reason || "Virtual consultation"}
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={() => navigate(routes.telemedicineSessions)}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { sessionQuery.refetch(); messagesQuery.refetch(); }}>
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
            {!isClosed && (
              <>
                <Button variant="secondary" size="sm" onClick={() => setShowCancel(true)}>
                  <XCircle className="h-4 w-4" /> Cancel
                </Button>
                <Button variant="secondary" size="sm" onClick={() => noShowMut.mutate()} disabled={noShowMut.isPending}>
                  <UserX className="h-4 w-4" /> No-show
                </Button>
              </>
            )}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <Badge variant={telemedicineStatusVariant(session.status)}>{labelize(session.status)}</Badge>
        <span className="text-sm text-secondary-500">{labelize(session.modality)} consultation</span>
        <span className="text-sm text-secondary-500">Patient: {session.patient_name || `#${session.patient_id}`}</span>
        {session.clinician_name && <span className="text-sm text-secondary-500">Clinician: {session.clinician_name}</span>}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: video + notes */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-secondary-900 dark:text-white">Virtual room</h3>
              <div className="flex gap-2">
                {isOpen && !join && canVideo && (
                  <Button size="sm" onClick={() => joinMut.mutate()} disabled={joinMut.isPending}>
                    <Video className="h-4 w-4" /> {joinMut.isPending ? "Joining…" : "Join room"}
                  </Button>
                )}
                {(session.status === "SCHEDULED" || session.status === "WAITING") && (
                  <Button size="sm" variant="secondary" onClick={() => startMut.mutate()} disabled={startMut.isPending}>
                    <PlayCircle className="h-4 w-4" /> Start
                  </Button>
                )}
              </div>
            </div>
            {join && canVideo ? (
              <JitsiFrame join={join} displayName={join.display_name} />
            ) : isClosed ? (
              <JitsiPlaceholder message={`This session is ${labelize(session.status).toLowerCase()}. The room is closed.`} />
            ) : canVideo ? (
              <JitsiPlaceholder message="Click “Join room” to enter the secure video consultation." />
            ) : (
              <JitsiPlaceholder message="This is a chat-only consultation. Use the secure chat on the right." />
            )}
          </Card>

          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-secondary-900 dark:text-white">Consultation notes (SOAP)</h3>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => notesMut.mutate()} disabled={notesMut.isPending || isClosed}>
                  <Save className="h-4 w-4" /> Save
                </Button>
                {!isClosed && (
                  <Button size="sm" onClick={() => completeMut.mutate()} disabled={completeMut.isPending}>
                    <CheckCircle2 className="h-4 w-4" /> Complete
                  </Button>
                )}
              </div>
            </div>
            <div className="space-y-4">
              <Textarea label="Subjective" value={notes.subjective_note ?? ""} onChange={(e) => setNote("subjective_note", e.target.value)} rows={2} disabled={isClosed} placeholder="Patient-reported symptoms, history…" />
              <Textarea label="Objective" value={notes.objective_note ?? ""} onChange={(e) => setNote("objective_note", e.target.value)} rows={2} disabled={isClosed} placeholder="Observed findings, vitals…" />
              <Textarea label="Assessment" value={notes.assessment_note ?? ""} onChange={(e) => setNote("assessment_note", e.target.value)} rows={2} disabled={isClosed} placeholder="Clinical impression / diagnosis…" />
              <Textarea label="Plan" value={notes.plan_note ?? ""} onChange={(e) => setNote("plan_note", e.target.value)} rows={2} disabled={isClosed} placeholder="Treatment, prescriptions, referrals…" />
              <Textarea label="Summary" value={notes.summary ?? ""} onChange={(e) => setNote("summary", e.target.value)} rows={2} disabled={isClosed} placeholder="Visit summary shared with the patient…" />
              <label className="flex items-center gap-2 text-sm text-secondary-700 dark:text-secondary-200">
                <input type="checkbox" checked={!!notes.follow_up_required} onChange={(e) => setNote("follow_up_required", e.target.checked)} disabled={isClosed} />
                Follow-up required
              </label>
              {notes.follow_up_required && (
                <Textarea label="Follow-up notes" value={notes.follow_up_notes ?? ""} onChange={(e) => setNote("follow_up_notes", e.target.value)} rows={2} disabled={isClosed} />
              )}
            </div>
          </Card>
        </div>

        {/* Right: details + chat */}
        <div className="space-y-6">
          <Card>
            <h3 className="mb-3 text-base font-semibold text-secondary-900 dark:text-white">Session details</h3>
            <dl className="space-y-2 text-sm">
              <Row label="Scheduled" value={fmt(session.scheduled_start_at)} />
              <Row label="Started" value={fmt(session.started_at)} />
              <Row label="Ended" value={fmt(session.ended_at)} />
              <Row label="Patient joined" value={fmt(session.patient_joined_at)} />
              <Row label="Clinician joined" value={fmt(session.clinician_joined_at)} />
              <Row label="Provider" value={labelize(session.provider)} />
              {typeof session.duration_seconds === "number" && (
                <Row label="Duration" value={`${Math.round((session.duration_seconds ?? 0) / 60)} min`} />
              )}
              {session.cancellation_reason && <Row label="Cancel reason" value={session.cancellation_reason} />}
            </dl>
          </Card>

          <Card>
            <h3 className="mb-3 text-base font-semibold text-secondary-900 dark:text-white">Secure chat</h3>
            <SessionChat
              messages={messagesQuery.data ?? []}
              onSend={(body) => sendMut.mutate(body)}
              isSending={sendMut.isPending}
              disabled={isClosed}
              mineRole="CLINICIAN"
            />
          </Card>
        </div>
      </div>

      {showCancel && (
        <Modal
          isOpen
          onClose={() => setShowCancel(false)}
          title="Cancel telemedicine session"
          footer={
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowCancel(false)}>Keep session</Button>
              <Button variant="danger" onClick={() => cancelMut.mutate()} disabled={cancelMut.isPending}>
                {cancelMut.isPending ? "Cancelling…" : "Cancel session"}
              </Button>
            </div>
          }
        >
          <Input label="Reason (optional)" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="e.g. Patient rescheduled" />
        </Modal>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-secondary-500">{label}</dt>
      <dd className="text-right font-medium text-secondary-900 dark:text-white">{value}</dd>
    </div>
  );
}
