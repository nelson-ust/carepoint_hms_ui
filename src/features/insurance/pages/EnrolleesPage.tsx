import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, ShieldQuestion, Link2 } from "lucide-react";
import {
  DxPage, DxPageHeader, DxPanel, DxButton, DxBadge, DxInput, DxSelect, DxPopup,
  DxGrid, type DxGridColumn, type DxBadgeTone,
} from "@/components/dx";
import { SearchInput } from "@/components/forms/SearchInput";
import { Pagination } from "@/components/data-table/Pagination";
import { useToast } from "@/components/feedback/ToastProvider";
import { hmoApi, type Enrollee } from "../api/hmo.api";

const PAGE_SIZE = 25;

const POLICY_TONES: Record<string, DxBadgeTone> = {
  ACTIVE: "success", EXPIRED: "danger", SUSPENDED: "warning", CANCELLED: "neutral", PENDING: "info",
};
const VERIFY_TONES: Record<string, DxBadgeTone> = {
  VERIFIED: "success", UNVERIFIED: "neutral", EXPIRED: "danger", SUSPENDED: "warning",
};

export function EnrolleesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [providerId, setProviderId] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [verifying, setVerifying] = useState<Enrollee | null>(null);
  const [linking, setLinking] = useState<Enrollee | null>(null);

  const providers = useQuery({ queryKey: ["hmo", "providers"], queryFn: () => hmoApi.listProviders() });
  const enrollees = useQuery({
    queryKey: ["hmo", "enrollees", search, providerId, status, page],
    queryFn: () => hmoApi.listEnrollees({
      search: search || undefined,
      provider_id: providerId ? Number(providerId) : undefined,
      status: status || undefined,
      page, page_size: PAGE_SIZE,
    }),
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["hmo", "enrollees"] });

  const columns: DxGridColumn<Enrollee>[] = [
    { key: "patient_name", header: "Enrollee", render: (r) => (
        <div>
          <div className="font-semibold text-[var(--dx-text)]">{r.patient_name ?? `Patient #${r.patient_id}`}</div>
          <div className="text-[11.5px] text-[var(--dx-text-muted)]">{r.policy_number}{r.member_id ? ` · ${r.member_id}` : ""}</div>
        </div>) },
    { key: "plan_name", header: "Plan", render: (r) => r.plan_name ?? <span className="text-[11.5px] italic text-[var(--dx-text-faint)]">no plan linked</span> },
    { key: "policy_status", header: "Policy", render: (r) => <DxBadge tone={POLICY_TONES[r.policy_status] ?? "neutral"}>{r.policy_status}</DxBadge> },
    { key: "verification_status", header: "Verification", render: (r) => <DxBadge tone={VERIFY_TONES[r.verification_status] ?? "neutral"}>{r.verification_status}</DxBadge> },
    { key: "valid_to", header: "Valid to", render: (r) => r.valid_to ?? "—" },
    { key: "act", header: "", align: "right", render: (r) => (
        <div className="flex justify-end gap-1">
          <DxButton size="sm" variant="default" leftIcon={<BadgeCheck className="h-4 w-4" />} onClick={() => setVerifying(r)}>Verify</DxButton>
          <DxButton size="sm" variant="text" leftIcon={<Link2 className="h-4 w-4" />} onClick={() => setLinking(r)}>Plan</DxButton>
        </div>) },
  ];

  const total = enrollees.data?.total ?? 0;

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Insurance" }, { label: "Enrollees" }]}
        title="Enrollees & Eligibility"
        subtitle="Look an enrollee up, confirm they're covered and capture the authorization code — the front-desk HMO flow."
      />

      <div className="flex flex-wrap items-end gap-2">
        <SearchInput className="w-full sm:w-72" value={search} placeholder="Name, policy or member number…"
          onSearch={(v) => { setSearch(v); setPage(1); }} />
        <DxSelect className="w-full sm:w-56" value={providerId} aria-label="Payer"
          onChange={(e) => { setProviderId(e.target.value); setPage(1); }}
          options={[{ value: "", label: "All payers" }, ...(providers.data ?? []).map((p) => ({ value: String(p.id), label: p.name }))]} />
        <DxSelect className="w-full sm:w-44" value={status} aria-label="Status"
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          options={[{ value: "", label: "All statuses" }, { value: "ACTIVE", label: "Active" }, { value: "EXPIRED", label: "Expired" }, { value: "SUSPENDED", label: "Suspended" }]} />
      </div>

      <DxPanel flush>
        <DxGrid<Enrollee>
          borderless columns={columns} data={enrollees.data?.items} rowKey={(r) => r.id}
          isLoading={enrollees.isLoading}
          error={enrollees.isError ? "Could not load enrollees." : null}
          onRetry={() => enrollees.refetch()}
          empty={{ icon: ShieldQuestion, title: "No enrollees found", description: "Enrollees appear here once patients are registered with insurance. Adjust the search or payer filter." }}
        />
        {total > PAGE_SIZE && (
          <Pagination page={page} pageSize={PAGE_SIZE} totalItems={total} totalPages={Math.ceil(total / PAGE_SIZE)} onPageChange={setPage} />
        )}
      </DxPanel>

      {verifying && (
        <VerifyModal enrollee={verifying} onClose={() => setVerifying(null)} onSaved={() => { setVerifying(null); invalidate(); }} />
      )}
      {linking && (
        <LinkPlanModal enrollee={linking} onClose={() => setLinking(null)} onSaved={() => { setLinking(null); invalidate(); }} />
      )}
    </DxPage>
  );
}

function VerifyModal({ enrollee, onClose, onSaved }: {
  enrollee: Enrollee; onClose: () => void; onSaved: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({ result: "ELIGIBLE", method: "CARD", authorization_code: "", notes: "" });
  const [busy, setBusy] = useState(false);
  return (
    <DxPopup isOpen onClose={onClose} title={`Verify — ${enrollee.patient_name ?? enrollee.policy_number}`} size="md"
      footer={<>
        <DxButton variant="text" onClick={onClose}>Cancel</DxButton>
        <DxButton variant="primary" isLoading={busy} onClick={() => {
          setBusy(true);
          hmoApi.recordEligibility({
            patient_insurance_id: enrollee.id, result: form.result, method: form.method,
            authorization_code: form.authorization_code || undefined, notes: form.notes || undefined,
          }).then(() => { toast.success("Eligibility recorded."); onSaved(); })
            .catch((e) => toast.error(e?.response?.data?.detail ?? "Could not record the check."))
            .finally(() => setBusy(false));
        }}>Record check</DxButton>
      </>}>
      <div className="mb-4 rounded-md bg-[var(--dx-surface-sunken)] p-3 text-[13px]">
        <div className="flex justify-between"><span className="text-[var(--dx-text-muted)]">Policy</span><span className="font-medium text-[var(--dx-text)]">{enrollee.policy_number}</span></div>
        <div className="flex justify-between"><span className="text-[var(--dx-text-muted)]">Plan</span><span className="font-medium text-[var(--dx-text)]">{enrollee.plan_name ?? "—"}</span></div>
        <div className="flex justify-between"><span className="text-[var(--dx-text-muted)]">Valid to</span><span className="font-medium text-[var(--dx-text)]">{enrollee.valid_to ?? "—"}</span></div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <DxSelect label="Result" value={form.result} onChange={(e) => setForm((f) => ({ ...f, result: e.target.value }))}
          options={[{ value: "ELIGIBLE", label: "Eligible" }, { value: "NEEDS_AUTH", label: "Needs authorization" }, { value: "INELIGIBLE", label: "Not eligible" }]} />
        <DxSelect label="How was it checked?" value={form.method} onChange={(e) => setForm((f) => ({ ...f, method: e.target.value }))}
          options={[{ value: "CARD", label: "ID card" }, { value: "PHONE", label: "Phone call" }, { value: "PORTAL", label: "HMO portal" }, { value: "API", label: "API" }]} />
        <div className="sm:col-span-2">
          <DxInput label="Authorization code" value={form.authorization_code}
            onChange={(e) => setForm((f) => ({ ...f, authorization_code: e.target.value }))} placeholder="e.g. AUTH/2026/09123" />
        </div>
        <div className="sm:col-span-2">
          <DxInput label="Notes" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
        </div>
      </div>
    </DxPopup>
  );
}

function LinkPlanModal({ enrollee, onClose, onSaved }: {
  enrollee: Enrollee; onClose: () => void; onSaved: () => void;
}) {
  const toast = useToast();
  const plans = useQuery({ queryKey: ["hmo", "plans-all"], queryFn: () => hmoApi.listPlans() });
  const [planId, setPlanId] = useState("");
  return (
    <DxPopup isOpen onClose={onClose} title={`Link plan — ${enrollee.patient_name ?? enrollee.policy_number}`} size="md"
      footer={<>
        <DxButton variant="text" onClick={onClose}>Cancel</DxButton>
        <DxButton variant="primary" disabled={!planId} onClick={() =>
          hmoApi.linkToPlan(enrollee.id, Number(planId))
            .then(() => { toast.success("Plan linked — coverage rules now apply at billing."); onSaved(); })
            .catch((e) => toast.error(e?.response?.data?.detail ?? "Could not link the plan."))}>Link plan</DxButton>
      </>}>
      <p className="mb-3 flex items-start gap-2 text-[13px] text-[var(--dx-text-muted)]">
        <ShieldQuestion className="mt-0.5 h-4 w-4 shrink-0" />
        The plan drives automatic bill-splitting: tariffs, coverage %, co-pays and pre-auth rules. Only plans from the enrollee's own payer can be linked.
      </p>
      <DxSelect label="Benefit plan" value={planId} onChange={(e) => setPlanId(e.target.value)}
        options={[{ value: "", label: "Select a plan…" }, ...(plans.data ?? []).map((p) => ({ value: String(p.id), label: `${p.provider_name ?? ""} — ${p.name} (${p.coverage_type.replace(/_/g, " ")})` }))]} />
    </DxPopup>
  );
}
