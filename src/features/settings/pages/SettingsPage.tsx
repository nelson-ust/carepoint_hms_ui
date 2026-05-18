import { PageHeader } from "@/components/layout/PageHeader";
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
   Users,
   CreditCard,
   Cloud,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { routes } from "@/config/routes";

export function SettingsPage() {
   const navigate = useNavigate();

   const settingsGroups = [
      {
         title: "System & Communication",
         items: [
            { icon: Mail, label: "Email Configuration", desc: "SMTP servers, templates, and delivery logs", path: routes.emailSettings },
            { icon: Bell, label: "Notifications", desc: "Global alert preferences and SMS gateways", path: "#" },
            { icon: Cloud, label: "Background Jobs", desc: "Monitor automated tasks and system workers", path: routes.tenantJobs },
         ]
      },
      {
         title: "Organization & Security",
         items: [
            { icon: Building2, label: "Hospital Profile", desc: "Manage facility details and branding", path: "#" },
            { icon: Shield, label: "Access Control", desc: "RBAC roles and system permissions", path: routes.staff },
            { icon: Lock, label: "Security & 2FA", desc: "Enforce multi-factor auth and session policies", path: "#" },
         ]
      },
      {
         title: "Infrastructure",
         items: [
            { icon: Globe, label: "Custom Domains", desc: "Manage white-label domains and SSL", path: routes.tenantDomains },
            { icon: CreditCard, label: "Subscription & Billing", desc: "Manage your Carepoint SaaS plan", path: routes.saasInvoices },
            { icon: Database, label: "Data Management", desc: "Backup policies and data exports", path: "#" },
         ]
      }
   ];

   return (
      <div className="space-y-10 animate-fade-in pb-20">
         <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <PageHeader
               title="System Settings"
               description="Configure your hospital's operational parameters, security, and global infrastructure."
            />
         </div>

         <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            <div className="lg:col-span-1 space-y-6">
               <div className="glass-card rounded-[2.5rem] p-10 border border-secondary-400/50 bg-secondary-900 text-white shadow-premium">
                  <div className="h-16 w-16 rounded-2xl bg-white/10 flex items-center justify-center mb-8">
                     <SettingsIcon className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-xl font-black mb-2">Hospital Console</h3>
                  <p className="text-sm text-secondary-400 font-medium leading-relaxed">
                     Manage the core configuration of your healthcare facility. Changes made here affect all users within your tenant.
                  </p>
                  <div className="mt-10 pt-10 border-t border-white/10 flex items-center justify-between">
                     <div>
                        <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest">Platform Version</p>
                        <p className="text-xs font-bold mt-1">v2.4.12-pro</p>
                     </div>
                     <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  </div>
               </div>
            </div>

            <div className="lg:col-span-2 space-y-10">
               {settingsGroups.map((group, idx) => (
                  <div key={idx} className="space-y-4">
                     <h4 className="text-[10px] font-bold text-secondary-400 uppercase tracking-[0.3em] ml-4">{group.title}</h4>
                     <div className="grid gap-3">
                        {group.items.map((item, i) => (
                           <div
                              key={i}
                              onClick={() => item.path !== '#' && navigate(item.path)}
                              className="glass-card rounded-[2rem] p-6 border border-secondary-400/50 bg-white/40 hover:bg-white/60 transition-all group cursor-pointer flex items-center justify-between"
                           >
                              <div className="flex items-center gap-6">
                                 <div className="h-12 w-12 rounded-xl bg-secondary-900/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <item.icon className="h-5 w-5 text-secondary-900" />
                                 </div>
                                 <div>
                                    <h5 className="text-sm font-black text-secondary-900">{item.label}</h5>
                                    <p className="text-xs text-secondary-500 font-medium">{item.desc}</p>
                                 </div>
                              </div>
                              <ChevronRight className="h-5 w-5 text-secondary-200 group-hover:translate-x-1 transition-transform" />
                           </div>
                        ))}
                     </div>
                  </div>
               ))}
            </div>
         </div>
      </div>
   );
}
