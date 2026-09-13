import { useRef, useState } from "react";
import { Camera, CreditCard, Loader2, Pencil, UserRound } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/feedback/ToastProvider";
import { env } from "@/config/env";
import { formatNaira, portalErrorMessage, type PortalPatient } from "../api/portal.api";
import {
  usePortalDashboard,
  usePortalProfile,
  useUpdatePortalProfile,
  useUploadPortalPhoto,
} from "../hooks/use-portal";

type EditableSection = "personal" | "contact" | "emergency";

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function Field({
  label,
  value,
  mono = false,
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-widest text-secondary-400">
        {label}
      </p>
      <p
        className={
          mono
            ? "data-mono mt-1 text-sm font-bold text-secondary-900"
            : "mt-1 text-sm font-bold text-secondary-900"
        }
      >
        {value || "—"}
      </p>
    </div>
  );
}

function SectionSkeleton() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-5 w-36" />
        </div>
      ))}
    </div>
  );
}

/** The subset of fields a patient may self-edit; string form for inputs. */
type ProfileForm = {
  national_identifier: string;
  national_identifier_type: string;
  phone_number: string;
  alternate_phone_number: string;
  address: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_relationship: string;
  next_of_kin_name: string;
  next_of_kin_phone: string;
  next_of_kin_relationship: string;
};

function seedForm(p?: PortalPatient | null): ProfileForm {
  return {
    national_identifier: p?.national_identifier ?? "",
    national_identifier_type: p?.national_identifier_type ?? "",
    phone_number: p?.phone_number ?? "",
    alternate_phone_number: p?.alternate_phone_number ?? "",
    address: p?.address ?? "",
    emergency_contact_name: p?.emergency_contact_name ?? "",
    emergency_contact_phone: p?.emergency_contact_phone ?? "",
    emergency_contact_relationship: p?.emergency_contact_relationship ?? "",
    next_of_kin_name: p?.next_of_kin_name ?? "",
    next_of_kin_phone: p?.next_of_kin_phone ?? "",
    next_of_kin_relationship: p?.next_of_kin_relationship ?? "",
  };
}

/** "" → null so a cleared field is actually cleared server-side. */
function clean(v: string): string | null {
  const t = v.trim();
  return t === "" ? null : t;
}

/** Editable patient profile — GET/PATCH /portal/profile (+ card from dashboard). */
export function PortalProfilePage() {
  const { data: profile, isLoading, isError, refetch } = usePortalProfile();
  const { data: dashboard } = usePortalDashboard();
  const updateProfile = useUpdatePortalProfile();
  const uploadPhoto = useUploadPortalPhoto();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const onPhotoSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Unsupported file", "Please choose a JPG, PNG or WEBP image.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Image too large", "Please choose an image under 20MB.");
      return;
    }
    uploadPhoto.mutate(file, {
      onSuccess: () => toast.success("Photo updated", "Your profile picture has been saved."),
      onError: (err) => toast.error("Upload failed", portalErrorMessage(err, "Please try again.")),
    });
  };

  const [editing, setEditing] = useState<EditableSection | null>(null);
  const [form, setForm] = useState<ProfileForm>(seedForm(null));

  const patient = profile?.patient;
  const fullName = patient
    ? [patient.first_name, patient.middle_name, patient.last_name]
        .filter(Boolean)
        .join(" ")
    : undefined;
  const card = dashboard?.card;
  const apiOrigin = env.apiBaseUrl.replace(/\/api(\/v\d+)?\/?$/, "");
  const rawPhoto = patient?.photo?.file_url || null;
  const photoUrl = rawPhoto
    ? (rawPhoto.startsWith("http") ? rawPhoto : `${apiOrigin}${rawPhoto}`)
    : null;

  const startEdit = (section: EditableSection) => {
    setForm(seedForm(patient));
    setEditing(section);
  };
  const cancelEdit = () => setEditing(null);
  const setField = (key: keyof ProfileForm, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const save = (fields: Record<string, string | null>) => {
    updateProfile.mutate(fields, {
      onSuccess: () => {
        toast.success("Profile updated", "Your changes have been saved.");
        setEditing(null);
      },
      onError: (err) =>
        toast.error("Update failed", portalErrorMessage(err, "Please try again.")),
    });
  };

  const savePersonal = () =>
    save({
      national_identifier: clean(form.national_identifier),
      national_identifier_type: clean(form.national_identifier_type),
    });
  const saveContact = () =>
    save({
      phone_number: clean(form.phone_number),
      alternate_phone_number: clean(form.alternate_phone_number),
      address: clean(form.address),
    });
  const saveEmergency = () =>
    save({
      emergency_contact_name: clean(form.emergency_contact_name),
      emergency_contact_phone: clean(form.emergency_contact_phone),
      emergency_contact_relationship: clean(form.emergency_contact_relationship),
      next_of_kin_name: clean(form.next_of_kin_name),
      next_of_kin_phone: clean(form.next_of_kin_phone),
      next_of_kin_relationship: clean(form.next_of_kin_relationship),
    });

  /** Edit / Save+Cancel controls shown in a section's header. */
  const sectionActions = (section: EditableSection, onSave: () => void) => {
    if (isLoading || !patient) return undefined;
    if (editing === section) {
      return (
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={cancelEdit} disabled={updateProfile.isPending}>
            Cancel
          </Button>
          <Button size="sm" onClick={onSave} isLoading={updateProfile.isPending}>
            Save
          </Button>
        </div>
      );
    }
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => startEdit(section)}
        disabled={editing !== null}
        leftIcon={<Pencil className="h-3.5 w-3.5" />}
      >
        Edit
      </Button>
    );
  };

  if (isError) {
    return (
      <div className="space-y-8 animate-fade-in">
        <PageHeader eyebrow="Patient portal" title="My profile" />
        <Card>
          <EmptyState
            icon={UserRound}
            title="We couldn't load your profile"
            description="Please check your connection and try again."
            action={<Button onClick={() => refetch()}>Retry</Button>}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        eyebrow="Patient portal"
        title="My profile"
        description="Keep your contact, identification, and emergency details up to date. Other records are maintained by the hospital."
      />

      {/* Identity summary */}
      <Card>
        <div className="flex flex-wrap items-center gap-5">
          <div className="relative h-16 w-16 shrink-0">
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onPhotoSelected} />
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-3xl bg-primary-500/10 text-primary-500 shadow-glow-sm">
              {photoUrl ? (
                <img src={photoUrl} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <UserRound className="h-8 w-8" aria-hidden />
              )}
            </div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploadPhoto.isPending}
              title="Change profile picture"
              className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary-500 text-white shadow-md ring-2 ring-white transition hover:bg-primary-600 disabled:opacity-70 dark:ring-secondary-900"
            >
              {uploadPhoto.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
            </button>
          </div>
          <div className="min-w-0">
            {isLoading ? (
              <>
                <Skeleton className="h-6 w-48" />
                <Skeleton className="mt-2 h-4 w-32" />
              </>
            ) : (
              <>
                <h2 className="font-display text-xl font-bold tracking-tight text-secondary-900">
                  {fullName}
                </h2>
                <p className="data-mono mt-1 text-sm text-secondary-400">
                  {patient?.hospital_number}
                </p>
              </>
            )}
          </div>
          {!isLoading && patient?.patient_type ? (
            <Badge variant="soft-info" className="ml-auto">
              {patient.patient_type}
            </Badge>
          ) : null}
        </div>
      </Card>

      {/* Personal details */}
      <Card>
        <CardHeader
          title="Personal details"
          actions={sectionActions("personal", savePersonal)}
        />
        {isLoading ? (
          <SectionSkeleton />
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Date of birth" value={formatDate(patient?.date_of_birth)} />
            <Field label="Gender" value={patient?.gender} />
            <Field label="Marital status" value={patient?.marital_status} />
            <Field label="Blood group" value={patient?.blood_group} />
            <Field label="Genotype" value={patient?.genotype} />
            <Field label="Allergies" value={patient?.allergies} />
            <Field label="Chronic conditions" value={patient?.chronic_conditions} />
            {editing === "personal" ? (
              <>
                <Input
                  label="National ID type"
                  value={form.national_identifier_type}
                  onChange={(e) => setField("national_identifier_type", e.target.value)}
                  placeholder="e.g. NIN, Passport"
                />
                <Input
                  label="National ID number"
                  value={form.national_identifier}
                  onChange={(e) => setField("national_identifier", e.target.value)}
                  placeholder="ID number"
                />
              </>
            ) : (
              <Field
                label="National ID"
                value={
                  patient?.national_identifier
                    ? `${patient.national_identifier_type ?? "ID"}: ${patient.national_identifier}`
                    : null
                }
                mono
              />
            )}
          </div>
        )}
      </Card>

      {/* Contact information */}
      <Card>
        <CardHeader
          title="Contact information"
          actions={sectionActions("contact", saveContact)}
        />
        {isLoading ? (
          <SectionSkeleton />
        ) : editing === "contact" ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Input
              label="Phone"
              value={form.phone_number}
              onChange={(e) => setField("phone_number", e.target.value)}
              placeholder="+234…"
            />
            <Input
              label="Alternate phone"
              value={form.alternate_phone_number}
              onChange={(e) => setField("alternate_phone_number", e.target.value)}
              placeholder="Optional"
            />
            <Field label="Email" value={patient?.email ?? profile?.email} />
            <Field label="Portal username" value={profile?.username} mono />
            <div className="sm:col-span-2 lg:col-span-3">
              <Textarea
                label="Address"
                value={form.address}
                onChange={(e) => setField("address", e.target.value)}
                rows={2}
                placeholder="Residential address"
              />
            </div>
            <Field
              label="City / State"
              value={
                [patient?.city, patient?.state, patient?.country].filter(Boolean).join(", ") ||
                null
              }
            />
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Phone" value={patient?.phone_number} mono />
            <Field label="Alternate phone" value={patient?.alternate_phone_number} mono />
            <Field label="Email" value={patient?.email ?? profile?.email} />
            <Field label="Portal username" value={profile?.username} mono />
            <Field label="Address" value={patient?.address} />
            <Field
              label="City / State"
              value={
                [patient?.city, patient?.state, patient?.country].filter(Boolean).join(", ") ||
                null
              }
            />
          </div>
        )}
      </Card>

      {/* Emergency contact & next of kin */}
      <Card>
        <CardHeader
          title="Emergency contact & next of kin"
          actions={sectionActions("emergency", saveEmergency)}
        />
        {isLoading ? (
          <SectionSkeleton />
        ) : editing === "emergency" ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Input
              label="Emergency contact"
              value={form.emergency_contact_name}
              onChange={(e) => setField("emergency_contact_name", e.target.value)}
            />
            <Input
              label="Emergency phone"
              value={form.emergency_contact_phone}
              onChange={(e) => setField("emergency_contact_phone", e.target.value)}
            />
            <Input
              label="Relationship"
              value={form.emergency_contact_relationship}
              onChange={(e) => setField("emergency_contact_relationship", e.target.value)}
            />
            <Input
              label="Next of kin"
              value={form.next_of_kin_name}
              onChange={(e) => setField("next_of_kin_name", e.target.value)}
            />
            <Input
              label="Next of kin phone"
              value={form.next_of_kin_phone}
              onChange={(e) => setField("next_of_kin_phone", e.target.value)}
            />
            <Input
              label="Next of kin relationship"
              value={form.next_of_kin_relationship}
              onChange={(e) => setField("next_of_kin_relationship", e.target.value)}
            />
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Emergency contact" value={patient?.emergency_contact_name} />
            <Field label="Emergency phone" value={patient?.emergency_contact_phone} mono />
            <Field label="Relationship" value={patient?.emergency_contact_relationship} />
            <Field label="Next of kin" value={patient?.next_of_kin_name} />
            <Field label="Next of kin phone" value={patient?.next_of_kin_phone} mono />
            <Field
              label="Next of kin relationship"
              value={patient?.next_of_kin_relationship}
            />
          </div>
        )}
      </Card>

      {/* Membership card (read-only) */}
      <Card>
        <CardHeader
          title="Membership card"
          actions={
            card ? (
              <Badge
                variant={
                  card.status?.toUpperCase() === "ACTIVE" ? "soft-success" : "soft-warning"
                }
              >
                {card.status}
              </Badge>
            ) : undefined
          }
        />
        {card ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Card number" value={card.card_number} mono />
            <Field label="Balance" value={formatNaira(card.balance)} mono />
            <Field label="Issued" value={formatDate(card.date_issued)} />
            <Field label="Expires" value={formatDate(card.expiry_date)} />
          </div>
        ) : (
          <EmptyState
            icon={CreditCard}
            title="No membership card"
            description="Ask the hospital front desk about getting a membership card."
          />
        )}
      </Card>
    </div>
  );
}
