/** Best-effort abnormal flag: numeric result vs a "low - high" reference range. */
export function isAbnormal(value?: string | null, range?: string | null): boolean {
  if (!value || !range) return false;
  const v = parseFloat(String(value).replace(/[^\d.-]/g, ""));
  if (Number.isNaN(v)) return false;
  const m = String(range).match(/(-?\d+(?:\.\d+)?)\s*[-–]\s*(-?\d+(?:\.\d+)?)/);
  if (!m) return false;
  const low = parseFloat(m[1]);
  const high = parseFloat(m[2]);
  if (Number.isNaN(low) || Number.isNaN(high)) return false;
  return v < low || v > high;
}
