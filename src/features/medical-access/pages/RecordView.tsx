import type { MedicalRecord } from "../api/medicalAccess.api";

function humanize(key: string) {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function Cell({ value }: { value: any }) {
  if (value === null || value === undefined || value === "") return <span className="text-[var(--dx-text-faint)]">—</span>;
  if (typeof value === "object") return <span className="dx-mono text-[11px]">{JSON.stringify(value)}</span>;
  return <span>{String(value)}</span>;
}

export function RecordView({ data }: { data: MedicalRecord }) {
  const rec = data?.record;
  if (!rec) {
    return <p className="text-[13px] text-[var(--dx-text-muted)]">No record content is available for this request.</p>;
  }
  const patient = rec.patient ?? {};
  const sections = rec.sections ?? {};
  const patientFields = ["hospital_number", "first_name", "last_name", "gender", "date_of_birth", "phone_number", "email", "blood_group", "genotype", "allergies"];

  return (
    <div className="space-y-5">
      <div className="rounded-md border border-[var(--dx-border)] bg-[var(--dx-surface-sunken)] p-4">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--dx-text-muted)]">
          {(rec.kind || "RECORD").replace(/_/g, " ")} · read-only snapshot
        </p>
        <p className="mt-1 text-[17px] font-bold text-[var(--dx-text)]">
          {[patient.first_name, patient.last_name].filter(Boolean).join(" ") || rec.global_patient_id}
        </p>
        <div className="mt-2 grid gap-x-6 gap-y-1 text-[13px] sm:grid-cols-2 md:grid-cols-3">
          {patientFields.filter((f) => patient[f] != null && patient[f] !== "").map((f) => (
            <div key={f} className="flex gap-2">
              <span className="text-[var(--dx-text-muted)]">{humanize(f)}:</span>
              <span className="font-medium text-[var(--dx-text)]"><Cell value={patient[f]} /></span>
            </div>
          ))}
        </div>
      </div>

      {Object.keys(sections).length === 0 ? (
        <p className="text-[13px] text-[var(--dx-text-muted)]">No clinical sections were recorded for this patient.</p>
      ) : (
        Object.entries(sections).map(([name, rows]) => {
          const list = Array.isArray(rows) ? rows : [];
          if (list.length === 0) return null;
          const cols = Array.from(
            list.reduce((set: Set<string>, r: any) => {
              Object.keys(r || {}).forEach((k) => {
                if (!["id", "is_deleted", "created_at", "updated_at", "tenant_id"].includes(k)) set.add(k);
              });
              return set;
            }, new Set<string>())
          ).slice(0, 8);
          return (
            <div key={name}>
              <div className="mb-2 flex items-center gap-2">
                <h4 className="text-[13px] font-bold text-[var(--dx-text)]">{humanize(name)}</h4>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--dx-text-muted)]">{list.length}</span>
              </div>
              <div className="overflow-x-auto rounded-md border border-[var(--dx-border)]">
                <table className="w-full text-[12px]">
                  <thead className="bg-[var(--dx-surface-sunken)] text-[var(--dx-text-muted)]">
                    <tr>{cols.map((c) => <th key={c} className="whitespace-nowrap px-3 py-2 text-left font-semibold">{humanize(c)}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--dx-border)]">
                    {list.slice(0, 50).map((r: any, i: number) => (
                      <tr key={i}>{cols.map((c) => <td key={c} className="whitespace-nowrap px-3 py-1.5 text-[var(--dx-text)]"><Cell value={r?.[c]} /></td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
