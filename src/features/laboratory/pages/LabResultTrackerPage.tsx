import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, Download, FileText, RefreshCw } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { SearchInput } from "@/components/forms/SearchInput";
import { useToast } from "@/components/feedback/ToastProvider";
import {
  trackLabOrders,
  downloadLabReport,
  type LabTrackRow,
} from "../api/lab-orders.api";

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "ORDERED", label: "Ordered" },
  { value: "SAMPLE_COLLECTED", label: "Sample collected" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "RESULT_READY", label: "Result ready" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

function orderStatusVariant(status: string) {
  switch (status) {
    case "COMPLETED":
    case "RESULT_READY":
      return "soft-success" as const;
    case "IN_PROGRESS":
    case "SAMPLE_COLLECTED":
      return "soft-info" as const;
    case "CANCELLED":
      return "soft-danger" as const;
    default:
      return "soft-warning" as const;
  }
}

function resultStatusVariant(status: string) {
  switch (status) {
    case "RELEASED":
      return "success" as const;
    case "VERIFIED":
      return "info" as const;
    case "ENTERED":
      return "warning" as const;
    case "CANCELLED":
      return "destructive" as const;
    default:
      return "outline" as const;
  }
}

function fmt(dt: string | null): string {
  if (!dt) return "—";
  const d = new Date(dt);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

/**
 * Hospital-wide Lab Result Tracker.
 *
 * Any authorised staff member — doctor, receptionist, nurse or laboratory
 * scientist — can look up laboratory orders across visits by order number,
 * patient name or hospital number, watch each test move through the lab
 * lifecycle, and download the branded report the moment results are released.
 */
export function LabResultTrackerPage() {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [downloading, setDownloading] = useState<number | null>(null);

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["lab-track", query, status],
    queryFn: () => trackLabOrders({ query, status, limit: 100 }),
    placeholderData: (prev) => prev,
  });

  const rows: LabTrackRow[] = useMemo(() => data?.items ?? [], [data]);

  const handleDownload = async (row: LabTrackRow) => {
    setDownloading(row.order_id);
    try {
      await downloadLabReport(row.order_id, row.order_no);
    } catch {
      toast.error(
        "Report unavailable",
        "The report can be downloaded once the laboratory releases results for this order.",
      );
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Laboratory"
        title="Lab Result Tracker"
        description="Track laboratory orders across the hospital and download released reports."
        actions={
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`mr-1 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1">
            <SearchInput
              value={query}
              onSearch={setQuery}
              placeholder="Search by order number, patient name or hospital number…"
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-11 rounded-xl border border-secondary-200 bg-white px-3 text-sm font-medium text-secondary-700 focus:border-primary-400 focus:outline-none"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {isFetching && rows.length === 0 ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={ClipboardList}
            title="No lab orders found"
            description="Try a different order number, patient name or hospital number."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {rows.map((row) => (
            <Card key={row.order_id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-primary-700">
                      {row.order_no}
                    </span>
                    <Badge variant={orderStatusVariant(row.status)}>
                      {row.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <div className="mt-1 text-base font-bold text-secondary-900">
                    {row.patient_name}
                    {row.hospital_number ? (
                      <span className="ml-2 font-mono text-xs font-medium text-secondary-500">
                        {row.hospital_number}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-0.5 text-xs text-secondary-500">
                    Ordered {fmt(row.ordered_at)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {row.visit_id ? (
                    <Link to={`/visits/${row.visit_id}`}>
                      <Button variant="ghost" size="sm">
                        <FileText className="mr-1 h-4 w-4" />
                        Visit
                      </Button>
                    </Link>
                  ) : null}
                  <Button
                    variant={row.report_available ? "primary" : "outline"}
                    size="sm"
                    disabled={!row.report_available || downloading === row.order_id}
                    onClick={() => handleDownload(row)}
                    title={
                      row.report_available
                        ? "Download the branded lab report (PDF)"
                        : "Report becomes available once results are released"
                    }
                  >
                    <Download className="mr-1 h-4 w-4" />
                    {downloading === row.order_id ? "Preparing…" : "Report"}
                  </Button>
                </div>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-secondary-400">
                      <th className="pb-2 font-semibold">Test</th>
                      <th className="pb-2 font-semibold">Order stage</th>
                      <th className="pb-2 font-semibold">Result</th>
                      <th className="pb-2 font-semibold">Released</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-secondary-100">
                    {row.items.map((it) => (
                      <tr key={it.item_id}>
                        <td className="py-2 font-medium text-secondary-800">{it.test}</td>
                        <td className="py-2 text-secondary-600">
                          {it.item_status.replace(/_/g, " ")}
                        </td>
                        <td className="py-2">
                          <Badge variant={resultStatusVariant(it.result_status)}>
                            {it.result_status}
                          </Badge>
                        </td>
                        <td className="py-2 text-secondary-500">{fmt(it.released_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
