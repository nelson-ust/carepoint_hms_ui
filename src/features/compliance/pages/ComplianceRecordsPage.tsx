import { PageHeader } from "@/components/layout/PageHeader";
import {
   ShieldCheck,
   Plus,
   RefreshCw,
   FileText,
   AlertCircle,
   Clock,
   ExternalLink,
   Search,
   Filter,
   CheckCircle2,
   XCircle,
} from "lucide-react";
import { useState, useEffect } from "react";
import { complianceApi, type ComplianceRecord } from "../api/compliance.api";

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

   const getStatusStyle = (status: string) => {
      switch (status) {
         case 'VALID': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
         case 'EXPIRED': return 'bg-rose-50 text-rose-600 border-rose-100';
         case 'PENDING': return 'bg-amber-50 text-amber-600 border-amber-100';
         default: return 'bg-secondary-50 text-secondary-400 border-secondary-400';
      }
   };

   return (
      <div className="space-y-10 animate-fade-in pb-20">
         <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <PageHeader
               title="Compliance & Audits"
               description="Maintain legal, safety, and medical certification records for the facility."
            />
            <div className="flex gap-3">
               <button onClick={load} className="btn-secondary p-4 rounded-2xl bg-white/80 border-secondary-400">
                  <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
               </button>
               <button className="btn-primary gap-3 py-3 px-8 shadow-xl shadow-primary-500/20">
                  <Plus className="h-5 w-5" />
                  <span className="font-bold">New Audit Record</span>
               </button>
            </div>
         </div>

         <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
            {/* Compliance Scorecard */}
            <div className="lg:col-span-1 space-y-6">
               <div className="glass-card rounded-[2.5rem] p-8 border border-secondary-400/50 bg-white/40 shadow-premium">
                  <div className="h-16 w-16 rounded-2xl bg-emerald-500 text-white flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/20">
                     <ShieldCheck className="h-8 w-8" />
                  </div>
                  <h4 className="text-xl font-black text-secondary-900 mb-2">94% Compliant</h4>
                  <p className="text-xs text-secondary-500 leading-relaxed mb-8">
                     Your facility is currently meeting most regulatory requirements. 2 items require immediate attention.
                  </p>
                  <div className="space-y-4">
                     <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100 flex items-center gap-3">
                        <AlertCircle className="h-5 w-5 text-rose-500" />
                        <span className="text-xs font-bold text-rose-700">Fire Safety Expired</span>
                     </div>
                     <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100 flex items-center gap-3">
                        <Clock className="h-5 w-5 text-amber-500" />
                        <span className="text-xs font-bold text-amber-700">Radiology License Due</span>
                     </div>
                  </div>
               </div>
            </div>

            {/* Records List */}
            <div className="lg:col-span-3 space-y-6">
               <div className="flex items-center justify-between">
                  <div className="relative max-w-sm w-full group">
                     <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary-400 group-focus-within:text-primary-500 transition-colors" />
                     <input
                        type="text"
                        placeholder="Search audit records..."
                        className="w-full pl-12 pr-6 py-3 rounded-2xl bg-white/60 border border-secondary-400 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/5 transition-all text-sm font-medium outline-none"
                     />
                  </div>
                  <button className="btn-secondary py-3 px-6 rounded-2xl gap-2 text-xs font-bold">
                     <Filter className="h-4 w-4" />
                     Filters
                  </button>
               </div>

               {error && (
                  <div className="p-6 rounded-[2rem] bg-rose-50 border border-rose-100 text-rose-600 flex items-center gap-4">
                     <AlertCircle className="h-6 w-6" />
                     <p className="text-sm font-bold">{error}</p>
                  </div>
               )}

               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {isLoading ? (
                     Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-48 bg-white/40 rounded-[2.5rem] animate-pulse" />
                     ))
                  ) : records.length === 0 ? (
                     <div className="col-span-2 py-32 text-center bg-white/20 rounded-[3rem] border-2 border-dashed border-secondary-400">
                        <FileText className="h-12 w-12 mx-auto text-secondary-200 mb-4" />
                        <h4 className="text-lg font-bold text-secondary-900">No Records Found</h4>
                        <p className="text-sm text-secondary-400 mt-2">Upload your first certification or audit record.</p>
                     </div>
                  ) : (
                     records.map((record) => (
                        <div key={record.id} className="glass-card rounded-[2.5rem] p-8 border border-secondary-400/50 bg-white/40 hover:shadow-xl transition-all group">
                           <div className="flex items-start justify-between mb-6">
                              <div className="h-12 w-12 rounded-2xl bg-secondary-900 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                                 <FileText className="h-6 w-6" />
                              </div>
                              <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${getStatusStyle(record.status)}`}>
                                 {record.status}
                              </span>
                           </div>
                           <h4 className="text-lg font-black text-secondary-900 mb-2">{record.title}</h4>
                           <p className="text-xs text-secondary-500 line-clamp-2 mb-6">
                              {record.description}
                           </p>
                           <div className="flex items-center justify-between pt-6 border-t border-secondary-400/50">
                              <div className="flex flex-col">
                                 <span className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest">Valid Until</span>
                                 <span className="text-xs font-black text-secondary-900">{record.expiry_date ? new Date(record.expiry_date).toLocaleDateString() : 'N/A'}</span>
                              </div>
                              <button className="h-10 w-10 rounded-xl bg-secondary-50 flex items-center justify-center text-secondary-400 hover:bg-primary-500 hover:text-white transition-all">
                                 <ExternalLink className="h-4 w-4" />
                              </button>
                           </div>
                        </div>
                     ))
                  )}
               </div>
            </div>
         </div>
      </div>
   );
}
