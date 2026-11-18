import {
  Mail,
  Server,
  Shield,
  Settings as SettingsIcon,
  RotateCcw,
  Plus,
  MoreHorizontal,
  AlertCircle,
} from "lucide-react";
import { useState } from "react";
import {
  DxPage,
  DxPageHeader,
  DxPanel,
  DxBadge,
  DxButton,
  DxPopup,
  DxMessage,
} from "@/components/dx";
import { useEmailConfigs, useDeleteEmailConfig, useTestEmailConfig } from "../hooks/use-email-settings";
import { CreateEmailConfigForm } from "../components/CreateEmailConfigForm";

export function EmailSettingsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { data, isLoading, error, refetch } = useEmailConfigs();
  const deleteMutation = useDeleteEmailConfig();
  const testMutation = useTestEmailConfig();

  const configs = data?.items || [];

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Settings" }, { label: "Email" }]}
        title="Email Configuration"
        subtitle="Configure SMTP servers and email providers for automated system notifications."
        actions={
          <DxButton variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setIsModalOpen(true)}>
            Add configuration
          </DxButton>
        }
      />

      <DxPopup
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
      </DxPopup>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Info cards */}
        <div className="space-y-4 lg:col-span-1">
          <DxPanel>
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--dx-surface-sunken)] text-[var(--dx-text)]">
              <SettingsIcon className="h-6 w-6" />
            </div>
            <h4 className="text-[15px] font-bold text-[var(--dx-text)]">Notification Hub</h4>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--dx-text-muted)]">
              Settings configured here affect all outgoing emails including patient reminders,
              billing notifications, and staff invitations.
            </p>
          </DxPanel>

          <DxMessage tone="info" title="Security Hint">
            Always use TLS (Port 587 or 465) for secure transmissions. Plain SMTP (Port 25) is not
            recommended.
          </DxMessage>
        </div>

        {/* Configurations list */}
        <div className="space-y-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-[15px] font-bold text-[var(--dx-text)]">
              <Server className="h-5 w-5 text-[var(--dx-accent)]" />
              SMTP Providers
            </h3>
            <DxButton icon title="Refresh" variant="text" onClick={() => refetch()} isLoading={isLoading}>
              <RotateCcw />
            </DxButton>
          </div>

          <div className="space-y-4">
            {isLoading ? (
              Array.from({ length: 2 }).map((_, i) => <div key={i} className="dx-skeleton h-28 w-full" />)
            ) : configs.length > 0 ? (
              configs.map((config) => (
                <div
                  key={config.id}
                  className="rounded-lg border border-[var(--dx-border)] bg-[var(--dx-surface)] p-5 transition-colors hover:border-[var(--dx-border-strong)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--dx-accent-soft)] text-[var(--dx-accent)]">
                        <Mail className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-3">
                          <h4 className="text-[14px] font-bold text-[var(--dx-text)]">{config.provider_name}</h4>
                          {config.is_active ? (
                            <DxBadge tone="success" dot>
                              Active
                            </DxBadge>
                          ) : null}
                        </div>
                        <p className="mt-1 text-[12px] font-medium text-[var(--dx-text-muted)]">
                          {config.smtp_host}:{config.smtp_port} • {config.sender_email}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <DxButton
                        size="sm"
                        onClick={() => testMutation.mutate(config.id)}
                        disabled={testMutation.isPending}
                      >
                        Test connection
                      </DxButton>
                      <DxButton icon size="sm" variant="text" title="More">
                        <MoreHorizontal />
                      </DxButton>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <DxPanel>
                <div className="py-14 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-[var(--dx-surface-sunken)]">
                    <AlertCircle className="h-8 w-8 text-[var(--dx-text-faint)]" />
                  </div>
                  <p className="text-[14px] font-semibold text-[var(--dx-text)]">
                    No email providers configured yet.
                  </p>
                </div>
              </DxPanel>
            )}
          </div>
          {error ? <DxMessage tone="danger">Failed to load email configurations.</DxMessage> : null}
        </div>
      </div>
    </DxPage>
  );
}
