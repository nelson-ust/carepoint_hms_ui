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
  XCircle,
  ShieldAlert,
} from "lucide-react";
import { useState, useEffect } from "react";
import { backupsApi, type Backup } from "../api/backups.api";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { resolveTenantCode } from "@/lib/tenant/tenant-resolver";

export function DatabaseBackupsPage() {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTriggering, setIsTriggering] = useState(false);
  
  // Feedback Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalConfig, setModalConfig] = useState({
    title: "",
    message: "",
    type: "success" as "success" | "error"
  });

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await backupsApi.list();
      setBackups(data || []);
    } catch (err: any) {
      console.error("Backup load error:", err);
      const tenant = resolveTenantCode();
      if (err.message === "Network Error") {
        setError(`Connectivity Blocked (CORS): The server at carepoint-hms.onrender.com is refusing requests from ${window.location.origin}. This is a security policy configuration on the backend.`);
      } else {
        setError(`System Error (500): The backup vault for tenant "${tenant}" is currently unreachable or crashed on the server.`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleTriggerBackup = async () => {
    setIsTriggering(true);
    try {
      await backupsApi.trigger();
      setModalConfig({
        title: "Backup Initiated",
        message: "The system has successfully started a manual database snapshot. This recovery point will appear in the registry once processing is complete.",
        type: "success"
      });
      setShowModal(true);
      await load();
    } catch (err: any) {
      setModalConfig({
        title: "Backup Failed",
        message: err.response?.data?.message || "The system was unable to trigger a manual backup. Please verify your administrative permissions and storage availability.",
        type: "error"
      });
      setShowModal(true);
    } finally {
      setIsTriggering(false);
    }
  };

  const handleDownload = async (id: number) => {
    try {
      const response: any = await backupsApi.download(id);
      if (response.s3_url || response.download_url) {
        window.open(response.s3_url || response.download_url, '_blank');
      } else {
        alert("Secure download link could not be generated.");
      }
    } catch (err) {
      console.error("Download error", err);
      alert("Failed to retrieve the backup file.");
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
          <button 
            onClick={handleTriggerBackup} 
            disabled={isTriggering}
            className="btn-primary gap-3 py-3 px-8 shadow-xl shadow-primary-500/20 disabled:opacity-70 disabled:cursor-wait"
          >
            {isTriggering ? (
              <RefreshCw className="h-5 w-5 animate-spin" />
            ) : (
              <Play className="h-5 w-5" />
            )}
            <span className="font-bold">{isTriggering ? "Initializing..." : "Trigger Manual Backup"}</span>
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
               <div className="p-8 rounded-[2.5rem] bg-rose-50 border-2 border-rose-100 text-rose-600 space-y-4 shadow-lg shadow-rose-500/5">
                  <div className="flex items-center gap-4">
                    <ShieldAlert className="h-8 w-8 shrink-0" />
                    <div>
                      <h4 className="font-black text-lg">Access Denied or System Failure</h4>
                      <p className="text-sm font-medium opacity-80">{error}</p>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-rose-200/50 flex flex-wrap gap-4">
                    <div className="bg-white/50 px-4 py-2 rounded-xl border border-rose-200">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-rose-400 block">Resolved Tenant</span>
                      <span className="text-xs font-black text-rose-700">{resolveTenantCode() || "NONE"}</span>
                    </div>
                    <div className="bg-white/50 px-4 py-2 rounded-xl border border-rose-200">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-rose-400 block">Origin</span>
                      <span className="text-xs font-black text-rose-700">{window.location.origin}</span>
                    </div>
                  </div>
                  <button onClick={load} className="w-full btn-primary bg-rose-500 hover:bg-rose-600 text-white py-3 rounded-2xl shadow-xl shadow-rose-500/20">
                    Retry Connection
                  </button>
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
                                 <button 
                                   onClick={() => handleDownload(bk.id)}
                                   className="h-10 w-10 rounded-xl bg-secondary-50 flex items-center justify-center text-secondary-400 hover:bg-primary-500 hover:text-white transition-all shadow-sm"
                                 >
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

      {/* Feedback Modal */}
      <Modal 
        isOpen={showModal} 
        onClose={() => setShowModal(false)}
        title={modalConfig.title}
      >
        <div className="p-6 text-center">
          <div className={`h-20 w-20 mx-auto rounded-3xl flex items-center justify-center mb-6 ${
            modalConfig.type === 'success' ? 'bg-emerald-50 text-emerald-500' : 'bg-rose-50 text-rose-500'
          }`}>
            {modalConfig.type === 'success' ? (
              <CheckCircle2 className="h-10 w-10" />
            ) : (
              <XCircle className="h-10 w-10" />
            )}
          </div>
          <h3 className="text-xl font-black text-secondary-900 mb-2">{modalConfig.title}</h3>
          <p className="text-sm text-secondary-500 leading-relaxed mb-8">
            {modalConfig.message}
          </p>
          <button 
            onClick={() => setShowModal(false)}
            className={`w-full py-4 rounded-2xl font-bold text-white shadow-lg transition-all ${
              modalConfig.type === 'success' ? 'bg-emerald-500 shadow-emerald-500/20' : 'bg-rose-500 shadow-rose-500/20'
            }`}
          >
            Acknowledge
          </button>
        </div>
      </Modal>
    </div>
  );
}
