import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format, isValid } from "date-fns";
import { ShieldCheck, ShieldAlert, ShieldX, CreditCard, Building2, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { membershipApi } from "../api/membership.api";

function fmtDate(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  return isValid(d) ? format(d, "MMM d, yyyy") : "—";
}

export function PublicCardVerifyPage() {
  const [params] = useSearchParams();
  const code = params.get("code") || "";
  const hospital = params.get("h") || params.get("hospital") || "";

  const q = useQuery({
    queryKey: ["public-card-verify", code, hospital],
    queryFn: () => membershipApi.publicVerify(code, hospital),
    enabled: !!code,
    retry: false,
  });

  const r = q.data;
  const usable = !!r?.usable;
  const valid = !!r?.valid;

  const tone = q.isError || (r && !valid)
    ? { ring: "bg-rose-100 text-rose-600", Icon: ShieldX, label: "Invalid card" }
    : usable
      ? { ring: "bg-emerald-100 text-emerald-600", Icon: ShieldCheck, label: "Valid & active" }
      : { ring: "bg-amber-100 text-amber-600", Icon: ShieldAlert, label: "Not usable" };

  return (
    <div className="min-h-screen bg-secondary-50/50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-11 w-11 rounded-xl bg-primary-600 text-white grid place-items-center"><CreditCard className="h-5 w-5" /></div>
          <div>
            <h1 className="text-lg font-bold">Membership card verification</h1>
            <p className="text-sm text-secondary-500">Scan result</p>
          </div>
        </div>

        {!code ? (
          <Card className="p-8 text-center text-secondary-500">No card code was provided in the link.</Card>
        ) : q.isLoading ? (
          <Card className="p-10 text-center text-secondary-500">
            <Loader2 className="h-6 w-6 mx-auto animate-spin mb-3" /> Verifying…
          </Card>
        ) : q.isError ? (
          <Card className="p-8 text-center space-y-2">
            <ShieldX className="h-9 w-9 mx-auto text-rose-400" />
            <p className="font-semibold">This card could not be verified.</p>
            <p className="text-sm text-secondary-500">The code or hospital reference may be invalid.</p>
          </Card>
        ) : (
          <Card className="p-0 overflow-hidden">
            <div className={`p-6 flex items-center gap-4 ${usable ? "bg-emerald-50" : valid ? "bg-amber-50" : "bg-rose-50"}`}>
              <div className={`h-14 w-14 rounded-2xl grid place-items-center ${tone.ring}`}>
                <tone.Icon className="h-7 w-7" />
              </div>
              <div>
                <p className="text-lg font-bold">{tone.label}</p>
                <p className="text-sm text-secondary-500">{r?.message}</p>
              </div>
            </div>
            <div className="p-6 space-y-3 text-sm">
              <Row label="Cardholder" value={r?.patient_name || "—"} />
              <Row label="Card number" value={r?.card_number || "—"} mono />
              <Row label="Status" value={r?.status || "—"} />
              <Row label="Valid thru" value={fmtDate(r?.expiry_date)} />
              <Row icon={<Building2 className="h-3.5 w-3.5" />} label="Hospital" value={r?.hospital_name || hospital || "—"} />
            </div>
            <div className="px-6 pb-6">
              <p className="text-[11px] text-secondary-400 flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" /> Verified against the issuing hospital's records. Balance is not shown for privacy.
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function Row({ icon, label, value, mono }: { icon?: React.ReactNode; label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex gap-3">
      <span className="text-secondary-400 w-28 shrink-0 flex items-center gap-1.5">{icon}{label}</span>
      <span className={`font-medium ${mono ? "data-mono tracking-wider" : ""}`}>{value}</span>
    </div>
  );
}
