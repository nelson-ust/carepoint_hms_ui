import { useState, useEffect } from "react";
import {
  ShieldCheck,
  Plus,
  RotateCcw,
  FileText,
  AlertCircle,
  Clock,
  ExternalLink,
  Search,
  Filter,
} from "lucide-react";
import {
  DxPage,
  DxPageHeader,
  DxPanel,
  DxBadge,
  DxButton,
  DxInput,
  DxMessage,
  type DxBadgeTone,
} from "@/components/dx";
import { complianceApi, type ComplianceRecord } from "../api/compliance.api";

function statusTone(status: string): DxBadgeTone {
  switch (status) {
    case "VALID":
      return "success";
    case "EXPIRED":
      return "danger";
    case "PENDING":
      return "warning";
    default:
      return "neutral";
  }
}

export function ComplianceRecordsPage() {
  const [records, setRecords] = useState<ComplianceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await complianceApi.list();
      setRecords(data.items || []);
    } catch (err: any) {
      setError("Failed to fetch compliance audit records.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Administration" }, { label: "Compliance" }]}
        title="Compliance & Audits"
        subtitle="Maintain legal, safety, and medical certification records for the facility."
        actions={
          <>
            <DxButton icon title="Refresh" onClick={load} isLoading={isLoading}>
              <RotateCcw />
            </DxButton>
            <DxButton variant="primary" leftIcon={<Plus className="h-4 w-4" />}>
              New audit record
            </DxButton>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Compliance scorecard */}
        <div className="lg:col-span-1">
          <DxPanel>
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-lg bg-[var(--dx-success-soft)] text-[var(--dx-success)]">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <h4 className="text-[18px] font-bold text-[var(--dx-text)]">94% Compliant</h4>
            <p className="mt-2 text-[12px] leading-relaxed text-[var(--dx-text-muted)]">
              Your facility is currently meeting most regulatory requirements. 2 items require
              immediate attention.
            </p>
            <div className="mt-6 space-y-3">
              <div
                className="flex items-center gap-3 rounded-md border p-3"
                style={{ background: "var(--dx-danger-soft)", borderColor: "var(--dx-danger)" }}
              >
                <AlertCircle className="h-5 w-5" style={{ color: "var(--dx-danger)" }} />
                <span className="text-[12px] font-semibold" style={{ color: "var(--dx-danger)" }}>
                  Fire Safety Expired
                </span>
              </div>
              <div
                className="flex items-center gap-3 rounded-md border p-3"
                style={{ background: "var(--dx-warning-soft)", borderColor: "var(--dx-warning)" }}
              >
                <Clock className="h-5 w-5" style={{ color: "var(--dx-warning)" }} />
                <span className="text-[12px] font-semibold" style={{ color: "var(--dx-warning)" }}>
                  Radiology License Due
                </span>
              </div>
            </div>
          </DxPanel>
        </div>

        {/* Records list */}
        <div className="space-y-5 lg:col-span-3">
          <div className="flex items-center justify-between gap-3">
            <div className="w-full max-w-sm">
              <DxInput leftIcon={<Search className="h-3.5 w-3.5" />} placeholder="Search audit records…" />
            </div>
            <DxButton leftIcon={<Filter className="h-4 w-4" />}>Filters</DxButton>
          </div>

          {error ? <DxMessage tone="danger">{error}</DxMessage> : null}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => <div key={i} className="dx-skeleton h-44 w-full" />)
            ) : records.length === 0 ? (
              <div className="md:col-span-2">
                <DxPanel>
                  <div className="py-16 text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-[var(--dx-surface-sunken)]">
                      <FileText className="h-8 w-8 text-[var(--dx-text-faint)]" />
                    </div>
                    <h4 className="text-[16px] font-bold text-[var(--dx-text)]">No Records Found</h4>
                    <p className="mt-1 text-[13px] text-[var(--dx-text-muted)]">
                      Upload your first certification or audit record.
                    </p>
                  </div>
                </DxPanel>
              </div>
            ) : (
              records.map((record) => (
                <div
                  key={record.id}
                  className="flex flex-col rounded-lg border border-[var(--dx-border)] bg-[var(--dx-surface)] p-6 transition-colors hover:border-[var(--dx-border-strong)]"
                >
                  <div className="mb-5 flex items-start justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--dx-accent-soft)] text-[var(--dx-accent)]">
                      <FileText className="h-6 w-6" />
                    </div>
                    <DxBadge tone={statusTone(record.status)} dot>
                      {record.status}
                    </DxBadge>
                  </div>
                  <h4 className="text-[15px] font-bold text-[var(--dx-text)]">{record.title}</h4>
                  <p className="mt-1 line-clamp-2 text-[12px] text-[var(--dx-text-muted)]">
                    {record.description}
                  </p>
                  <div className="mt-auto flex items-center justify-between border-t border-[var(--dx-border)] pt-4">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--dx-text-muted)]">
                        Valid Until
                      </span>
                      <span className="text-[12px] font-bold text-[var(--dx-text)]">
                        {record.expiry_date ? new Date(record.expiry_date).toLocaleDateString() : "N/A"}
                      </span>
                    </div>
                    <DxButton icon size="sm" variant="text" title="Open record">
                      <ExternalLink />
                    </DxButton>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </DxPage>
  );
}
