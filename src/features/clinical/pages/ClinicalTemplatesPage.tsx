import { PageHeader } from "@/components/layout/PageHeader";
import {
   FileText,
   Plus,
   RefreshCw,
   Search,
   Filter,
   CheckCircle2,
   Settings as SettingsIcon,
   MoreVertical,
   Layers,
   Copy,
   AlertCircle,
} from "lucide-react";
import { useState, useEffect } from "react";
import { clinicalTemplatesApi } from "../api/clinical.api";

export function ClinicalTemplatesPage() {
   const [templates, setTemplates] = useState<any[]>([]);
   const [isLoading, setIsLoading] = useState(true);
   const [error, setError] = useState<string | null>(null);

   const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
         const data = await clinicalTemplatesApi.list();
         setTemplates(data || []);
      } catch (err: any) {
         setError("Failed to synchronize with the template library.");
      } finally {
         setIsLoading(false);
      }
   };

   useEffect(() => {
      load();
   }, []);

   return (
      <div className="space-y-10 animate-fade-in pb-20">
         <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <PageHeader
               title="Clinical Templates"
               description="Standardize consultations with reusable SOAP, history, and examination templates."
            />
            <div className="flex gap-3">
               <button onClick={load} className="btn-secondary p-4 rounded-2xl bg-white/80 border-secondary-100 transition-all">
                  <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
               </button>
               <button className="btn-primary gap-3 py-3 px-8 shadow-xl shadow-primary-500/20">
                  <Plus className="h-5 w-5" />
                  <span className="font-bold">Create Template</span>
               </button>
            </div>
         </div>

         <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
            {/* Template Library Stats */}
            <div className="lg:col-span-1 space-y-6">
               <div className="glass-card rounded-[2.5rem] p-8 border border-secondary-100/50 bg-white/40 shadow-premium">
                  <div className="h-16 w-16 rounded-2xl bg-secondary-900 text-white flex items-center justify-center mb-6 shadow-lg">
                     <Layers className="h-8 w-8" />
                  </div>
                  <h4 className="text-xl font-black text-secondary-900 mb-2">Standardization</h4>
                  <p className="text-xs text-secondary-500 leading-relaxed mb-8">
                     Using templates reduces clinical documentation time by up to 60% while ensuring ICD-10 compliance.
                  </p>
                  <div className="space-y-4">
                     <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-secondary-700">Total Templates</span>
                        <span className="text-xl font-black text-secondary-900">28</span>
                     </div>
                     <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-secondary-700">Commonly Used</span>
                        <span className="text-xl font-black text-primary-500">12</span>
                     </div>
                  </div>
               </div>
            </div>

            {/* Templates List */}
            <div className="lg:col-span-3 space-y-6">
               <div className="flex items-center justify-between">
                  <div className="relative max-w-sm w-full group">
                     <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary-400 group-focus-within:text-primary-500 transition-colors" />
                     <input
                        type="text"
                        placeholder="Search templates by name or specialty..."
                        className="w-full pl-12 pr-6 py-3 rounded-2xl bg-white/60 border border-secondary-100 focus:border-primary-500 transition-all text-sm font-medium outline-none"
                     />
                  </div>
                  <button className="btn-secondary py-3 px-6 rounded-2xl gap-2 text-xs font-bold">
                     <Filter className="h-4 w-4" />
                     All Specialties
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
                  ) : templates.length === 0 ? (
                     <div className="col-span-2 py-32 text-center bg-white/20 rounded-[3rem] border-2 border-dashed border-secondary-100">
                        <FileText className="h-12 w-12 mx-auto text-secondary-200 mb-4" />
                        <h4 className="text-lg font-bold text-secondary-900">Library is Empty</h4>
                        <p className="text-sm text-secondary-400 mt-2">Create your first clinical documentation template.</p>
                     </div>
                  ) : (
                     templates.map((tpl) => (
                        <div key={tpl.id} className="glass-card rounded-[2.5rem] p-8 border border-secondary-100/50 bg-white/40 hover:bg-white/60 transition-all group relative overflow-hidden">
                           <div className="flex items-start justify-between mb-6">
                              <div className="h-12 w-12 rounded-2xl bg-primary-500/10 text-primary-600 flex items-center justify-center shadow-sm group-hover:bg-primary-500 group-hover:text-white transition-all">
                                 <FileText className="h-6 w-6" />
                              </div>
                              <div className="flex gap-2">
                                 <button className="p-2.5 hover:bg-secondary-100 rounded-xl transition-all">
                                    <Copy className="h-4 w-4 text-secondary-400" />
                                 </button>
                                 <button className="p-2.5 hover:bg-secondary-100 rounded-xl transition-all">
                                    <SettingsIcon className="h-4 w-4 text-secondary-400" />
                                 </button>
                              </div>
                           </div>
                           <h4 className="text-lg font-black text-secondary-900 mb-2">{tpl.name}</h4>
                           <div className="flex items-center gap-3">
                              <span className="px-2 py-0.5 rounded-lg bg-secondary-900 text-white text-[8px] font-black uppercase tracking-widest">{tpl.specialty || 'General'}</span>
                              <span className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest">{tpl.sections_count || 0} Sections</span>
                           </div>
                           <div className="mt-8 pt-6 border-t border-secondary-100/50 flex items-center justify-between">
                              <span className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest">Last updated {new Date(tpl.updated_at).toLocaleDateString()}</span>
                              <button className="text-primary-600 text-xs font-black uppercase tracking-widest hover:underline">Preview →</button>
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
