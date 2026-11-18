import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, isValid } from "date-fns";
import { Video, Plus, RotateCcw } from "lucide-react";
import {
  DxPage, DxPageHeader, DxGrid, DxPager, DxBadge, DxButton, DxPopup,
  DxInput, DxSelect, DxTextarea, DxStatusBar, DxStatusItem,
  type DxGridColumn, type DxBadgeTone,
} from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import { PatientPicker } from "@/components/forms/pickers";
import type { EntityOption } from "@/components/forms/EntityPicker";
import { apiErrorMessage } from "@/lib/api/api-error";
import { routes } from "@/config/routes";
import { StaffPicker } from "@/features/home-health/components/StaffPicker";
import {
  telemedicineApi,
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

function statusTone(status?: string | null): DxBadgeTone {
  switch (status) {
    case "IN_PROGRESS":
      return "success";
    case "WAITING":
      return "warning";
    case "SCHEDULED":
      return "info";
    case "CANCELLED":
    case "NO_SHOW":
      return "danger";
    default:
      return "neutral";
  }
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

  const columns: DxGridColumn<TelemedicineSession>[] = useMemo(
    () => [
      {
        key: "session_code",
        header: "Session",
        render: (r) => (
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold text-[var(--dx-text)]">{r.session_code}</div>
            <div className="text-[11px] text-[var(--dx-text-muted)]">{labelize(r.modality)}</div>
          </div>
        ),
      },
      { key: "patient", header: "Patient", render: (r) => <span className="text-[13px] text-[var(--dx-text)]">{r.patient_name || `#${r.patient_id}`}</span> },
      { key: "clinician", header: "Clinician", render: (r) => <span className="text-[13px] text-[var(--dx-text)]">{r.clinician_name || <span className="text-[var(--dx-text-faint)]">Unassigned</span>}</span> },
      {
        key: "status",
        header: "Status",
        align: "center",
        render: (r) => <DxBadge tone={statusTone(r.status)}>{labelize(r.status)}</DxBadge>,
      },
      { key: "scheduled_start_at", header: "Scheduled", render: (r) => <span className="text-[13px] text-[var(--dx-text-muted)]">{fmt(r.scheduled_start_at)}</span> },
      {
        key: "actions",
        header: "",
        align: "right",
        render: (r) => (
          <DxButton size="sm" variant="primary" leftIcon={<Video className="h-3.5 w-3.5" />} onClick={() => navigate(routes.telemedicineConsole.replace(":sessionId", String(r.id)))}>Open</DxButton>
        ),
      },
    ],
    [navigate],
  );

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Telemedicine" }, { label: "Sessions" }]}
        title="Telemedicine"
        subtitle="Schedule and conduct virtual consultations — video, audio or chat — with in-session notes and secure messaging."
        actions={
          <>
            <DxButton icon title="Refresh" onClick={() => query.refetch()} isLoading={query.isFetching}><RotateCcw /></DxButton>
            <DxButton variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowCreate(true)}>New session</DxButton>
          </>
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-56">
          <DxSelect
            label="Status"
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            options={TELEMEDICINE_STATUS_OPTIONS}
          />
        </div>
      </div>

      <DxStatusBar>
        <DxStatusItem icon={<Video className="h-3.5 w-3.5" />}>{total} session{total === 1 ? "" : "s"}{status ? ` · ${labelize(status)}` : ""}</DxStatusItem>
      </DxStatusBar>

      <DxGrid<TelemedicineSession>
        columns={columns}
        data={items}
        rowKey={(r) => r.id}
        isLoading={query.isLoading}
        error={query.isError ? apiErrorMessage(query.error, "Couldn't load telemedicine sessions.") : null}
        onRetry={() => query.refetch()}
        onRowClick={(r) => navigate(routes.telemedicineConsole.replace(":sessionId", String(r.id)))}
        empty={{ icon: Video, title: "No telemedicine sessions", description: "Schedule one to get started." }}
        footer={
          <DxPager
            page={page}
            totalItems={total}
            totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE))}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        }
      />

      {showCreate ? (
        <CreateSessionModal
          onClose={() => setShowCreate(false)}
          onCreated={(s) => {
            setShowCreate(false);
            qc.invalidateQueries({ queryKey: ["telemedicine", "list"] });
            toast.success("Telemedicine session scheduled");
            navigate(routes.telemedicineConsole.replace(":sessionId", String(s.id)));
          }}
        />
      ) : null}
    </DxPage>
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
    <DxPopup
      isOpen
      onClose={onClose}
      title="Schedule a telemedicine session"
      size="lg"
      locked={mutation.isPending}
      footer={
        <>
          <DxButton onClick={onClose} disabled={mutation.isPending}>Cancel</DxButton>
          <DxButton variant="primary" onClick={submit} isLoading={mutation.isPending}>Schedule session</DxButton>
        </>
      }
    >
      <div className="space-y-4">
        <PatientPicker value={patient} onChange={setPatient} />
        <div className="grid grid-cols-2 gap-4">
          <DxSelect label="Modality" value={modality} onChange={(e) => setModality(e.target.value)} options={TELEMEDICINE_MODALITY_OPTIONS} />
          <DxInput label="Scheduled start" type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
        </div>
        <StaffPicker value={staffId} onChange={(id) => setStaffId(id)} label="Clinician" />
        <DxTextarea label="Reason for consultation" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
      </div>
    </DxPopup>
  );
}
