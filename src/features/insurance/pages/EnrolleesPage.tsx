import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, ShieldQuestion, Link2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { Badge, type BadgeProps } from "@/components/ui/Badge";
import { SearchInput } from "@/components/forms/SearchInput";
import { DataTable, type DataTableColumn } from "@/components/data-table/DataTable";
import { Pagination } from "@/components/data-table/Pagination";
import { useToast } from "@/components/feedback/ToastProvider";
import { hmoApi, type Enrollee } from "../api/hmo.api";

const PAGE_SIZE = 25;

const POLICY_VARIANTS: Record<string, BadgeProps["variant"]> = {
  ACTIVE: "soft-success", EXPIRED: "soft-danger", SUSPENDED: "soft-warning",
  CANCELLED: "secondary", PENDING: "soft-info",
};
const VERIFY_VARIANTS: Record<string, BadgeProps["variant"]> = {
  VERIFIED: "soft-success", UNVERIFIED: "secondary",
  EXPIRED: "soft-danger", SUSPENDED: "soft-warning",
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

  const columns: DataTableColumn<Enrollee>[] = [
    { key: "patient_name", header: "Enrollee", render: (r) => (
        <div>
          <div className="font-semibold text-secondary-900">{r.patient_name ?? `Patient #${r.patient_id}`}</div>
          <div className="text-xs text-secondary-500">
            {r.policy_number}{r.member_id ? ` · ${r.member_id}` : ""}
          </div>
        </div>) },
    { key: "plan_name", header: "Plan", render: (r) => r.plan_name ?? (
        <span className="text-xs italic text-secondary-400">no plan linked</span>) },
    { key: "policy_status", header: "Policy", render: (r) => (
        <Badge variant={POLICY_VARIANTS[r.policy_status] ?? "secondary"}>{r.policy_status}</Badge>) },
    { key: "verification_status", header: "Verification", render: (r) => (
        <Badge variant={VERIFY_VARIANTS[r.verification_status] ?? "secondary"}>{r.verification_status}</Badge>) },
    { key: "valid_to", header: "Valid to", render: (r) => r.valid_to ?? "—" },
    { key: "act", header: "", align: "right", render: (r) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="secondary" onClick={() => setVerifying(r)}>
            <BadgeCheck className="mr-1 h-4 w-4" /> Verify
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setLinking(r)}>
            <Link2 className="mr-1 h-4 w-4" /> Plan
          </Button>
        </div>) },
  ];

  const total = enrollees.data?.total ?? 0;

  return (
    <div>
      <PageHeader title="Enrollees & Eligibility"
        description="Look an enrollee up, confirm they're covered and capture the authorization code — the front-desk HMO flow." />

      <Card className="p-4">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <SearchInput className="w-full sm:w-72" value={search} placeholder="Name, policy or member number…"
            onSearch={(v) => { setSearch(v); setPage(1); }} />
          <Select className="w-full sm:w-56" value={providerId}
            onChange={(e) => { setProviderId(e.target.value); setPage(1); }}
            options={[{ value: "", label: "All payers" },
              ...(providers.data ?? []).map((p) => ({ value: String(p.id), label: p.name }))]} />
          <Select className="w-full sm:w-44" value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            options={[{ value: "", label: "All statuses" },
              { value: "ACTIVE", label: "Active" }, { value: "EXPIRED", label: "Expired" },
              { value: "SUSPENDED", label: "Suspended" }]} />
        </div>

        <DataTable columns={columns} data={enrollees.data?.items} rowKey={(r) => r.id}
          isLoading={enrollees.isLoading}
          error={enrollees.isError ? "Could not load enrollees." : null}
          onRetry={() => enrollees.refetch()}
          empty={{ title: "No enrollees found",
            description: "Enrollees appear here once patients are registered with insurance. Adjust the search or payer filter." }} />
        {total > PAGE_SIZE && (
          <Pagination page={page} pageSize={PAGE_SIZE} totalItems={total}
            totalPages={Math.ceil(total / PAGE_SIZE)} onPageChange={setPage} />
        )}
      </Card>

      {verifying && (
        <VerifyModal enrollee={verifying} onClose={() => setVerifying(null)}
          onSaved={() => { setVerifying(null); invalidate(); }} />
      )}
      {linking && (
        <LinkPlanModal enrollee={linking} onClose={() => setLinking(null)}
          onSaved={() => { setLinking(null); invalidate(); }} />
      )}
    </div>
  );
}

function VerifyModal({ enrollee, onClose, onSaved }: {
  enrollee: Enrollee; onClose: () => void; onSaved: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({ result: "ELIGIBLE", method: "CARD",
    authorization_code: "", notes: "" });
  const [busy, setBusy] = useState(false);
  return (
    <Modal isOpen onClose={onClose}
      title={`Verify — ${enrollee.patient_name ?? enrollee.policy_number}`}
      footer={<div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button disabled={busy} onClick={() => {
          setBusy(true);
          hmoApi.recordEligibility({
            patient_insurance_id: enrollee.id, result: form.result, method: form.method,
            authorization_code: form.authorization_code || undefined,
            notes: form.notes || undefined,
          }).then(() => { toast.success("Eligibility recorded."); onSaved(); })
            .catch((e) => toast.error(e?.response?.data?.detail ?? "Could not record the check."))
            .finally(() => setBusy(false));
        }}>
          {busy ? "Saving…" : "Record check"}
        </Button>
      </div>}>
      <div className="mb-4 rounded-lg bg-secondary-50 p-3 text-sm">
        <div className="flex justify-between"><span>Policy</span>
          <span className="font-medium">{enrollee.policy_number}</span></div>
        <div className="flex justify-between"><span>Plan</span>
          <span className="font-medium">{enrollee.plan_name ?? "—"}</span></div>
        <div className="flex justify-between"><span>Valid to</span>
          <span className="font-medium">{enrollee.valid_to ?? "—"}</span></div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select label="Result" value={form.result}
          onChange={(e) => setForm((f) => ({ ...f, result: e.target.value }))}
          options={[{ value: "ELIGIBLE", label: "Eligible" },
            { value: "NEEDS_AUTH", label: "Needs authorization" },
            { value: "INELIGIBLE", label: "Not eligible" }]} />
        <Select label="How was it checked?" value={form.method}
          onChange={(e) => setForm((f) => ({ ...f, method: e.target.value }))}
          options={[{ value: "CARD", label: "ID card" }, { value: "PHONE", label: "Phone call" },
            { value: "PORTAL", label: "HMO portal" }, { value: "API", label: "API" }]} />
        <Input label="Authorization code" value={form.authorization_code}
          onChange={(e) => setForm((f) => ({ ...f, authorization_code: e.target.value }))}
          placeholder="e.g. AUTH/2026/09123" className="col-span-2" />
        <Input label="Notes" value={form.notes} className="col-span-2"
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
      </div>
    </Modal>
  );
}

function LinkPlanModal({ enrollee, onClose, onSaved }: {
  enrollee: Enrollee; onClose: () => void; onSaved: () => void;
}) {
  const toast = useToast();
  const plans = useQuery({ queryKey: ["hmo", "plans-all"], queryFn: () => hmoApi.listPlans() });
  const [planId, setPlanId] = useState("");
  return (
    <Modal isOpen onClose={onClose}
      title={`Link plan — ${enrollee.patient_name ?? enrollee.policy_number}`}
      footer={<div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button disabled={!planId} onClick={() =>
          hmoApi.linkToPlan(enrollee.id, Number(planId))
            .then(() => { toast.success("Plan linked — coverage rules now apply at billing."); onSaved(); })
            .catch((e) => toast.error(e?.response?.data?.detail ?? "Could not link the plan."))}>
          Link plan
        </Button>
      </div>}>
      <p className="mb-3 flex items-start gap-2 text-sm text-secondary-500">
        <ShieldQuestion className="mt-0.5 h-4 w-4 shrink-0" />
        The plan drives automatic bill-splitting: tariffs, coverage %, co-pays and pre-auth rules.
        Only plans from the enrollee's own payer can be linked.
      </p>
      <Select label="Benefit plan" value={planId} onChange={(e) => setPlanId(e.target.value)}
        options={[{ value: "", label: "Select a plan…" },
          ...(plans.data ?? []).map((p) => ({
            value: String(p.id),
            label: `${p.provider_name ?? ""} — ${p.name} (${p.coverage_type.replace(/_/g, " ")})`,
          }))]} />
    </Modal>
  );
}
