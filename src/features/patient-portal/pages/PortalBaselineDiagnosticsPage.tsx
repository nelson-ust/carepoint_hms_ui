import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  Download,
  Dna,
  Printer,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/feedback/ToastProvider";
import { cn } from "@/lib/utils/cn";
import {
  downloadPortalBaselineReport,
  getPortalBaselineDiagnostics,
  portalErrorMessage,
  type PortalBaselineRecord,
} from "../api/portal.api";

function fmt(v?: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? v
    : d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function StatusPill({ status }: { status: PortalBaselineRecord["verification_status"] }) {
  const map = {
    VERIFIED: {
      label: "Verified",
      cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
      Icon: ShieldCheck,
    },
    RECORDED: {
      label: "On record",
      cls: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
      Icon: CheckCircle2,
    },
    NOT_RECORDED: {
      label: "Not recorded",
      cls: "bg-secondary-500/10 text-secondary-400",
      Icon: CircleDashed,
    },
  }[status];
  const Icon = map.Icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest", map.cls)}>
      <Icon className="h-3 w-3" aria-hidden />
      {map.label}
    </span>
  );
}

function RecordCard({ record }: { record: PortalBaselineRecord }) {
  const [open, setOpen] = useState(false);
  const hasValue = !!record.value;
  return (
    <div className="overflow-hidden rounded-2xl border border-secondary-100 bg-white transition-colors dark:border-white/10 dark:bg-white/5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-widest text-secondary-400">
            {record.label}
          </p>
          <p className={cn("mt-0.5 truncate text-sm font-bold", hasValue ? "text-secondary-900 dark:text-white" : "text-secondary-300")}>
            {record.value || "Not recorded"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <StatusPill status={record.verification_status} />
          <ChevronDown className={cn("h-4 w-4 text-secondary-300 transition-transform", open && "rotate-180")} aria-hidden />
        </div>
      </button>
      {open ? (
        <div className="border-t border-secondary-100 bg-secondary-50/50 px-4 py-3 text-sm dark:border-white/10 dark:bg-white/5">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
            {record.interpretation ? (
              <div className="col-span-2 sm:col-span-4">
                <dt className="text-[10px] font-black uppercase tracking-widest text-secondary-400">Interpretation</dt>
                <dd className="text-secondary-700 dark:text-secondary-200">{record.interpretation}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-[10px] font-black uppercase tracking-widest text-secondary-400">Recorded</dt>
              <dd className="text-secondary-700 dark:text-secondary-200">{fmt(record.recorded_at)}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-black uppercase tracking-widest text-secondary-400">Last updated</dt>
              <dd className="text-secondary-700 dark:text-secondary-200">{fmt(record.updated_at)}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-black uppercase tracking-widest text-secondary-400">Status</dt>
              <dd className="text-secondary-700 dark:text-secondary-200">
                {record.verification_status === "VERIFIED"
                  ? "Verified"
                  : record.verification_status === "RECORDED"
                    ? "On record"
                    : "Not recorded"}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-black uppercase tracking-widest text-secondary-400">Verified / updated by</dt>
              <dd className="text-secondary-700 dark:text-secondary-200">{record.verified_by || "—"}</dd>
            </div>
          </dl>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Patient portal — read-only Baseline Diagnostic Profile with expandable
 * record cards, a branded PDF download and print. Baseline diagnostics are the
 * patient's enduring clinical characteristics, kept separate from
 * visit-specific laboratory investigations.
 */
export function PortalBaselineDiagnosticsPage() {
  const toast = useToast();
  const [downloading, setDownloading] = useState(false);
  const query = useQuery({
    queryKey: ["patient-portal", "baseline-diagnostics"],
    queryFn: getPortalBaselineDiagnostics,
  });
  const data = query.data;
  const ref = useMemo(
    () => data?.patient?.hospital_number || data?.patient?.global_patient_id || "profile",
    [data],
  );
  const categories = (data?.categories ?? []).filter((c) => c.records.length > 0);

  const download = async () => {
    setDownloading(true);
    try {
      await downloadPortalBaselineReport(ref);
      toast.success("Report downloaded", "Your Baseline Diagnostic Profile PDF has been saved.");
    } catch (err) {
      toast.error("Couldn't download", portalErrorMessage(err, "Please try again."));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 print:px-0 print:py-0">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-500/10 text-primary-500">
            <Dna className="h-6 w-6" aria-hidden />
          </span>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-secondary-900 dark:text-white">
              Baseline Diagnostics
            </h1>
            <p className="mt-1 max-w-xl text-sm text-secondary-500 dark:text-secondary-400">
              Your enduring clinical profile — blood group, genotype, allergies,
              chronic conditions and more. Kept separate from visit-specific lab
              results. Read-only.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<Printer className="h-3.5 w-3.5" />}
            onClick={() => window.print()}
          >
            Print
          </Button>
          <Button
            size="sm"
            leftIcon={<Download className="h-3.5 w-3.5" />}
            isLoading={downloading}
            onClick={download}
          >
            Download PDF
          </Button>
        </div>
      </div>

      {data?.patient ? (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-2xl border border-secondary-100 bg-white px-5 py-3 text-xs dark:border-white/10 dark:bg-white/5">
          <span className="font-bold text-secondary-900 dark:text-white">{data.patient.name}</span>
          <span className="text-secondary-400">
            Hospital No: <span className="data-mono text-secondary-600 dark:text-secondary-300">{data.patient.hospital_number || "—"}</span>
          </span>
          <span className="text-secondary-400">
            Patient ID: <span className="data-mono text-secondary-600 dark:text-secondary-300">{data.patient.global_patient_id || "—"}</span>
          </span>
          {data.version ? (
            <span className="text-secondary-400">Version {data.version}</span>
          ) : null}
          <span className="text-secondary-400">Updated {fmt(data.updated_at)}</span>
        </div>
      ) : null}

      {query.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-2xl" />
          ))}
        </div>
      ) : query.isError ? (
        <div className="rounded-3xl border border-rose-100 bg-rose-50 p-6 text-sm font-semibold text-rose-600 dark:border-rose-500/20 dark:bg-rose-500/10">
          {portalErrorMessage(query.error, "We couldn't load your baseline profile — please retry.")}
        </div>
      ) : categories.length === 0 ? (
        <div className="rounded-3xl border border-secondary-100 bg-white p-12 text-center dark:border-white/10 dark:bg-white/5">
          <Dna className="mx-auto mb-3 h-10 w-10 text-secondary-200" />
          <p className="font-bold text-secondary-900 dark:text-white">No baseline diagnostics yet</p>
          <p className="mt-1 text-sm text-secondary-400">
            Your hospital will populate this profile as your baseline clinical
            information is confirmed. You'll be notified when it's updated.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {categories.map((cat) => (
            <section key={cat.name} className="space-y-2">
              <h2 className="px-1 text-xs font-black uppercase tracking-widest text-primary-600 dark:text-primary-300">
                {cat.name}
              </h2>
              <div className="space-y-2">
                {cat.records.map((r) => (
                  <RecordCard key={r.key} record={r} />
                ))}
              </div>
            </section>
          ))}
          <p className="px-1 pt-2 text-xs text-secondary-400">
            This information is read-only. Only authorised healthcare
            professionals can create, update or verify baseline diagnostic
            records. Every view and download is recorded in the audit log.
          </p>
        </div>
      )}
    </div>
  );
}
