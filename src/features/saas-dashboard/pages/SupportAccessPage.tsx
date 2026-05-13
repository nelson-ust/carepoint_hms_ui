// carepoint_hms_ui/src/features/saas-dashboard/pages/SupportAccessPage.tsx

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  ShieldCheck,
  ShieldAlert,
  Clock,
  MoreHorizontal,
  RefreshCw,
  Plus,
  Lock,
  Unlock,
  User,
  History,
  CheckCircle2,
  XCircle,
  Loader2,
  Building2,
  AlertTriangle,
} from "lucide-react";
import {
  useAllSupportGrants,
  useRevokeSupportGrant,
  useRequestSupportAccess,
  useApproveSupportGrant
} from "../hooks/use-support-access";
import { listTenants, type Tenant } from "@/features/tenants/api/tenants.api";
import { format } from "date-fns";
import { Modal } from "@/components/ui/Modal";
import type { SupportGrant } from "../api/support-access.api";

export function SupportAccessPage() {
  const { data, isLoading, error, refetch } = useAllSupportGrants();
  const revokeMutation = useRevokeSupportGrant();
  const requestMutation = useRequestSupportAccess();
  const approveMutation = useApproveSupportGrant();

  const grants = Array.isArray(data) ? data : data?.items || [];

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isLoadingTenants, setIsLoadingTenants] = useState(false);

  // Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: "approve" | "revoke";
    grantId: number | null;
  }>({ isOpen: false, type: "approve", grantId: null });

  // Details Modal State
  const [selectedGrant, setSelectedGrant] = useState<SupportGrant | null>(null);

  const [formData, setFormData] = useState({
    tenant_id: "",
    reason: "",
    valid_hours: 4,
    permissions: ["super_admin"]
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const handleActionClick = (type: "approve" | "revoke", grantId: number) => {
    setConfirmModal({ isOpen: true, type, grantId });
  };

  const handleConfirmAction = async () => {
    if (!confirmModal.grantId) return;

    try {
      if (confirmModal.type === "approve") {
        await approveMutation.mutateAsync(confirmModal.grantId);
        setFeedback({ type: "success", message: "Support access grant approved successfully." });
      } else {
        await revokeMutation.mutateAsync(confirmModal.grantId);
        setFeedback({ type: "success", message: "Support access grant revoked successfully." });
      }
      setConfirmModal({ isOpen: false, type: "approve", grantId: null });
      setTimeout(() => setFeedback(null), 5000);
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.response?.data?.message || `Failed to ${confirmModal.type} grant.` });
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

      setFeedback({ type: "success", message: "Support access grant requested successfully." });
      setIsModalOpen(false);
      setFormData({
        tenant_id: "",
        reason: "",
        valid_hours: 4,
        permissions: ["super_admin"]
      });

      setTimeout(() => setFeedback(null), 5000);
    } catch (err: any) {
      setFormError(err?.response?.data?.message || "Failed to request access grant. Please try again.");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "APPROVED":
        return "bg-emerald-50 text-emerald-600 border-emerald-100";
      case "REQUESTED":
        return "bg-amber-50 text-amber-600 border-amber-100";
      case "REVOKED":
        return "bg-rose-50 text-rose-600 border-rose-100";
      case "EXPIRED":
        return "bg-secondary-50 text-secondary-600 border-secondary-100";
      default:
        return "bg-secondary-50 text-secondary-600 border-secondary-100";
    }
  };

  return (
    <div className="space-y-10 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <PageHeader
          title="Support Access"
          description="Manage and monitor temporary access grants provided to platform support engineers."
        />
        <button
          onClick={() => setIsModalOpen(true)}
          className="btn-primary gap-3 py-3 px-8 shadow-xl shadow-primary-500/20"
        >
          <Plus className="h-5 w-5" />
          <span className="font-bold">New Access Grant</span>
        </button>
      </div>

      {feedback && (
        <div className={`p-4 rounded-[1.5rem] border flex items-center gap-4 animate-slide-up ${feedback.type === "success"
          ? "bg-emerald-50 border-emerald-100 text-emerald-700"
          : "bg-rose-50 border-rose-100 text-rose-700"
          }`}>
          {feedback.type === "success" ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
          <p className="text-sm font-bold">{feedback.message}</p>
          <button onClick={() => setFeedback(null)} className="ml-auto text-xs opacity-50 hover:opacity-100">Dismiss</button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-10">


        {/* Access Table */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-secondary-900 flex items-center gap-2">
              <History className="h-5 w-5 text-primary-500" />
              Recent Access Grants
            </h3>
            <button onClick={() => refetch()} className="p-2 hover:bg-secondary-100 rounded-xl transition-all">
              <RefreshCw className={`h-4 w-4 text-secondary-400 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="glass-card rounded-[2.5rem] overflow-hidden border border-secondary-100/50 shadow-premium bg-white/40">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-secondary-900/5">
                    <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500">Engineer / Reason</th>
                    <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500">Status</th>
                    <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500">Expiry</th>
                    <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-secondary-100/50">
                  {isLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td colSpan={4} className="px-8 py-8"><div className="h-10 bg-secondary-100/30 rounded-xl" /></td>
                      </tr>
                    ))
                  ) : grants.length > 0 ? (
                    grants.map((grant: any) => (
                      <tr
                        key={grant.id}
                        className="hover:bg-primary-50/30 transition-all group cursor-pointer"
                        onClick={() => setSelectedGrant(grant)}
                      >
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-xl bg-secondary-100 flex items-center justify-center text-secondary-400 group-hover:bg-primary-500 group-hover:text-white transition-all">
                              <User className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-secondary-900 truncate max-w-[200px]">
                                {grant.reason}
                              </p>
                              <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-tighter">
                                ID: #{grant.id} • {format(new Date(grant.valid_from), "MMM d")}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <span className={`px-3 py-1.5 rounded-xl text-[10px] font-bold border ${getStatusColor(grant.status)}`}>
                            {grant.status}
                          </span>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-2 text-xs font-bold text-secondary-600">
                            <Clock className="h-3.5 w-3.5 text-secondary-400" />
                            {format(new Date(grant.valid_until), "MMM d, HH:mm")}
                          </div>
                        </td>
                        <td className="px-8 py-6 text-right" onClick={(e) => e.stopPropagation()}>
                          {grant.status === "APPROVED" ? (
                            <button
                              onClick={() => handleActionClick("revoke", grant.id)}
                              disabled={revokeMutation.isPending}
                              className="px-4 py-2 rounded-xl bg-rose-500/10 text-rose-600 text-[10px] font-bold uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all border border-rose-100"
                            >
                              Revoke
                            </button>
                          ) : grant.status === "REQUESTED" ? (
                            <button
                              onClick={() => handleActionClick("approve", grant.id)}
                              disabled={approveMutation.isPending}
                              className="px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-600 text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-500 hover:text-white transition-all border border-emerald-100"
                            >
                              Approve
                            </button>
                          ) : (
                            <button className="p-2.5 hover:bg-secondary-100 rounded-xl transition-all">
                              <MoreHorizontal className="h-5 w-5 text-secondary-400" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-8 py-20 text-center">
                        <p className="text-secondary-500 font-medium">No recent support grants.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>


        <div className="lg:col-span-1">
          <div className="glass-card rounded-[2.5rem] p-8 border border-rose-100 bg-rose-50/30">
            <div className="h-14 w-14 rounded-2xl bg-rose-500 flex items-center justify-center mb-6 shadow-lg shadow-rose-500/20">
              <ShieldAlert className="h-7 w-7 text-white" />
            </div>
            <h3 className="text-xl font-bold text-secondary-900 mb-4">Security Protocol</h3>
            <p className="text-sm text-secondary-600 leading-relaxed mb-6">
              Granting support access allows authorized engineers to view your data for troubleshooting.
              <strong> All actions are logged and audited.</strong> Access automatically expires after the granted duration.
            </p>
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-xs font-bold text-rose-700">
                <div className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                <span>Only grant access when requested by support</span>
              </div>
              <div className="flex items-center gap-3 text-xs font-bold text-rose-700">
                <div className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                <span>Revoke immediately after issue resolution</span>
              </div>
            </div>
          </div>
        </div>


      </div>

      {/* Grant Details Modal */}
      <Modal
        isOpen={!!selectedGrant}
        onClose={() => setSelectedGrant(null)}
        title="Support Access Details"
      >
        {selectedGrant && (
          <div className="space-y-8">
            <div className="flex items-center justify-between p-6 bg-secondary-50 rounded-[2rem] border border-secondary-100">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-secondary-900 text-white flex items-center justify-center">
                  <User className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-secondary-400 uppercase tracking-widest">Support Engineer</p>
                  <p className="text-base font-black text-secondary-900">Admin ID: #{selectedGrant.saas_admin_id}</p>
                </div>
              </div>
              <span className={`px-4 py-2 rounded-xl text-xs font-bold border ${getStatusColor(selectedGrant.status)}`}>
                {selectedGrant.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1.5 p-5 rounded-2xl bg-white border border-secondary-100 shadow-sm">
                <p className="text-[10px] font-black text-secondary-400 uppercase tracking-tighter">Valid From</p>
                <div className="flex items-center gap-2 text-sm font-bold text-secondary-900">
                  <Clock className="h-4 w-4 text-primary-500" />
                  {format(new Date(selectedGrant.valid_from), "MMM d, yyyy HH:mm")}
                </div>
              </div>
              <div className="space-y-1.5 p-5 rounded-2xl bg-white border border-secondary-100 shadow-sm">
                <p className="text-[10px] font-black text-secondary-400 uppercase tracking-tighter">Valid Until</p>
                <div className="flex items-center gap-2 text-sm font-bold text-secondary-900">
                  <Clock className="h-4 w-4 text-rose-500" />
                  {format(new Date(selectedGrant.valid_until), "MMM d, yyyy HH:mm")}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-black text-secondary-400 uppercase tracking-widest ml-1">Access Reason</h4>
              <div className="p-6 rounded-[2rem] bg-white border border-secondary-100 shadow-premium-sm italic text-secondary-700 text-sm leading-relaxed">
                "{selectedGrant.reason}"
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-black text-secondary-400 uppercase tracking-widest ml-1">Permissions Granted</h4>
              <div className="flex flex-wrap gap-2">
                {selectedGrant.permissions.actions.map(action => (
                  <span key={action} className="px-4 py-2 rounded-xl bg-primary-50 text-primary-700 text-[11px] font-bold border border-primary-100 flex items-center gap-2">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {action}
                  </span>
                ))}
              </div>
            </div>

            <div className="pt-4 grid grid-cols-1 gap-3">
              <div className="flex items-center justify-between text-[10px] font-bold text-secondary-400 uppercase tracking-widest px-1">
                <span>Approved At: {selectedGrant.approved_at ? format(new Date(selectedGrant.approved_at), "MMM d, HH:mm") : "N/A"}</span>
                <span>Grant ID: #{selectedGrant.id}</span>
              </div>
              <button
                onClick={() => setSelectedGrant(null)}
                className="w-full btn-secondary py-4 rounded-2xl font-bold"
              >
                Close Details
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* New Access Grant Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Request Support Access"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-black text-secondary-400 uppercase tracking-widest ml-1">Target Tenant</label>
            <div className="relative group">
              <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-secondary-300 group-focus-within:text-primary-500 transition-colors" />
              <select
                value={formData.tenant_id}
                onChange={(e) => setFormData({ ...formData, tenant_id: e.target.value })}
                className="w-full bg-secondary-50 border-none rounded-2xl pl-12 pr-4 py-4 text-sm focus:ring-2 focus:ring-primary-500/20 transition-all font-bold appearance-none"
                required
              >
                <option value="">Select a Hospital</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.code})
                  </option>
                ))}
              </select>
              {isLoadingTenants && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-secondary-400" />}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-secondary-400 uppercase tracking-widest ml-1">Reason for Access</label>
            <textarea
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              placeholder="Detailed explanation for the support request..."
              rows={3}
              className="w-full bg-secondary-50 border-none rounded-2xl p-4 text-sm focus:ring-2 focus:ring-primary-500/20 transition-all font-bold"
              required
            />
            <p className="text-[10px] text-secondary-400 ml-1 flex items-center gap-1">
              {formData.reason.length < 10 ? (
                <AlertTriangle className="h-3 w-3 text-amber-500" />
              ) : (
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              )}
              Min. 10 characters required. Current: {formData.reason.length}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-black text-secondary-400 uppercase tracking-widest ml-1">Valid For (Hours)</label>
              <input
                type="number"
                value={formData.valid_hours}
                onChange={(e) => setFormData({ ...formData, valid_hours: Number(e.target.value) })}
                min={1}
                max={48}
                className="w-full bg-secondary-50 border-none rounded-2xl px-4 py-4 text-sm focus:ring-2 focus:ring-primary-500/20 transition-all font-bold"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-secondary-400 uppercase tracking-widest ml-1">Permissions</label>
              <select
                value={formData.permissions[0]}
                onChange={(e) => setFormData({ ...formData, permissions: [e.target.value] })}
                className="w-full bg-secondary-50 border-none rounded-2xl px-4 py-4 text-sm focus:ring-2 focus:ring-primary-500/20 transition-all font-bold"
                required
              >
                <option value="super_admin">Super Admin</option>
                <option value="read_only">Read Only</option>
                <option value="billing_only">Billing Only</option>
              </select>
            </div>
          </div>

          {formError && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 text-xs font-bold flex items-center gap-3">
              <ShieldAlert className="h-4 w-4" />
              {formError}
            </div>
          )}

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="flex-1 btn-secondary py-4 rounded-2xl font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={requestMutation.isPending}
              className="flex-1 btn-primary py-4 rounded-2xl font-bold flex items-center justify-center gap-2"
            >
              {requestMutation.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin mx-auto" />
              ) : (
                <>
                  <Lock className="h-5 w-5" />
                  Grant Access
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Action Confirmation Modal */}
      <Modal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        title="Confirm Action"
      >
        <div className="text-center py-6 space-y-6">
          <div className={`h-24 w-24 rounded-[2rem] flex items-center justify-center mx-auto shadow-2xl ${confirmModal.type === 'approve'
            ? 'bg-emerald-500 text-white shadow-emerald-500/20'
            : 'bg-rose-500 text-white shadow-rose-500/20'
            }`}>
            {confirmModal.type === 'approve' ? <ShieldCheck className="h-12 w-12" /> : <ShieldAlert className="h-12 w-12" />}
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-black text-secondary-900 tracking-tight">
              {confirmModal.type === 'approve' ? 'Approve Access Grant?' : 'Revoke Access Grant?'}
            </h3>
            <p className="text-sm text-secondary-500 font-medium px-4">
              {confirmModal.type === 'approve'
                ? 'Are you sure you want to approve this support access request? This will allow the engineer to access the tenant environment.'
                : 'Are you sure you want to revoke this active grant? The engineer will immediately lose all access permissions.'}
            </p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
              className="flex-1 btn-secondary py-4 rounded-2xl font-bold text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmAction}
              disabled={approveMutation.isPending || revokeMutation.isPending}
              className={`flex-1 py-4 rounded-2xl font-bold text-sm text-white transition-all ${confirmModal.type === 'approve'
                ? 'bg-emerald-500 hover:bg-emerald-600 shadow-xl shadow-emerald-500/20'
                : 'bg-rose-500 hover:bg-rose-600 shadow-xl shadow-rose-500/20'
                }`}
            >
              {approveMutation.isPending || revokeMutation.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin mx-auto" />
              ) : (
                confirmModal.type === 'approve' ? 'Confirm Approval' : 'Confirm Revoke'
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
