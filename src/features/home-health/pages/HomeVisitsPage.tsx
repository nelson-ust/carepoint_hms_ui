import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, isValid } from "date-fns";
import { HomeIcon, Plus, RefreshCw, MapPin } from "lucide-react";
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
import { StaffPicker } from "../components/StaffPicker";
import {
  homeVisitsApi,
  homeVisitStatusVariant,
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

  const columns: DataTableColumn<HomeVisit>[] = useMemo(
    () => [
      {
        key: "visit_code",
        header: "Visit",
        render: (r) => (
          <div>
            <div className="font-semibold text-secondary-900 dark:text-white">{r.visit_code}</div>
            <div className="text-xs text-secondary-500">{labelize(r.visit_type)}</div>
          </div>
        ),
      },
      {
        key: "patient",
        header: "Patient",
        render: (r) => r.patient_name || `#${r.patient_id}`,
      },
      {
        key: "status",
        header: "Status",
        render: (r) => <Badge variant={homeVisitStatusVariant(r.status)}>{labelize(r.status)}</Badge>,
      },
      {
        key: "priority",
        header: "Priority",
        render: (r) => <Badge variant={r.priority === "URGENT" || r.priority === "HIGH" ? "soft-warning" : "secondary"}>{labelize(r.priority)}</Badge>,
      },
      { key: "scheduled_start_at", header: "Scheduled", render: (r) => fmt(r.scheduled_start_at) },
      { key: "caregiver", header: "Caregiver", render: (r) => r.assigned_staff_name || "Unassigned" },
      {
        key: "actions",
        header: "",
        align: "right",
        render: (r) => (
          <Button size="sm" variant="secondary" onClick={() => navigate(routes.homeVisitDetail.replace(":visitId", String(r.id)))}>
            View
          </Button>
        ),
      },
    ],
    [navigate],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Home Visits"
        description="Schedule, dispatch and track domiciliary visits from request to completion."
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={() => query.refetch()}>
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" /> New home visit
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
            options={HOME_VISIT_STATUS_OPTIONS}
          />
        </div>
        <div className="text-sm text-secondary-500">{total} visit(s)</div>
      </Card>

      <Card padding="none">
        <DataTable<HomeVisit>
          columns={columns}
          data={items}
          rowKey={(r) => r.id}
          isLoading={query.isLoading}
          error={query.isError ? apiErrorMessage(query.error, "Couldn't load home visits.") : null}
          onRetry={() => query.refetch()}
          empty={{ icon: HomeIcon, title: "No home visits", description: "Create one to get started." }}
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
        <CreateHomeVisitModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            qc.invalidateQueries({ queryKey: ["home-visits", "list"] });
            toast.success("Home visit created");
          }}
        />
      )}
    </div>
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
    <Modal
      isOpen
      onClose={onClose}
      title="Request a home visit"
      size="lg"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending ? "Creating…" : "Create visit"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <PatientPicker value={patient} onChange={setPatient} />
        <div className="grid grid-cols-2 gap-4">
          <Select label="Visit type" value={visitType} onChange={(e) => setVisitType(e.target.value)} options={HOME_VISIT_TYPE_OPTIONS} />
          <Select label="Priority" value={priority} onChange={(e) => setPriority(e.target.value)} options={PRIORITY_OPTIONS} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Scheduled start" type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
          <Input label="ETA (minutes)" type="number" value={etaMinutes} onChange={(e) => setEtaMinutes(e.target.value)} />
        </div>
        <StaffPicker value={staffId} onChange={(id) => setStaffId(id)} />
        <Textarea label="Reason for visit" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Address" leftIcon={<MapPin className="h-4 w-4" />} value={address} onChange={(e) => setAddress(e.target.value)} />
          <Input label="City" value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}
