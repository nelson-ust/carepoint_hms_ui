import { PageHeader } from "@/components/layout/PageHeader";
import {
   ArrowLeft,
   Download,
   Printer,
   Mail,
   MoreHorizontal,
   CreditCard,
   Building2,
   Calendar,
   User,
   CheckCircle2,
   AlertCircle,
   FileText,
   ShieldCheck,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { routes } from "@/config/routes";

export function BillingDetailPage() {
   const navigate = useNavigate();
   const { invoiceId } = useParams<{ invoiceId: string }>();

   // Mock data for the demonstration
   const invoice = {
      id: invoiceId || "INV-2026-0042",
      date: "May 12, 2026",
      dueDate: "May 26, 2026",
      status: "PAID",
      customer: {
         name: "Johnathan Smith",
         id: "PAT-8829",
         email: "j.smith@email.com",
         phone: "+1 (555) 012-3456",
         address: "742 Evergreen Terrace, Springfield"
      },
      items: [
         { id: 1, description: "General Consultation - Senior Physician", qty: 1, price: 150.00 },
         { id: 2, description: "Full Blood Count (Lab)", qty: 1, price: 45.00 },
         { id: 3, description: "Amoxicillin 500mg (14 Tabs)", qty: 2, price: 12.50 },
         { id: 4, description: "Emergency Room Surcharge", qty: 1, price: 250.00 },
      ],
      subtotal: 470.00,
      tax: 37.60,
      total: 507.60
   };

   return (
      <div className="space-y-10 animate-fade-in pb-20">
         <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-4">
               <button
                  onClick={() => navigate(routes.billing)}
                  className="flex items-center gap-2 text-secondary-400 hover:text-secondary-900 font-bold transition-all group"
               >
                  <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                  <span className="text-[10px] uppercase tracking-widest">Back to Invoices</span>
               </button>
               <PageHeader
                  title={`Invoice ${invoice.id}`}
                  description="Detailed breakdown of clinical charges and payment history."
               />
            </div>
            <div className="flex gap-3">
               <button className="btn-secondary gap-3 py-3 px-6">
                  <Printer className="h-4 w-4" />
                  <span className="font-bold">Print PDF</span>
               </button>
               <button className="btn-primary gap-3 py-3 px-8 shadow-xl shadow-primary-500/20">
                  <CreditCard className="h-5 w-5" />
                  <span className="font-bold">Record Payment</span>
               </button>
            </div>
         </div>

         <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            {/* Main Invoice Content */}
            <div className="lg:col-span-2 space-y-8">
               <div className="glass-card rounded-[3rem] p-12 border border-secondary-400/50 bg-white/40 shadow-premium relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-12">
                     <div className={`px-6 py-2 rounded-2xl text-xs font-black border flex items-center gap-2 ${invoice.status === 'PAID' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                        {invoice.status === 'PAID' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                        {invoice.status}
                     </div>
                  </div>

                  {/* Branding & Header */}
                  <div className="flex items-center gap-4 mb-16">
                     <div className="h-14 w-14 rounded-2xl bg-secondary-900 flex items-center justify-center">
                        <Building2 className="h-8 w-8 text-white" />
                     </div>
                     <div>
                        <h2 className="text-xl font-black text-secondary-900 tracking-tight">Carepoint HMS</h2>
                        <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-[0.2em]">Medical Excellence</p>
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-12 mb-16">
                     <div>
                        <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest mb-4">Bill To</p>
                        <h4 className="text-lg font-black text-secondary-900">{invoice.customer.name}</h4>
                        <p className="text-sm text-secondary-500 font-medium mt-1">{invoice.customer.id}</p>
                        <div className="mt-4 space-y-1">
                           <p className="text-xs text-secondary-500">{invoice.customer.email}</p>
                           <p className="text-xs text-secondary-500">{invoice.customer.phone}</p>
                        </div>
                     </div>
                     <div className="text-right">
                        <div className="space-y-4">
                           <div>
                              <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest mb-1">Date Issued</p>
                              <p className="text-sm font-black text-secondary-900">{invoice.date}</p>
                           </div>
                           <div>
                              <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest mb-1">Due Date</p>
                              <p className="text-sm font-black text-secondary-900">{invoice.dueDate}</p>
                           </div>
                        </div>
                     </div>
                  </div>

                  {/* Table */}
                  <div className="mb-16">
                     <table className="w-full">
                        <thead>
                           <tr className="border-b border-secondary-400">
                              <th className="py-4 text-left text-[10px] font-bold text-secondary-400 uppercase tracking-widest">Description</th>
                              <th className="py-4 text-center text-[10px] font-bold text-secondary-400 uppercase tracking-widest">Qty</th>
                              <th className="py-4 text-right text-[10px] font-bold text-secondary-400 uppercase tracking-widest">Price</th>
                              <th className="py-4 text-right text-[10px] font-bold text-secondary-400 uppercase tracking-widest">Total</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-secondary-50">
                           {invoice.items.map((item) => (
                              <tr key={item.id} className="group">
                                 <td className="py-6">
                                    <p className="text-sm font-bold text-secondary-900">{item.description}</p>
                                    <p className="text-[10px] text-secondary-400 font-medium mt-0.5">Code: SRV-00{item.id}</p>
                                 </td>
                                 <td className="py-6 text-center text-sm font-bold text-secondary-600">{item.qty}</td>
                                 <td className="py-6 text-right text-sm font-bold text-secondary-600">${item.price.toFixed(2)}</td>
                                 <td className="py-6 text-right text-sm font-black text-secondary-900">${(item.qty * item.price).toFixed(2)}</td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>

                  {/* Totals */}
                  <div className="flex justify-end">
                     <div className="w-64 space-y-4">
                        <div className="flex justify-between text-sm font-bold text-secondary-500">
                           <span>Subtotal</span>
                           <span>${invoice.subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm font-bold text-secondary-500">
                           <span>Tax (8%)</span>
                           <span>${invoice.tax.toFixed(2)}</span>
                        </div>
                        <div className="pt-4 border-t border-secondary-400 flex justify-between items-center">
                           <span className="text-lg font-black text-secondary-900">Total</span>
                           <span className="text-2xl font-black text-primary-600">${invoice.total.toFixed(2)}</span>
                        </div>
                     </div>
                  </div>
               </div>
            </div>

            {/* Sidebar Info */}
            <div className="lg:col-span-1 space-y-6">
               <div className="glass-card rounded-[2.5rem] p-8 border border-secondary-400/50 bg-white/40 shadow-premium">
                  <h4 className="text-sm font-bold text-secondary-900 uppercase tracking-widest mb-6">Payment Method</h4>
                  <div className="p-4 rounded-2xl bg-secondary-900/5 flex items-center gap-4 border border-secondary-400">
                     <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center border border-secondary-400 shadow-sm">
                        <CreditCard className="h-5 w-5 text-secondary-600" />
                     </div>
                     <div>
                        <p className="text-xs font-bold text-secondary-900">Visa ending in 4429</p>
                        <p className="text-[10px] text-secondary-500 font-medium uppercase mt-0.5 tracking-tighter">Processed May 12, 14:22</p>
                     </div>
                  </div>
               </div>

               <div className="glass-card rounded-[2.5rem] p-8 border border-secondary-400/50 bg-white/40 shadow-premium">
                  <h4 className="text-sm font-bold text-secondary-900 uppercase tracking-widest mb-6">Related Documents</h4>
                  <div className="space-y-3">
                     <div className="flex items-center justify-between p-3 rounded-xl hover:bg-white/60 transition-all cursor-pointer group">
                        <div className="flex items-center gap-3">
                           <FileText className="h-4 w-4 text-primary-500" />
                           <span className="text-xs font-bold text-secondary-700">Lab Results.pdf</span>
                        </div>
                        <Download className="h-3 w-3 text-secondary-400 group-hover:text-primary-500" />
                     </div>
                     <div className="flex items-center justify-between p-3 rounded-xl hover:bg-white/60 transition-all cursor-pointer group">
                        <div className="flex items-center gap-3">
                           <FileText className="h-4 w-4 text-primary-500" />
                           <span className="text-xs font-bold text-secondary-700">Prescription.pdf</span>
                        </div>
                        <Download className="h-3 w-3 text-secondary-400 group-hover:text-primary-500" />
                     </div>
                  </div>
               </div>

               <div className="glass-card rounded-[2.5rem] p-8 border border-emerald-100 bg-emerald-50/30">
                  <div className="flex items-start gap-4">
                     <ShieldCheck className="h-6 w-6 text-emerald-500 shrink-0" />
                     <div>
                        <h4 className="text-sm font-bold text-secondary-900 mb-1">Insurance Verified</h4>
                        <p className="text-xs text-secondary-500 leading-relaxed">
                           This invoice has been reviewed and approved by the insurance provider (AXA Mansard).
                        </p>
                     </div>
                  </div>
               </div>
            </div>
         </div>
      </div>
   );
}
