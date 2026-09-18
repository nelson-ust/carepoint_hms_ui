import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, Plus, RefreshCw } from "lucide-react";
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
import { carePlansApi, labelize, PRIORITY_OPTIONS, type CarePlan } from "../api/home-health.api";

const PAGE_SIZE = 25;

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "DRAFT", label: "Draft" },
  { value: "ACTIVE", label: "Active" },
  { value: "ON_HOLD", label: "On hold" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

function statusVariant(s: string): "soft-success" | "soft-warning" | "soft-info" | "secondary" {
  if (s === "ACTIVE") return "soft-success";
  if (s === "ON_HOLD") return "soft-warning";
  if (s === "DRAFT") return "soft-info";
  return "secondary";
}

export function CarePlansPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const skip = (page - 1) * PAGE_SIZE;

  const query = useQuery({
    queryKey: ["care-plans", "list", status, skip],
    queryFn: () => carePlansApi.list({ skip, limit: PAGE_SIZE, status: status || undefined }),
  });
  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;

  const columns: DataTableColumn<CarePlan>[] = useMemo(
    () => [
      {
        key: "title",
        header: "Care plan",
        render: (r) => (
          <div>
            <div className="font-semibold text-secondary-900 dark:text-white">{r.title}</div>
            <div className="text-xs text-secondary-500">{r.condition || "—"}</div>
          </div>
        ),
      },
      { key: "patient", header: "Patient", render: (r) => r.patient_name || `#${r.patient_id}` },
      { key: "status", header: "Status", render: (r) => <Badge variant={statusVariant(String(r.status))}>{labelize(r.status)}</Badge> },
      { key: "goals", header: "Goals", render: (r) => r.goal_count ?? 0 },
      { key: "tasks", header: "Open tasks", render: (r) => r.open_task_count ?? 0 },
      { key: "lead", header: "Lead", render: (r) => r.lead_staff_name || "—" },
      {
        key: "actions",
        header: "",
        align: "right",
        render: (r) => (
          <Button size="sm" variant="secondary" onClick={() => navigate(routes.carePlanDetail.replace(":planId", String(r.id)))}>
            Open
          </Button>
        ),
      },
    ],
    [navigate],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Care Plans"
        description="Individualized care plans with goals, interventions, tasks and reviews."
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={() => query.refetch()}><RefreshCw className="h-4 w-4" /> Refresh</Button>
            <Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" /> New care plan</Button>
          </>
        }
      />
      <Card className="flex flex-wrap items-end gap-4">
        <div className="w-56">
          <Select label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} options={STATUS_OPTIONS} />
        </div>
        <div className="text-sm text-secondary-500">{total} plan(s)</div>
      </Card>
      <Card padding="none">
        <DataTable<CarePlan>
          columns={columns}
          data={items}
          rowKey={(r) => r.id}
          isLoading={query.isLoading}
          error={query.isError ? apiErrorMessage(query.error, "Couldn't load care plans.") : null}
          onRetry={() => query.refetch()}
          empty={{ icon: ClipboardList, title: "No care plans", description: "Create one to get started." }}
          footer={<Pagination page={page} totalItems={total} totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE))} pageSize={PAGE_SIZE} onPageChange={setPage} />}
        />
      </Card>

      {showCreate && (
        <CreateCarePlanModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); qc.invalidateQueries({ queryKey: ["care-plans", "list"] }); toast.success("Care plan created"); }}
        />
      )}
    </div>
  );
}

function CreateCarePlanModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const toast = useToast();
  const [patient, setPatient] = useState<EntityOption | null>(null);
  const [title, setTitle] = useState("");
  const [condition, setCondition] = useState("");
  const [priority, setPriority] = useState("NORMAL");
  const [description, setDescription] = useState("");
  const [leadStaffId, setLeadStaffId] = useState<number | null>(null);
  const [reviewDays, setReviewDays] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      carePlansApi.create({
        patient_id: patient!.value,
        title: title.trim(),
        condition: condition.trim() || undefined,
        priority,
        description: description.trim() || undefined,
        lead_staff_id: leadStaffId ?? undefined,
        review_frequency_days: reviewDays ? Number(reviewDays) : undefined,
        status: "ACTIVE",
      }),
    onSuccess: onCreated,
    onError: (e) => toast.error("Couldn't create care plan", apiErrorMessage(e, "Review the details.")),
  });

  const submit = () => {
    if (!patient) return toast.error("Patient required", "Select a patient.");
    if (!title.trim()) return toast.error("Title required", "Give the care plan a title.");
    mutation.mutate();
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Create a care plan"
      size="lg"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={mutation.isPending}>{mutation.isPending ? "Creating…" : "Create"}</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <PatientPicker value={patient} onChange={setPatient} />
        <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Diabetes management" />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Condition" value={condition} onChange={(e) => setCondition(e.target.value)} />
          <Select label="Priority" value={priority} onChange={(e) => setPriority(e.target.value)} options={PRIORITY_OPTIONS} />
        </div>
        <StaffPicker label="Lead clinician" value={leadStaffId} onChange={(id) => setLeadStaffId(id)} />
        <Input label="Review frequency (days)" type="number" value={reviewDays} onChange={(e) => setReviewDays(e.target.value)} />
        <Textarea label="Description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
    </Modal>
  );
}
