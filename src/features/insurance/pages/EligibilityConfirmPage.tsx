import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  ClipboardCheck,
  History,
  RotateCcw,
  ShieldCheck,
  ShieldOff,
  ShieldQuestion,
  Wallet,
} from "lucide-react";
import {
  DxBadge,
  DxButton,
  DxForm,
  DxGrid,
  DxInput,
  DxMessage,
  DxPage,
  DxPageHeader,
  DxPageLoading,
  DxPanel,
  DxProps,
  DxSelect,
  DxSkeleton,
  DxStatusBadge,
  DxStatusBar,
  DxStatusItem,
  DxTextarea,
  DxToolbar,
  DxToolbarGroup,
  DxToolbarSpacer,
  apiErrorMessage,
  formatDate,
  formatDateTime,
  formatNaira,
  humanize,
  type DxGridColumn,
} from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import { routes } from "@/config/routes";
import { advanceVisit, getVisitDetails } from "@/features/visits/api/visits.api";
import { VisitBanner } from "@/features/visits/components/VisitBanner";
import { RoutePatientPopup } from "@/features/visits/components/RoutePatientPopup";
import { nextPathwayStep, patientDisplayName } from "@/features/visits/lib/clinic-flow";
import { hmoApi, type Enrollee, type EligibilityCheck } from "../api/hmo.api";

// ============================================================
// Helpers
// ============================================================

type Eligibility = { eligible: boolean | null; label: string; tone: "success" | "danger" | "warning" | "neutral"; reason: string };

function assessEligibility(e: Enrollee | null, checksThisVisit: EligibilityCheck[]): Eligibility {
  if (!e) return { eligible: null, label: "Self-pay", tone: "neutral", reason: "No insurance enrolment on file for this patient." };
  const latest = checksThisVisit[0];
  if (latest) {
    const r = String(latest.result).toUpperCase();
    if (r === "ELIGIBLE") return { eligible: true, label: "Eligible", tone: "success", reason: `Confirmed ${humanize(latest.method).toLowerCase()} at ${formatDateTime(latest.checked_at)}.` };
    if (r === "INELIGIBLE") return { eligible: false, label: "Not eligible", tone: "danger", reason: "Cover was declined on this visit. Patient pays out-of-pocket unless re-checked." };
    if (r === "NEEDS_AUTH") return { eligible: false, label: "Needs authorisation", tone: "warning", reason: "Awaiting an authorisation code from the HMO." };
  }
  const status = String(e.policy_status).toUpperCase();
  const expired = e.valid_to ? new Date(e.valid_to).getTime() < Date.now() : false;
  if (status !== "ACTIVE") return { eligible: false, label: humanize(e.policy_status), tone: "danger", reason: "Policy is not active." };
  if (expired) return { eligible: false, label: "Expired", tone: "danger", reason: `Policy validity ended ${formatDate(e.valid_to)}.` };
  if (String(e.verification_status).toUpperCase() === "VERIFIED")
    return { eligible: true, label: "Active cover", tone: "success", reason: e.last_verified_at ? `Last verified ${formatDateTime(e.last_verified_at)}. Record today's check to confirm.` : "Record today's check to confirm." };
  return { eligible: null, label: "Unverified", tone: "warning", reason: "Cover has not been confirmed with the payer yet." };
}

const RESULT_OPTIONS = [
  { value: "ELIGIBLE", label: "Eligible — cover confirmed" },
  { value: "NEEDS_AUTH", label: "Needs authorisation" },
  { value: "INELIGIBLE", label: "Not eligible" },
];
const METHOD_OPTIONS = [
  { value: "CARD", label: "ID card" },
  { value: "PHONE", label: "Phone call" },
  { value: "PORTAL", label: "HMO portal" },
  { value: "API", label: "API" },
];

// ============================================================
// Page
// ============================================================

/**
 * HMO / Insurance desk workstation. Confirms the patient's cover before
 * clinical care (coverage %, co-pay, limits), records the eligibility check
 * against the visit, then "Confirm & Route to Triage" advances the pathway.
 */
export function EligibilityConfirmPage(props: { visitId?: number; embedded?: boolean } = {}) {
  const embedded = props.embedded ?? false;
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const { visitId } = useParams<{ visitId: string }>();
  const id = props.visitId ?? Number(visitId);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState({ result: "ELIGIBLE", method: "CARD", authorization_code: "", notes: "" });
  const [routeOpen, setRouteOpen] = useState(false);

  const visitQuery = useQuery({ queryKey: ["visits", "detail", id], queryFn: () => getVisitDetails(id), enabled: Number.isFinite(id) });
  const visit = visitQuery.data ?? null;

  const enrolleesQuery = useQuery({
    queryKey: ["hmo", "enrollees", "patient", visit?.patient_id],
    queryFn: () => hmoApi.listEnrollees({ patient_id: visit!.patient_id, page_size: 50 }),
    enabled: !!visit?.patient_id,
  });
  const checksQuery = useQuery({
    queryKey: ["hmo", "eligibility-checks", "visit", id],
    queryFn: () => hmoApi.listEligibilityChecks({ visit_id: id }),
    enabled: Number.isFinite(id),
  });

  const enrollees = useMemo(() => {
    const items = [...(enrolleesQuery.data?.items ?? [])];
    // Primary + active first.
    return items.sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.policy_status.localeCompare(b.policy_status));
  }, [enrolleesQuery.data]);
  const selected: Enrollee | null = useMemo(
    () => enrollees.find((e) => e.id === selectedId) ?? enrollees[0] ?? null,
    [enrollees, selectedId],
  );
  const checks = useMemo(
    () => [...(checksQuery.data ?? [])].sort((a, b) => new Date(b.checked_at).getTime() - new Date(a.checked_at).getTime()),
    [checksQuery.data],
  );
  const checksForSelected = useMemo(
    () => (selected ? checks.filter((c) => c.patient_insurance_id === selected.id) : []),
    [checks, selected],
  );
  const eligibility = assessEligibility(selected, checksForSelected);
  const nextStep = nextPathwayStep(visit);

  // ---------- Mutations ----------
  const recordMutation = useMutation({
    mutationFn: () =>
      hmoApi.recordEligibility({
        patient_insurance_id: selected!.id,
        result: form.result,
        method: form.method,
        visit_id: id,
        authorization_code: form.authorization_code.trim() || undefined,
        notes: form.notes.trim() || undefined,
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["hmo", "eligibility-checks"] });
      qc.invalidateQueries({ queryKey: ["hmo", "enrollees"] });
      toast.success("Eligibility recorded", `${humanize(res.check.result)} · policy now ${humanize(res.check.verification_status).toLowerCase()}.`);
      setForm((f) => ({ ...f, authorization_code: "", notes: "" }));
    },
    onError: (err) => toast.error("Could not record the check", apiErrorMessage(err)),
  });

  const routeMutation = useMutation({
    mutationFn: () =>
      advanceVisit(id, {
        action: "complete",
        notes: selected
          ? `Insurance desk: ${eligibility.label} (${selected.provider_name ?? "payer"} · ${selected.plan_name ?? "no plan"}).`
          : "Insurance desk: self-pay patient.",
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["visits"] });
      qc.invalidateQueries({ queryKey: ["queue"] });
      toast.success("Patient routed", `${patientDisplayName(visit?.patient)} sent to ${res.visit?.current_service_delivery_point?.name ?? "the next service point"}.`);
      navigate(routes.queues);
    },
    onError: (err) => {
      const msg = apiErrorMessage(err);
      if (/flow steps/i.test(msg)) {
        setRouteOpen(true);
        return;
      }
      toast.error("Could not route patient", msg);
    },
  });

  // ---------- Grids ----------
  const enrolleeColumns: DxGridColumn<Enrollee>[] = [
    { key: "provider_name", header: "Payer", render: (r) => <span className="dx-row-primary">{r.provider_name ?? "—"}</span> },
    { key: "plan_name", header: "Plan", render: (r) => r.plan_name ?? <span className="dx-faint italic">no plan linked</span> },
    { key: "policy_number", header: "Policy no.", render: (r) => <span className="dx-mono">{r.policy_number}</span> },
    { key: "policy_status", header: "Policy", render: (r) => <DxStatusBadge status={r.policy_status} /> },
    { key: "verification_status", header: "Verification", render: (r) => <DxStatusBadge status={r.verification_status} /> },
    { key: "valid_to", header: "Valid to", render: (r) => formatDate(r.valid_to) },
    { key: "is_primary", header: "", width: 70, render: (r) => (r.is_primary ? <DxBadge tone="accent">Primary</DxBadge> : null) },
  ];

  const checkColumns: DxGridColumn<EligibilityCheck>[] = [
    { key: "checked_at", header: "When", width: 140, render: (r) => <span className="dx-mono">{formatDateTime(r.checked_at)}</span> },
    { key: "result", header: "Result", render: (r) => <DxStatusBadge status={r.result} /> },
    { key: "method", header: "Method", render: (r) => humanize(r.method) },
    { key: "authorization_code", header: "Auth code", render: (r) => (r.authorization_code ? <span className="dx-mono">{r.authorization_code}</span> : "—") },
    { key: "notes", header: "Notes", wrap: true, render: (r) => r.notes || "—" },
  ];

  // ---------- Render ----------
  if (!Number.isFinite(id)) {
    const invalid = <DxMessage tone="danger" title="Invalid visit">Open a patient from the HMO desk queue to confirm eligibility.</DxMessage>;
    return embedded ? <div className="space-y-4">{invalid}</div> : <DxPage>{invalid}</DxPage>;
  }
  if (visitQuery.isLoading)
    return embedded ? (
      <div className="space-y-4">
        <DxSkeleton className="h-8 w-48" />
        <DxSkeleton className="h-64 w-full" />
      </div>
    ) : (
      <DxPageLoading label="Loading encounter…" />
    );
  if (visitQuery.isError || !visit) {
    const loadError = (
      <DxMessage tone="danger" title="Could not load the visit" action={<DxButton size="sm" leftIcon={<RotateCcw />} onClick={() => visitQuery.refetch()}>Retry</DxButton>}>
        {apiErrorMessage(visitQuery.error)}
      </DxMessage>
    );
    return embedded ? <div className="space-y-4">{loadError}</div> : <DxPage>{loadError}</DxPage>;
  }

  const EligIcon = eligibility.eligible ? ShieldCheck : eligibility.eligible === false ? ShieldOff : ShieldQuestion;
  const canRoute = !routeMutation.isPending && (eligibility.eligible !== false || !selected);
  const busy = recordMutation.isPending || routeMutation.isPending;

  const Wrapper = embedded ? "div" : DxPage;

  return (
    <Wrapper className={embedded ? "space-y-4" : undefined}>
      {!embedded && (
        <DxPageHeader
          crumbs={[{ label: "Queues", to: routes.queues }, { label: "HMO / Insurance desk" }]}
          title="Eligibility confirmation"
          subtitle="Confirm the patient's cover and co-pay before clinical care, then route them to triage."
          actions={<DxButton leftIcon={<ArrowLeft />} onClick={() => navigate(routes.queues)}>Back to queue</DxButton>}
        />
      )}

      {!embedded && <VisitBanner visit={visit} />}

      <DxToolbar>
        <DxToolbarGroup>
          <DxButton variant="text" leftIcon={<RotateCcw className={enrolleesQuery.isFetching ? "animate-spin" : undefined} />} onClick={() => { enrolleesQuery.refetch(); checksQuery.refetch(); }}>
            Refresh
          </DxButton>
          {!embedded && <Link to={routes.insuranceEnrollees} className="dx-btn dx-btn-text">Enrollee register</Link>}
        </DxToolbarGroup>
        <DxToolbarSpacer />
        {!embedded && (
        <DxToolbarGroup>
          <DxButton
            variant="primary"
            rightIcon={<ArrowRight />}
            disabled={!canRoute}
            isLoading={routeMutation.isPending}
            onClick={() => routeMutation.mutate()}
            title={eligibility.eligible === false ? "Record an eligible check (or switch to self-pay) before routing" : undefined}
          >
            {nextStep ? `Confirm & Route to ${nextStep.service_delivery_point?.name ?? "next step"}` : "Confirm & Route to Triage"}
          </DxButton>
        </DxToolbarGroup>
        )}
      </DxToolbar>

      <div className="grid gap-4 xl:grid-cols-12">
        {/* ---------- Coverage ---------- */}
        <div className="space-y-4 xl:col-span-8">
          <DxPanel title="Insurance enrolments" icon={<Wallet />} description="Select the policy being used for this visit." flush>
            <DxGrid
              columns={enrolleeColumns}
              data={enrollees}
              rowKey={(r) => r.id}
              isLoading={enrolleesQuery.isLoading}
              error={enrolleesQuery.isError ? apiErrorMessage(enrolleesQuery.error, "Could not load enrolments.") : null}
              onRetry={() => enrolleesQuery.refetch()}
              onRowClick={(r) => setSelectedId(r.id)}
              selectedKey={selected?.id ?? null}
              borderless
              empty={{ icon: Wallet, title: "No insurance on file", description: "This patient is self-pay. You can route them straight to triage." }}
            />
          </DxPanel>

          {selected ? (
            <DxPanel title="Coverage terms" icon={<ShieldCheck />} description={`${selected.provider_name ?? "Payer"} · ${selected.plan_name ?? "no plan linked"}`}>
              <div className="grid gap-4 md:grid-cols-2">
                <DxProps
                  tight
                  items={[
                    { label: "Payer", value: selected.provider_name ?? "—" },
                    { label: "Plan", value: selected.plan_name ? <span>{selected.plan_name}{selected.plan_tier ? <DxBadge tone="outline" className="ml-2">{humanize(selected.plan_tier)}</DxBadge> : null}</span> : "—" },
                    { label: "Coverage type", value: humanize(selected.coverage_type) },
                    { label: "Policy no.", value: <span className="dx-mono">{selected.policy_number}</span> },
                    { label: "Member ID", value: selected.member_id ? <span className="dx-mono">{selected.member_id}</span> : "—" },
                    { label: "Relationship", value: selected.principal_patient_insurance_id ? humanize(selected.relationship_to_principal ?? "dependent") : "Principal" },
                  ]}
                />
                <DxProps
                  tight
                  items={[
                    { label: "Covered by HMO", value: selected.coverage_percent != null ? <b>{selected.coverage_percent}%</b> : "—" },
                    { label: "Patient co-pay", value: selected.copay_percent != null || selected.copay_flat ? <b>{[selected.copay_percent != null ? `${selected.copay_percent}%` : null, selected.copay_flat ? formatNaira(selected.copay_flat) : null].filter(Boolean).join(" + ")}</b> : "—" },
                    { label: "Annual limit", value: selected.annual_limit != null ? formatNaira(selected.annual_limit) : "—" },
                    { label: "Per-visit limit", value: selected.per_visit_limit != null ? formatNaira(selected.per_visit_limit) : "—" },
                    { label: "Validity", value: `${formatDate(selected.valid_from)} → ${formatDate(selected.valid_to)}` },
                    { label: "Referral required", value: selected.requires_referral ? <DxBadge tone="warning">Yes</DxBadge> : "No" },
                  ]}
                />
              </div>
            </DxPanel>
          ) : null}
        </div>

        {/* ---------- Verdict + record check ---------- */}
        <div className="space-y-4 xl:col-span-4">
          <DxPanel title="Eligibility" icon={<BadgeCheck />}>
            <div className="flex items-start gap-3">
              <span
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded border"
                style={{
                  borderColor: `var(--dx-${eligibility.tone === "neutral" ? "border-strong" : eligibility.tone})`,
                  background: `var(--dx-${eligibility.tone === "neutral" ? "surface-alt" : `${eligibility.tone}-soft`})`,
                  color: `var(--dx-${eligibility.tone === "neutral" ? "text-muted" : eligibility.tone})`,
                }}
              >
                <EligIcon className="h-6 w-6" aria-hidden />
              </span>
              <div className="min-w-0">
                <DxBadge tone={eligibility.tone} className="h-6 px-2.5 text-[12px]">{eligibility.label}</DxBadge>
                <p className="mt-1.5 text-[12px] text-[var(--dx-text-muted)]">{eligibility.reason}</p>
              </div>
            </div>
            {!selected ? (
              <DxMessage tone="info" className="mt-3">
                Self-paying patients skip this step — route them straight to triage.
              </DxMessage>
            ) : null}
          </DxPanel>

          {selected ? (
            <DxPanel
              title="Record today's check"
              icon={<ClipboardCheck />}
              footer={
                <DxButton variant="primary" leftIcon={<BadgeCheck />} isLoading={recordMutation.isPending} disabled={busy} onClick={() => recordMutation.mutate()}>
                  Record check
                </DxButton>
              }
            >
              <DxForm cols={1}>
                <DxSelect label="Result" required options={RESULT_OPTIONS} value={form.result} onChange={(e) => setForm((f) => ({ ...f, result: e.target.value }))} disabled={busy} />
                <DxSelect label="How was it checked?" options={METHOD_OPTIONS} value={form.method} onChange={(e) => setForm((f) => ({ ...f, method: e.target.value }))} disabled={busy} />
                <DxInput
                  label="Authorisation code"
                  mono
                  placeholder="e.g. AUTH/2026/09123"
                  value={form.authorization_code}
                  onChange={(e) => setForm((f) => ({ ...f, authorization_code: e.target.value }))}
                  required={form.result === "NEEDS_AUTH"}
                  hint={form.result === "NEEDS_AUTH" ? "Enter the code once the HMO issues it." : undefined}
                  disabled={busy}
                />
                <DxTextarea label="Notes" rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} disabled={busy} />
              </DxForm>
            </DxPanel>
          ) : null}

          <DxPanel title="Checks on this visit" icon={<History />} flush description={checks.length ? `${checks.length} recorded` : undefined}>
            <DxGrid
              columns={checkColumns}
              data={checks}
              rowKey={(r) => r.id}
              isLoading={checksQuery.isLoading}
              error={checksQuery.isError ? apiErrorMessage(checksQuery.error, "Could not load checks.") : null}
              onRetry={() => checksQuery.refetch()}
              borderless
              maxHeight={260}
              empty={{ title: "No checks yet", description: "Record the first eligibility check for this visit." }}
            />
          </DxPanel>
        </div>
      </div>

      <DxStatusBar>
        <DxStatusItem>Visit <b className="dx-mono">{visit.visit_code}</b></DxStatusItem>
        <DxStatusItem>Enrolments: <b>{enrollees.length}</b></DxStatusItem>
        <DxStatusItem>Verdict: <b>{eligibility.label}</b></DxStatusItem>
        <span className="ml-auto">{nextStep ? `Next checkpoint: ${nextStep.service_delivery_point?.name}` : "No pathway — destination chosen on route"}</span>
      </DxStatusBar>

      {!embedded && (
        <RoutePatientPopup
          visit={visit}
          isOpen={routeOpen}
          onClose={() => setRouteOpen(false)}
          preferType="TRIAGE"
          intro="This visit has no care pathway. Choose where the patient goes next (Triage is pre-selected)."
          defaultReason="Routed from the HMO / insurance desk"
          onRouted={() => navigate(routes.queues)}
        />
      )}
    </Wrapper>
  );
}
