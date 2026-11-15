// carepoint_hms_ui/src/features/saas-dashboard/pages/SupportAccessPage.tsx
import { useState, useEffect } from "react";
import {
  ShieldCheck,
  Clock,
  RefreshCw,
  Plus,
  Lock,
  User,
} from "lucide-react";
import {
  DxBadge,
  DxButton,
  DxConfirm,
  DxForm,
  DxGrid,
  DxInput,
  DxMessage,
  DxPage,
  DxPageHeader,
  DxPanel,
  DxPopup,
  DxProps,
  DxSelect,
  DxStatusBadge,
  DxTextarea,
  apiErrorMessage,
  type DxGridColumn,
} from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import {
  useAllSupportGrants,
  useRevokeSupportGrant,
  useRequestSupportAccess,
  useApproveSupportGrant,
} from "../hooks/use-support-access";
import { listTenants, type Tenant } from "@/features/tenants/api/tenants.api";
import { format } from "date-fns";
import type { SupportGrant } from "../api/support-access.api";

export function SupportAccessPage() {
  const toast = useToast();
  const { data, isLoading, refetch } = useAllSupportGrants();
  const revokeMutation = useRevokeSupportGrant();
  const requestMutation = useRequestSupportAccess();
  const approveMutation = useApproveSupportGrant();

  const grants: SupportGrant[] = (Array.isArray(data) ? data : (data as any)?.items) || [];

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isLoadingTenants, setIsLoadingTenants] = useState(false);

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: "approve" | "revoke";
    grantId: number | null;
  }>({ isOpen: false, type: "approve", grantId: null });

  const [selectedGrant, setSelectedGrant] = useState<SupportGrant | null>(null);

  const [formData, setFormData] = useState({
    tenant_id: "",
    reason: "",
    valid_hours: 4,
    permissions: ["super_admin"],
  });
  const [formError, setFormError] = useState<string | null>(null);

  const handleActionClick = (type: "approve" | "revoke", grantId: number) =>
    setConfirmModal({ isOpen: true, type, grantId });

  const handleConfirmAction = async () => {
    if (!confirmModal.grantId) return;
    try {
      if (confirmModal.type === "approve") {
        await approveMutation.mutateAsync(confirmModal.grantId);
        toast.success("Support access grant approved.");
      } else {
        await revokeMutation.mutateAsync(confirmModal.grantId);
        toast.success("Support access grant revoked.");
      }
      setConfirmModal({ isOpen: false, type: "approve", grantId: null });
    } catch (err) {
      toast.error(apiErrorMessage(err) || `Failed to ${confirmModal.type} grant.`);
      setConfirmModal({ isOpen: false, type: "approve", grantId: null });
    }
  };

  useEffect(() => {
    if (isModalOpen) {
      const fetchTenants = async () => {
        setIsLoadingTenants(true);
        try {
          const res = await listTenants({ page: 1, page_size: 200 });
          setTenants(res.tenants || []);
        } catch (err) {
          console.error("Failed to fetch tenants", err);
        } finally {
          setIsLoadingTenants(false);
        }
      };
      fetchTenants();
    }
  }, [isModalOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!formData.tenant_id) return setFormError("Please select a tenant.");
    if (formData.reason.length < 10) return setFormError("Reason must be at least 10 characters.");

    try {
      await requestMutation.mutateAsync({
        tenant_id: Number(formData.tenant_id),
        reason: formData.reason,
        valid_hours: formData.valid_hours,
        permissions: formData.permissions,
      });
      toast.success("Support access grant requested.");
      setIsModalOpen(false);
      setFormData({ tenant_id: "", reason: "", valid_hours: 4, permissions: ["super_admin"] });
    } catch (err) {
      setFormError(apiErrorMessage(err) || "Failed to request access grant. Please try again.");
    }
  };

  const columns: DxGridColumn<SupportGrant>[] = [
    {
      key: "reason",
      header: "Engineer / reason",
      minWidth: 260,
      render: (g) => (
        <div className="flex items-center gap-3">
          <span className="h-9 w-9 rounded-[var(--dx-radius)] bg-[var(--dx-surface-alt)] border border-[var(--dx-border)] flex items-center justify-center text-[var(--dx-text-muted)]">
            <User className="h-4 w-4" />
          </span>
          <div>
            <p className="font-medium text-[var(--dx-text)] truncate max-w-[240px]">{g.reason}</p>
            <p className="text-[11px] text-[var(--dx-text-muted)]">
              ID #{g.id} · {format(new Date(g.valid_from), "MMM d")}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: 130,
      accessor: (g) => g.status,
      render: (g) => <DxStatusBadge status={g.status} />,
    },
    {
      key: "expiry",
      header: "Expiry",
      width: 170,
      render: (g) => (
        <span className="inline-flex items-center gap-1.5 text-[var(--dx-text)]">
          <Clock className="h-3.5 w-3.5 text-[var(--dx-text-muted)]" />
          {format(new Date(g.valid_until), "MMM d, HH:mm")}
        </span>
      ),
    },
    {
      key: "action",
      header: "Action",
      align: "right",
      width: 140,
      render: (g) =>
        g.status === "APPROVED" ? (
          <DxButton
            size="sm"
            variant="outline-danger"
            isLoading={revokeMutation.isPending}
            onClick={() => handleActionClick("revoke", g.id)}
          >
            Revoke
          </DxButton>
        ) : g.status === "REQUESTED" ? (
          <DxButton
            size="sm"
            variant="primary"
            isLoading={approveMutation.isPending}
            onClick={() => handleActionClick("approve", g.id)}
          >
            Approve
          </DxButton>
        ) : (
          <DxButton size="sm" variant="text" onClick={() => setSelectedGrant(g)}>
            Details
          </DxButton>
        ),
    },
  ];

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "SaaS admin" }, { label: "Support access" }]}
        title="Support access"
        subtitle="Manage and monitor temporary access grants provided to platform support engineers."
        actions={
          <>
            <DxButton leftIcon={<RefreshCw className={isLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />} onClick={() => refetch()}>
              Refresh
            </DxButton>
            <DxButton variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setIsModalOpen(true)}>
              New access grant
            </DxButton>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <DxPanel className="lg:col-span-2" title="Recent access grants" flush>
          <DxGrid
            borderless
            columns={columns}
            data={grants}
            rowKey={(g) => g.id}
            isLoading={isLoading}
            onRowClick={(g) => setSelectedGrant(g)}
            empty={{ icon: ShieldCheck, title: "No grants", description: "No recent support grants." }}
          />
        </DxPanel>

        <DxMessage tone="danger" title="Security protocol">
          Granting support access allows authorized engineers to view tenant data for
          troubleshooting. All actions are logged and audited, and access automatically expires
          after the granted duration.
          <span className="block mt-2 text-[var(--dx-text-muted)]">
            • Only grant access when requested by support
            <br />• Revoke immediately after issue resolution
          </span>
        </DxMessage>
      </div>

      {/* Grant details */}
      <DxPopup
        isOpen={!!selectedGrant}
        onClose={() => setSelectedGrant(null)}
        title="Support access details"
        size="md"
        footer={
          <DxButton onClick={() => setSelectedGrant(null)}>Close</DxButton>
        }
      >
        {selectedGrant && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="h-10 w-10 rounded-[var(--dx-radius)] bg-[var(--dx-surface-alt)] border border-[var(--dx-border)] flex items-center justify-center text-[var(--dx-text-muted)]">
                  <User className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-[11px] text-[var(--dx-text-muted)] uppercase tracking-wide">Support engineer</p>
                  <p className="font-semibold text-[var(--dx-text)]">Admin ID #{selectedGrant.saas_admin_id}</p>
                </div>
              </div>
              <DxStatusBadge status={selectedGrant.status} />
            </div>

            <DxProps
              items={[
                { label: "Valid from", value: format(new Date(selectedGrant.valid_from), "MMM d, yyyy HH:mm") },
                { label: "Valid until", value: format(new Date(selectedGrant.valid_until), "MMM d, yyyy HH:mm") },
                {
                  label: "Approved at",
                  value: selectedGrant.approved_at
                    ? format(new Date(selectedGrant.approved_at), "MMM d, HH:mm")
                    : "N/A",
                },
                { label: "Grant ID", value: `#${selectedGrant.id}` },
              ]}
            />

            <div>
              <p className="dx-field-label mb-1">Access reason</p>
              <p className="rounded-[var(--dx-radius)] border border-[var(--dx-border)] bg-[var(--dx-surface-alt)] p-3 text-[var(--dx-text)] italic">
                “{selectedGrant.reason}”
              </p>
            </div>

            <div>
              <p className="dx-field-label mb-1">Permissions granted</p>
              <div className="flex flex-wrap gap-1.5">
                {selectedGrant.permissions.actions.map((action) => (
                  <DxBadge key={action} tone="accent">
                    <ShieldCheck className="h-3 w-3" />
                    {action}
                  </DxBadge>
                ))}
              </div>
            </div>
          </div>
        )}
      </DxPopup>

      {/* New grant */}
      <DxPopup
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Request support access"
        size="md"
        footer={
          <>
            <DxButton type="button" onClick={() => setIsModalOpen(false)}>
              Cancel
            </DxButton>
            <DxButton
              type="submit"
              form="support-grant-form"
              variant="primary"
              leftIcon={<Lock className="h-4 w-4" />}
              isLoading={requestMutation.isPending}
            >
              Grant access
            </DxButton>
          </>
        }
      >
        <form id="support-grant-form" onSubmit={handleSubmit}>
          <DxForm cols={2}>
            <DxSelect
              label="Target tenant"
              required
              fieldClassName="dx-col-span-full"
              value={formData.tenant_id}
              onChange={(e) => setFormData({ ...formData, tenant_id: e.target.value })}
              hint={isLoadingTenants ? "Loading tenants…" : undefined}
              options={[
                { value: "", label: "Select a hospital" },
                ...tenants.map((t) => ({ value: String(t.id), label: `${t.name} (${t.code})` })),
              ]}
            />
            <DxTextarea
              label="Reason for access"
              required
              fieldClassName="dx-col-span-full"
              rows={3}
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              placeholder="Detailed explanation for the support request…"
              hint={`Min. 10 characters. Current: ${formData.reason.length}`}
            />
            <DxInput
              label="Valid for (hours)"
              type="number"
              min={1}
              max={48}
              required
              value={formData.valid_hours}
              onChange={(e) => setFormData({ ...formData, valid_hours: Number(e.target.value) })}
            />
            <DxSelect
              label="Permissions"
              required
              value={formData.permissions[0]}
              onChange={(e) => setFormData({ ...formData, permissions: [e.target.value] })}
              options={[
                { value: "super_admin", label: "Super admin" },
                { value: "read_only", label: "Read only" },
                { value: "billing_only", label: "Billing only" },
              ]}
            />
          </DxForm>
          {formError && (
            <DxMessage tone="danger" className="mt-4">
              {formError}
            </DxMessage>
          )}
        </form>
      </DxPopup>

      {/* Confirm approve / revoke */}
      <DxConfirm
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={handleConfirmAction}
        title={confirmModal.type === "approve" ? "Approve access grant?" : "Revoke access grant?"}
        description={
          confirmModal.type === "approve"
            ? "This will allow the engineer to access the tenant environment."
            : "The engineer will immediately lose all access permissions."
        }
        confirmLabel={confirmModal.type === "approve" ? "Confirm approval" : "Confirm revoke"}
        tone={confirmModal.type === "approve" ? "primary" : "danger"}
      />
    </DxPage>
  );
}
