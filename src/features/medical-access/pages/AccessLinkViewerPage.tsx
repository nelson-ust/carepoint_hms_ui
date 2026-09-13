import { useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { Lock, FileText, ShieldCheck, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { medicalAccessApi, type MedicalRecord } from "../api/medicalAccess.api";
import { RecordView } from "./RecordView";

export function AccessLinkViewerPage() {
  const { token = "" } = useParams();
  const [data, setData] = useState<MedicalRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  const consume = useMutation({
    mutationFn: () => medicalAccessApi.consumeLink(token),
    onSuccess: (d) => setData(d),
    onError: (e: any) => setError(medicalAccessApi.errMsg(e, "This link is invalid, used, or expired.")),
  });

  return (
    <div className="min-h-screen bg-secondary-50/50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-11 w-11 rounded-xl bg-primary-600 text-white grid place-items-center"><Lock className="h-5 w-5" /></div>
          <div>
            <h1 className="text-lg font-bold">Secure medical records</h1>
            <p className="text-sm text-secondary-500">One-time, read-only access.</p>
          </div>
        </div>

        {error ? (
          <Card className="p-10 text-center space-y-2">
            <AlertTriangle className="h-8 w-8 mx-auto text-amber-500" />
            <p className="font-semibold">{error}</p>
            <p className="text-sm text-secondary-500">For security, each link works only once and expires automatically.</p>
          </Card>
        ) : data ? (
          <Card className="p-6">
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 mb-5 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" /> Access granted. This link is now spent and will not open again.
            </div>
            <RecordView data={data} />
          </Card>
        ) : (
          <Card className="p-10 text-center space-y-4 max-w-lg mx-auto">
            <div className="h-14 w-14 mx-auto rounded-2xl bg-primary-100 text-primary-600 grid place-items-center"><FileText className="h-7 w-7" /></div>
            <p className="font-semibold text-lg">Reveal the patient's records</p>
            <p className="text-sm text-secondary-500">
              This is a one-time link. Opening it will consume the access and it cannot be reopened.
              Make sure you're ready before continuing.
            </p>
            <Button isLoading={consume.isPending} leftIcon={<Lock className="h-4 w-4" />} onClick={() => consume.mutate()}>
              Reveal records (one-time)
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
