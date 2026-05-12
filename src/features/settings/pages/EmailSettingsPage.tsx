import { PageHeader } from "@/components/layout/PageHeader";
import {
  Mail,
  Server,
  Shield,
  Settings as SettingsIcon,
  RefreshCw,
  Plus,
  Trash2,
  CheckCircle2,
  Send,
  MoreHorizontal,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { useEmailConfigs, useDeleteEmailConfig, useTestEmailConfig } from "../hooks/use-email-settings";
import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { CreateEmailConfigForm } from "../components/CreateEmailConfigForm";

export function EmailSettingsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { data, isLoading, error, refetch } = useEmailConfigs();
  const deleteMutation = useDeleteEmailConfig();
  const testMutation = useTestEmailConfig();
  
  const configs = data?.items || [];

  return (
    <div className="space-y-10 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <PageHeader
          title="Email Configuration"
          description="Configure SMTP servers and email providers for automated system notifications."
        />
        <button 
           onClick={() => setIsModalOpen(true)}
           className="btn-primary gap-3 py-3 px-8 shadow-xl shadow-primary-500/20"
        >
          <Plus className="h-5 w-5" />
          <span className="font-bold">Add Configuration</span>
        </button>
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title="Add Email Provider"
        size="lg"
      >
        <CreateEmailConfigForm 
          onSuccess={() => {
            setIsModalOpen(false);
            refetch();
          }} 
          onCancel={() => setIsModalOpen(false)} 
        />
      </Modal>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Info Card */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-card rounded-[2.5rem] p-8 border border-secondary-100/50 bg-white/40">
             <div className="h-12 w-12 rounded-2xl bg-secondary-900/5 flex items-center justify-center mb-6">
                <SettingsIcon className="h-6 w-6 text-secondary-900" />
             </div>
             <h4 className="text-lg font-bold text-secondary-900 mb-2">Notification Hub</h4>
             <p className="text-sm text-secondary-500 leading-relaxed">
                Settings configured here affect all outgoing emails including patient reminders, 
                billing notifications, and staff invitations.
             </p>
          </div>

          <div className="glass-card rounded-[2.5rem] p-8 border border-primary-100 bg-primary-50/20">
             <div className="flex items-start gap-4">
                <Shield className="h-6 w-6 text-primary-500 shrink-0" />
                <div>
                   <h4 className="text-sm font-bold text-secondary-900 mb-1">Security Hint</h4>
                   <p className="text-xs text-secondary-500 leading-relaxed">
                      Always use TLS (Port 587 or 465) for secure transmissions. 
                      Plain SMTP (Port 25) is not recommended.
                   </p>
                </div>
             </div>
          </div>
        </div>

        {/* Configurations List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-secondary-900 flex items-center gap-2">
              <Server className="h-5 w-5 text-primary-500" />
              SMTP Providers
            </h3>
            <button onClick={() => refetch()} className="p-2 hover:bg-secondary-100 rounded-xl transition-all">
              <RefreshCw className={`h-4 w-4 text-secondary-400 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="space-y-4">
            {isLoading ? (
              Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="h-32 bg-white/40 rounded-[2rem] animate-pulse" />
              ))
            ) : configs.length > 0 ? (
              configs.map((config) => (
                <div 
                  key={config.id}
                  className="glass-card rounded-[2rem] p-6 border border-secondary-100/50 bg-white/40 hover:bg-white/60 transition-all group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-5">
                      <div className="h-14 w-14 rounded-2xl bg-secondary-900 text-white flex items-center justify-center shadow-lg shadow-secondary-900/10">
                        <Mail className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-3">
                          <h4 className="font-bold text-secondary-900">{config.provider_name}</h4>
                          {config.is_active && (
                             <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-600 text-[10px] font-bold border border-emerald-100">
                                ACTIVE
                             </span>
                          )}
                        </div>
                        <p className="text-xs text-secondary-500 mt-1 font-medium">
                          {config.smtp_host}:{config.smtp_port} • {config.sender_email}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                       <button 
                        onClick={() => testMutation.mutate(config.id)}
                        disabled={testMutation.isPending}
                        className="btn-secondary py-2 px-4 rounded-xl text-[10px] font-bold"
                       >
                          Test Connection
                       </button>
                       <div className="relative">
                          <button className="p-2.5 hover:bg-secondary-100 rounded-xl transition-all">
                            <MoreHorizontal className="h-5 w-5 text-secondary-400" />
                          </button>
                       </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-20 text-center bg-white/20 rounded-[2.5rem] border-2 border-dashed border-secondary-100">
                <AlertCircle className="h-12 w-12 mx-auto text-secondary-100 mb-4" />
                <p className="text-secondary-500 font-bold">No email providers configured yet.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
