// carepoint_hms_ui/src/features/tenants/components/TenantRegistrationForm.tsx

import { useForm } from "react-hook-form";
import type { Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Building2, Mail, Phone, User, Lock, Globe, MapPin, ChevronRight, CheckCircle2 } from "lucide-react";
import { registerTenant, listSubscriptionPlans } from "../api/tenants.api";
import type { TenantRegistrationPayload, SubscriptionPlan } from "../api/tenants.api";
import { useState, useEffect } from "react";

const registrationSchema = z.object({
  tenant_name: z.string().min(5, "Organization name must be at least 5 characters"),
  tenant_code: z.string().min(3, "Tenant code must be at least 3 characters").regex(/^[A-Z0-9]+$/, "Code must be uppercase alphanumeric"),
  billing_email: z.string().email("Invalid email address"),
  billing_phone: z.string().min(10, "Invalid phone number"),
  billing_contact_name: z.string().min(3, "Contact name is required"),
  billing_address: z.string().min(5, "Billing address is required"),
  tax_id: z.string().optional(),
  plan_code: z.string().min(1, "Please select a plan"),
  admin_email: z.string().email("Invalid admin email"),
  admin_username: z.string().min(3, "Admin username is required"),
  admin_password: z.string().min(8, "Password must be at least 8 characters"),
  admin_first_name: z.string().min(2, "First name is required"),
  admin_last_name: z.string().min(2, "Last name is required"),
});

type FormData = z.infer<typeof registrationSchema>;

export function TenantRegistrationForm() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors }, trigger, setValue, watch } = useForm<FormData>({
    resolver: zodResolver(registrationSchema) as unknown as Resolver<FormData>,
    defaultValues: {
      plan_code: "BASIC",
    },
  });

  useEffect(() => {
    async function fetchData() {
      try {
        const availablePlans = await listSubscriptionPlans();
        setPlans(availablePlans);

        if (availablePlans.length > 0) {
          const basicPlan = availablePlans.find(p => p.code?.toUpperCase() === "BASIC") || availablePlans[0];
          setSelectedPlan(basicPlan);
          setValue("plan_code", basicPlan.code || "BASIC");
        }
      } catch (err) {
        console.error("Failed to fetch onboarding data", err);
      }
    }
    fetchData();
  }, [setValue]);

  const nextStep = async () => {
    let fieldsToValidate: (keyof FormData)[] = [];
    if (step === 1) fieldsToValidate = ["tenant_name", "tenant_code"];
    if (step === 2) fieldsToValidate = ["billing_contact_name", "billing_email", "billing_phone", "billing_address"];
    if (step === 3) fieldsToValidate = ["admin_first_name", "admin_last_name", "admin_email", "admin_username", "admin_password"];
    if (step === 4) fieldsToValidate = ["plan_code"];

    const isValid = await trigger(fieldsToValidate);
    if (isValid) setStep(step + 1);
  };

  const onSubmit = async (data: FormData) => {
    console.log("[Registration] Starting submission with data:", data);
    setIsSubmitting(true);
    setError(null);
    try {
      // Clean up optional fields
      const payload: any = { ...data };
      
      // Construct the domain_url automatically from tenant_code
      payload.domain_url = `https://${payload.tenant_code.toLowerCase()}.carepoint-hms.com`;
      
      if (!payload.tax_id) {
        payload.tax_id = "N/A";
      }

      console.log("[Registration] Cleaned payload to be sent:", payload);

      const result = await registerTenant(payload as TenantRegistrationPayload);
      console.log("[Registration] Success response:", result);
      setIsSuccess(true);
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || "Failed to register tenant. Please check your information.";
      const validationDetails = err.response?.data?.detail;
      
      console.error("[Registration] Error during submission:", {
        status: err.response?.status,
        message: errorMsg,
        details: validationDetails,
        fullError: err
      });

      setError(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="text-center py-12 animate-in zoom-in duration-300">
        <div className="mx-auto h-20 w-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
          <CheckCircle2 className="h-12 w-12 text-emerald-500" />
        </div>
        <h2 className="text-3xl font-bold text-slate-900">Application Submitted!</h2>
        <p className="mt-4 text-slate-600 max-w-md mx-auto">
          Your request to join Carepoint HMS has been received. Our team will review your application and contact you via email shortly.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-8 btn-primary px-8"
        >
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Progress Stepper */}
      <div className="flex items-center justify-between mb-12 px-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center">
            <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold transition-all duration-300 ${step >= i ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "bg-slate-200 text-slate-500"
              }`}>
              {i}
            </div>
            {i < 4 && (
              <div className={`h-1 w-12 md:w-24 mx-2 rounded-full transition-all duration-500 ${step > i ? "bg-emerald-500" : "bg-slate-200"
                }`} />
            )}
          </div>
        ))}
      </div>

      <div className="glass-card rounded-3xl p-8 md:p-12">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          {error && (
            <div className="p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl text-sm flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-rose-500" />
              {error}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-xl font-bold">Organization Identity</h3>
                <p className="text-sm text-slate-500">Tell us about your hospital or clinic</p>
              </div>
              <div className="grid gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Hospital Name</label>
                  <div className="relative group">
                    <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                    <input {...register("tenant_name")} className="input-field pl-12" placeholder="e.g. St. Nicholas Hospital" />
                  </div>
                  {errors.tenant_name && <p className="text-xs text-rose-500 mt-1">{errors.tenant_name.message}</p>}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Tenant Code (Uppercase letters/numbers)</label>
                  <div className="relative group">
                    <Globe className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                    <input {...register("tenant_code")} className="input-field pl-12" placeholder="e.g. STNICHOLAS" />
                  </div>
                  {errors.tenant_code && <p className="text-xs text-rose-500 mt-1">{errors.tenant_code.message}</p>}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-xl font-bold">Billing & Contact</h3>
                <p className="text-sm text-slate-500">Where should we send invoices?</p>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2 col-span-2">
                  <label className="text-sm font-semibold text-slate-700">Billing Contact Name</label>
                  <div className="relative group">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                    <input {...register("billing_contact_name")} className="input-field pl-12" placeholder="John Doe" />
                  </div>
                  {errors.billing_contact_name && <p className="text-xs text-rose-500 mt-1">{errors.billing_contact_name.message}</p>}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Billing Email</label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                    <input {...register("billing_email")} className="input-field pl-12" placeholder="billing@hospital.com" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Billing Phone</label>
                  <div className="relative group">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                    <input {...register("billing_phone")} className="input-field pl-12" placeholder="+234..." />
                  </div>
                </div>
                <div className="space-y-2 col-span-2">
                  <label className="text-sm font-semibold text-slate-700">Physical Address</label>
                  <div className="relative group">
                    <MapPin className="absolute left-4 top-3 h-5 w-5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                    <textarea {...register("billing_address")} className="input-field pl-12 h-24 pt-3 resize-none" placeholder="123 Hospital Road, Lagos" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-xl font-bold">Admin Credentials</h3>
                <p className="text-sm text-slate-500">The primary administrator for this tenant</p>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">First Name</label>
                  <input {...register("admin_first_name")} className="input-field" placeholder="Admin First Name" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Last Name</label>
                  <input {...register("admin_last_name")} className="input-field" placeholder="Admin Last Name" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Admin Username</label>
                  <input {...register("admin_username")} className="input-field" placeholder="admin.user" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Admin Email</label>
                  <input {...register("admin_email")} className="input-field" placeholder="admin@hospital.com" />
                </div>
                <div className="space-y-2 col-span-2">
                  <label className="text-sm font-semibold text-slate-700">Password</label>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                    <input type="password" {...register("admin_password")} className="input-field pl-12" placeholder="••••••••" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-xl font-bold">Select Subscription Plan</h3>
                <p className="text-sm text-slate-500">Choose the tier that fits your facility's needs</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {plans.map((p) => (
                  <div
                    key={p.code}
                    onClick={() => {
                      setSelectedPlan(p);
                      setValue("plan_code", p.code);
                    }}
                    className={`relative p-6 rounded-[2rem] border-2 transition-all cursor-pointer overflow-hidden flex flex-col ${selectedPlan?.code === p.code
                      ? "bg-emerald-50/50 border-emerald-500 shadow-xl shadow-emerald-500/10 scale-[1.02]"
                      : "bg-white border-slate-100 hover:border-emerald-200"
                      }`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className={`text-lg font-black ${selectedPlan?.code === p.code ? "text-emerald-900" : "text-slate-900"}`}>
                          {p.name}
                        </h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{p.code}</p>
                      </div>
                      {selectedPlan?.code === p.code && (
                        <div className="h-6 w-6 bg-emerald-500 rounded-full flex items-center justify-center animate-in zoom-in">
                          <CheckCircle2 className="h-4 w-4 text-white" />
                        </div>
                      )}
                    </div>

                    <div className="mb-6">
                      <p className="text-2xl font-black text-slate-900">
                        {p.currency} {Number(p.price).toLocaleString()}
                        <span className="text-xs font-bold text-slate-400"> / {p.interval.toLowerCase()}</span>
                      </p>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">{p.description}</p>
                    </div>

                    <div className="space-y-3 flex-1">
                      <div className="pt-3 border-t border-slate-100">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Capabilities</p>
                        <ul className="grid grid-cols-1 gap-1.5">
                          {[
                            { label: "Clinical", show: p.has_clinical },
                            { label: "Inpatient", show: p.has_inpatient },
                            { label: "Lab", show: p.has_laboratory },
                            { label: "Pharmacy", show: p.has_pharmacy },
                            { label: "Inventory", show: p.has_inventory },
                            { label: "Billing", show: p.has_billing },
                            { label: "Reporting", show: p.has_reporting },
                            { label: "Appointments", show: p.has_appointments },
                            { label: "Portal", show: p.has_patient_portal },
                          ].filter(f => f.show).map(f => (
                            <li key={f.label} className="flex items-center gap-2 text-[11px] font-bold text-slate-600">
                              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                              {f.label}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="pt-3 border-t border-slate-100">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Quotas</p>
                        <div className="flex flex-wrap gap-2">
                          <QuotaBadge label="Facilities" value={p.max_facilities} />
                          <QuotaBadge label="Users" value={p.max_users} />
                          <QuotaBadge label="Patients" value={p.max_patients} />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {errors.plan_code && <p className="text-xs text-rose-500 text-center font-bold animate-shake">{errors.plan_code.message}</p>}
            </div>
          )}

          <div className="flex items-center justify-between pt-6">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="btn-secondary"
              >
                Back
              </button>
            ) : (
              <div />
            )}

            {step < 4 ? (
              <button
                type="button"
                onClick={nextStep}
                className="btn-primary group"
              >
                Continue
                <ChevronRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary px-10"
              >
                {isSubmitting ? "Processing..." : "Complete Registration"}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

// =====================================================================
// Sub-components
// =====================================================================

function QuotaBadge({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="px-2 py-1 rounded-lg bg-slate-50 border border-slate-100 flex flex-col items-center min-w-[60px]">
      <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">{label}</span>
      <span className="text-[10px] font-black text-slate-900">{value === null ? "∞" : value}</span>
    </div>
  );
}
