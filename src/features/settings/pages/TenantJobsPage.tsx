import { PageHeader } from "@/components/layout/PageHeader";
import {
  Clock,
  Play,
  Settings as SettingsIcon,
  RefreshCw,
  Plus,
  Trash2,
  CheckCircle2,
  MoreHorizontal,
  ChevronRight,
  AlertCircle,
  Activity,
  Calendar,
} from "lucide-react";
import { useTenantJobs, useJobHandlers, useDeleteJob } from "../hooks/use-tenant-jobs";
import { format } from "date-fns";

export function TenantJobsPage() {
  const { data, isLoading, refetch } = useTenantJobs();
  const { data: handlers } = useJobHandlers();
  const deleteMutation = useDeleteJob();
  
  const jobs = data?.items || [];

  return (
    <div className="space-y-10 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <PageHeader
          title="Scheduled Jobs"
          description="Manage automated background tasks, data syncs, and system maintenance schedules."
        />
        <button className="btn-primary gap-3 py-3 px-8 shadow-xl shadow-primary-500/20">
          <Plus className="h-5 w-5" />
          <span className="font-bold">Create New Job</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Handlers Info */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-card rounded-[2.5rem] p-8 border border-secondary-100/50 bg-white/40">
             <h4 className="text-sm font-bold text-secondary-900 uppercase tracking-widest mb-6">Available Handlers</h4>
             <div className="space-y-4">
                {handlers?.map(handler => (
                  <div key={handler.name} className="p-4 rounded-2xl bg-secondary-900/5 border border-secondary-900/10">
                    <p className="text-xs font-black text-secondary-900">{handler.name}</p>
                    <p className="text-[10px] text-secondary-500 mt-1">{handler.description}</p>
                  </div>
                ))}
             </div>
          </div>
        </div>

        {/* Jobs List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-secondary-900 flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary-500" />
              Active Schedules
            </h3>
            <button onClick={() => refetch()} className="p-2 hover:bg-secondary-100 rounded-xl transition-all">
              <RefreshCw className={`h-4 w-4 text-secondary-400 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="space-y-4">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-28 bg-white/40 rounded-[2rem] animate-pulse" />
              ))
            ) : jobs.length > 0 ? (
              jobs.map((job) => (
                <div 
                  key={job.id}
                  className="glass-card rounded-[2.5rem] p-6 border border-secondary-100/50 bg-white/40 hover:bg-white/60 transition-all group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-5">
                      <div className="h-14 w-14 rounded-2xl bg-primary-500 text-white flex items-center justify-center shadow-lg shadow-primary-500/20">
                        <Clock className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-3">
                          <h4 className="font-bold text-secondary-900">{job.job_name}</h4>
                          <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${job.is_active ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-secondary-50 text-secondary-500 border-secondary-100'}`}>
                            {job.is_active ? 'ACTIVE' : 'PAUSED'}
                          </span>
                        </div>
                        <p className="text-xs text-secondary-400 mt-1 font-medium">
                          {job.handler_name} • {job.schedule_type}: {job.schedule_value}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                       <div className="text-right hidden sm:block">
                          <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest">Last Run</p>
                          <p className="text-[11px] font-bold text-secondary-900">
                             {job.last_run_at ? format(new Date(job.last_run_at), "MMM d, HH:mm") : 'Never'}
                          </p>
                       </div>
                       <button className="p-2.5 hover:bg-secondary-100 rounded-xl transition-all">
                          <MoreHorizontal className="h-5 w-5 text-secondary-400" />
                       </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-20 text-center bg-white/20 rounded-[2.5rem] border-2 border-dashed border-secondary-100">
                <p className="text-secondary-500 font-bold">No background jobs configured.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
