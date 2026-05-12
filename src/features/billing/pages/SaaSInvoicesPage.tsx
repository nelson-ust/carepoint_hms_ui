import { PageHeader } from "@/components/layout/PageHeader";
import {
  CreditCard,
  Download,
  Filter,
  MoreHorizontal,
  RefreshCw,
  Search,
  AlertCircle,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { useMySaaSInvoices } from "../hooks/use-saas-billing";
import { format } from "date-fns";

export function SaaSInvoicesPage() {
  const { data, isLoading, error, refetch } = useMySaaSInvoices();
  const invoices = data?.items || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PAID":
        return "bg-emerald-50 text-emerald-600 border-emerald-100";
      case "ISSUED":
        return "bg-blue-50 text-blue-600 border-blue-100";
      case "OVERDUE":
        return "bg-rose-50 text-rose-600 border-rose-100";
      case "DRAFT":
        return "bg-secondary-50 text-secondary-600 border-secondary-100";
      default:
        return "bg-secondary-50 text-secondary-600 border-secondary-100";
    }
  };

  return (
    <div className="space-y-10 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <PageHeader
          title="Subscription Billing"
          description="Manage your hospital's platform subscription, view invoices, and track payments."
        />
        <div className="flex gap-3">
          <button className="btn-secondary gap-3 py-3 px-6">
            <Download className="h-4 w-4" />
            <span className="font-bold">Export History</span>
          </button>
          <button className="btn-primary gap-3 py-3 px-8 shadow-xl shadow-primary-500/20">
            <CreditCard className="h-5 w-5" />
            <span className="font-bold">Pay Balance</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Quick Stats */}
        <div className="glass-card rounded-[2rem] p-8 border border-secondary-100/50 bg-white/40 shadow-premium col-span-1 lg:col-span-3 flex flex-wrap gap-12">
          <div>
            <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-[0.2em] mb-2">Current Plan</p>
            <h4 className="text-2xl font-black text-secondary-900 flex items-center gap-2">
              Enterprise Pro
              <span className="px-2 py-0.5 rounded-lg bg-primary-500 text-white text-[10px] font-bold">ACTIVE</span>
            </h4>
          </div>
          <div className="w-px h-12 bg-secondary-100 hidden md:block" />
          <div>
            <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-[0.2em] mb-2">Balance Due</p>
            <h4 className="text-2xl font-black text-rose-600">$0.00</h4>
          </div>
          <div className="w-px h-12 bg-secondary-100 hidden md:block" />
          <div>
            <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-[0.2em] mb-2">Next Renewal</p>
            <h4 className="text-2xl font-black text-secondary-900">June 24, 2026</h4>
          </div>
        </div>

        {/* Invoice List */}
        <div className="lg:col-span-3 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-secondary-900 flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary-500" />
              Invoice History
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
                    <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500">Invoice</th>
                    <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500">Date</th>
                    <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500">Amount</th>
                    <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500">Status</th>
                    <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-secondary-100/50">
                  {isLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td colSpan={5} className="px-8 py-8"><div className="h-10 bg-secondary-100/30 rounded-xl" /></td>
                      </tr>
                    ))
                  ) : invoices.length > 0 ? (
                    invoices.map((invoice) => (
                      <tr key={invoice.id} className="hover:bg-primary-50/30 transition-all group">
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-xl bg-secondary-100 flex items-center justify-center text-secondary-400">
                              <FileText className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-secondary-900">{invoice.invoice_no}</p>
                              <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-tighter">
                                Due {format(new Date(invoice.due_date), "MMM d, yyyy")}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-6 text-sm font-bold text-secondary-700">
                          {format(new Date(invoice.invoice_date), "MMM d, yyyy")}
                        </td>
                        <td className="px-8 py-6">
                          <p className="text-sm font-black text-secondary-900">${invoice.total_amount.toLocaleString()}</p>
                          {invoice.amount_paid > 0 && (
                            <p className="text-[10px] font-bold text-emerald-600 uppercase">Paid: ${invoice.amount_paid.toLocaleString()}</p>
                          )}
                        </td>
                        <td className="px-8 py-6">
                          <span className={`px-3 py-1.5 rounded-xl text-[10px] font-bold border ${getStatusColor(invoice.status)}`}>
                            {invoice.status}
                          </span>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex items-center justify-end gap-2">
                            <button className="p-2.5 hover:bg-primary-50 text-primary-600 rounded-xl transition-all" title="Download">
                              <Download className="h-4 w-4" />
                            </button>
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
                        <div className="max-w-xs mx-auto space-y-4">
                           <FileText className="h-12 w-12 mx-auto text-secondary-100" />
                           <p className="text-secondary-500 font-bold">No invoice history found.</p>
                        </div>
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
