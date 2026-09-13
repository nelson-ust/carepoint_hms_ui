/** Points-tier thresholds, derived purely from the live points balance. */
export const POINTS_TIERS = [
  { name: "Member", min: 0, perks: ["Access to the rewards program", "Earn points on eligible visits"] },
  { name: "Silver", min: 1_000, perks: ["Everything in Member", "Priority appointment reminders", "Birthday bonus points"] },
  { name: "Gold", min: 5_000, perks: ["Everything in Silver", "Dedicated support line", "Higher points earn rate"] },
  { name: "Platinum", min: 15_000, perks: ["Everything in Gold", "Complimentary annual health check", "Exclusive partner offers"] },
] as const;

export type PointsTier = (typeof POINTS_TIERS)[number];

export function tierForBalance(balance: number): { tier: PointsTier; next: PointsTier | undefined } {
  let tier: PointsTier = POINTS_TIERS[0];
  for (const t of POINTS_TIERS) {
    if (balance >= t.min) tier = t;
  }
  const next = POINTS_TIERS[POINTS_TIERS.indexOf(tier) + 1];
  return { tier, next };
}
