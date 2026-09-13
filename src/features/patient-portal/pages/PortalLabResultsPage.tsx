import { useQuery } from "@tanstack/react-query";
import { Download, FlaskConical } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/feedback/ToastProvider";
import {
  downloadPortalLabReport,
  getPortalLabResults,
  portalErrorMessage,
} from "../api/portal.api";

function fmt(v?: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? v
    : d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

/** Patient portal — released laboratory results with branded PDF downloads. */
export function PortalLabResultsPage() {
  const toast = useToast();
  const [downloading, setDownloading] = useState<number | null>(null);
  const resultsQuery = useQuery({
    queryKey: ["portal", "lab-results"],
    queryFn: getPortalLabResults,
  });
  const orders = resultsQuery.data ?? [];

  const download = async (orderId: number, orderNo: string) => {
    setDownloading(orderId);
    try {
      await downloadPortalLabReport(orderId, orderNo);
      toast.success("Report downloaded", "Your laboratory report PDF has been saved.");
    } catch (err) {
      toast.error("Couldn't download", portalErrorMessage(err, "Please try again."));
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-secondary-900">Lab Results</h1>
        <p className="mt-1 text-sm text-secondary-500">
          Results released by the laboratory appear here. Download the official
          report as a PDF — each report carries a verification code.
        </p>
      </div>

      {resultsQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-3xl" />)}
        </div>
      ) : resultsQuery.isError ? (
        <div className="rounded-3xl border border-rose-100 bg-rose-50 p-6 text-sm font-semibold text-rose-600">
          {portalErrorMessage(resultsQuery.error, "We couldn't load your results — please retry.")}
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-3xl border border-secondary-100 bg-white p-12 text-center">
          <FlaskConical className="mx-auto mb-3 h-10 w-10 text-secondary-200" />
          <p className="font-bold text-secondary-900">No results yet</p>
          <p className="mt-1 text-sm text-secondary-400">
            When the laboratory releases your results, they'll appear here and
            you'll get a notification.
          </p>
        </div>
      ) : (
        orders.map((order) => (
          <div key={order.order_id}
            className="overflow-hidden rounded-3xl border border-secondary-100 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-secondary-100 px-6 py-4">
              <div>
                <p className="data-mono text-sm font-black text-secondary-900">{order.order_no}</p>
                <p className="text-xs text-secondary-400">Requested {fmt(order.ordered_at)}</p>
              </div>
              <Button size="sm" leftIcon={<Download className="h-3.5 w-3.5" />}
                isLoading={downloading === order.order_id}
                onClick={() => download(order.order_id, order.order_no)}>
                Download PDF
              </Button>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] font-black uppercase tracking-widest text-secondary-400">
                  <th className="px-6 py-2.5">Test</th>
                  <th className="px-6 py-2.5">Result</th>
                  <th className="px-6 py-2.5">Reference range</th>
                  <th className="px-6 py-2.5">Released</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-50">
                {order.results.map((r, i) => (
                  <tr key={i}>
                    <td className="px-6 py-3 font-semibold text-secondary-800">{r.test}</td>
                    <td className="data-mono px-6 py-3 font-bold text-secondary-900">
                      {r.result}{r.unit ? ` ${r.unit}` : ""}
                    </td>
                    <td className="px-6 py-3 text-secondary-500">{r.reference_range || "—"}</td>
                    <td className="px-6 py-3 text-secondary-500">{fmt(r.released_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  );
}
