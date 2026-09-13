import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HeartPulse, History, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiClient } from "@/lib/api/api-client";
import { apiErrorMessage } from "@/lib/api/api-error";
import { usePermissionGate } from "@/lib/permissions/usePermissionGate";

export type BaselineProfile = {
  patient_id: number;
  version: number;
  updated_at?: string | null;
  blood_group?: string | null;
  genotype?: string | null;
  rhesus_factor?: string | null;
  g6pd_status?: string | null;
  hepatitis_b_status?: string | null;
  hepatitis_c_status?: string | null;
  hiv_status?: string | null;
  blood_sugar_baseline?: string | null;
  lipid_profile_baseline?: string | null;
  known_allergies?: string | null;
  chronic_conditions?: string | null;
  existing_diagnoses?: string | null;
  long_term_medications?: string | null;
  past_medical_history?: string | null;
  past_surgical_history?: string | null;
  family_history?: string | null;
  social_history?: string | null;
  immunization_history?: string | null;
  obstetric_history?: string | null;
  disability_info?: string | null;
  organ_donor?: boolean | null;
  baseline_height_cm?: string | number | null;
  baseline_weight_kg?: string | number | null;
  primary_physician_name?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  additional_notes?: string | null;
};

type Revision = {
  version: number;
  changed_at?: string | null;
  changed_by?: string | null;
  changed_fields?: string[] | null;
  previous_values?: Record<string, string | null> | null;
};

const NARRATIVE_FIELDS: [keyof BaselineProfile, string][] = [
  ["known_allergies", "Known allergies"],
  ["chronic_conditions", "Chronic conditions"],
  ["existing_diagnoses", "Existing diagnoses"],
  ["long_term_medications", "Long-term medications"],
  ["past_medical_history", "Past medical history"],
  ["past_surgical_history", "Past surgical history"],
  ["family_history", "Family history"],
  ["social_history", "Social history"],
  ["immunization_history", "Immunisation history"],
  ["obstetric_history", "Obstetric history"],
  ["disability_info", "Disability information"],
  ["additional_notes", "Additional notes"],
];

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const GENOTYPES = ["AA", "AS", "SS", "AC", "SC", "CC"];

async function getBaseline(patientId: number): Promise<BaselineProfile> {
  return (await apiClient.get<BaselineProfile>(`/patients/${patientId}/baseline-profile`)).data;
}
async function getRevisions(patientId: number): Promise<Revision[]> {
  return (await apiClient.get<Revision[]>(`/patients/${patientId}/baseline-profile/revisions`)).data;
}

/**
 * The patient's lifelong Baseline Medical Profile — versioned, audited, and
 * automatically included in referral packages and approved record shares.
 */
export function BaselineProfileCard({ patientId }: { patientId: number }) {
  const toast = useToast();
  const gate = usePermissionGate();
  const queryClient = useQueryClient();
  const canEdit = gate.hasAny(["PATIENT_UPDATE"]);
  const [editOpen, setEditOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const profileQuery = useQuery({
    queryKey: ["patients", patientId, "baseline-profile"],
    queryFn: () => getBaseline(patientId),
  });
  const revisionsQuery = useQuery({
    queryKey: ["patients", patientId, "baseline-revisions"],
    queryFn: () => getRevisions(patientId),
    enabled: historyOpen,
  });
  const p = profileQuery.data;

  const openEdit = () => {
    if (!p) return;
    const f: Record<string, string> = {
      blood_group: p.blood_group ?? "",
      genotype: p.genotype ?? "",
      rhesus_factor: p.rhesus_factor ?? "",
      organ_donor: p.organ_donor == null ? "" : p.organ_donor ? "YES" : "NO",
      g6pd_status: p.g6pd_status ?? "",
      hepatitis_b_status: p.hepatitis_b_status ?? "",
      hepatitis_c_status: p.hepatitis_c_status ?? "",
      hiv_status: p.hiv_status ?? "",
      blood_sugar_baseline: p.blood_sugar_baseline ?? "",
      lipid_profile_baseline: p.lipid_profile_baseline ?? "",
      baseline_height_cm: p.baseline_height_cm != null ? String(p.baseline_height_cm) : "",
      baseline_weight_kg: p.baseline_weight_kg != null ? String(p.baseline_weight_kg) : "",
    };
    for (const [key] of NARRATIVE_FIELDS) f[key as string] = (p[key] as string) ?? "";
    setForm(f);
    setEditOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(form)) {
        if (k === "organ_donor") {
          if (v) payload[k] = v === "YES";
        } else if (k === "baseline_height_cm" || k === "baseline_weight_kg") {
          if (v !== "") payload[k] = v;
        } else {
          payload[k] = v || null;
        }
      }
      return (await apiClient.put(`/patients/${patientId}/baseline-profile`, payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients", patientId, "baseline-profile"] });
      queryClient.invalidateQueries({ queryKey: ["patients", patientId, "baseline-revisions"] });
      toast.success("Baseline profile updated", "A new version was recorded in the audit trail.");
      setEditOpen(false);
    },
    onError: (err) => toast.error("Couldn't save", apiErrorMessage(err)),
  });

  const set = (k: string) => (e: React.ChangeEvent<any>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const filledNarratives = NARRATIVE_FIELDS.filter(([k]) => (p?.[k] as string | null)?.trim());

  return (
    <div className="glass-card rounded p-8 border border-secondary-400 bg-white/80 shadow-premium">
      <div className="flex items-center justify-between border-b border-secondary-400 pb-5 mb-6">
        <div className="flex items-center gap-4">
          <div className="h-11 w-11 rounded bg-gradient-to-br from-rose-500 to-primary-600 text-white flex items-center justify-center shadow-xl">
            <HeartPulse className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-black font-display tracking-tight">Baseline Medical Profile</h3>
            <p className="text-secondary-400 font-bold text-[10px] uppercase tracking-[0.25em]">
              Lifelong record · v{p?.version ?? 0}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setHistoryOpen(true)} title="Change history"
            className="rounded-xl p-2 text-secondary-400 hover:bg-secondary-100 hover:text-secondary-700">
            <History className="h-4 w-4" />
          </button>
          {canEdit && (
            <button onClick={openEdit} title="Edit baseline profile"
              className="rounded-xl p-2 text-secondary-400 hover:bg-primary-500/10 hover:text-primary-600">
              <Pencil className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {profileQuery.isLoading ? (
        <div className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-2/3" /></div>
      ) : profileQuery.isError ? (
        <p className="text-sm font-semibold text-rose-500">
          {apiErrorMessage(profileQuery.error, "Couldn't load the baseline profile.")}
        </p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="soft-danger">Blood {p?.blood_group || "—"}{p?.rhesus_factor ? ` (${p.rhesus_factor})` : ""}</Badge>
            <Badge variant="soft-info">Genotype {p?.genotype || "—"}</Badge>
            {p?.organ_donor != null && (
              <Badge variant={p.organ_donor ? "soft-success" : "secondary"}>
                Organ donor: {p.organ_donor ? "Yes" : "No"}
              </Badge>
            )}
            {(p?.baseline_height_cm || p?.baseline_weight_kg) && (
              <Badge variant="secondary">
                {p?.baseline_height_cm ? `${p.baseline_height_cm} cm` : ""}
                {p?.baseline_height_cm && p?.baseline_weight_kg ? " · " : ""}
                {p?.baseline_weight_kg ? `${p.baseline_weight_kg} kg` : ""}
              </Badge>
            )}
          </div>

          {(p?.g6pd_status || p?.hepatitis_b_status || p?.hepatitis_c_status
            || p?.hiv_status || p?.blood_sugar_baseline) && (
            <div className="flex flex-wrap gap-2">
              {p?.g6pd_status && <Badge variant="soft-info">G6PD: {p.g6pd_status}</Badge>}
              {p?.hepatitis_b_status && <Badge variant="soft-warning">Hep B: {p.hepatitis_b_status}</Badge>}
              {p?.hepatitis_c_status && <Badge variant="soft-warning">Hep C: {p.hepatitis_c_status}</Badge>}
              {p?.hiv_status && <Badge variant="soft-danger">HIV: {p.hiv_status}</Badge>}
              {p?.blood_sugar_baseline && <Badge variant="secondary">Glucose: {p.blood_sugar_baseline}</Badge>}
            </div>
          )}
          {p?.lipid_profile_baseline?.trim() && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-secondary-400">Lipid profile baseline</p>
              <p className="text-sm text-secondary-700 whitespace-pre-wrap">{p.lipid_profile_baseline}</p>
            </div>
          )}

          {p?.known_allergies?.trim() && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-rose-500">Allergies</p>
              <p className="text-sm font-bold text-rose-700">{p.known_allergies}</p>
            </div>
          )}

          {filledNarratives.filter(([k]) => k !== "known_allergies").map(([key, label]) => (
            <div key={key as string}>
              <p className="text-[10px] font-black uppercase tracking-widest text-secondary-400">{label}</p>
              <p className="text-sm text-secondary-700 whitespace-pre-wrap">{p?.[key] as string}</p>
            </div>
          ))}

          <div className="border-t border-secondary-100 pt-3 space-y-1">
            {p?.primary_physician_name && (
              <p className="text-xs text-secondary-500">
                <span className="font-black uppercase tracking-widest text-[10px] text-secondary-400 mr-2">Primary physician</span>
                {p.primary_physician_name}
              </p>
            )}
            {p?.emergency_contact_name && (
              <p className="text-xs text-secondary-500">
                <span className="font-black uppercase tracking-widest text-[10px] text-secondary-400 mr-2">Emergency contact</span>
                {p.emergency_contact_name}{p.emergency_contact_phone ? ` · ${p.emergency_contact_phone}` : ""}
              </p>
            )}
            <p className="text-[10px] text-secondary-400">
              Included automatically in referral packages and approved record shares.
            </p>
          </div>
        </div>
      )}

      {/* ---- Edit modal ---- */}
      <Modal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Baseline Medical Profile"
        size="xl"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setEditOpen(false)} disabled={save.isPending}>Cancel</Button>
            <Button size="sm" isLoading={save.isPending} onClick={() => save.mutate()}>Save new version</Button>
          </div>
        }
      >
        <p className="mb-4 text-xs text-secondary-400">Saving records a new version with a full audit snapshot.</p>
        <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-xs font-bold text-secondary-500">
                Blood group
                <select value={form.blood_group} onChange={set("blood_group")} className="input-field mt-1">
                  <option value="">—</option>
                  {BLOOD_GROUPS.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </label>
              <label className="text-xs font-bold text-secondary-500">
                Genotype
                <select value={form.genotype} onChange={set("genotype")} className="input-field mt-1">
                  <option value="">—</option>
                  {GENOTYPES.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </label>
              <label className="text-xs font-bold text-secondary-500">
                Rhesus factor
                <select value={form.rhesus_factor} onChange={set("rhesus_factor")} className="input-field mt-1">
                  <option value="">—</option>
                  <option value="POSITIVE">Positive</option>
                  <option value="NEGATIVE">Negative</option>
                </select>
              </label>
              <label className="text-xs font-bold text-secondary-500">
                Organ donor
                <select value={form.organ_donor} onChange={set("organ_donor")} className="input-field mt-1">
                  <option value="">Unknown</option>
                  <option value="YES">Yes</option>
                  <option value="NO">No</option>
                </select>
              </label>
              <label className="text-xs font-bold text-secondary-500">
                G6PD status
                <select value={form.g6pd_status} onChange={set("g6pd_status")} className="input-field mt-1">
                  <option value="">Unknown</option>
                  <option value="NORMAL">Normal</option>
                  <option value="DEFICIENT">Deficient</option>
                </select>
              </label>
              <label className="text-xs font-bold text-secondary-500">
                Hepatitis B
                <select value={form.hepatitis_b_status} onChange={set("hepatitis_b_status")} className="input-field mt-1">
                  <option value="">Unknown</option>
                  <option value="NEGATIVE">Negative</option>
                  <option value="POSITIVE">Positive</option>
                  <option value="IMMUNE">Immune (vaccinated)</option>
                </select>
              </label>
              <label className="text-xs font-bold text-secondary-500">
                Hepatitis C
                <select value={form.hepatitis_c_status} onChange={set("hepatitis_c_status")} className="input-field mt-1">
                  <option value="">Unknown</option>
                  <option value="NEGATIVE">Negative</option>
                  <option value="POSITIVE">Positive</option>
                </select>
              </label>
              <label className="text-xs font-bold text-secondary-500">
                HIV status
                <select value={form.hiv_status} onChange={set("hiv_status")} className="input-field mt-1">
                  <option value="">Unknown</option>
                  <option value="NEGATIVE">Negative</option>
                  <option value="POSITIVE">Positive</option>
                </select>
              </label>
              <label className="text-xs font-bold text-secondary-500">
                Blood sugar baseline
                <input value={form.blood_sugar_baseline} onChange={set("blood_sugar_baseline")}
                  placeholder="e.g. FBS 5.2 mmol/L" className="input-field mt-1" />
              </label>
              <label className="text-xs font-bold text-secondary-500">
                Lipid profile baseline
                <input value={form.lipid_profile_baseline} onChange={set("lipid_profile_baseline")}
                  placeholder="e.g. TC 4.8, LDL 2.9, HDL 1.2" className="input-field mt-1" />
              </label>
              <label className="text-xs font-bold text-secondary-500">
                Baseline height (cm)
                <input type="number" min="0" value={form.baseline_height_cm}
                  onChange={set("baseline_height_cm")} className="input-field mt-1" />
              </label>
              <label className="text-xs font-bold text-secondary-500">
                Baseline weight (kg)
                <input type="number" min="0" value={form.baseline_weight_kg}
                  onChange={set("baseline_weight_kg")} className="input-field mt-1" />
              </label>
            </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {NARRATIVE_FIELDS.map(([key, label]) => (
            <label key={key as string} className="text-xs font-bold text-secondary-500">
              {label}
              <textarea rows={2} value={form[key as string] ?? ""}
                onChange={set(key as string)} className="input-field mt-1 w-full" />
            </label>
          ))}
        </div>
      </Modal>

      {/* ---- Revision history modal ---- */}
      <Modal
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        title="Baseline Profile History"
        size="lg"
      >
            {revisionsQuery.isLoading ? (
              <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-2/3" /></div>
            ) : (revisionsQuery.data ?? []).length === 0 ? (
              <p className="py-8 text-center text-sm text-secondary-400">No changes recorded yet.</p>
            ) : (
              <div className="space-y-3">
                {(revisionsQuery.data ?? []).map((r) => (
                  <div key={r.version} className="rounded-2xl border border-secondary-100 p-4">
                    <div className="flex items-center justify-between">
                      <Badge variant="soft-info">v{r.version}</Badge>
                      <span className="text-[11px] text-secondary-400">
                        {r.changed_by ? `${r.changed_by} · ` : ""}
                        {r.changed_at ? new Date(r.changed_at).toLocaleString() : ""}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-secondary-600">
                      Changed: {(r.changed_fields ?? []).join(", ") || "—"}
                    </p>
                  </div>
                ))}
              </div>
            )}
      </Modal>
    </div>
  );
}
