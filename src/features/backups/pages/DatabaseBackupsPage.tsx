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
import { backupsApi, type Backup, type BackupSummary } from "../api/backups.api";
import { Modal } from "@/components/ui/Modal";
import { resolveTenantCode } from "@/lib/tenant/tenant-resolver";

export function DatabaseBackupsPage() {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [summary, setSummary] = useState<BackupSummary | null>(null);
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
      const data = await backupsApi.getDashboard();
      setBackups(data.backups || []);
      setSummary(data.summary || null);
    } catch (err: any) {
      console.error("Backup load error:", err);
      const status = err?.response?.status;
      const serverMsg = err?.response?.data?.message;
      if (!err?.response) {
        setError("Cannot reach the API server. Check that the backend is running, then retry.");
      } else if (status === 401 || status === 403) {
        setError(
          serverMsg ||
            "You don't have permission to view backups (requires BACKUP_READ). Ask your administrator to grant it via Roles & Permissions.",
        );
      } else {
        setError(serverMsg || "The backup service returned an error. Please retry, and contact support if it persists.");
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
        window.open(response.s3_url || response.download_url, "_blank", "noopener");
      } else {
        setModalConfig({
          title: "Download Unavailable",
          message: "A secure download link could not be generated for this recovery point.",
          type: "error",
        });
        setShowModal(true);
      }
    } catch (err: any) {
      console.error("Download error", err);
      setModalConfig({
        title: "Download Failed",
        message: err?.response?.data?.message || "The backup file could not be retrieved.",
        type: "error",
      });
      setShowModal(true);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const formatSize = (bytes?: number | null) => {
    if (!bytes || bytes === 0) return '0 B';
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
          <button onClick={load} className="btn-secondary p-4 rounded-2xl bg-white/80 border-secondary-400 transition-all">
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
          <div className="glass-card rounded-[2.5rem] p-8 border border-secondary-400/50 bg-white/40 shadow-premium">
            <div className="h-16 w-16 rounded-2xl bg-primary-900 text-white flex items-center justify-center mb-6 shadow-lg shadow-primary-900/20">
              <ShieldCheck className="h-8 w-8" />
            </div>
            {isLoading ? (
              <div className="space-y-4">
                <div className="h-7 w-40 rounded-xl bg-secondary-100/50 animate-pulse" />
                <div className="h-4 w-full rounded-xl bg-secondary-100/40 animate-pulse" />
              </div>
            ) : (
              <>
                <h4 className="text-xl font-black text-secondary-900 mb-2">
                  Health: {summary?.health_status ?? "—"}
                </h4>
                <p className="text-xs text-secondary-500 leading-relaxed mb-8">
                  {summary?.health_description ?? "Backup health information is unavailable."}
                </p>
                <div className="space-y-6">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest mb-1">Last Backup</span>
                    <span className="text-sm font-black text-secondary-900">
                      {summary?.last_backup_at ? new Date(summary.last_backup_at).toLocaleString() : "—"}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest mb-1">Retention Policy</span>
                    <span className="text-sm font-black text-secondary-900">{summary?.retention_policy ?? "—"}</span>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="glass-card rounded-[2.5rem] p-8 border border-secondary-400/50 bg-emerald-500 text-white shadow-xl shadow-emerald-500/20">
            <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center mb-6">
              <HardDrive className="h-6 w-6" />
            </div>
            <h4 className="text-lg font-bold mb-2">Storage Usage</h4>
            {isLoading ? (
              <div className="h-9 w-28 rounded-xl bg-white/20 animate-pulse mb-2" />
            ) : (
              <p className="text-3xl font-black mb-2">
                {summary ? `${summary.storage_usage_gb.toLocaleString()} GB` : "—"}
              </p>
            )}
            <p className="text-xs text-emerald-100 font-medium">
              {summary
                ? `Used across ${summary.recovery_points_count.toLocaleString()} recovery point${summary.recovery_points_count === 1 ? "" : "s"}`
                : "Recovery point information unavailable"}
            </p>
          </div>
        </div>

        {/* Backup History */}
        <div className="lg:col-span-3 space-y-6">
          {error && (
            <div className="p-8 rounded-[2.5rem] bg-rose-50 border-2 border-rose-100 text-rose-600 space-y-4 shadow-lg shadow-rose-500/5">
              <div className="flex items-center gap-4">
                <ShieldAlert className="h-8 w-8 shrink-0" />
                <div>
                  <h4 className="font-black text-lg">Couldn't load backups</h4>
                  <p className="text-sm font-medium opacity-80">{error}</p>
                  <p className="mt-1 text-[11px] font-bold uppercase tracking-widest text-rose-400">
                    Workspace: {resolveTenantCode() || "—"}
                  </p>
                </div>
              </div>
              <button onClick={load} className="w-full btn-primary bg-rose-500 hover:bg-rose-600 text-white py-3 rounded-2xl shadow-xl shadow-rose-500/20">
                Retry
              </button>
            </div>
          )}

          <div className="glass-card rounded-[2.5rem] overflow-hidden border border-secondary-400/50 shadow-premium bg-white/40">
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
                            <span className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest">{new Date(bk.date_created).toLocaleString()}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-sm font-bold text-secondary-700">
                        {formatSize(bk.size_bytes)}
                      </td>
                      <td className="px-8 py-6">
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${bk.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
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
          <div className={`h-20 w-20 mx-auto rounded-3xl flex items-center justify-center mb-6 ${modalConfig.type === 'success' ? 'bg-emerald-50 text-emerald-500' : 'bg-rose-50 text-rose-500'
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
            className={`w-full py-4 rounded-2xl font-bold text-white shadow-lg transition-all ${modalConfig.type === 'success' ? 'bg-emerald-500 shadow-emerald-500/20' : 'bg-rose-500 shadow-rose-500/20'
              }`}
          >
            Acknowledge
          </button>
        </div>
      </Modal>
    </div>
  );
}
