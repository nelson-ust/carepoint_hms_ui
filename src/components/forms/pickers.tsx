import { searchPatients } from "@/features/patients/api/patients.api";
import { listInvoices } from "@/features/billing/api/billing.api";
import { EntityPicker, type EntityOption } from "./EntityPicker";

/** Search the MPI by name / hospital number / phone. */
export function PatientPicker({ label = "Patient", value, onChange, hint, className }: {
  label?: string;
  value: EntityOption | null;
  onChange: (o: EntityOption | null) => void;
  hint?: string;
  className?: string;
}) {
  return (
    <EntityPicker
      label={label}
      placeholder="Name, hospital number or phone…"
      hint={hint}
      value={value}
      onChange={onChange}
      className={className}
      search={async (q) => {
        const res = await searchPatients(q, 15);
        return (res.items ?? []).map((p) => ({
          value: p.id,
          label: `${p.first_name} ${p.last_name}`,
          sublabel: `${p.hospital_number}${p.phone_number ? ` · ${p.phone_number}` : ""}`,
        }));
      }}
    />
  );
}

/** Pick one of a patient's invoices (shows number, status and balance). */
export function InvoicePicker({ patientId, value, onChange, label = "Invoice", hint, className }: {
  patientId: number | null;
  value: EntityOption | null;
  onChange: (o: EntityOption | null) => void;
  label?: string;
  hint?: string;
  className?: string;
}) {
  return (
    <EntityPicker
      label={label}
      placeholder={patientId ? "Choose an invoice…" : "Pick the patient first"}
      hint={hint}
      value={value}
      onChange={onChange}
      disabled={!patientId}
      preloadOnFocus
      className={className}
      search={async () => {
        if (!patientId) return [];
        const res = await listInvoices({ patient_id: patientId, limit: 25 });
        return (res.items ?? []).map((inv) => ({
          value: inv.id,
          label: `${inv.invoice_no} · ${inv.status}`,
          sublabel: `Total ₦${Number(inv.total_amount).toLocaleString()} · Balance ₦${Number(inv.balance_due).toLocaleString()}`,
        }));
      }}
    />
  );
}
