import { apiClient } from "@/lib/api/api-client";

export type VitalSign = {
  id: number;
  visit_id: number;
  recorded_by_staff_id?: number | null;
  temperature_celsius?: number | string | null;
  pulse_rate?: number | null;
  respiratory_rate?: number | null;
  systolic_bp?: number | null;
  diastolic_bp?: number | null;
  oxygen_saturation?: number | string | null;
  weight_kg?: number | string | null;
  height_cm?: number | string | null;
  bmi?: number | string | null;
  pain_score?: number | null;
  /** Modified Early Warning Score, auto-computed server-side when enough data is present. */
  mews_score?: number | null;
  recorded_at: string;
  created_at?: string | null;
};

export type RecordVitalSignPayload = {
  visit_id: number;
  recorded_by_staff_id?: number | null;
  temperature_celsius?: number | null;
  pulse_rate?: number | null;
  respiratory_rate?: number | null;
  systolic_bp?: number | null;
  diastolic_bp?: number | null;
  oxygen_saturation?: number | null;
  weight_kg?: number | null;
  height_cm?: number | null;
  pain_score?: number | null;
};

export async function getVisitVitalSigns(visitId: number) {
  const response = await apiClient.get<{ items: VitalSign[] }>(`/vital-signs/visits/${visitId}`);
  return response.data;
}

export async function getLatestVitalSigns(visitId: number) {
  const response = await apiClient.get<VitalSign>(`/vital-signs/visits/${visitId}/latest`);
  return response.data;
}

export async function recordVitalSigns(payload: RecordVitalSignPayload) {
  const response = await apiClient.post<{ success: boolean; message: string; vital_sign: VitalSign }>(
    "/vital-signs/",
    payload,
  );
  return response.data;
}

// ---------- Clinical calculators (mirror vital_sign_service.py) ----------

export function computeBmi(weightKg?: number | null, heightCm?: number | null): number | null {
  if (!weightKg || !heightCm || weightKg <= 0 || heightCm <= 0) return null;
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

export function bmiCategory(bmi: number | null): { label: string; tone: "success" | "warning" | "danger" | "neutral" } {
  if (bmi == null) return { label: "Awaiting data", tone: "neutral" };
  if (bmi < 18.5) return { label: "Underweight", tone: "warning" };
  if (bmi < 25) return { label: "Normal range", tone: "success" };
  if (bmi < 30) return { label: "Overweight", tone: "warning" };
  return { label: "Obese", tone: "danger" };
}

/** Modified Early Warning Score — same thresholds as the backend `_compute_mews`. */
export function computeMews(input: {
  pulse_rate?: number | null;
  respiratory_rate?: number | null;
  systolic_bp?: number | null;
  temperature_celsius?: number | null;
}): number | null {
  const { pulse_rate: pr, respiratory_rate: rr, systolic_bp: sbp, temperature_celsius: t } = input;
  if (pr == null || rr == null || sbp == null || t == null) return null;
  let s = 0;
  if (rr <= 8) s += 2;
  else if (rr >= 15 && rr <= 20) s += 1;
  else if (rr >= 21 && rr <= 29) s += 2;
  else if (rr >= 30) s += 3;

  if (pr <= 40) s += 2;
  else if (pr >= 41 && pr <= 50) s += 1;
  else if (pr >= 101 && pr <= 110) s += 1;
  else if (pr >= 111 && pr <= 129) s += 2;
  else if (pr >= 130) s += 3;

  if (sbp <= 70) s += 3;
  else if (sbp >= 71 && sbp <= 80) s += 2;
  else if (sbp >= 81 && sbp <= 100) s += 1;
  else if (sbp >= 200) s += 2;

  if (t <= 35.0) s += 2;
  else if (t >= 35.1 && t <= 36.0) s += 1;
  else if (t >= 38.1 && t <= 38.5) s += 1;
  else if (t >= 38.6) s += 2;
  return s;
}

export function mewsBand(score: number | null): { label: string; tone: "success" | "warning" | "danger" | "neutral"; advice: string } {
  if (score == null) return { label: "Incomplete", tone: "neutral", advice: "Record pulse, respiration, systolic BP and temperature to score." };
  if (score <= 1) return { label: "Low risk", tone: "success", advice: "Routine observation." };
  if (score <= 3) return { label: "Moderate", tone: "warning", advice: "Increase observation frequency; inform the clinician." };
  if (score === 4) return { label: "High", tone: "danger", advice: "Urgent clinician review." };
  return { label: "Critical", tone: "danger", advice: "Immediate escalation — an emergency alert is raised on save." };
}

/** Flag an individual reading against adult reference ranges. */
export function vitalFlag(key: string, value?: number | null): "low" | "high" | null {
  if (value == null || Number.isNaN(value)) return null;
  const ranges: Record<string, [number, number]> = {
    temperature_celsius: [36.1, 37.5],
    pulse_rate: [60, 100],
    respiratory_rate: [12, 20],
    systolic_bp: [90, 139],
    diastolic_bp: [60, 89],
    oxygen_saturation: [95, 100],
  };
  const r = ranges[key];
  if (!r) return null;
  if (value < r[0]) return "low";
  if (value > r[1]) return "high";
  return null;
}
