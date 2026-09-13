import { useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ShieldCheck, Check, X, HeartPulse, Building2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Skeleton } from "@/components/ui/Skeleton";
import { medicalAccessApi, type AccessRequest } from "../api/medicalAccess.api";

function fmt(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString();
}

export function PatientDecisionPage() {
  const { token = "" } = useParams();
  const [reason, setReason] = useState("");
  const [done, setDone] = useState<null | "APPROVED" | "DECLINED">(null);

  const q = useQuery({
    queryKey: ["mra-patient", token],
    queryFn: () => medicalAccessApi.viewAsPatient(token),
    retry: false,
  });

  const decide = useMutation({
    mutationFn: (approve: boolean) => medicalAccessApi.patientDecision(token, approve, reason || undefined),
    onSuccess: (r: AccessRequest) => setDone(r.patient_decision as any),
  });

  const req = q.data;
  const alreadyDecided = req && req.patient_decision !== "PENDING";
  const closed = req && !["PENDING"].includes(req.status);

  return (
    <div className="min-h-screen bg-secondary-50/50 flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-11 w-11 rounded-xl bg-primary-600 text-white grid place-items-center"><HeartPulse className="h-5 w-5" /></div>
          <div>
            <h1 className="text-lg font-bold">Medical records access request</h1>
            <p className="text-sm text-secondary-500">Your explicit approval is required.</p>
          </div>
        </div>

        {q.isLoading ? (
          <Card className="p-6"><Skeleton className="h-40 w-full" /></Card>
        ) : q.isError || !req ? (
          <Card className="p-8 text-center space-y-2">
            <X className="h-8 w-8 mx-auto text-rose-400" />
            <p className="font-semibold">This request link is invalid or has expired.</p>
            <p className="text-sm text-secondary-500">Please contact the hospital that sent it.</p>
          </Card>
        ) : done ? (
          <Card className="p-8 text-center space-y-3">
            <div className={`h-14 w-14 mx-auto rounded-2xl grid place-items-center ${done === "APPROVED" ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"}`}>
              {done === "APPROVED" ? <Check className="h-7 w-7" /> : <X className="h-7 w-7" />}
            </div>
            <p className="font-semibold text-lg">You {done === "APPROVED" ? "approved" : "declined"} this request.</p>
            <p className="text-sm text-secondary-500">
              {done === "APPROVED"
                ? "Access is granted only once your primary hospital also approves (if required). A secure, one-time, read-only link is then issued to the requesting hospital."
                : "No records will be shared. Thank you for letting us know."}
            </p>
          </Card>
        ) : (
          <Card className="p-6 space-y-5">
            <div className="space-y-3 text-sm">
              <Row icon={<Building2 className="h-4 w-4" />} label="Requesting party" value={req.requester_name} />
              <Row label="Patient" value={req.patient_display_name || req.patient_global_id} />
              <Row label="Records requested" value={req.scope.replace(/_/g, " ")} />
              <Row label="Reason" value={req.reason} />
              <Row label="Requested at" value={fmt(req.requested_at)} />
            </div>

            {closed || alreadyDecided ? (
              <div className="rounded-xl bg-secondary-100 p-4 text-sm text-secondary-600">
                This request has already been {(alreadyDecided ? req!.patient_decision : req!.status).toLowerCase()} and can no longer be changed.
              </div>
            ) : (
              <>
                <Textarea label="Add a note (optional)" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
                <div className="flex gap-3">
                  <Button className="flex-1" isLoading={decide.isPending} leftIcon={<Check className="h-4 w-4" />} onClick={() => decide.mutate(true)}>Approve</Button>
                  <Button className="flex-1" variant="danger" isLoading={decide.isPending} leftIcon={<X className="h-4 w-4" />} onClick={() => decide.mutate(false)}>Decline</Button>
                </div>
                <p className="text-[11px] text-secondary-400 flex items-center gap-1.5 justify-center">
                  <ShieldCheck className="h-3.5 w-3.5" /> Your medical records are never shared without your approval.
                </p>
              </>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}

function Row({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <span className="text-secondary-400 w-36 shrink-0 flex items-center gap-1.5">{icon}{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
