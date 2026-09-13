import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Activity,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileText,
  Image as ImageIcon,
  Plus,
  ScanLine,
  XCircle,
} from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, type BadgeProps } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Modal } from "@/components/ui/Modal";
import { SearchInput } from "@/components/forms/SearchInput";
import { DataTable, type DataTableColumn } from "@/components/data-table/DataTable";
import { Pagination } from "@/components/data-table/Pagination";
import { MetricCard } from "@/components/charts/MetricCard";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { useToast } from "@/components/feedback/ToastProvider";
import { useDisclosure } from "@/hooks/useDisclosure";
import { cn } from "@/lib/utils/cn";

import type {
  RadiologyOrder,
  RadiologyOrderItem,
  RadiologyProcedure,
  RadiologyReport,
} from "../api/radiology.api";
import {
  useCancelRadiologyOrder,
  useCreateRadiologyOrder,
  useRadiologyProcedures,
  useRadiologyReportForExam,
  useRadiologyWorklist,
} from "../hooks/use-radiology";

// ============================================================
// Constants
// ============================================================

const PAGE_SIZE = 10;

const ALL_ORDER_STATUSES = [
  "DRAFT",
  "ORDERED",
  "SCHEDULED",
  "CHECKED_IN",
  "IN_PROGRESS",
  "PERFORMED",
  "REPORTED",
  "RELEASED",
  "COMPLETED",
  "CANCELLED",
];

const PENDING_STATUSES = ["ORDERED", "SCHEDULED", "CHECKED_IN"];
const IN_PROGRESS_STATUSES = ["IN_PROGRESS", "PERFORMED"];
const COMPLETED_STATUSES = ["REPORTED", "RELEASED", "COMPLETED"];

const PRIORITY_OPTIONS = [
  { value: "LOW", label: "Low" },
  { value: "NORMAL", label: "Normal" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
  { value: "EMERGENCY", label: "Emergency" },
];

const ORDER_STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  ...ALL_ORDER_STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, " ") })),
];

type TabKey = "orders" | "exams" | "reports";

const TABS: { key: TabKey; label: string }[] = [
  { key: "orders", label: "Orders" },
  { key: "exams", label: "Exams" },
  { key: "reports", label: "Reports" },
];

// ============================================================
// Status / priority pills
// ============================================================

function orderStatusVariant(status: string): BadgeProps["variant"] {
  switch (status) {
    case "RELEASED":
    case "COMPLETED":
      return "soft-success";
    case "ORDERED":
    case "SCHEDULED":
    case "CHECKED_IN":
      return "soft-warning";
    case "IN_PROGRESS":
    case "PERFORMED":
    case "REPORTED":
      return "soft-info";
    case "CANCELLED":
      return "soft-danger";
    default:
      return "secondary";
  }
}

function priorityVariant(priority: string): BadgeProps["variant"] {
  switch (priority) {
    case "EMERGENCY":
    case "URGENT":
      return "soft-danger";
    case "HIGH":
      return "soft-warning";
    case "NORMAL":
      return "soft-info";
    default:
      return "secondary";
  }
}

function reportStatusVariant(status: string): BadgeProps["variant"] {
  switch (status) {
    case "FINAL":
      return "soft-success";
    case "PRELIMINARY":
    case "AMENDED":
      return "soft-info";
    case "DRAFT":
      return "soft-warning";
    case "CANCELLED":
      return "soft-danger";
    default:
      return "secondary";
  }
}

function StatusPill({
  value,
  variant,
}: {
  value: string;
  variant: BadgeProps["variant"];
}) {
  return <Badge variant={variant}>{value.replace(/_/g, " ")}</Badge>;
}

function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function errorMessage(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof Error) return error.message;
  return "Something went wrong while loading data.";
}

// ============================================================
// New imaging order modal (react-hook-form + zod)
// ============================================================

const newOrderSchema = z.object({
  visit_id: z.coerce.number().int().positive("Visit ID is required"),
  consultation_id: z.coerce.number().int().positive().optional().or(z.literal("")),
  procedure_catalog_id: z.string().min(1, "Select a procedure"),
  priority: z.string().min(1, "Select a priority"),
  laterality: z.string().max(50).optional(),
  clinical_indication: z.string().max(2000).optional(),
});

type NewOrderFormValues = z.infer<typeof newOrderSchema>;

function NewImagingOrderModal({
  isOpen,
  onClose,
  procedures,
}: {
  isOpen: boolean;
  onClose: () => void;
  procedures: RadiologyProcedure[];
}) {
  const toast = useToast();
  const createOrder = useCreateRadiologyOrder();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<z.input<typeof newOrderSchema>, unknown, NewOrderFormValues>({
    resolver: zodResolver(newOrderSchema),
    defaultValues: { priority: "NORMAL" },
  });

  const procedureOptions = procedures.map((p) => ({
    value: String(p.id),
    label: `${p.code} — ${p.name} (${String(p.modality).replace(/_/g, " ")})`,
  }));

  const handleClose = () => {
    reset({ priority: "NORMAL" });
    onClose();
  };

  const onSubmit = (values: NewOrderFormValues) => {
    createOrder.mutate(
      {
        visit_id: values.visit_id,
        consultation_id:
          values.consultation_id === "" || values.consultation_id === undefined
            ? undefined
            : Number(values.consultation_id),
        priority: values.priority,
        clinical_indication: values.clinical_indication?.trim() || undefined,
        items: [
          {
            procedure_catalog_id: Number(values.procedure_catalog_id),
            laterality: values.laterality?.trim() || undefined,
          },
        ],
      },
      {
        onSuccess: (order) => {
          toast.success("Imaging order placed", `Order ${order.order_no} created.`);
          handleClose();
        },
        onError: (err) => {
          toast.error("Could not place order", errorMessage(err) ?? undefined);
        },
      },
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="New Imaging Order"
      size="lg"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            leftIcon={<Plus className="h-4 w-4" />}
            isLoading={createOrder.isPending}
            onClick={handleSubmit(onSubmit)}
          >
            Place Order
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            label="Visit ID"
            type="number"
            placeholder="e.g. 1042"
            error={errors.visit_id?.message}
            {...register("visit_id")}
          />
          <Input
            label="Consultation ID (optional)"
            type="number"
            placeholder="e.g. 88"
            error={errors.consultation_id?.message as string | undefined}
            {...register("consultation_id")}
          />
        </div>
        <Select
          label="Procedure"
          placeholder={procedures.length ? "Select imaging procedure…" : "Loading catalog…"}
          options={procedureOptions}
          defaultValue=""
          error={errors.procedure_catalog_id?.message}
          {...register("procedure_catalog_id")}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <Select
            label="Priority"
            options={PRIORITY_OPTIONS}
            error={errors.priority?.message}
            {...register("priority")}
          />
          <Input
            label="Laterality (optional)"
            placeholder="e.g. LEFT, RIGHT, BILATERAL"
            error={errors.laterality?.message}
            {...register("laterality")}
          />
        </div>
        <Textarea
          label="Clinical Indication / Notes"
          rows={3}
          placeholder="Reason for the study, relevant history, safety notes…"
          error={errors.clinical_indication?.message}
          {...register("clinical_indication")}
        />
      </form>
    </Modal>
  );
}

// ============================================================
// Page
// ============================================================

export function RadiologyOrdersPage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<TabKey>("orders");
  const newOrderModal = useDisclosure();

  // ---- Shared catalog (form select + procedure name lookups) ----
  const proceduresQuery = useRadiologyProcedures({ limit: 200 });
  const procedures = proceduresQuery.data?.items ?? [];
  const procedureById = useMemo(() => {
    const map = new Map<number, RadiologyProcedure>();
    procedures.forEach((p) => map.set(p.id, p));
    return map;
  }, [procedures]);

  // ---- KPI counts (server totals via 1-row queries) ----
  const pendingKpi = useRadiologyWorklist({ limit: 1, statuses: PENDING_STATUSES });
  const inProgressKpi = useRadiologyWorklist({ limit: 1, statuses: IN_PROGRESS_STATUSES });
  const completedKpi = useRadiologyWorklist({ limit: 1, statuses: COMPLETED_STATUSES });

  // ---- Orders tab state ----
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersSearch, setOrdersSearch] = useState("");
  const [ordersStatus, setOrdersStatus] = useState("");

  const ordersQuery = useRadiologyWorklist({
    skip: (ordersPage - 1) * PAGE_SIZE,
    limit: PAGE_SIZE,
    statuses: ordersStatus ? [ordersStatus] : ALL_ORDER_STATUSES,
  });

  const filteredOrders = useMemo(() => {
    const items = ordersQuery.data?.items ?? [];
    const term = ordersSearch.trim().toLowerCase();
    if (!term) return items;
    return items.filter((o) => {
      const procedureNames = o.items
        .map((i) => procedureById.get(i.procedure_catalog_id)?.name ?? "")
        .join(" ");
      return (
        o.order_no.toLowerCase().includes(term) ||
        String(o.visit_id).includes(term) ||
        (o.clinical_indication ?? "").toLowerCase().includes(term) ||
        procedureNames.toLowerCase().includes(term)
      );
    });
  }, [ordersQuery.data?.items, ordersSearch, procedureById]);

  // ---- Cancel order flow ----
  const cancelOrder = useCancelRadiologyOrder();
  const [orderToCancel, setOrderToCancel] = useState<RadiologyOrder | null>(null);

  // ---- Exams tab (order items across the worklist) ----
  const [examsPage, setExamsPage] = useState(1);
  const [examsSearch, setExamsSearch] = useState("");
  const [examsStatus, setExamsStatus] = useState("");

  const examsSourceQuery = useRadiologyWorklist({
    skip: 0,
    limit: 200,
    statuses: ALL_ORDER_STATUSES,
  });

  type ExamRow = RadiologyOrderItem & { order: RadiologyOrder };

  const examRows = useMemo<ExamRow[]>(() => {
    const orders = examsSourceQuery.data?.items ?? [];
    const rows = orders.flatMap((order) => order.items.map((item) => ({ ...item, order })));
    const term = examsSearch.trim().toLowerCase();
    return rows.filter((row) => {
      if (examsStatus && row.status !== examsStatus) return false;
      if (!term) return true;
      const procedure = procedureById.get(row.procedure_catalog_id);
      return (
        row.order.order_no.toLowerCase().includes(term) ||
        String(row.order.visit_id).includes(term) ||
        (procedure?.name ?? "").toLowerCase().includes(term) ||
        (procedure?.code ?? "").toLowerCase().includes(term)
      );
    });
  }, [examsSourceQuery.data?.items, examsSearch, examsStatus, procedureById]);

  const examsTotalPages = Math.max(1, Math.ceil(examRows.length / PAGE_SIZE));
  const pagedExamRows = examRows.slice((examsPage - 1) * PAGE_SIZE, examsPage * PAGE_SIZE);

  // ---- Reports tab ----
  const [reportsPage, setReportsPage] = useState(1);
  const [reportsSearch, setReportsSearch] = useState("");
  const [reportsStatus, setReportsStatus] = useState("");
  const [reportExamId, setReportExamId] = useState(0);

  const reportedOrdersQuery = useRadiologyWorklist({
    skip: (reportsPage - 1) * PAGE_SIZE,
    limit: PAGE_SIZE,
    statuses: reportsStatus ? [reportsStatus] : COMPLETED_STATUSES,
  });

  const filteredReportedOrders = useMemo(() => {
    const items = reportedOrdersQuery.data?.items ?? [];
    const term = reportsSearch.trim().toLowerCase();
    if (!term) return items;
    return items.filter(
      (o) =>
        o.order_no.toLowerCase().includes(term) ||
        String(o.visit_id).includes(term) ||
        (o.clinical_indication ?? "").toLowerCase().includes(term),
    );
  }, [reportedOrdersQuery.data?.items, reportsSearch]);

  const reportLookupQuery = useRadiologyReportForExam(reportExamId);

  // ---- Columns ----
  const orderColumns: DataTableColumn<RadiologyOrder>[] = [
    {
      key: "order_no",
      header: "Order No.",
      render: (o) => <span className="data-mono text-xs">{o.order_no}</span>,
    },
    {
      key: "visit_id",
      header: "Visit",
      render: (o) => <span className="data-mono text-xs">#{o.visit_id}</span>,
    },
    {
      key: "procedures",
      header: "Procedures",
      render: (o) => {
        const names = o.items.map(
          (i) => procedureById.get(i.procedure_catalog_id)?.name ?? `Procedure #${i.procedure_catalog_id}`,
        );
        return (
          <span className="block max-w-[260px] truncate text-sm" title={names.join(", ")}>
            {names.length ? names.join(", ") : "—"}
          </span>
        );
      },
    },
    {
      key: "priority",
      header: "Priority",
      render: (o) => <StatusPill value={String(o.priority)} variant={priorityVariant(String(o.priority))} />,
    },
    {
      key: "status",
      header: "Status",
      render: (o) => <StatusPill value={String(o.status)} variant={orderStatusVariant(String(o.status))} />,
    },
    {
      key: "ordered_at",
      header: "Ordered",
      render: (o) => <span className="text-xs text-secondary-500">{formatDateTime(o.ordered_at)}</span>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (o) =>
        !["COMPLETED", "CANCELLED", "RELEASED"].includes(String(o.status)) ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setOrderToCancel(o)}
            leftIcon={<XCircle className="h-3.5 w-3.5" />}
          >
            Cancel
          </Button>
        ) : null,
    },
  ];

  const examColumns: DataTableColumn<ExamRow>[] = [
    {
      key: "id",
      header: "Item",
      render: (row) => <span className="data-mono text-xs">#{row.id}</span>,
    },
    {
      key: "order_no",
      header: "Order No.",
      render: (row) => <span className="data-mono text-xs">{row.order.order_no}</span>,
    },
    {
      key: "procedure",
      header: "Procedure",
      render: (row) => {
        const procedure = procedureById.get(row.procedure_catalog_id);
        return (
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {procedure?.name ?? `Procedure #${row.procedure_catalog_id}`}
            </p>
            <p className="data-mono text-[11px] text-secondary-400">
              {procedure ? `${procedure.code} · ${String(procedure.modality).replace(/_/g, " ")}` : "—"}
            </p>
          </div>
        );
      },
    },
    {
      key: "laterality",
      header: "Laterality",
      render: (row) => <span className="text-xs text-secondary-500">{row.laterality ?? "—"}</span>,
    },
    {
      key: "priority",
      header: "Priority",
      render: (row) => (
        <StatusPill value={String(row.order.priority)} variant={priorityVariant(String(row.order.priority))} />
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusPill value={String(row.status)} variant={orderStatusVariant(String(row.status))} />,
    },
  ];

  const reportedOrderColumns: DataTableColumn<RadiologyOrder>[] = [
    {
      key: "order_no",
      header: "Order No.",
      render: (o) => <span className="data-mono text-xs">{o.order_no}</span>,
    },
    {
      key: "visit_id",
      header: "Visit",
      render: (o) => <span className="data-mono text-xs">#{o.visit_id}</span>,
    },
    {
      key: "procedures",
      header: "Procedures",
      render: (o) => {
        const names = o.items.map(
          (i) => procedureById.get(i.procedure_catalog_id)?.name ?? `Procedure #${i.procedure_catalog_id}`,
        );
        return (
          <span className="block max-w-[280px] truncate text-sm" title={names.join(", ")}>
            {names.length ? names.join(", ") : "—"}
          </span>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      render: (o) => <StatusPill value={String(o.status)} variant={orderStatusVariant(String(o.status))} />,
    },
    {
      key: "updated_at",
      header: "Last Update",
      render: (o) => (
        <span className="text-xs text-secondary-500">{formatDateTime(o.updated_at ?? o.ordered_at)}</span>
      ),
    },
  ];

  const reportColumns: DataTableColumn<RadiologyReport>[] = [
    {
      key: "id",
      header: "Report",
      render: (r) => <span className="data-mono text-xs">#{r.id}</span>,
    },
    {
      key: "exam_id",
      header: "Exam",
      render: (r) => <span className="data-mono text-xs">#{r.exam_id}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (r) => <StatusPill value={String(r.status)} variant={reportStatusVariant(String(r.status))} />,
    },
    {
      key: "impression",
      header: "Impression",
      render: (r) => (
        <span className="block max-w-[280px] truncate text-sm" title={r.impression ?? undefined}>
          {r.impression ?? "—"}
        </span>
      ),
    },
    {
      key: "drafted_at",
      header: "Drafted",
      render: (r) => <span className="text-xs text-secondary-500">{formatDateTime(r.drafted_at)}</span>,
    },
    {
      key: "finalized_at",
      header: "Finalized",
      render: (r) => <span className="text-xs text-secondary-500">{formatDateTime(r.finalized_at)}</span>,
    },
    {
      key: "released_at",
      header: "Released",
      render: (r) => <span className="text-xs text-secondary-500">{formatDateTime(r.released_at)}</span>,
    },
  ];

  const reportLookupRows = reportLookupQuery.data ? [reportLookupQuery.data] : [];

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Radiology & Imaging"
        description="Track imaging orders across modalities, follow exam progress and review released reports."
        actions={
          <Button leftIcon={<Plus className="h-4 w-4" />} onClick={newOrderModal.open}>
            New Imaging Order
          </Button>
        }
      />

      {/* KPI row */}
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Pending"
          value={pendingKpi.data?.meta?.total ?? 0}
          icon={Clock}
          tone="amber"
          isLoading={pendingKpi.isLoading}
        />
        <MetricCard
          label="In Progress"
          value={inProgressKpi.data?.meta?.total ?? 0}
          icon={Activity}
          tone="cyan"
          isLoading={inProgressKpi.isLoading}
        />
        <MetricCard
          label="Completed"
          value={completedKpi.data?.meta?.total ?? 0}
          icon={CheckCircle2}
          tone="primary"
          isLoading={completedKpi.isLoading}
        />
        <MetricCard
          label="Catalog Procedures"
          value={proceduresQuery.data?.meta?.total ?? 0}
          icon={ScanLine}
          tone="violet"
          isLoading={proceduresQuery.isLoading}
        />
      </div>

      {/* Segmented tab switch */}
      <div className="glass-card inline-flex items-center gap-1 rounded-2xl p-1.5">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "rounded-xl px-5 py-2.5 text-xs font-bold uppercase tracking-widest transition-all",
              activeTab === tab.key
                ? "bg-primary-500 text-white shadow-glow-sm"
                : "text-secondary-500 hover:text-secondary-900 dark:hover:text-secondary-100",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ---- Orders tab ---- */}
      {activeTab === "orders" && (
        <Card padding="none">
          <div className="flex flex-wrap items-center gap-3 px-6 py-4">
            <SearchInput
              onSearch={setOrdersSearch}
              placeholder="Search order no., visit, procedure…"
              className="w-72"
            />
            <Select
              options={ORDER_STATUS_OPTIONS}
              value={ordersStatus}
              onChange={(e) => {
                setOrdersStatus(e.target.value);
                setOrdersPage(1);
              }}
              className="w-48 py-2.5"
              aria-label="Filter orders by status"
            />
          </div>
          <DataTable
            columns={orderColumns}
            data={filteredOrders}
            rowKey={(o) => o.id}
            isLoading={ordersQuery.isLoading}
            error={errorMessage(ordersQuery.error)}
            onRetry={() => ordersQuery.refetch()}
            empty={{
              icon: ClipboardList,
              title: "No imaging orders",
              description: "Place a new imaging order to see it appear on the worklist.",
              action: (
                <Button leftIcon={<Plus className="h-4 w-4" />} onClick={newOrderModal.open}>
                  New Imaging Order
                </Button>
              ),
            }}
            footer={
              <Pagination
                page={ordersPage}
                totalItems={ordersQuery.data?.meta?.total}
                pageSize={PAGE_SIZE}
                hasNext={ordersQuery.data?.meta?.has_next}
                onPageChange={setOrdersPage}
              />
            }
          />
        </Card>
      )}

      {/* ---- Exams tab ---- */}
      {activeTab === "exams" && (
        <Card padding="none">
          <div className="flex flex-wrap items-center gap-3 px-6 py-4">
            <SearchInput
              onSearch={(term) => {
                setExamsSearch(term);
                setExamsPage(1);
              }}
              placeholder="Search procedure, code, order no.…"
              className="w-72"
            />
            <Select
              options={ORDER_STATUS_OPTIONS}
              value={examsStatus}
              onChange={(e) => {
                setExamsStatus(e.target.value);
                setExamsPage(1);
              }}
              className="w-48 py-2.5"
              aria-label="Filter exams by status"
            />
          </div>
          <DataTable
            columns={examColumns}
            data={pagedExamRows}
            rowKey={(row) => row.id}
            isLoading={examsSourceQuery.isLoading}
            error={errorMessage(examsSourceQuery.error)}
            onRetry={() => examsSourceQuery.refetch()}
            empty={{
              icon: ImageIcon,
              title: "No exam items",
              description: "Ordered procedures appear here as they move through the imaging workflow.",
            }}
            footer={
              <Pagination
                page={examsPage}
                totalPages={examsTotalPages}
                totalItems={examRows.length}
                pageSize={PAGE_SIZE}
                onPageChange={setExamsPage}
              />
            }
          />
        </Card>
      )}

      {/* ---- Reports tab ---- */}
      {activeTab === "reports" && (
        <div className="space-y-6">
          <Card padding="none">
            <div className="flex flex-wrap items-center gap-3 px-6 py-4">
              <SearchInput
                onSearch={(term) => {
                  const parsed = Number.parseInt(term, 10);
                  setReportExamId(Number.isFinite(parsed) && parsed > 0 ? parsed : 0);
                }}
                placeholder="Look up report by exam ID…"
                className="w-72"
              />
              {reportExamId > 0 && reportLookupQuery.isError ? (
                <span className="text-xs font-bold text-rose-500">
                  No report found for exam #{reportExamId}.
                </span>
              ) : null}
            </div>
            <DataTable
              columns={reportColumns}
              data={reportLookupRows}
              rowKey={(r) => r.id}
              isLoading={reportExamId > 0 && reportLookupQuery.isLoading}
              empty={{
                icon: FileText,
                title: "Report lookup",
                description: "Enter an exam ID above to fetch its radiology report.",
              }}
            />
          </Card>

          <Card padding="none">
            <div className="flex flex-wrap items-center gap-3 px-6 py-4">
              <SearchInput
                onSearch={setReportsSearch}
                placeholder="Search reported orders…"
                className="w-72"
              />
              <Select
                options={[
                  { value: "", label: "All reporting stages" },
                  { value: "REPORTED", label: "Reported" },
                  { value: "RELEASED", label: "Released" },
                  { value: "COMPLETED", label: "Completed" },
                ]}
                value={reportsStatus}
                onChange={(e) => {
                  setReportsStatus(e.target.value);
                  setReportsPage(1);
                }}
                className="w-52 py-2.5"
                aria-label="Filter reported orders by stage"
              />
            </div>
            <DataTable
              columns={reportedOrderColumns}
              data={filteredReportedOrders}
              rowKey={(o) => o.id}
              isLoading={reportedOrdersQuery.isLoading}
              error={errorMessage(reportedOrdersQuery.error)}
              onRetry={() => reportedOrdersQuery.refetch()}
              empty={{
                icon: FileText,
                title: "No reported studies",
                description: "Orders reach this list once their reports are drafted and released.",
              }}
              footer={
                <Pagination
                  page={reportsPage}
                  totalItems={reportedOrdersQuery.data?.meta?.total}
                  pageSize={PAGE_SIZE}
                  hasNext={reportedOrdersQuery.data?.meta?.has_next}
                  onPageChange={setReportsPage}
                />
              }
            />
          </Card>
        </div>
      )}

      {/* ---- Modals ---- */}
      <NewImagingOrderModal
        isOpen={newOrderModal.isOpen}
        onClose={newOrderModal.close}
        procedures={procedures}
      />

      <ConfirmDialog
        isOpen={orderToCancel !== null}
        onClose={() => setOrderToCancel(null)}
        title="Cancel imaging order?"
        description={
          orderToCancel
            ? `Order ${orderToCancel.order_no} will be cancelled and removed from the worklist.`
            : undefined
        }
        confirmLabel="Cancel Order"
        tone="danger"
        onConfirm={async () => {
          if (!orderToCancel) return;
          try {
            await cancelOrder.mutateAsync({
              orderId: orderToCancel.id,
              reason: "Cancelled from radiology worklist",
            });
            toast.success("Order cancelled", `Order ${orderToCancel.order_no} was cancelled.`);
          } catch (err) {
            toast.error("Could not cancel order", errorMessage(err) ?? undefined);
          } finally {
            setOrderToCancel(null);
          }
        }}
      />
    </div>
  );
}
