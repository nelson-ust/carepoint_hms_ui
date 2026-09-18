import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, isValid } from "date-fns";
import { Video, Plus, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Modal } from "@/components/ui/Modal";
import { DataTable, type DataTableColumn } from "@/components/data-table/DataTable";
import { Pagination } from "@/components/data-table/Pagination";
import { useToast } from "@/components/feedback/ToastProvider";
import { PatientPicker } from "@/components/forms/pickers";
import type { EntityOption } from "@/components/forms/EntityPicker";
import { apiErrorMessage } from "@/lib/api/api-error";
import { routes } from "@/config/routes";
import { StaffPicker } from "@/features/home-health/components/StaffPicker";
import {
  telemedicineApi,
  telemedicineStatusVariant,
  labelize,
  TELEMEDICINE_STATUS_OPTIONS,
  TELEMEDICINE_MODALITY_OPTIONS,
  type TelemedicineSession,
  type TelemedicineCreatePayload,
} from "../api/telemedicine.api";

const PAGE_SIZE = 25;

function fmt(v?: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  return isValid(d) ? format(d, "MMM d, yyyy • h:mm a") : "—";
}

export function TelemedicineSessionsPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);

  const skip = (page - 1) * PAGE_SIZE;
  const query = useQuery({
    queryKey: ["telemedicine", "list", status, skip],
    queryFn: () => telemedicineApi.list({ skip, limit: PAGE_SIZE, status: status || undefined }),
  });

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;

  const columns: DataTableColumn<TelemedicineSession>[] = useMemo(
    () => [
      {
        key: "session_code",
        header: "Session",
        render: (r) => (
          <div>
            <div className="font-semibold text-secondary-900 dark:text-white">{r.session_code}</div>
            <div className="text-xs text-secondary-500">{labelize(r.modality)}</div>
          </div>
        ),
      },
      { key: "patient", header: "Patient", render: (r) => r.patient_name || `#${r.patient_id}` },
      { key: "clinician", header: "Clinician", render: (r) => r.clinician_name || "Unassigned" },
      {
        key: "status",
        header: "Status",
        render: (r) => <Badge variant={telemedicineStatusVariant(r.status)}>{labelize(r.status)}</Badge>,
      },
      { key: "scheduled_start_at", header: "Scheduled", render: (r) => fmt(r.scheduled_start_at) },
      {
        key: "actions",
        header: "",
        align: "right",
        render: (r) => (
          <Button size="sm" onClick={() => navigate(routes.telemedicineConsole.replace(":sessionId", String(r.id)))}>
            <Video className="h-4 w-4" /> Open
          </Button>
        ),
      },
    ],
    [navigate],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Telemedicine"
        description="Schedule and conduct virtual consultations — video, audio or chat — with in-session notes and secure messaging."
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={() => query.refetch()}>
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" /> New session
            </Button>
          </>
        }
      />

      <Card className="flex flex-wrap items-end gap-4">
        <div className="w-56">
          <Select
            label="Status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            options={TELEMEDICINE_STATUS_OPTIONS}
          />
        </div>
        <div className="text-sm text-secondary-500">{total} session(s)</div>
      </Card>

      <Card padding="none">
        <DataTable<TelemedicineSession>
          columns={columns}
          data={items}
          rowKey={(r) => r.id}
          isLoading={query.isLoading}
          error={query.isError ? apiErrorMessage(query.error, "Couldn't load telemedicine sessions.") : null}
          onRetry={() => query.refetch()}
          empty={{ icon: Video, title: "No telemedicine sessions", description: "Schedule one to get started." }}
          footer={
            <Pagination
              page={page}
              totalItems={total}
              totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE))}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          }
        />
      </Card>

      {showCreate && (
        <CreateSessionModal
          onClose={() => setShowCreate(false)}
          onCreated={(s) => {
            setShowCreate(false);
            qc.invalidateQueries({ queryKey: ["telemedicine", "list"] });
            toast.success("Telemedicine session scheduled");
            navigate(routes.telemedicineConsole.replace(":sessionId", String(s.id)));
          }}
        />
      )}
    </div>
  );
}

function CreateSessionModal({ onClose, onCreated }: { onClose: () => void; onCreated: (s: TelemedicineSession) => void }) {
  const toast = useToast();
  const [patient, setPatient] = useState<EntityOption | null>(null);
  const [modality, setModality] = useState("VIDEO");
  const [scheduledAt, setScheduledAt] = useState("");
  const [reason, setReason] = useState("");
  const [staffId, setStaffId] = useState<number | null>(null);

  const mutation = useMutation({
    mutationFn: (payload: TelemedicineCreatePayload) => telemedicineApi.create(payload),
    onSuccess: onCreated,
    onError: (err) => toast.error("Couldn't schedule session", apiErrorMessage(err, "Please review the details.")),
  });

  const submit = () => {
    if (!patient) {
      toast.error("Patient required", "Select a patient for this consultation.");
      return;
    }
    mutation.mutate({
      patient_id: patient.value,
      modality: modality as TelemedicineCreatePayload["modality"],
      scheduled_start_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      reason: reason.trim() || null,
      clinician_staff_id: staffId,
    });
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Schedule a telemedicine session"
      size="lg"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending ? "Scheduling…" : "Schedule session"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <PatientPicker value={patient} onChange={setPatient} />
        <div className="grid grid-cols-2 gap-4">
          <Select label="Modality" value={modality} onChange={(e) => setModality(e.target.value)} options={TELEMEDICINE_MODALITY_OPTIONS} />
          <Input label="Scheduled start" type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
        </div>
        <StaffPicker value={staffId} onChange={(id) => setStaffId(id)} label="Clinician" />
        <Textarea label="Reason for consultation" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
      </div>
    </Modal>
  );
}
