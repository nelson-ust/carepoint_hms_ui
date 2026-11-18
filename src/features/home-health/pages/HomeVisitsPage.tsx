import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, isValid } from "date-fns";
import { HomeIcon, Plus, RotateCcw, MapPin } from "lucide-react";
import {
  DxPage, DxPageHeader, DxPanel, DxGrid, DxPager, DxBadge, DxButton, DxPopup,
  DxInput, DxSelect, DxTextarea, DxStatusBar, DxStatusItem,
  type DxGridColumn, type DxBadgeTone,
} from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import { PatientPicker } from "@/components/forms/pickers";
import type { EntityOption } from "@/components/forms/EntityPicker";
import { apiErrorMessage } from "@/lib/api/api-error";
import { routes } from "@/config/routes";
import { StaffPicker } from "../components/StaffPicker";
import {
  homeVisitsApi,
  labelize,
  HOME_VISIT_STATUS_OPTIONS,
  HOME_VISIT_TYPE_OPTIONS,
  PRIORITY_OPTIONS,
  type HomeVisit,
  type HomeVisitCreatePayload,
} from "../api/home-health.api";

const PAGE_SIZE = 25;

function fmt(v?: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  return isValid(d) ? format(d, "MMM d, yyyy • h:mm a") : "—";
}

function statusTone(status?: string | null): DxBadgeTone {
  switch (status) {
    case "COMPLETED":
      return "success";
    case "REQUESTED":
    case "APPROVED":
    case "ASSIGNED":
      return "info";
    case "EN_ROUTE":
    case "ARRIVED":
    case "IN_PROGRESS":
      return "warning";
    case "CANCELLED":
    case "MISSED":
      return "danger";
    default:
      return "neutral";
  }
}

export function HomeVisitsPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);

  const skip = (page - 1) * PAGE_SIZE;
  const query = useQuery({
    queryKey: ["home-visits", "list", status, skip],
    queryFn: () => homeVisitsApi.list({ skip, limit: PAGE_SIZE, status: status || undefined }),
  });

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;

  const columns: DxGridColumn<HomeVisit>[] = useMemo(
    () => [
      {
        key: "visit_code",
        header: "Visit",
        render: (r) => (
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold text-[var(--dx-text)]">{r.visit_code}</div>
            <div className="text-[11px] text-[var(--dx-text-muted)]">{labelize(r.visit_type)}</div>
          </div>
        ),
      },
      {
        key: "patient",
        header: "Patient",
        render: (r) => <span className="text-[13px] text-[var(--dx-text)]">{r.patient_name || `#${r.patient_id}`}</span>,
      },
      {
        key: "status",
        header: "Status",
        align: "center",
        render: (r) => <DxBadge tone={statusTone(r.status)}>{labelize(r.status)}</DxBadge>,
      },
      {
        key: "priority",
        header: "Priority",
        align: "center",
        render: (r) => <DxBadge tone={r.priority === "URGENT" || r.priority === "HIGH" ? "warning" : "neutral"}>{labelize(r.priority)}</DxBadge>,
      },
      { key: "scheduled_start_at", header: "Scheduled", render: (r) => <span className="text-[13px] text-[var(--dx-text-muted)]">{fmt(r.scheduled_start_at)}</span> },
      { key: "caregiver", header: "Caregiver", render: (r) => <span className="text-[13px] text-[var(--dx-text)]">{r.assigned_staff_name || <span className="text-[var(--dx-text-faint)]">Unassigned</span>}</span> },
      {
        key: "actions",
        header: "",
        align: "right",
        render: (r) => (
          <DxButton size="sm" onClick={() => navigate(routes.homeVisitDetail.replace(":visitId", String(r.id)))}>View</DxButton>
        ),
      },
    ],
    [navigate],
  );

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Home health" }, { label: "Visits" }]}
        title="Home Visits"
        subtitle="Schedule, dispatch and track domiciliary visits from request to completion."
        actions={
          <>
            <DxButton icon title="Refresh" onClick={() => query.refetch()} isLoading={query.isFetching}><RotateCcw /></DxButton>
            <DxButton variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowCreate(true)}>New home visit</DxButton>
          </>
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-56">
          <DxSelect
            label="Status"
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            options={HOME_VISIT_STATUS_OPTIONS}
          />
        </div>
      </div>

      <DxStatusBar>
        <DxStatusItem icon={<HomeIcon className="h-3.5 w-3.5" />}>{total} visit{total === 1 ? "" : "s"}{status ? ` · ${labelize(status)}` : ""}</DxStatusItem>
      </DxStatusBar>

      <DxGrid<HomeVisit>
        columns={columns}
        data={items}
        rowKey={(r) => r.id}
        isLoading={query.isLoading}
        error={query.isError ? apiErrorMessage(query.error, "Couldn't load home visits.") : null}
        onRetry={() => query.refetch()}
        onRowClick={(r) => navigate(routes.homeVisitDetail.replace(":visitId", String(r.id)))}
        empty={{ icon: HomeIcon, title: "No home visits", description: "Create one to get started." }}
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
        <CreateHomeVisitModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            qc.invalidateQueries({ queryKey: ["home-visits", "list"] });
            toast.success("Home visit created");
          }}
        />
      ) : null}
    </DxPage>
  );
}

function CreateHomeVisitModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const toast = useToast();
  const [patient, setPatient] = useState<EntityOption | null>(null);
  const [visitType, setVisitType] = useState("ROUTINE");
  const [priority, setPriority] = useState("NORMAL");
  const [scheduledAt, setScheduledAt] = useState("");
  const [etaMinutes, setEtaMinutes] = useState("");
  const [reason, setReason] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [staffId, setStaffId] = useState<number | null>(null);

  const mutation = useMutation({
    mutationFn: (payload: HomeVisitCreatePayload) => homeVisitsApi.create(payload),
    onSuccess: onCreated,
    onError: (err) => toast.error("Couldn't create home visit", apiErrorMessage(err, "Please review the details.")),
  });

  const submit = () => {
    if (!patient) {
      toast.error("Patient required", "Select a patient for this visit.");
      return;
    }
    mutation.mutate({
      patient_id: patient.value,
      visit_type: visitType as HomeVisitCreatePayload["visit_type"],
      priority: priority as HomeVisitCreatePayload["priority"],
      scheduled_start_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      eta_minutes: etaMinutes ? Number(etaMinutes) : null,
      reason: reason.trim() || null,
      address: address.trim() || null,
      city: city.trim() || null,
      assigned_staff_id: staffId,
    });
  };

  return (
    <DxPopup
      isOpen
      onClose={onClose}
      title="Request a home visit"
      size="lg"
      locked={mutation.isPending}
      footer={
        <>
          <DxButton onClick={onClose} disabled={mutation.isPending}>Cancel</DxButton>
          <DxButton variant="primary" onClick={submit} isLoading={mutation.isPending}>Create visit</DxButton>
        </>
      }
    >
      <div className="space-y-4">
        <PatientPicker value={patient} onChange={setPatient} />
        <div className="grid grid-cols-2 gap-4">
          <DxSelect label="Visit type" value={visitType} onChange={(e) => setVisitType(e.target.value)} options={HOME_VISIT_TYPE_OPTIONS} />
          <DxSelect label="Priority" value={priority} onChange={(e) => setPriority(e.target.value)} options={PRIORITY_OPTIONS} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <DxInput label="Scheduled start" type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
          <DxInput label="ETA (minutes)" type="number" value={etaMinutes} onChange={(e) => setEtaMinutes(e.target.value)} />
        </div>
        <StaffPicker value={staffId} onChange={(id) => setStaffId(id)} />
        <DxTextarea label="Reason for visit" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
        <div className="grid grid-cols-2 gap-4">
          <DxInput label="Address" leftIcon={<MapPin className="h-3.5 w-3.5" />} value={address} onChange={(e) => setAddress(e.target.value)} />
          <DxInput label="City" value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
      </div>
    </DxPopup>
  );
}
