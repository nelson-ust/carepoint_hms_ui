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
} from "lucide-react";
import { useMySupportGrants, useRevokeSupportGrant } from "../hooks/use-support-access";
import { format } from "date-fns";

export function SupportAccessPage() {
  const { data, isLoading, error, refetch } = useMySupportGrants();
  const revokeMutation = useRevokeSupportGrant();
  const grants = data?.items || [];

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
        <button className="btn-primary gap-3 py-3 px-8 shadow-xl shadow-primary-500/20">
          <Plus className="h-5 w-5" />
          <span className="font-bold">New Access Grant</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Security Warning Card */}
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

        {/* Active Grants List */}
        <div className="lg:col-span-2 space-y-6">
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
                    grants.map((grant) => (
                      <tr key={grant.id} className="hover:bg-primary-50/30 transition-all group">
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-xl bg-secondary-100 flex items-center justify-center text-secondary-400">
                              <User className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-secondary-900 truncate max-w-[200px]">
                                {grant.reason}
                              </p>
                              <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-tighter">
                                ID: #{grant.id} • {format(new Date(grant.created_at), "MMM d")}
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
                             {format(new Date(grant.expires_at), "MMM d, HH:mm")}
                          </div>
                        </td>
                        <td className="px-8 py-6 text-right">
                          {grant.status === "APPROVED" ? (
                            <button 
                              onClick={() => revokeMutation.mutate(grant.id)}
                              disabled={revokeMutation.isPending}
                              className="px-4 py-2 rounded-xl bg-rose-500/10 text-rose-600 text-[10px] font-bold uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all border border-rose-100"
                            >
                              Revoke
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
      </div>
    </div>
  );
}
