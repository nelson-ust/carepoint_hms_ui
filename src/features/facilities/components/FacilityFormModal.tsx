import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2 } from "lucide-react";
import { DxPopup, DxButton, DxInput, DxSelect, DxMessage } from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/api/api-error";
import {
  facilitiesApi,
  FACILITY_STATUS_OPTIONS,
  FACILITY_TYPE_OPTIONS,
  type Facility,
  type FacilityCreatePayload,
  type FacilityStatus,
  type FacilityType,
} from "../api/facilities.api";

type FormState = {
  code: string;
  name: string;
  facility_type: FacilityType;
  status: FacilityStatus;
  phone_number: string;
  email: string;
  website: string;
  address_line_1: string;
  address_line_2: string;
  city: string;
  state: string;
  country: string;
  postal_code: string;
  timezone: string;
  network_id: string;
};

const EMPTY: FormState = {
  code: "",
  name: "",
  facility_type: "MAIN_HOSPITAL",
  status: "ACTIVE",
  phone_number: "",
  email: "",
  website: "",
  address_line_1: "",
  address_line_2: "",
  city: "",
  state: "",
  country: "Nigeria",
  postal_code: "",
  timezone: "Africa/Lagos",
  network_id: "",
};

function fromFacility(f: Facility): FormState {
  return {
    code: f.code ?? "",
    name: f.name ?? "",
    facility_type: f.facility_type ?? "MAIN_HOSPITAL",
    status: f.status ?? "ACTIVE",
    phone_number: f.phone_number ?? "",
    email: f.email ?? "",
    website: f.website ?? "",
    address_line_1: f.address_line_1 ?? "",
    address_line_2: f.address_line_2 ?? "",
    city: f.city ?? "",
    state: f.state ?? "",
    country: f.country ?? "",
    postal_code: f.postal_code ?? "",
    timezone: f.timezone ?? "",
    network_id: f.network_id != null ? String(f.network_id) : "",
  };
}

export function FacilityFormModal({
  isOpen,
  onClose,
  facility,
  onSaved,
}: {
  isOpen: boolean;
  onClose: () => void;
  /** null → create mode; a facility → edit mode. */
  facility: Facility | null;
  onSaved: () => void;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const isEdit = !!facility;
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      setForm(facility ? fromFacility(facility) : EMPTY);
      setErrors({});
    }
  }, [isOpen, facility]);

  const networksQuery = useQuery({
    queryKey: ["facilities", "networks"],
    queryFn: facilitiesApi.networks,
    enabled: isOpen,
  });
  const networks = networksQuery.data ?? [];

  const set = (key: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = "Name is required.";
    if (!isEdit && !form.code.trim()) next.code = "Code is required.";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      next.email = "Enter a valid email address.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const buildPayload = (): FacilityCreatePayload => {
    const clean = (v: string) => {
      const t = v.trim();
      return t.length ? t : null;
    };
    return {
      code: form.code.trim(),
      name: form.name.trim(),
      facility_type: form.facility_type,
      status: form.status,
      phone_number: clean(form.phone_number),
      email: clean(form.email),
      website: clean(form.website),
      address_line_1: clean(form.address_line_1),
      address_line_2: clean(form.address_line_2),
      city: clean(form.city),
      state: clean(form.state),
      country: clean(form.country),
      postal_code: clean(form.postal_code),
      timezone: clean(form.timezone),
      network_id: form.network_id ? Number(form.network_id) : null,
    };
  };

  const save = useMutation({
    mutationFn: () => {
      const payload = buildPayload();
      if (isEdit) {
        // `code` is immutable — don't send it on update.
        const { code, ...rest } = payload;
        void code;
        return facilitiesApi.update(facility!.id, rest);
      }
      return facilitiesApi.create(payload);
    },
    onSuccess: (saved) => {
      toast.success(
        isEdit ? "Facility updated" : "Facility created",
        `${saved.name} has been ${isEdit ? "updated" : "added"}.`,
      );
      queryClient.invalidateQueries({ queryKey: ["facilities"] });
      onSaved();
      onClose();
    },
    onError: (err) =>
      toast.error(
        isEdit ? "Couldn't update facility" : "Couldn't create facility",
        apiErrorMessage(err, "Please review the details and try again."),
      ),
  });

  const submit = () => {
    if (!validate()) return;
    save.mutate();
  };

  return (
    <DxPopup
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? "Edit facility" : "Add a facility"}
      size="lg"
      locked={save.isPending}
      footer={
        <>
          <DxButton onClick={onClose} disabled={save.isPending}>
            Cancel
          </DxButton>
          <DxButton
            variant="primary"
            onClick={submit}
            isLoading={save.isPending}
            leftIcon={<Building2 className="h-4 w-4" />}
          >
            {isEdit ? "Save changes" : "Create facility"}
          </DxButton>
        </>
      }
    >
      <div className="space-y-5">
        <DxMessage tone="info">
          Facilities are your hospital's branches, clinics and service sites. The one you mark{" "}
          <strong>Active</strong> is used for card issuance and other facility-scoped operations.
        </DxMessage>

        {/* Identity */}
        <div className="grid gap-4 sm:grid-cols-2">
          <DxInput
            label="Facility name"
            required
            placeholder="e.g. Meridian Main Hospital"
            value={form.name}
            onChange={set("name")}
            error={errors.name}
          />
          <DxInput
            label={isEdit ? "Code (immutable)" : "Code"}
            required={!isEdit}
            mono
            placeholder="e.g. MERIDIAN-HQ"
            value={form.code}
            onChange={set("code")}
            error={errors.code}
            disabled={isEdit}
            hint={isEdit ? "Code cannot be changed after creation" : undefined}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <DxSelect
            label="Facility type"
            value={form.facility_type}
            onChange={set("facility_type")}
            options={FACILITY_TYPE_OPTIONS}
          />
          <DxSelect
            label="Status"
            value={form.status}
            onChange={set("status")}
            options={FACILITY_STATUS_OPTIONS}
          />
        </div>

        {/* Contact */}
        <div className="grid gap-4 sm:grid-cols-2">
          <DxInput
            label="Phone number"
            placeholder="+234…"
            value={form.phone_number}
            onChange={set("phone_number")}
          />
          <DxInput
            label="Email"
            type="email"
            placeholder="branch@hospital.com"
            value={form.email}
            onChange={set("email")}
            error={errors.email}
          />
        </div>
        <DxInput
          label="Website"
          placeholder="https://…"
          value={form.website}
          onChange={set("website")}
        />

        {/* Address */}
        <div className="space-y-4">
          <DxInput
            label="Address line 1"
            value={form.address_line_1}
            onChange={set("address_line_1")}
          />
          <DxInput
            label="Address line 2"
            value={form.address_line_2}
            onChange={set("address_line_2")}
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <DxInput label="City" value={form.city} onChange={set("city")} />
            <DxInput label="State" value={form.state} onChange={set("state")} />
            <DxInput label="Country" value={form.country} onChange={set("country")} />
            <DxInput label="Postal code" value={form.postal_code} onChange={set("postal_code")} />
          </div>
        </div>

        {/* Org */}
        <div className="grid gap-4 sm:grid-cols-2">
          <DxSelect
            label="Network (optional)"
            value={form.network_id}
            onChange={set("network_id")}
          >
            <option value="">No network</option>
            {networks.map((n) => (
              <option key={n.id} value={String(n.id)}>
                {n.name}
              </option>
            ))}
          </DxSelect>
          <DxInput
            label="Timezone"
            placeholder="Africa/Lagos"
            value={form.timezone}
            onChange={set("timezone")}
          />
        </div>
      </div>
    </DxPopup>
  );
}
