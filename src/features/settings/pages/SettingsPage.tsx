import {
  Settings as SettingsIcon,
  Mail,
  Shield,
  Bell,
  Database,
  Globe,
  Lock,
  ChevronRight,
  Building2,
  CreditCard,
  Cloud,
  ScrollText,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { DxPage, DxPageHeader, DxPanel } from "@/components/dx";
import { routes } from "@/config/routes";
import { FacilityProfileCard } from "@/features/tenant-modules/components/FacilityProfileCard";
import { useFacilityProfile } from "@/lib/modules/useFacilityProfile";

export function SettingsPage() {
  const navigate = useNavigate();
  const { label, workspaceName } = useFacilityProfile();

  const settingsGroups = [
    {
      title: "System & Communication",
      items: [
        { icon: Mail, label: "Email Configuration", desc: "SMTP servers, templates, and delivery logs", path: routes.emailSettings },
        { icon: Bell, label: "Notifications", desc: "Global alert preferences and SMS gateways", path: "#" },
        { icon: Cloud, label: "Background Jobs", desc: "Monitor automated tasks and system workers", path: routes.tenantJobs },
      ],
    },
    {
      title: "Organization & Security",
      items: [
        { icon: Building2, label: "Facility Profile", desc: "Facility details, logo and branding", path: routes.settingsBranding },
        { icon: Shield, label: "Access Control", desc: "RBAC roles and system permissions", path: routes.staff },
        { icon: ScrollText, label: "Audit Logs", desc: "Every create, update, delete and sign-in", path: routes.auditLogs },
        { icon: Lock, label: "Security & 2FA", desc: "Enforce multi-factor auth and session policies", path: "#" },
      ],
    },
    {
      title: "Infrastructure",
      items: [
        { icon: Globe, label: "Custom Domains", desc: "Manage white-label domains and SSL", path: routes.tenantDomains },
        { icon: CreditCard, label: "Subscription & Billing", desc: "Manage your Carepoint SaaS plan", path: routes.saasInvoices },
        { icon: Database, label: "Data Management", desc: "Backup policies and data exports", path: routes.backups },
      ],
    },
  ];

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Administration" }, { label: "Settings" }]}
        title="System Settings"
        subtitle={`Configure your ${workspaceName}'s operational parameters, security, and global infrastructure.`}
      />

      <FacilityProfileCard />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Console summary */}
        <div className="lg:col-span-1">
          <DxPanel>
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-lg bg-[var(--dx-accent-soft)] text-[var(--dx-accent)]">
              <SettingsIcon className="h-7 w-7" />
            </div>
            <h3 className="text-[17px] font-bold text-[var(--dx-text)]">{label} Console</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-[var(--dx-text-muted)]">
              Manage the core configuration of your workspace. Changes made here affect all users
              within your tenant.
            </p>
            <div className="mt-6 flex items-center justify-between border-t border-[var(--dx-border)] pt-5">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--dx-text-muted)]">
                  Platform Version
                </p>
                <p className="dx-mono mt-1 text-[12px] font-semibold text-[var(--dx-text)]">v2.4.12-pro</p>
              </div>
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--dx-success)]">
                <span className="h-2 w-2 rounded-full bg-[var(--dx-success)]" />
                Online
              </span>
            </div>
          </DxPanel>
        </div>

        {/* Settings groups */}
        <div className="space-y-8 lg:col-span-2">
          {settingsGroups.map((group, idx) => (
            <div key={idx} className="space-y-3">
              <h4 className="text-[10px] font-semibold uppercase tracking-widest text-[var(--dx-text-muted)]">
                {group.title}
              </h4>
              <div className="grid gap-3">
                {group.items.map((item, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => item.path !== "#" && navigate(item.path)}
                    className="group flex items-center justify-between rounded-lg border border-[var(--dx-border)] bg-[var(--dx-surface)] p-5 text-left transition-colors hover:border-[var(--dx-border-strong)]"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--dx-surface-sunken)] text-[var(--dx-text)]">
                        <item.icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h5 className="text-[14px] font-bold text-[var(--dx-text)]">{item.label}</h5>
                        <p className="text-[12px] text-[var(--dx-text-muted)]">{item.desc}</p>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-[var(--dx-text-faint)] transition-transform group-hover:translate-x-1" />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </DxPage>
  );
}
