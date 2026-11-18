import { useForm, useFieldArray } from "react-hook-form";
import type { Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  User,
  Phone,
  ShieldCheck,
  Save,
  X,
  FileText,
  Heart,
  Award,
  Plus,
  Trash2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { routes } from "@/config/routes";
import { useState, useEffect } from "react";
import {
  DxPage,
  DxPageHeader,
  DxPanel,
  DxForm,
  DxInput,
  DxSelect,
  DxTextarea,
  DxButton,
  DxMessage,
  DxTabs,
} from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import { useInsuranceProviders } from "@/features/insurance/hooks/use-insurance";
import { createPatient, getLoyaltyPrograms } from "../api/patients.api";
import type { LoyaltyProgram } from "../api/patients.api";

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
  patient_class: z.string().default("SELF_PAY"),
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
type SectionKey = "basic" | "clinical" | "insurance" | "loyalty";

const GENDER_OPTIONS = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "OTHER", label: "Other" },
];
const MARITAL_OPTIONS = [
  { value: "SINGLE", label: "Single" },
  { value: "MARRIED", label: "Married" },
  { value: "DIVORCED", label: "Divorced" },
  { value: "WIDOWED", label: "Widowed" },
];
const BLOOD_GROUP_OPTIONS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((v) => ({ value: v, label: v }));
const GENOTYPE_OPTIONS = ["AA", "AS", "SS", "SC", "AC"].map((v) => ({ value: v, label: v }));
const PATIENT_CLASS_OPTIONS = [
  { value: "SELF_PAY", label: "Normal (Self-pay)" },
  { value: "HMO", label: "HMO / Insurance" },
  { value: "RETAINERSHIP", label: "Retainership (Company-billed)" },
];

export function PatientRegistrationPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<SectionKey>("basic");
  const [loyaltyPrograms, setLoyaltyPrograms] = useState<LoyaltyProgram[]>([]);

  useEffect(() => {
    const fetchPrograms = async () => {
      try {
        const programs = await getLoyaltyPrograms();
        setLoyaltyPrograms(programs);
      } catch (err) {
        console.error("Failed to fetch loyalty programs:", err);
      }
    };
    fetchPrograms();
  }, []);

  const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm<FormData>({
    // The schema's INPUT type differs from its OUTPUT type because of
    // `.default()` and `.optional().or(z.literal(""))` — coerce to the OUTPUT
    // type so the useForm generic stays consistent.
    resolver: zodResolver(patientSchema) as unknown as Resolver<FormData>,
    defaultValues: {
      patient_type: "OUTPATIENT",
      payer_type: "CASH",
      patient_class: "SELF_PAY",
      country: "Nigeria",
      previous_identifiers: [],
    },
  });

  const { fields: identifierFields, append: appendIdentifier, remove: removeIdentifier } = useFieldArray({
    control,
    name: "previous_identifiers",
  });

  // Auto-generate membership number when a loyalty program is selected.
  const watchLoyaltyProgram = watch("loyalty_enrollment.loyalty_program_id");
  const currentMembershipNo = watch("loyalty_enrollment.membership_no");
  const patientClass = watch("patient_class");
  const providersQuery = useInsuranceProviders();
  const providers = providersQuery.data ?? [];

  useEffect(() => {
    if (watchLoyaltyProgram && !currentMembershipNo) {
      const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const random = Math.floor(1000 + Math.random() * 9000);
      setValue("loyalty_enrollment.membership_no", `LOY-${date}-${random}`);
    }
  }, [watchLoyaltyProgram, setValue, currentMembershipNo]);

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    setError(null);
    try {
      // Deep clean: OMIT empty strings, nulls, undefined, and empty objects
      // entirely. The backend rejects `null` on optional string fields and
      // expects them to be absent from the payload.
      const cleanData = (obj: unknown): unknown => {
        if (Array.isArray(obj)) {
          return obj
            .map(cleanData)
            .filter((v) => v !== undefined && v !== null && v !== "");
        }
        if (obj !== null && typeof obj === "object") {
          const out: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
            const cleaned = cleanData(v);
            if (cleaned === undefined || cleaned === null || cleaned === "") continue;
            // Drop empty arrays / objects entirely
            if (Array.isArray(cleaned) && cleaned.length === 0) continue;
            if (
              typeof cleaned === "object" &&
              !Array.isArray(cleaned) &&
              Object.keys(cleaned as object).length === 0
            )
              continue;
            out[k] = cleaned;
          }
          return out;
        }
        return obj;
      };

      const payload = cleanData(data) as {
        preferred_payer_id?: number;
        insurance_enrollment?: { insurance_provider_id?: number };
        loyalty_enrollment?: { loyalty_program_id?: number };
        [k: string]: unknown;
      };

      // Final sanitization for backend alignment
      if (payload.preferred_payer_id === 0) delete payload.preferred_payer_id;

      // Ensure specific optional sub-objects are removed when their PK is missing
      if (payload.insurance_enrollment && !payload.insurance_enrollment.insurance_provider_id) {
        delete payload.insurance_enrollment;
      }
      if (payload.patient_class === "SELF_PAY") {
        delete payload.insurance_enrollment;
      }
      if (payload.loyalty_enrollment && !payload.loyalty_enrollment.loyalty_program_id) {
        delete payload.loyalty_enrollment;
      }

      await createPatient(payload as Parameters<typeof createPatient>[0], { forceCreateIfPossibleDuplicate: false });
      toast.success("Patient registered", `${data.first_name} ${data.last_name} was added successfully.`);
      navigate(routes.patients);
    } catch (err: unknown) {
      // Surface the most informative error available (FastAPI uses `detail`,
      // some endpoints use `message`, validation errors come back as arrays).
      const ax = err as {
        response?: { data?: { message?: unknown; detail?: unknown } };
        message?: string;
      };
      const resp = ax?.response?.data;
      const message =
        (typeof resp?.message === "string" && resp.message) ||
        (typeof resp?.detail === "string" && resp.detail) ||
        (Array.isArray(resp?.detail) &&
          resp.detail
            .map((d: { loc?: unknown[]; msg?: string }) => `${d.loc?.join(".") ?? "field"}: ${d.msg ?? "invalid"}`)
            .join(" · ")) ||
        (ax?.message?.includes("Network Error")
          ? "Server returned an error. Please double-check the form and try again."
          : null) ||
        "Failed to register patient. Please verify the information.";
      setError(message);
      toast.error("Registration failed", message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // When validation fails on a tab the user isn't viewing, jump to the first
  // tab (where the required identity/contact fields live) so errors are seen.
  const onInvalid = () => {
    setActiveSection("basic");
    toast.error("Check the form", "Some required fields need your attention.");
  };

  const tabs: { key: SectionKey; label: string; icon: React.ReactNode }[] = [
    { key: "basic", label: "Identity & Contact", icon: <User className="h-4 w-4" /> },
    { key: "clinical", label: "Clinical Profile", icon: <Heart className="h-4 w-4" /> },
    { key: "insurance", label: "Insurance Details", icon: <ShieldCheck className="h-4 w-4" /> },
    { key: "loyalty", label: "Loyalty Program", icon: <Award className="h-4 w-4" /> },
  ];

  return (
    <DxPage className="max-w-6xl pb-10">
      <DxPageHeader
        title="Patient Registration"
        subtitle="Register new patients with full clinical and administrative profiles."
        crumbs={[
          { label: "Patients", to: routes.patients },
          { label: "Register" },
        ]}
        actions={
          <DxButton variant="default" leftIcon={<X className="h-4 w-4" />} onClick={() => navigate(routes.patients)}>
            Exit
          </DxButton>
        }
      />

      <DxTabs items={tabs} value={activeSection} onChange={setActiveSection} />

      <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-4">
        {error && (
          <DxMessage tone="danger" title="Registration failed">
            {error}
          </DxMessage>
        )}

        {/* ---- Identity & Contact ---- */}
        {activeSection === "basic" && (
          <div className="space-y-4">
            <DxPanel title="Demographics" icon={<User className="h-4 w-4" />}>
              <DxForm cols={3}>
                <DxInput label="First name" required placeholder="Nelson" error={errors.first_name?.message} {...register("first_name")} />
                <DxInput label="Middle name" placeholder="Optional" {...register("middle_name")} />
                <DxInput label="Last name" required placeholder="Mandela" error={errors.last_name?.message} {...register("last_name")} />
              </DxForm>
              <DxForm cols={3} className="mt-3">
                <DxInput type="date" label="Date of birth" required error={errors.date_of_birth?.message} {...register("date_of_birth")} />
                <DxSelect label="Gender" required placeholder="Select…" options={GENDER_OPTIONS} error={errors.gender?.message} {...register("gender")} />
                <DxSelect label="Marital status" placeholder="Select…" options={MARITAL_OPTIONS} {...register("marital_status")} />
              </DxForm>
            </DxPanel>

            <DxPanel title="Contact & Location" icon={<Phone className="h-4 w-4" />}>
              <DxForm cols={2}>
                <DxInput label="Primary phone" required placeholder="+234…" error={errors.phone_number?.message} {...register("phone_number")} />
                <DxInput label="Alternate phone" placeholder="Optional" {...register("alternate_phone_number")} />
              </DxForm>
              <DxForm cols={2} className="mt-3">
                <DxInput type="email" label="Email address" placeholder="nelson@mandela.org" error={errors.email?.message} {...register("email")} />
              </DxForm>
              <div className="mt-3">
                <DxTextarea label="Residential address" required rows={3} placeholder="Residential details…" error={errors.address?.message} {...register("address")} />
              </div>
              <DxForm cols={3} className="mt-3">
                <DxInput label="City" required error={errors.city?.message} {...register("city")} />
                <DxInput label="State" required error={errors.state?.message} {...register("state")} />
                <DxInput label="Country" required error={errors.country?.message} {...register("country")} />
              </DxForm>
            </DxPanel>
          </div>
        )}

        {/* ---- Clinical Profile ---- */}
        {activeSection === "clinical" && (
          <div className="space-y-4">
            <DxPanel title="Medical Markers" icon={<Heart className="h-4 w-4" />}>
              <DxForm cols={2}>
                <DxSelect label="Blood group" placeholder="Select…" options={BLOOD_GROUP_OPTIONS} {...register("blood_group")} />
                <DxSelect label="Genotype" placeholder="Select…" options={GENOTYPE_OPTIONS} {...register("genotype")} />
              </DxForm>
              <div className="mt-3">
                <DxTextarea label="Known allergies" rows={4} placeholder="List clinical sensitivities…" {...register("allergies")} />
              </div>
            </DxPanel>

            <DxPanel
              title="Historical Identifiers"
              icon={<FileText className="h-4 w-4" />}
              actions={
                <DxButton
                  variant="default"
                  size="sm"
                  leftIcon={<Plus className="h-4 w-4" />}
                  onClick={() => appendIdentifier({ identifier_type: "HOSPITAL_ID", identifier_value: "", is_primary: false, is_active: true })}
                >
                  Add ID
                </DxButton>
              }
            >
              <div className="space-y-3">
                {identifierFields.map((field, index) => (
                  <div key={field.id} className="flex items-end gap-3 rounded-md border border-[var(--dx-border)] p-3">
                    <DxForm cols={2} className="flex-1">
                      <DxInput label="ID type" placeholder="e.g. OLD_MRN" {...register(`previous_identifiers.${index}.identifier_type`)} />
                      <DxInput label="ID value" placeholder="Value…" {...register(`previous_identifiers.${index}.identifier_value`)} />
                    </DxForm>
                    <DxButton
                      variant="outline-danger"
                      size="sm"
                      icon
                      title="Remove identifier"
                      onClick={() => removeIdentifier(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </DxButton>
                  </div>
                ))}
                {identifierFields.length === 0 && (
                  <p className="dx-muted py-6 text-center text-sm">No historical identifiers added.</p>
                )}
              </div>
            </DxPanel>
          </div>
        )}

        {/* ---- Insurance Details ---- */}
        {activeSection === "insurance" && (
          <DxPanel title="Health Coverage Enrollment" icon={<ShieldCheck className="h-4 w-4" />}>
            <DxSelect
              label="Patient class"
              options={PATIENT_CLASS_OPTIONS}
              hint="Normal patients pay for their own services. HMO/Insurance and Retainership patients are covered by their provider/company — add the enrollment details below so covered charges are billed to the sponsor."
              {...register("patient_class")}
            />
            {patientClass === "SELF_PAY" ? (
              <DxMessage tone="info" className="mt-3" title="No enrollment needed">
                Self-pay patients cover their own charges. Switch the patient class to HMO/Insurance or Retainership to record sponsor cover.
              </DxMessage>
            ) : (
              <>
                <DxForm cols={2} className="mt-3">
                  <DxSelect
                    label="Insurance provider"
                    required
                    placeholder={providersQuery.isLoading ? "Loading providers…" : "Select provider…"}
                    options={providers.map((pr) => ({ value: String(pr.id), label: pr.code ? `${pr.name} (${pr.code})` : pr.name }))}
                    hint={!providersQuery.isLoading && providers.length === 0 ? "No providers configured yet — add one under Insurance first." : undefined}
                    {...register("insurance_enrollment.insurance_provider_id")}
                  />
                  <DxInput label="Policy number" placeholder="POL-12345" {...register("insurance_enrollment.policy_number")} />
                </DxForm>
                <DxForm cols={2} className="mt-3">
                  <DxInput label="Plan name" placeholder="Premium Gold" {...register("insurance_enrollment.plan_name")} />
                  <DxInput label="Member ID" placeholder="MEM-990" {...register("insurance_enrollment.member_id")} />
                </DxForm>
                <DxForm cols={2} className="mt-3">
                  <DxInput type="date" label="Valid from" {...register("insurance_enrollment.valid_from")} />
                  <DxInput type="date" label="Valid to" {...register("insurance_enrollment.valid_to")} />
                </DxForm>
              </>
            )}
          </DxPanel>
        )}

        {/* ---- Loyalty Program ---- */}
        {activeSection === "loyalty" && (
          <DxPanel title="Loyalty Rewards Enrollment" icon={<Award className="h-4 w-4" />}>
            <DxForm cols={2}>
              <DxSelect
                label="Program"
                placeholder="Select program…"
                options={loyaltyPrograms.map((p) => ({ value: String(p.id), label: p.name }))}
                {...register("loyalty_enrollment.loyalty_program_id")}
              />
              <DxInput
                label="Membership no."
                mono
                readOnly
                placeholder="LOY-…"
                hint="Auto-generated when a program is selected."
                {...register("loyalty_enrollment.membership_no")}
              />
            </DxForm>
            <div className="mt-3">
              <DxTextarea label="Enrollment note" rows={4} placeholder="Additional details…" {...register("loyalty_enrollment.note")} />
            </div>
          </DxPanel>
        )}

        {/* ---- Action bar ---- */}
        <DxPanel bodyClassName="flex flex-wrap items-center justify-between gap-3">
          <p className="dx-muted text-xs">Ensure all mandatory fields (marked *) are completed before saving.</p>
          <div className="flex gap-2">
            <DxButton variant="default" leftIcon={<X className="h-4 w-4" />} onClick={() => navigate(routes.patients)}>
              Cancel
            </DxButton>
            <DxButton type="submit" variant="primary" isLoading={isSubmitting} leftIcon={<Save className="h-4 w-4" />}>
              Register patient
            </DxButton>
          </div>
        </DxPanel>
      </form>
    </DxPage>
  );
}
