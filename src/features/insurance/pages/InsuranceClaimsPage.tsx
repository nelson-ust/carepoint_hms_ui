import { useMemo, useState } from "react";
import {
  Building2,
  CheckCircle2,
  Clock,
  FileText,
  Layers,
  Plus,
  RotateCcw,
  Scale,
  Send,
  ShieldCheck,
  Undo2,
  XCircle,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Modal } from "@/components/ui/Modal";
import { Badge, type BadgeProps } from "@/components/ui/Badge";
import { SearchInput } from "@/components/forms/SearchInput";
import { MetricCard } from "@/components/charts/MetricCard";
import { DataTable, type DataTableColumn } from "@/components/data-table/DataTable";
import { Pagination } from "@/components/data-table/Pagination";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { useToast } from "@/components/feedback/ToastProvider";
import { useDisclosure } from "@/hooks/useDisclosure";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getPatients } from "@/features/patients/api/patients.api";
import { CLAIM_STATUSES, formatMoney, type InsuranceClaim } from "../api/insurance.api";
import { hmoApi } from "../api/hmo.api";
import {
  useClaims,
  useClaimsSummary,
  useCreateClaim,
  useInsuranceProviders,
  usePatientInsurancePolicies,
  useSubmitAppeal,
  useSubmitClaim,
} from "../hooks/use-insurance";

const PAGE_SIZE = 20;

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  ...CLAIM_STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, " ") })),
];

const STATUS_VARIANTS: Record<string, BadgeProps["variant"]> = {
  DRAFT: "secondary",
  PENDING_AUTH: "soft-warning",
  AUTHORIZED: "soft-info",
  SUBMITTED: "soft-info",
  UNDER_REVIEW: "soft-warning",
  APPROVED: "soft-success",
  PARTIALLY_APPROVED: "soft-warning",
  REJECTED: "soft-danger",
  PAID: "soft-success",
  APPEALED: "soft-info",
  CLOSED: "secondary",
};

const SUBMITTABLE = new Set(["DRAFT", "AUTHORIZED"]);
const APPEALABLE = new Set(["REJECTED", "PARTIALLY_APPROVED"]);

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function ClaimStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={STATUS_VARIANTS[status] ?? "secondary"}>
      {status.replace(/_/g, " ") || "UNKNOWN"}
    </Badge>
  );
}

function NewClaimModal({
  isOpen,
  onClose,
  patientOptions,
}: {
  isOpen: boolean;
  onClose: () => void;
  patientOptions: { value: string; label: string }[];
}) {
  const toast = useToast();
  const createClaim = useCreateClaim();
  const [patientId, setPatientId] = useState("");
  const [policyId, setPolicyId] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [serviceDate, setServiceDate] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  // A patient's policies load once a patient is chosen; the provider is then
  // derived from the selected policy (no free-text IDs, no mismatches).
  const policiesQuery = usePatientInsurancePolicies(patientId ? Number(patientId) : null);
  const policies = policiesQuery.data ?? [];
  const selectedPolicy = policies.find((p) => String(p.id) === policyId) ?? null;

  const policyOptions = policies.map((p) => ({
    value: String(p.id),
    label: `${p.provider_name ?? `Provider #${p.insurance_provider_id}`} — ${p.policy_number}${
      p.plan_name ? ` (${p.plan_name})` : ""
    }`,
  }));

  const derivedProvider = selectedPolicy
    ? selectedPolicy.provider_name ?? `Provider #${selectedPolicy.insurance_provider_id}`
    : "";

  const noPolicies =
    !!patientId && !policiesQuery.isLoading && !policiesQuery.isError && policyOptions.length === 0;

  const handleClose = () => {
    setPatientId("");
    setPolicyId("");
    setInvoiceId("");
    setServiceDate("");
    setDiagnosis("");
    setNotes("");
    setError(null);
    onClose();
  };

  const handlePatientChange = (value: string) => {
    setPatientId(value);
    setPolicyId(""); // reset the dependent policy when the patient changes
  };

  const handleSubmit = () => {
    const pid = Number(patientId);
    if (!pid) {
      setError("Please select a patient.");
      return;
    }
    if (!selectedPolicy) {
      setError("Please select the patient's insurance policy.");
      return;
    }
    setError(null);
    createClaim.mutate(
      {
        patient_id: pid,
        patient_insurance_id: selectedPolicy.id,
        insurance_provider_id: selectedPolicy.insurance_provider_id,
        invoice_id: invoiceId ? Number(invoiceId) : undefined,
        service_date: serviceDate || undefined,
        primary_diagnosis_text: diagnosis.trim() || undefined,
        notes: notes.trim() || undefined,
      },
      {
        onSuccess: (claim) => {
          toast.success("Claim created", `Claim ${claim.claim_no} saved as draft.`);
          handleClose();
        },
        onError: (err: any) => {
          toast.error(
            "Failed to create claim",
            err?.response?.data?.detail?.toString?.() ?? err?.message,
          );
        },
      },
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="New Insurance Claim"
      size="lg"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            isLoading={createClaim.isPending}
            disabled={!selectedPolicy}
          >
            Create Claim
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Patient"
            options={patientOptions}
            placeholder="Select patient…"
            value={patientId}
            onChange={(e) => handlePatientChange(e.target.value)}
          />
          <Select
            label="Insurance Policy"
            options={policyOptions}
            placeholder={
              !patientId
                ? "Select a patient first"
                : policiesQuery.isLoading
                  ? "Loading policies…"
                  : policyOptions.length === 0
                    ? "No policies on file"
                    : "Select policy…"
            }
            value={policyId}
            onChange={(e) => setPolicyId(e.target.value)}
            disabled={!patientId || policyOptions.length === 0}
          />
        </div>
        <Input
          label="Insurance Provider"
          value={derivedProvider}
          placeholder="Auto-filled from the selected policy"
          disabled
          readOnly
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Invoice ID (optional)"
            type="number"
            min={1}
            value={invoiceId}
            onChange={(e) => setInvoiceId(e.target.value)}
            placeholder="e.g. 128"
          />
          <Input
            label="Service Date"
            type="date"
            value={serviceDate}
            onChange={(e) => setServiceDate(e.target.value)}
          />
        </div>
        <Input
          label="Primary Diagnosis"
          value={diagnosis}
          onChange={(e) => setDiagnosis(e.target.value)}
          placeholder="e.g. Acute bronchitis"
        />
        <Textarea
          label="Notes (optional)"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        {noPolicies ? (
          <p className="text-xs font-semibold text-amber-600">
            This patient has no insurance policy on file. Add one from the patient's record
            before creating a claim.
          </p>
        ) : null}
        {error ? <p className="text-xs font-semibold text-rose-500">{error}</p> : null}
      </div>
    </Modal>
  );
}

function AppealClaimModal({
  claim,
  onClose,
}: {
  claim: InsuranceClaim | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const submitAppeal = useSubmitAppeal();
  const [appealText, setAppealText] = useState("");
  const [additionalAmount, setAdditionalAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setAppealText("");
    setAdditionalAmount("");
    setError(null);
    onClose();
  };

  const handleSubmit = () => {
    if (!claim) return;
    if (!appealText.trim()) {
      setError("Appeal justification text is required.");
      return;
    }
    setError(null);
    submitAppeal.mutate(
      {
        claim_id: claim.id,
        appeal_text: appealText.trim(),
        additional_amount_requested: additionalAmount ? Number(additionalAmount) : undefined,
      },
      {
        onSuccess: (appeal) => {
          toast.success("Appeal submitted", `Appeal ${appeal.appeal_no} filed for ${claim.claim_no}.`);
          handleClose();
        },
        onError: (err: any) => {
          toast.error(
            "Failed to submit appeal",
            err?.response?.data?.detail?.toString?.() ?? err?.message,
          );
        },
      },
    );
  };

  return (
    <Modal
      isOpen={claim !== null}
      onClose={handleClose}
      title={claim ? `Appeal Claim ${claim.claim_no}` : "Appeal Claim"}
      size="md"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            isLoading={submitAppeal.isPending}
            leftIcon={<Scale className="h-4 w-4" />}
          >
            Submit Appeal
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {claim ? (
          <div className="glass-card flex items-center justify-between gap-4 p-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-secondary-400">
                Rejected Amount
              </p>
              <p className="data-mono mt-1 text-lg font-bold text-rose-500">
                {formatMoney(claim.rejected_amount)}
              </p>
            </div>
            <ClaimStatusBadge status={claim.status} />
          </div>
        ) : null}
        <Textarea
          label="Appeal Justification"
          rows={4}
          value={appealText}
          onChange={(e) => setAppealText(e.target.value)}
          placeholder="Explain why the adjudication should be reconsidered…"
          error={error ?? undefined}
        />
        <Input
          label="Additional Amount Requested (optional)"
          type="number"
          min={0}
          step="0.01"
          value={additionalAmount}
          onChange={(e) => setAdditionalAmount(e.target.value)}
          placeholder="0.00"
        />
      </div>
    </Modal>
  );
}

export function InsuranceClaimsPage() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [providerId, setProviderId] = useState("");
  const [search, setSearch] = useState("");
  const [appealTarget, setAppealTarget] = useState<InsuranceClaim | null>(null);
  const [submitTarget, setSubmitTarget] = useState<InsuranceClaim | null>(null);

  const newClaimModal = useDisclosure();
  const submitClaim = useSubmitClaim();

  const filters = useMemo(
    () => ({
      skip: (page - 1) * PAGE_SIZE,
      limit: PAGE_SIZE,
      statuses: status ? [status] : undefined,
      insurance_provider_id: providerId ? Number(providerId) : undefined,
    }),
    [page, status, providerId],
  );

  const claimsQuery = useClaims(filters);
  const summaryQuery = useClaimsSummary();
  const providersQuery = useInsuranceProviders();
  const patientsQuery = useQuery({
    queryKey: ["patients", "insurance-select"],
    queryFn: () => getPatients(0, 200),
    staleTime: 60 * 1000,
  });

  const providerNameById = useMemo(() => {
    const map = new Map<number, string>();
    (providersQuery.data ?? []).forEach((p) => map.set(p.id, p.name));
    return map;
  }, [providersQuery.data]);

  const patientNameById = useMemo(() => {
    const map = new Map<number, string>();
    (patientsQuery.data?.items ?? []).forEach((p) =>
      map.set(p.id, `${p.first_name} ${p.last_name}`.trim()),
    );
    return map;
  }, [patientsQuery.data?.items]);

  const providerFilterOptions = useMemo(
    () => [
      { value: "", label: "All providers" },
      ...(providersQuery.data ?? []).map((p) => ({ value: String(p.id), label: p.name })),
    ],
    [providersQuery.data],
  );

  const patientOptions = useMemo(
    () =>
      (patientsQuery.data?.items ?? []).map((p) => ({
        value: String(p.id),
        label: `${p.first_name} ${p.last_name} — ${p.hospital_number}`,
      })),
    [patientsQuery.data?.items],
  );

  const rows = useMemo(() => {
    const items = claimsQuery.data?.items ?? [];
    if (!search) return items;
    const term = search.toLowerCase();
    return items.filter(
      (c) =>
        c.claim_no.toLowerCase().includes(term) ||
        String(c.patient_id).includes(term) ||
        (patientNameById.get(c.patient_id) ?? "").toLowerCase().includes(term) ||
        (providerNameById.get(c.insurance_provider_id) ?? "").toLowerCase().includes(term),
    );
  }, [claimsQuery.data?.items, search, providerNameById, patientNameById]);

  const meta = claimsQuery.data?.meta;
  const summary = summaryQuery.data;

  const qcClient = useQueryClient();
  const [resubmitTarget, setResubmitTarget] = useState<InsuranceClaim | null>(null);
  const [writeOffTarget, setWriteOffTarget] = useState<InsuranceClaim | null>(null);
  const [batchModalOpen, setBatchModalOpen] = useState(false);

  const refreshClaims = () => qcClient.invalidateQueries({ queryKey: ["insurance"] })
    .then(() => claimsQuery.refetch());

  const handleResubmit = async () => {
    if (!resubmitTarget) return;
    try {
      const out = await hmoApi.resubmitClaim(resubmitTarget.id) as any;
      toast.success("Claim resubmitted",
        `A corrected draft ${out?.new_claim_no ?? ""} was created; the rejected claim is closed.`);
      setResubmitTarget(null);
      refreshClaims();
    } catch (err: any) {
      toast.error("Could not resubmit", err?.response?.data?.detail?.toString?.() ?? err?.message);
    }
  };

  const handleWriteOff = async () => {
    if (!writeOffTarget) return;
    try {
      const out = await hmoApi.writeOffClaim(writeOffTarget.id, {}) as any;
      toast.success("Balance written off",
        `${formatMoney(Number(out?.amount ?? 0))} moved to disallowance on ${writeOffTarget.claim_no}.`);
      setWriteOffTarget(null);
      refreshClaims();
    } catch (err: any) {
      toast.error("Could not write off", err?.response?.data?.detail?.toString?.() ?? err?.message);
    }
  };

  const handleSubmitClaim = async () => {
    if (!submitTarget) return;
    try {
      const claim = await submitClaim.mutateAsync({ claimId: submitTarget.id });
      toast.success("Claim submitted", `Claim ${claim.claim_no} sent to the insurer.`);
      setSubmitTarget(null);
    } catch (err: any) {
      toast.error(
        "Failed to submit claim",
        err?.response?.data?.detail?.toString?.() ?? err?.message,
      );
    }
  };

  const columns: DataTableColumn<InsuranceClaim>[] = [
    {
      key: "claim_no",
      header: "Claim",
      render: (c) => (
        <div>
          <p className="data-mono text-sm font-bold text-secondary-900">{c.claim_no}</p>
          <p className="mt-0.5 text-xs text-secondary-400">
            {formatDate(c.service_date ?? c.created_at)}
          </p>
        </div>
      ),
    },
    {
      key: "patient_id",
      header: "Patient",
      render: (c) => (
        <div>
          <p className="text-sm font-bold text-secondary-900">
            {patientNameById.get(c.patient_id) ?? `Patient #${c.patient_id}`}
          </p>
          <p className="mt-0.5 text-xs text-secondary-400">
            {patientNameById.has(c.patient_id) ? `Patient #${c.patient_id}` : null}
            {c.invoice_id ? `${patientNameById.has(c.patient_id) ? " • " : ""}Invoice #${c.invoice_id}` : null}
          </p>
        </div>
      ),
    },
    {
      key: "provider",
      header: "Provider",
      render: (c) => (
        <span className="flex items-center gap-2 text-sm text-secondary-600">
          <Building2 className="h-3.5 w-3.5 text-secondary-400" aria-hidden />
          {providerNameById.get(c.insurance_provider_id) ?? `Provider #${c.insurance_provider_id}`}
        </span>
      ),
    },
    {
      key: "billed_amount",
      header: "Billed",
      align: "right",
      render: (c) => (
        <span className="data-mono text-sm font-bold text-secondary-900">
          {formatMoney(c.billed_amount)}
        </span>
      ),
    },
    {
      key: "approved_amount",
      header: "Approved",
      align: "right",
      render: (c) => (
        <span className="data-mono text-sm text-emerald-500">
          {formatMoney(c.approved_amount)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (c) => <ClaimStatusBadge status={c.status} />,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (c) => (
        <div className="flex items-center justify-end gap-2">
          {SUBMITTABLE.has(c.status) ? (
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Send className="h-3.5 w-3.5" />}
              onClick={(e) => {
                e.stopPropagation();
                setSubmitTarget(c);
              }}
            >
              Submit
            </Button>
          ) : null}
          {APPEALABLE.has(c.status) ? (
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Scale className="h-3.5 w-3.5" />}
              onClick={(e) => {
                e.stopPropagation();
                setAppealTarget(c);
              }}
            >
              Appeal
            </Button>
          ) : null}
          {c.status === "REJECTED" ? (
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
              onClick={(e) => {
                e.stopPropagation();
                setResubmitTarget(c);
              }}
            >
              Resubmit
            </Button>
          ) : null}
          {(c.status === "APPROVED" || c.status === "PARTIALLY_APPROVED") &&
            c.approved_amount - c.paid_amount > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Undo2 className="h-3.5 w-3.5" />}
              onClick={(e) => {
                e.stopPropagation();
                setWriteOffTarget(c);
              }}
            >
              Write off
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Insurance & Claims"
        description="Manage healthcare insurance claim submissions, adjudications, and reimbursement tracking."
        actions={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              leftIcon={<Layers className="h-4 w-4" />}
              onClick={() => setBatchModalOpen(true)}
            >
              Batch a Month
            </Button>
            <Button leftIcon={<Plus className="h-4 w-4" />} onClick={newClaimModal.open}>
              New Claim
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total Claims"
          value={summary ? summary.totalClaims.toLocaleString() : "—"}
          icon={ShieldCheck}
          tone="primary"
          isLoading={summaryQuery.isLoading}
        />
        <MetricCard
          label="Pending Review"
          value={summary ? summary.pendingCount.toLocaleString() : "—"}
          icon={Clock}
          tone="amber"
          isLoading={summaryQuery.isLoading}
        />
        <MetricCard
          label="Approved Value"
          value={summary ? formatMoney(summary.approvedValue) : "—"}
          icon={CheckCircle2}
          tone="cyan"
          isLoading={summaryQuery.isLoading}
        />
        <MetricCard
          label="Rejected Claims"
          value={summary ? summary.rejectedCount.toLocaleString() : "—"}
          icon={XCircle}
          tone="rose"
          isLoading={summaryQuery.isLoading}
        />
      </div>

      <Card padding="none">
        <div className="flex flex-wrap items-center gap-3 px-6 py-4">
          <SearchInput
            onSearch={setSearch}
            placeholder="Search claim no., patient, provider…"
            className="w-72"
          />
          <Select
            aria-label="Filter by status"
            options={STATUS_OPTIONS}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="w-48 py-2.5"
          />
          <Select
            aria-label="Filter by provider"
            options={providerFilterOptions}
            value={providerId}
            onChange={(e) => {
              setProviderId(e.target.value);
              setPage(1);
            }}
            className="w-48 py-2.5"
          />
        </div>
        <DataTable
          columns={columns}
          data={rows}
          rowKey={(c) => c.id}
          isLoading={claimsQuery.isLoading}
          error={claimsQuery.isError ? "Failed to load insurance claims." : null}
          onRetry={() => claimsQuery.refetch()}
          empty={{
            icon: FileText,
            title: "No claims found",
            description: search
              ? "No claims match your search on this page."
              : "Insurance claims will appear here once created.",
            action: (
              <Button
                size="sm"
                leftIcon={<Plus className="h-3.5 w-3.5" />}
                onClick={newClaimModal.open}
              >
                New Claim
              </Button>
            ),
          }}
          footer={
            <Pagination
              page={page}
              totalPages={meta?.total_pages}
              hasNext={meta?.has_next}
              totalItems={typeof meta?.total === "number" ? meta.total : undefined}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          }
        />
      </Card>

      <NewClaimModal
        isOpen={newClaimModal.isOpen}
        onClose={newClaimModal.close}
        patientOptions={patientOptions}
      />

      <AppealClaimModal claim={appealTarget} onClose={() => setAppealTarget(null)} />

      <ConfirmDialog
        isOpen={resubmitTarget !== null}
        onClose={() => setResubmitTarget(null)}
        onConfirm={handleResubmit}
        title="Resubmit this rejected claim?"
        tone="primary"
        description={
          resubmitTarget
            ? `A corrected draft copy of ${resubmitTarget.claim_no} will be created for editing and re-submission; the rejected claim will be closed.`
            : undefined
        }
        confirmLabel="Create corrected claim"
      />

      <ConfirmDialog
        isOpen={writeOffTarget !== null}
        onClose={() => setWriteOffTarget(null)}
        onConfirm={handleWriteOff}
        title="Write off the uncollected balance?"
        tone="danger"
        description={
          writeOffTarget
            ? `${formatMoney(writeOffTarget.approved_amount - writeOffTarget.paid_amount)} on ${writeOffTarget.claim_no} will post to Disallowance and be removed from HMO receivables. This is done by reversal only.`
            : undefined
        }
        confirmLabel="Write off"
      />

      <BatchMonthModal isOpen={batchModalOpen} onClose={() => setBatchModalOpen(false)} />

      <ConfirmDialog
        isOpen={submitTarget !== null}
        onClose={() => setSubmitTarget(null)}
        onConfirm={handleSubmitClaim}
        title="Submit this claim?"
        tone="primary"
        description={
          submitTarget
            ? `Claim ${submitTarget.claim_no} (${formatMoney(submitTarget.billed_amount)}) will be submitted to the insurer for adjudication.`
            : undefined
        }
        confirmLabel="Submit Claim"
      />
    </div>
  );
}


function BatchMonthModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const toast = useToast();
  const providersQuery = useInsuranceProviders();
  const [providerId, setProviderId] = useState("");
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [busy, setBusy] = useState(false);

  const options = [
    { value: "", label: "Select payer…" },
    ...((providersQuery.data ?? []) as any[]).map((p: any) => ({
      value: String(p.id),
      label: p.name,
    })),
  ];

  const run = async () => {
    setBusy(true);
    try {
      const out = await hmoApi.generateMonthlyBatch({
        provider_id: Number(providerId),
        period_code: period,
      });
      toast.success(
        "Batch generated",
        `${out.claims} claims gathered into ${out.batch_no}. Downloading the submission workbook…`,
      );
      const blob = await hmoApi.downloadBatchXlsx(out.batch_id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `claim_batch_${out.batch_no}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      onClose();
    } catch (err: any) {
      toast.error(
        "Could not generate the batch",
        err?.response?.data?.detail?.toString?.() ?? err?.message,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Batch a month's claims"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={run} disabled={!providerId || busy}>
            {busy ? "Generating…" : "Generate & download XLSX"}
          </Button>
        </div>
      }
    >
      <p className="mb-4 text-sm text-secondary-500">
        Gathers every un-batched draft claim for the payer in the chosen month into one
        submission batch and downloads the workbook most HMOs accept.
      </p>
      <div className="grid grid-cols-2 gap-4">
        <Select label="Payer" value={providerId} onChange={(e) => setProviderId(e.target.value)} options={options} />
        <Input label="Month" type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
      </div>
    </Modal>
  );
}
