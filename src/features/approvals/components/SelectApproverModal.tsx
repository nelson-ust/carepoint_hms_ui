import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Send, UserCheck, AlertCircle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { firstStepApprovers } from "../api/approvals.api";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  /** RequestType code, e.g. "SALARY_ADVANCE". */
  requestType: string;
  /** What is being submitted — shown in the dialog. */
  summary?: string;
  /** Called with the selected approver's user id. */
  onConfirm: (approverUserId: number) => void;
  isSubmitting?: boolean;
};

/**
 * Submit-for-approval dialog: the requester picks WHO actions the first
 * approval step, from the users eligible for that step. The selected
 * approver is emailed, and step one is locked to them.
 */
export function SelectApproverModal({ isOpen, onClose, requestType, summary, onConfirm, isSubmitting }: Props) {
  const [approverId, setApproverId] = useState("");

  const info = useQuery({
    queryKey: ["first-step-approvers", requestType],
    queryFn: () => firstStepApprovers(requestType),
    enabled: isOpen && !!requestType,
  });

  const approvers = info.data?.approvers ?? [];
  const noFlow = info.isError;
  const emptyList = info.isSuccess && approvers.length === 0;

  function confirm() {
    if (!approverId) return;
    onConfirm(Number(approverId));
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Submit for Approval" size="md"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
          <Button onClick={confirm} isLoading={isSubmitting} disabled={!approverId || noFlow || emptyList}
            leftIcon={<Send className="h-4 w-4" />}>
            Submit Request
          </Button>
        </div>
      }>
      <div className="space-y-4">
        {summary && (
          <div className="rounded-2xl bg-secondary-50/80 px-4 py-3 text-sm font-semibold text-secondary-700">{summary}</div>
        )}

        {info.isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : noFlow ? (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <p className="text-sm font-bold">
              No approval flow is configured for {requestType}. Configure one under Approvals → Flows & Types.
            </p>
          </div>
        ) : emptyList ? (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100 text-amber-700 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <p className="text-sm font-bold">
              No eligible approvers were found for the first step ({info.data?.step_name || "—"}).
              Ask an administrator to review the flow's approver configuration.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 text-xs text-secondary-500">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary-500/10 text-primary-600"><UserCheck className="h-4 w-4" /></span>
              <span>
                First step: <span className="font-bold text-secondary-800">{info.data?.step_name}</span>
                {info.data?.flow_name ? <> · Flow: <span className="font-bold text-secondary-800">{info.data.flow_name}</span></> : null}
              </span>
            </div>
            <Select
              label="Approver"
              value={approverId}
              onChange={(e) => setApproverId(e.target.value)}
              options={[
                { value: "", label: "— Select who should approve this —" },
                ...approvers.map((a) => ({ value: String(a.user_id), label: `${a.name} (${a.email})` })),
              ]}
            />
            <p className="text-[11px] text-secondary-400 leading-relaxed">
              The selected approver is notified by email and is the only person who can action the first
              step. You'll also get a confirmation email, and updates as the request progresses.
            </p>
          </>
        )}
      </div>
    </Modal>
  );
}
