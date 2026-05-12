import { PageHeader } from "@/components/layout/PageHeader";
import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Mail,
  User,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Send,
} from "lucide-react";
import { useInvitations, useResendInvitation, useCancelInvitation } from "../hooks/use-invitations";
import { format } from "date-fns";

export function InvitationsPage() {
  const { data, isLoading, error, refetch } = useInvitations();
  const resendMutation = useResendInvitation();
  const cancelMutation = useCancelInvitation();
  
  const invitations = data?.items || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING":
        return "bg-amber-50 text-amber-600 border-amber-100";
      case "ACCEPTED":
        return "bg-emerald-50 text-emerald-600 border-emerald-100";
      case "EXPIRED":
        return "bg-secondary-50 text-secondary-600 border-secondary-100";
      case "CANCELLED":
        return "bg-rose-50 text-rose-600 border-rose-100";
      default:
        return "bg-secondary-50 text-secondary-600 border-secondary-100";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "PENDING":
        return <Clock className="h-3.5 w-3.5" />;
      case "ACCEPTED":
        return <CheckCircle2 className="h-3.5 w-3.5" />;
      case "EXPIRED":
        return <XCircle className="h-3.5 w-3.5" />;
      case "CANCELLED":
        return <XCircle className="h-3.5 w-3.5" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-10 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <PageHeader
          title="Staff Invitations"
          description="Send and manage invitations for new hospital staff members."
        />
        <button className="btn-primary gap-3 py-3 px-8 shadow-xl shadow-primary-500/20">
          <Plus className="h-5 w-5" />
          <span className="font-bold">Send Invitation</span>
        </button>
      </div>

      <div className="grid gap-8">
        {/* Filters */}
        <div className="glass-card rounded-[2rem] p-4 flex flex-col md:flex-row gap-4 items-center bg-white/40 backdrop-blur-md">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-secondary-400" />
            <input
              type="text"
              placeholder="Search by email or role..."
              className="w-full bg-white/50 border-none rounded-2xl pl-14 pr-6 py-4 text-sm focus:ring-2 focus:ring-primary-500/50 transition-all font-medium"
            />
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <button className="btn-secondary p-4 rounded-2xl bg-white/80 border-secondary-100 hover:rotate-180 transition-transform duration-500">
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="glass-card rounded-[2.5rem] overflow-hidden border border-secondary-100/50 shadow-premium bg-white/40">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-secondary-900/5">
                  <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500">Recipient</th>
                  <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500">Designated Role</th>
                  <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500">Status</th>
                  <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500">Expires</th>
                  <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-100/50">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={5} className="px-8 py-8"><div className="h-12 bg-secondary-100/30 rounded-xl w-full" /></td>
                    </tr>
                  ))
                ) : invitations.length > 0 ? (
                  invitations.map((inv) => (
                    <tr key={inv.id} className="hover:bg-primary-50/30 transition-all group">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-xl bg-secondary-100 flex items-center justify-center text-secondary-400">
                            <Mail className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-secondary-900">{inv.email}</p>
                            <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-tighter mt-0.5">
                              Invited {format(new Date(inv.created_at), "MMM d, yyyy")}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span className="text-xs font-bold text-secondary-700 bg-secondary-900/5 px-3 py-1.5 rounded-lg border border-secondary-900/10">
                          {inv.role?.name || "System Staff"}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold border ${getStatusColor(inv.status)}`}>
                          {getStatusIcon(inv.status)}
                          <span>{inv.status}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-xs font-bold text-secondary-500">
                        {format(new Date(inv.expires_at), "MMM d, HH:mm")}
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center justify-end gap-2">
                          {inv.status === "PENDING" && (
                            <>
                              <button 
                                onClick={() => resendMutation.mutate(inv.id)}
                                disabled={resendMutation.isPending}
                                className="p-2.5 hover:bg-primary-50 text-primary-600 rounded-xl transition-all" 
                                title="Resend"
                              >
                                <Send className="h-4 w-4" />
                              </button>
                              <button 
                                onClick={() => cancelMutation.mutate(inv.id)}
                                disabled={cancelMutation.isPending}
                                className="p-2.5 hover:bg-rose-50 text-rose-500 rounded-xl transition-all" 
                                title="Cancel"
                              >
                                <XCircle className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          <button className="p-2.5 hover:bg-secondary-100 rounded-xl transition-all">
                            <MoreHorizontal className="h-5 w-5 text-secondary-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-8 py-20 text-center">
                      <p className="text-secondary-500 font-medium">No invitations found.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
