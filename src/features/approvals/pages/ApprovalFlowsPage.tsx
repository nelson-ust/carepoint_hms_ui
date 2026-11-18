import { useEffect, useState } from "react";
import { GitBranch, Plus, Trash2, Settings as SettingsIcon, Star, Layers, Upload, ChevronDown } from "lucide-react";
import {
  DxPage,
  DxPageHeader,
  DxPanel,
  DxBadge,
  DxButton,
  DxSelect,
  DxSkeleton,
} from "@/components/dx";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { useToast } from "@/components/feedback/ToastProvider";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listRoles } from "@/features/roles/api/roles.api";
import { ApprovalTabs } from "../components/ApprovalTabs";
import { FlowModal } from "../components/FlowModal";
import { RequestTypeModal } from "../components/RequestTypeModal";
import { useRequestTypes, useFlows, useDeleteFlow } from "../hooks/use-approvals";
import type { ApprovalFlow } from "../api/approvals.api";
import {
  downloadRequestTypeTemplate, bulkUploadRequestTypes,
  downloadFlowTemplate, bulkUploadFlows,
  downloadStepTemplate, bulkUploadSteps,
} from "../api/approvals.api";
import { DrugBulkUploadModal } from "@/features/drugs/components/DrugBulkUploadModal";

type BulkEntity = "request-types" | "flows" | "steps";

const BULK_CONFIG: Record<BulkEntity, {
  label: string; title: string; subtitle: string; description: string; importLabel: string;
  download: () => Promise<void>; upload: (file: File) => Promise<any>;
}> = {
  "request-types": {
    label: "Request Types",
    title: "Bulk Upload Request Types",
    subtitle: "Import request types from Excel",
    description: "One row per request type. Code and Name are required; codes are stored in UPPER_SNAKE_CASE.",
    importLabel: "Import Request Types",
    download: downloadRequestTypeTemplate,
    upload: bulkUploadRequestTypes,
  },
  flows: {
    label: "Flows",
    title: "Bulk Upload Approval Flows",
    subtitle: "Import flows from Excel",
    description: "One row per flow. Request Type Code must already exist (create Request Types first). Flow Code is unique within its request type.",
    importLabel: "Import Flows",
    download: downloadFlowTemplate,
    upload: bulkUploadFlows,
  },
  steps: {
    label: "Steps",
    title: "Bulk Upload Approval Steps",
    subtitle: "Import steps from Excel",
    description: "One row per step. Create Request Types and Flows first. Approver Kind is ROLE (fill Role) or DYNAMIC (fill Dynamic Token).",
    importLabel: "Import Steps",
    download: downloadStepTemplate,
    upload: bulkUploadSteps,
  },
};

function FlowsEmpty({ icon: Icon, title, description, action }: {
  icon: any; title: string; description: string; action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <Icon className="h-10 w-10 text-[var(--dx-text-faint)]" aria-hidden />
      <p className="text-sm font-semibold text-[var(--dx-text)]">{title}</p>
      <p className="max-w-sm text-xs text-[var(--dx-text-muted)]">{description}</p>
      {action}
    </div>
  );
}

export function ApprovalFlowsPage() {
  const toast = useToast();
  const types = useRequestTypes();
  const [selectedType, setSelectedType] = useState<string>("");
  const flows = useFlows(selectedType || undefined);
  const del = useDeleteFlow();

  const rolesQuery = useQuery({ queryKey: ["roles", "all-lite"], queryFn: () => listRoles({ limit: 200 }) });
  const roles = (rolesQuery.data?.items ?? []).map((r) => ({ id: r.id, name: r.name, code: r.code }));

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ApprovalFlow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ApprovalFlow | null>(null);
  const [typeModalOpen, setTypeModalOpen] = useState(false);
  const [bulkEntity, setBulkEntity] = useState<BulkEntity | null>(null);
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false);
  const qc = useQueryClient();

  const refreshAfterImport = () => {
    qc.invalidateQueries({ queryKey: ["approvals"] });
    types.refetch();
    flows.refetch();
  };

  useEffect(() => {
    if (!selectedType && (types.data?.length ?? 0) > 0) {
      const payroll = types.data!.find((t) => t.code === "PAYROLL_RUN");
      setSelectedType(payroll ? payroll.code : types.data![0].code);
    }
  }, [types.data, selectedType]);

  const typeFlows = flows.data ?? [];

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Approvals" }, { label: "Flows & Types" }]}
        title="Approval Flows"
        subtitle="Define, per request type, the ordered steps and approvers a request must pass through."
      />
      <ApprovalTabs />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="w-72">
          <DxSelect
            label="Request type"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            options={(types.data ?? []).length === 0
              ? [{ value: "", label: "No request types yet" }]
              : (types.data ?? []).map((t) => ({ value: t.code, label: `${t.name} (${t.code})` }))}
          />
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <DxButton variant="default" leftIcon={<Upload className="h-4 w-4" />} rightIcon={<ChevronDown className="h-4 w-4" />} onClick={() => setBulkMenuOpen((o) => !o)}>
              Bulk Upload
            </DxButton>
            {bulkMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setBulkMenuOpen(false)} />
                <div className="absolute right-0 z-20 mt-2 w-56 rounded-md border border-[var(--dx-border)] bg-[var(--dx-surface)] p-1.5 shadow-xl">
                  {(Object.keys(BULK_CONFIG) as BulkEntity[]).map((key) => (
                    <button
                      key={key}
                      onClick={() => { setBulkEntity(key); setBulkMenuOpen(false); }}
                      className="flex w-full items-center gap-2 rounded px-3 py-2.5 text-left text-sm font-semibold text-[var(--dx-text)] hover:bg-[var(--dx-surface-alt)]"
                    >
                      <Upload className="h-4 w-4 text-[var(--dx-accent)]" />
                      {BULK_CONFIG[key].label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <DxButton variant="default" leftIcon={<Layers className="h-4 w-4" />} onClick={() => setTypeModalOpen(true)}>
            New Request Type
          </DxButton>
          <DxButton variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => { setEditing(null); setModalOpen(true); }} disabled={!selectedType}>
            New Flow
          </DxButton>
        </div>
      </div>

      {(types.data ?? []).length === 0 && !types.isLoading && (
        <DxPanel>
          <FlowsEmpty
            icon={Layers}
            title="No request types found"
            description="Create a request type (e.g. PAYROLL_RUN) to start defining its approval flow."
            action={<DxButton variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setTypeModalOpen(true)}>New Request Type</DxButton>}
          />
        </DxPanel>
      )}

      {flows.isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <DxSkeleton key={i} className="h-28 w-full" />)}</div>
      ) : typeFlows.length === 0 && (types.data ?? []).length > 0 ? (
        <DxPanel>
          <FlowsEmpty icon={GitBranch} title="No flows for this type" description="Create a flow so requests of this type can be routed for approval." />
        </DxPanel>
      ) : (
        <div className="space-y-4">
          {typeFlows.map((f) => (
            <DxPanel key={f.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-[var(--dx-text)]">{f.name}</h3>
                    {f.is_default && <DxBadge tone="success"><Star className="h-3 w-3" /> Default</DxBadge>}
                    {!f.is_active && <DxBadge tone="neutral">Inactive</DxBadge>}
                  </div>
                  <p className="dx-mono mt-1 text-[11px] font-semibold uppercase tracking-widest text-[var(--dx-text-muted)]">{f.code}</p>
                </div>
                <div className="flex items-center gap-1">
                  <DxButton icon size="sm" variant="text" title="Edit" onClick={() => { setEditing(f); setModalOpen(true); }}>
                    <SettingsIcon />
                  </DxButton>
                  <DxButton icon size="sm" variant="outline-danger" title="Delete" onClick={() => setDeleteTarget(f)}>
                    <Trash2 />
                  </DxButton>
                </div>
              </div>
              <ol className="mt-4 flex flex-wrap gap-2">
                {f.steps.map((s) => (
                  <li key={s.step_order} className="flex items-center gap-2 rounded-full border border-[var(--dx-border)] bg-[var(--dx-surface-alt)] px-3 py-1 text-[11px] font-semibold text-[var(--dx-text)]">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--dx-accent)] text-[9px] font-bold text-white">{s.step_order}</span>
                    {s.name}
                    <span className="text-[var(--dx-text-muted)]">· {s.approver_kind}{s.dynamic_token ? `:${s.dynamic_token}` : ""}</span>
                  </li>
                ))}
                {f.steps.length === 0 && <li className="text-xs text-[var(--dx-text-muted)]">No steps.</li>}
              </ol>
            </DxPanel>
          ))}
        </div>
      )}

      {selectedType && (
        <FlowModal isOpen={modalOpen} onClose={() => setModalOpen(false)} requestType={selectedType} roles={roles} flow={editing} />
      )}

      <RequestTypeModal isOpen={typeModalOpen} onClose={() => setTypeModalOpen(false)} onCreated={(code) => setSelectedType(code)} />

      {bulkEntity && (
        <DrugBulkUploadModal
          isOpen={!!bulkEntity}
          onClose={() => setBulkEntity(null)}
          onImported={refreshAfterImport}
          title={BULK_CONFIG[bulkEntity].title}
          subtitle={BULK_CONFIG[bulkEntity].subtitle}
          description={BULK_CONFIG[bulkEntity].description}
          importLabel={BULK_CONFIG[bulkEntity].importLabel}
          download={BULK_CONFIG[bulkEntity].download}
          upload={BULK_CONFIG[bulkEntity].upload}
        />
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          try { await del.mutateAsync(deleteTarget.id); toast.success("Flow deleted", deleteTarget.name); }
          catch { toast.error("Couldn't delete flow", "Please try again."); }
        }}
        title="Delete approval flow?"
        description={deleteTarget ? `"${deleteTarget.name}" will no longer be available for new requests.` : undefined}
        confirmLabel="Delete"
        tone="danger"
      />
    </DxPage>
  );
}
