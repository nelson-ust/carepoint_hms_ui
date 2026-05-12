import { PageHeader } from "@/components/layout/PageHeader";
import {
  Database,
  Download,
  Play,
  RefreshCw,
  HardDrive,
  ShieldCheck,
  AlertCircle,
  Clock,
  ChevronRight,
  MoreVertical,
  CheckCircle2,
} from "lucide-react";
import { useState, useEffect } from "react";
import { backupsApi, type Backup } from "../api/backups.api";

export function DatabaseBackupsPage() {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await backupsApi.list();
      setBackups(data || []);
    } catch (err: any) {
      setError("Failed to connect to the backup vault.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-10 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <PageHeader
          title="System Backups"
          description="Automated database snapshots and manual recovery points."
        />
        <div className="flex gap-3">
          <button onClick={load} className="btn-secondary p-4 rounded-2xl bg-white/80 border-secondary-100 transition-all">
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button className="btn-primary gap-3 py-3 px-8 shadow-xl shadow-primary-500/20">
            <Play className="h-5 w-5" />
            <span className="font-bold">Trigger Manual Backup</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
         {/* Backup Health */}
         <div className="lg:col-span-1 space-y-6">
            <div className="glass-card rounded-[2.5rem] p-8 border border-secondary-100/50 bg-white/40 shadow-premium">
               <div className="h-16 w-16 rounded-2xl bg-primary-900 text-white flex items-center justify-center mb-6 shadow-lg shadow-primary-900/20">
                  <ShieldCheck className="h-8 w-8" />
               </div>
               <h4 className="text-xl font-black text-secondary-900 mb-2">Health: Healthy</h4>
               <p className="text-xs text-secondary-500 leading-relaxed mb-8">
                  Backups are encrypted and synchronized with S3 regional storage every 6 hours.
               </p>
               <div className="space-y-6">
                  <div className="flex flex-col">
                     <span className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest mb-1">Last Daily</span>
                     <span className="text-sm font-black text-secondary-900">Today, 04:00 AM</span>
                  </div>
                  <div className="flex flex-col">
                     <span className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest mb-1">Retention Policy</span>
                     <span className="text-sm font-black text-secondary-900">30 Days (Rolling)</span>
                  </div>
               </div>
            </div>

            <div className="glass-card rounded-[2.5rem] p-8 border border-secondary-100/50 bg-emerald-500 text-white shadow-xl shadow-emerald-500/20">
               <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center mb-6">
                  <HardDrive className="h-6 w-6" />
               </div>
               <h4 className="text-lg font-bold mb-2">Storage Usage</h4>
               <p className="text-3xl font-black mb-2">12.4 GB</p>
               <p className="text-xs text-emerald-100 font-medium">Used across 182 recovery points</p>
            </div>
         </div>

         {/* Backup History */}
         <div className="lg:col-span-3 space-y-6">
            {error && (
               <div className="p-6 rounded-[2rem] bg-rose-50 border border-rose-100 text-rose-600 flex items-center gap-4">
                  <AlertCircle className="h-6 w-6" />
                  <p className="text-sm font-bold">{error}</p>
               </div>
            )}

            <div className="glass-card rounded-[2.5rem] overflow-hidden border border-secondary-100/50 shadow-premium bg-white/40">
               <table className="w-full text-left">
                  <thead>
                     <tr className="bg-secondary-900/5">
                        <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary-500">Recovery Point</th>
                        <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary-500">Size</th>
                        <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary-500">Status</th>
                        <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary-500 text-right">Download</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-secondary-100/50">
                     {isLoading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                           <tr key={i} className="animate-pulse">
                              <td colSpan={4} className="px-8 py-6"><div className="h-10 bg-secondary-100/30 rounded-xl" /></td>
                           </tr>
                        ))
                     ) : backups.length === 0 ? (
                        <tr>
                           <td colSpan={4} className="px-8 py-32 text-center">
                              <Database className="h-12 w-12 mx-auto text-secondary-200 mb-4" />
                              <h4 className="text-lg font-bold text-secondary-900">No Recovery Points</h4>
                              <p className="text-sm text-secondary-400 mt-2">Historical snapshots will appear here.</p>
                           </td>
                        </tr>
                     ) : (
                        backups.map((bk) => (
                           <tr key={bk.id} className="hover:bg-primary-50/20 transition-all group">
                              <td className="px-8 py-6">
                                 <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-xl bg-secondary-900 text-white flex items-center justify-center shadow-lg">
                                       <Database className="h-5 w-5" />
                                    </div>
                                    <div className="flex flex-col">
                                       <span className="text-sm font-black text-secondary-900">{bk.filename}</span>
                                       <span className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest">{new Date(bk.created_at).toLocaleString()}</span>
                                    </div>
                                 </div>
                              </td>
                              <td className="px-8 py-6 text-sm font-bold text-secondary-700">
                                 {formatSize(bk.size_bytes)}
                              </td>
                              <td className="px-8 py-6">
                                 <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                                    bk.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                    bk.status === 'FAILED' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                                    'bg-amber-50 text-amber-600 border-amber-100'
                                 }`}>
                                    {bk.status}
                                 </span>
                              </td>
                              <td className="px-8 py-6 text-right">
                                 <button className="h-10 w-10 rounded-xl bg-secondary-50 flex items-center justify-center text-secondary-400 hover:bg-primary-500 hover:text-white transition-all shadow-sm">
                                    <Download className="h-4 w-4" />
                                 </button>
                              </td>
                           </tr>
                        ))
                     )}
                  </tbody>
               </table>
            </div>
         </div>
      </div>
    </div>
  );
}
