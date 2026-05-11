import { PageHeader } from "@/components/layout/PageHeader";
import { useForm, useFieldArray } from "react-hook-form";
import type { Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar, 
  ShieldCheck, 
  Save, 
  X, 
  Activity, 
  Users, 
  Contact, 
  FileText, 
  AlertCircle,
  Heart,
  CreditCard,
  Award,
  Plus,
  Trash2
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { routes } from "@/config/routes";
import { createPatient } from "../api/patients.api";
import { useState } from "react";

const patientSchema = z.object({
  first_name: z.string().min(2, "First name is required"),
  last_name: z.string().min(2, "Last name is required"),
  middle_name: z.string().optional().or(z.literal("")),
  date_of_birth: z.string().min(1, "Date of birth is required"),
  gender: z.string().min(1, "Gender is required"),
  marital_status: z.string().optional().or(z.literal("")),
  phone_number: z.string().min(10, "Valid phone number required"),
  alternate_phone_number: z.string().optional().or(z.literal("")),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  address: z.string().min(5, "Residential address is required"),
  city: z.string().min(2, "City is required"),
  state: z.string().min(2, "State is required"),
  country: z.string().min(2, "Country is required").default("Nigeria"),
  blood_group: z.string().optional().or(z.literal("")),
  genotype: z.string().optional().or(z.literal("")),
  allergies: z.string().optional().or(z.literal("")),
  emergency_contact_name: z.string().optional().or(z.literal("")),
  emergency_contact_phone: z.string().optional().or(z.literal("")),
  emergency_contact_relationship: z.string().optional().or(z.literal("")),
  next_of_kin_name: z.string().optional().or(z.literal("")),
  next_of_kin_phone: z.string().optional().or(z.literal("")),
  next_of_kin_relationship: z.string().optional().or(z.literal("")),
  next_of_kin_address: z.string().optional().or(z.literal("")),
  patient_type: z.string().default("INDIVIDUAL"),
  payer_type: z.string().default("CASH"),
  preferred_payer_id: z.coerce.number().optional().or(z.literal(0)),
  national_identifier: z.string().optional().or(z.literal("")),
  national_identifier_type: z.string().optional().or(z.literal("")),
  hospital_number: z.string().optional().or(z.literal("")),
  registration_notes: z.string().optional().or(z.literal("")),
  previous_identifiers: z.array(z.object({
    identifier_type: z.string(),
    identifier_value: z.string(),
    issuing_authority: z.string().optional(),
    is_primary: z.boolean().default(false),
    is_active: z.boolean().default(true),
    note: z.string().optional(),
  })).optional(),
  insurance_enrollment: z.object({
    insurance_provider_id: z.coerce.number(),
    policy_number: z.string(),
    member_id: z.string().optional(),
    plan_name: z.string().optional(),
    status: z.string().optional().default("ACTIVE"),
    valid_from: z.string().optional(),
    valid_to: z.string().optional(),
    note: z.string().optional(),
  }).optional(),
  loyalty_enrollment: z.object({
    loyalty_program_id: z.coerce.number(),
    membership_no: z.string(),
    joined_date: z.string().optional().default(new Date().toISOString()),
    note: z.string().optional(),
  }).optional(),
});

type FormData = z.infer<typeof patientSchema>;

export function PatientRegistrationPage() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<"basic" | "clinical" | "insurance" | "loyalty">("basic");

  const { register, handleSubmit, control, watch, formState: { errors } } = useForm<FormData>({
    // The schema's INPUT type differs from its OUTPUT type because of
    // `.default()` and `.optional().or(z.literal(""))` — coerce to the OUTPUT
    // type so the useForm generic stays consistent.
    resolver: zodResolver(patientSchema) as unknown as Resolver<FormData>,
    defaultValues: {
      patient_type: "INDIVIDUAL",
      payer_type: "CASH",
      country: "Nigeria",
      previous_identifiers: [],
    },
  });

  const { fields: identifierFields, append: appendIdentifier, remove: removeIdentifier } = useFieldArray({
    control,
    name: "previous_identifiers"
  });

  const payerType = watch("payer_type");

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    setError(null);
    try {
      // Deep clean: OMIT empty strings, nulls, undefined, and empty objects
      // entirely. The backend rejects `null` on optional string fields and
      // expects them to be absent from the payload.
      const cleanData = (obj: any): any => {
        if (Array.isArray(obj)) {
          return obj
            .map(cleanData)
            .filter((v) => v !== undefined && v !== null && v !== "");
        }
        if (obj !== null && typeof obj === "object") {
          const out: Record<string, any> = {};
          for (const [k, v] of Object.entries(obj)) {
            const cleaned = cleanData(v);
            if (cleaned === undefined || cleaned === null || cleaned === "") continue;
            // Drop empty arrays / objects entirely
            if (Array.isArray(cleaned) && cleaned.length === 0) continue;
            if (
              typeof cleaned === "object" &&
              !Array.isArray(cleaned) &&
              Object.keys(cleaned).length === 0
            )
              continue;
            out[k] = cleaned;
          }
          return out;
        }
        return obj;
      };

      const payload = cleanData(data) as any;

      // Ensure specific optional sub-objects are removed when their PK is missing
      if (!payload.insurance_enrollment?.insurance_provider_id) {
        delete payload.insurance_enrollment;
      }
      if (!payload.loyalty_enrollment?.loyalty_program_id) {
        delete payload.loyalty_enrollment;
      }

      await createPatient(payload, { forceCreateIfPossibleDuplicate: false });
      navigate(routes.patients);
    } catch (err: any) {
      // Surface the most informative error available (FastAPI uses `detail`,
      // some endpoints use `message`, validation errors come back as arrays).
      const data = err?.response?.data;
      const message =
        (typeof data?.message === "string" && data.message) ||
        (typeof data?.detail === "string" && data.detail) ||
        (Array.isArray(data?.detail) &&
          data.detail
            .map((d: any) => `${d.loc?.join(".") ?? "field"}: ${d.msg ?? "invalid"}`)
            .join(" · ")) ||
        (err?.message?.includes("Network Error")
          ? "Server returned an error. Please double-check the form and try again."
          : null) ||
        "Failed to register patient. Please verify the information.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const SectionTab = ({ id, label, icon: Icon }: { id: typeof activeSection, label: string, icon: any }) => (
    <button
      type="button"
      onClick={() => setActiveSection(id)}
      className={`flex items-center gap-3 px-6 py-4 rounded-2xl transition-all duration-300 font-bold text-sm ${
        activeSection === id 
        ? "bg-primary-600 text-white shadow-lg shadow-primary-500/20 translate-y-[-2px]" 
        : "text-secondary-500 hover:bg-secondary-50"
      }`}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </button>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in pb-20">
      <div className="flex items-center justify-between">
        <PageHeader 
          title="Patient Onboarding" 
          description="Register new patients with full enterprise clinical and administrative profiles."
        />
        <button 
          onClick={() => navigate(routes.patients)}
          className="btn-secondary px-4 py-2 flex items-center gap-2"
        >
          <X className="h-4 w-4" />
          <span>Exit</span>
        </button>
      </div>

      <div className="flex gap-4 p-2 bg-white/50 backdrop-blur-md rounded-[2rem] border border-secondary-100 overflow-x-auto scrollbar-hide">
        <SectionTab id="basic" label="Identity & Contact" icon={User} />
        <SectionTab id="clinical" label="Clinical Profile" icon={Heart} />
        <SectionTab id="insurance" label="Insurance Details" icon={ShieldCheck} />
        <SectionTab id="loyalty" label="Loyalty Program" icon={Award} />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-10">
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl text-sm flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-rose-500" />
            {error}
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-1">
          {/* Identity Section */}
          {activeSection === "basic" && (
            <div className="space-y-8 animate-slide-up">
              <div className="glass-card rounded-[2.5rem] p-10 md:p-12 space-y-10">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-xl bg-primary-500 flex items-center justify-center text-white">
                    <User className="h-5 w-5" />
                  </div>
                  <h3 className="text-xl font-bold font-display">Demographics</h3>
                </div>

                <div className="grid gap-6 md:grid-cols-3">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-secondary-500">First Name</label>
                    <input {...register("first_name")} className="input-field" placeholder="Nelson" />
                    {errors.first_name && <p className="text-[10px] font-bold text-rose-500 mt-1">{errors.first_name.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-secondary-500">Middle Name</label>
                    <input {...register("middle_name")} className="input-field" placeholder="Optional" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-secondary-500">Last Name</label>
                    <input {...register("last_name")} className="input-field" placeholder="Mandela" />
                    {errors.last_name && <p className="text-[10px] font-bold text-rose-500 mt-1">{errors.last_name.message}</p>}
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-3">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-secondary-500">Date of Birth</label>
                    <input type="date" {...register("date_of_birth")} className="input-field" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-secondary-500">Gender</label>
                    <select {...register("gender")} className="input-field">
                      <option value="">Select</option>
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-secondary-500">Marital Status</label>
                    <select {...register("marital_status")} className="input-field">
                      <option value="">Select</option>
                      <option value="SINGLE">Single</option>
                      <option value="MARRIED">Married</option>
                      <option value="DIVORCED">Divorced</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="glass-card rounded-[2.5rem] p-10 md:p-12 space-y-10">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-xl bg-slate-900 flex items-center justify-center text-white">
                    <Phone className="h-5 w-5" />
                  </div>
                  <h3 className="text-xl font-bold font-display">Contact & Location</h3>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-secondary-500">Primary Phone</label>
                    <input {...register("phone_number")} className="input-field" placeholder="+234..." />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-secondary-500">Email Address</label>
                    <input {...register("email")} className="input-field" placeholder="nelson@mandela.org" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-secondary-500">Residential Address</label>
                  <textarea {...register("address")} className="input-field h-24 pt-3 resize-none" placeholder="Residential details..." />
                </div>

                <div className="grid gap-6 md:grid-cols-3">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-secondary-500">City</label>
                    <input {...register("city")} className="input-field" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-secondary-500">State</label>
                    <input {...register("state")} className="input-field" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-secondary-500">Country</label>
                    <input {...register("country")} className="input-field" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Clinical Section */}
          {activeSection === "clinical" && (
            <div className="space-y-8 animate-slide-up">
              <div className="glass-card rounded-[2.5rem] p-10 md:p-12 space-y-10">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-xl bg-rose-500 flex items-center justify-center text-white">
                    <Heart className="h-5 w-5" />
                  </div>
                  <h3 className="text-xl font-bold font-display">Medical Markers</h3>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-secondary-500">Blood Group</label>
                    <select {...register("blood_group")} className="input-field">
                      <option value="">Unknown</option>
                      <option value="A+">A+</option>
                      <option value="O+">O+</option>
                      <option value="B+">B+</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-secondary-500">Genotype</label>
                    <select {...register("genotype")} className="input-field">
                      <option value="">Unknown</option>
                      <option value="AA">AA</option>
                      <option value="AS">AS</option>
                      <option value="SS">SS</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-secondary-500">Known Allergies</label>
                  <textarea {...register("allergies")} className="input-field h-32 pt-3 resize-none" placeholder="List clinical sensitivities..." />
                </div>
              </div>

              <div className="glass-card rounded-[2.5rem] p-10 md:p-12 space-y-10">
                <div className="flex items-center gap-4 justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-xl bg-indigo-500 flex items-center justify-center text-white">
                      <FileText className="h-5 w-5" />
                    </div>
                    <h3 className="text-xl font-bold font-display">Historical Identifiers</h3>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => appendIdentifier({ identifier_type: "HOSPITAL_ID", identifier_value: "", is_primary: false, is_active: true })}
                    className="btn-secondary gap-2 px-4 py-2"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add ID</span>
                  </button>
                </div>

                <div className="space-y-6">
                  {identifierFields.map((field, index) => (
                    <div key={field.id} className="p-6 bg-secondary-50/50 rounded-2xl border border-secondary-100 flex gap-6 items-end">
                      <div className="flex-1 grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500">ID Type</label>
                          <input {...register(`previous_identifiers.${index}.identifier_type`)} className="input-field bg-white" placeholder="e.g. OLD_MRN" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500">ID Value</label>
                          <input {...register(`previous_identifiers.${index}.identifier_value`)} className="input-field bg-white" placeholder="Value..." />
                        </div>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => removeIdentifier(index)}
                        className="p-3 text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  ))}
                  {identifierFields.length === 0 && (
                    <p className="text-center py-10 text-secondary-400 text-sm italic">No historical identifiers added.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Insurance Section */}
          {activeSection === "insurance" && (
            <div className="animate-slide-up">
              <div className="glass-card rounded-[2.5rem] p-10 md:p-12 space-y-10">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <h3 className="text-xl font-bold font-display">Health Coverage Enrollment</h3>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-secondary-500">Provider ID</label>
                    <input type="number" {...register("insurance_enrollment.insurance_provider_id")} className="input-field" placeholder="1" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-secondary-500">Policy Number</label>
                    <input {...register("insurance_enrollment.policy_number")} className="input-field" placeholder="POL-12345" />
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-secondary-500">Plan Name</label>
                    <input {...register("insurance_enrollment.plan_name")} className="input-field" placeholder="Premium Gold" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-secondary-500">Member ID</label>
                    <input {...register("insurance_enrollment.member_id")} className="input-field" placeholder="MEM-990" />
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-secondary-500">Valid From</label>
                    <input type="date" {...register("insurance_enrollment.valid_from")} className="input-field" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-secondary-500">Valid To</label>
                    <input type="date" {...register("insurance_enrollment.valid_to")} className="input-field" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Loyalty Section */}
          {activeSection === "loyalty" && (
            <div className="animate-slide-up">
              <div className="glass-card rounded-[2.5rem] p-10 md:p-12 space-y-10">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-xl bg-amber-500 flex items-center justify-center text-white">
                    <Award className="h-5 w-5" />
                  </div>
                  <h3 className="text-xl font-bold font-display">Loyalty Rewards Enrollment</h3>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-secondary-500">Program ID</label>
                    <input type="number" {...register("loyalty_enrollment.loyalty_program_id")} className="input-field" placeholder="1" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-secondary-500">Membership No.</label>
                    <input {...register("loyalty_enrollment.membership_no")} className="input-field" placeholder="LOY-555" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-secondary-500">Enrollment Note</label>
                  <textarea {...register("loyalty_enrollment.note")} className="input-field h-32 pt-3 resize-none" placeholder="Additional details..." />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Global Footer Controls */}
        <div className="flex items-center justify-between p-8 glass-card rounded-[2.5rem] bg-slate-900 text-white shadow-2xl">
          <div className="hidden md:block">
            <p className="font-bold">Summary Review</p>
            <p className="text-xs text-white/50 tracking-wide">Please ensure all mandatory clinical fields are populated before saving.</p>
          </div>
          <div className="flex gap-4 w-full md:w-auto">
            <button 
              type="button" 
              onClick={() => navigate(routes.patients)}
              className="flex-1 md:flex-none px-8 py-4 rounded-2xl border border-white/20 font-bold text-sm hover:bg-white/10 transition-all"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="flex-1 md:flex-none bg-primary-500 hover:bg-primary-600 px-12 py-4 rounded-2xl font-bold text-sm shadow-xl shadow-primary-500/20 transition-all flex items-center justify-center gap-3"
            >
              {isSubmitting ? "Syncing..." : (
                <>
                  <Save className="h-5 w-5" />
                  <span>Finalize Admission</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
