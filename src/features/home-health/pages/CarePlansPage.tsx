import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, Plus, RotateCcw } from "lucide-react";
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

function statusTone(s: string): DxBadgeTone {
  if (s === "ACTIVE") return "success";
  if (s === "ON_HOLD") return "warning";
  if (s === "DRAFT") return "info";
  return "neutral";
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

  const columns: DxGridColumn<CarePlan>[] = useMemo(
    () => [
      {
        key: "title",
        header: "Care plan",
        render: (r) => (
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold text-[var(--dx-text)]">{r.title}</div>
            <div className="text-[11px] text-[var(--dx-text-muted)]">{r.condition || "—"}</div>
          </div>
        ),
      },
      { key: "patient", header: "Patient", render: (r) => <span className="text-[13px] text-[var(--dx-text)]">{r.patient_name || `#${r.patient_id}`}</span> },
      { key: "status", header: "Status", align: "center", render: (r) => <DxBadge tone={statusTone(String(r.status))}>{labelize(r.status)}</DxBadge> },
      { key: "goals", header: "Goals", align: "center", render: (r) => <span className="dx-mono text-[13px] text-[var(--dx-text)]">{r.goal_count ?? 0}</span> },
      { key: "tasks", header: "Open tasks", align: "center", render: (r) => <span className="dx-mono text-[13px] text-[var(--dx-text)]">{r.open_task_count ?? 0}</span> },
      { key: "lead", header: "Lead", render: (r) => <span className="text-[13px] text-[var(--dx-text)]">{r.lead_staff_name || <span className="text-[var(--dx-text-faint)]">—</span>}</span> },
      {
        key: "actions",
        header: "",
        align: "right",
        render: (r) => (
          <DxButton size="sm" onClick={() => navigate(routes.carePlanDetail.replace(":planId", String(r.id)))}>Open</DxButton>
        ),
      },
    ],
    [navigate],
  );

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Home health" }, { label: "Care plans" }]}
        title="Care Plans"
        subtitle="Individualized care plans with goals, interventions, tasks and reviews."
        actions={
          <>
            <DxButton icon title="Refresh" onClick={() => query.refetch()} isLoading={query.isFetching}><RotateCcw /></DxButton>
            <DxButton variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowCreate(true)}>New care plan</DxButton>
          </>
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-56">
          <DxSelect label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} options={STATUS_OPTIONS} />
        </div>
      </div>

      <DxStatusBar>
        <DxStatusItem icon={<ClipboardList className="h-3.5 w-3.5" />}>{total} plan{total === 1 ? "" : "s"}{status ? ` · ${labelize(status)}` : ""}</DxStatusItem>
      </DxStatusBar>

      <DxGrid<CarePlan>
        columns={columns}
        data={items}
        rowKey={(r) => r.id}
        isLoading={query.isLoading}
        error={query.isError ? apiErrorMessage(query.error, "Couldn't load care plans.") : null}
        onRetry={() => query.refetch()}
        onRowClick={(r) => navigate(routes.carePlanDetail.replace(":planId", String(r.id)))}
        empty={{ icon: ClipboardList, title: "No care plans", description: "Create one to get started." }}
        footer={<DxPager page={page} totalItems={total} totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE))} pageSize={PAGE_SIZE} onPageChange={setPage} />}
      />

      {showCreate ? (
        <CreateCarePlanModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); qc.invalidateQueries({ queryKey: ["care-plans", "list"] }); toast.success("Care plan created"); }}
        />
      ) : null}
    </DxPage>
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
    <DxPopup
      isOpen
      onClose={onClose}
      title="Create a care plan"
      size="lg"
      locked={mutation.isPending}
      footer={
        <>
          <DxButton onClick={onClose} disabled={mutation.isPending}>Cancel</DxButton>
          <DxButton variant="primary" onClick={submit} isLoading={mutation.isPending}>Create</DxButton>
        </>
      }
    >
      <div className="space-y-4">
        <PatientPicker value={patient} onChange={setPatient} />
        <DxInput label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Diabetes management" />
        <div className="grid grid-cols-2 gap-4">
          <DxInput label="Condition" value={condition} onChange={(e) => setCondition(e.target.value)} />
          <DxSelect label="Priority" value={priority} onChange={(e) => setPriority(e.target.value)} options={PRIORITY_OPTIONS} />
        </div>
        <StaffPicker label="Lead clinician" value={leadStaffId} onChange={(id) => setLeadStaffId(id)} />
        <DxInput label="Review frequency (days)" type="number" value={reviewDays} onChange={(e) => setReviewDays(e.target.value)} />
        <DxTextarea label="Description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
    </DxPopup>
  );
}
