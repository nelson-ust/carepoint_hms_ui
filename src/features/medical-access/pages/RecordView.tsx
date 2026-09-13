import type { MedicalRecord } from "../api/medicalAccess.api";

function humanize(key: string) {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function Cell({ value }: { value: any }) {
  if (value === null || value === undefined || value === "") return <span className="text-secondary-400">—</span>;
  if (typeof value === "object") return <span className="font-mono text-[11px]">{JSON.stringify(value)}</span>;
  return <span>{String(value)}</span>;
}

export function RecordView({ data }: { data: MedicalRecord }) {
  const rec = data?.record;
  if (!rec) {
    return <p className="text-sm text-secondary-500">No record content is available for this request.</p>;
  }
  const patient = rec.patient ?? {};
  const sections = rec.sections ?? {};
  const patientFields = ["hospital_number", "first_name", "last_name", "gender", "date_of_birth", "phone_number", "email", "blood_group", "genotype", "allergies"];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-secondary-200 bg-secondary-50/60 p-4">
        <p className="text-[10px] uppercase tracking-widest font-bold text-secondary-400">
          {(rec.kind || "RECORD").replace(/_/g, " ")} · read-only snapshot
        </p>
        <p className="text-lg font-bold mt-1">
          {[patient.first_name, patient.last_name].filter(Boolean).join(" ") || rec.global_patient_id}
        </p>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1 mt-2 text-sm">
          {patientFields.filter((f) => patient[f] != null && patient[f] !== "").map((f) => (
            <div key={f} className="flex gap-2">
              <span className="text-secondary-500">{humanize(f)}:</span>
              <span className="font-medium"><Cell value={patient[f]} /></span>
            </div>
          ))}
        </div>
      </div>

      {Object.keys(sections).length === 0 ? (
        <p className="text-sm text-secondary-500">No clinical sections were recorded for this patient.</p>
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
              <div className="flex items-center gap-2 mb-2">
                <h4 className="font-bold text-sm">{humanize(name)}</h4>
                <span className="text-[10px] font-bold uppercase tracking-widest text-secondary-400">{list.length}</span>
              </div>
              <div className="overflow-x-auto rounded-xl border border-secondary-200">
                <table className="w-full text-xs">
                  <thead className="bg-secondary-50 text-secondary-500">
                    <tr>{cols.map((c) => <th key={c} className="text-left px-3 py-2 font-semibold whitespace-nowrap">{humanize(c)}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-secondary-100">
                    {list.slice(0, 50).map((r: any, i: number) => (
                      <tr key={i}>{cols.map((c) => <td key={c} className="px-3 py-1.5 whitespace-nowrap"><Cell value={r?.[c]} /></td>)}</tr>
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
