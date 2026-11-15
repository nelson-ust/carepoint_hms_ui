import { describe, it, expect } from "vitest";
import {
  computeBmi,
  bmiCategory,
  computeMews,
  mewsBand,
  vitalFlag,
} from "@/features/clinical/api/vital-signs.api";

describe("computeBmi", () => {
  it("computes and rounds to one decimal", () => {
    expect(computeBmi(82, 157.5)).toBe(33.1);
    expect(computeBmi(70, 175)).toBe(22.9);
  });
  it("returns null on missing/invalid input", () => {
    expect(computeBmi(null, 170)).toBeNull();
    expect(computeBmi(70, 0)).toBeNull();
  });
});

describe("bmiCategory", () => {
  it("bands the BMI", () => {
    expect(bmiCategory(null)).toEqual({ label: "Awaiting data", tone: "neutral" });
    expect(bmiCategory(17)).toEqual({ label: "Underweight", tone: "warning" });
    expect(bmiCategory(22)).toEqual({ label: "Normal range", tone: "success" });
    expect(bmiCategory(27)).toEqual({ label: "Overweight", tone: "warning" });
    expect(bmiCategory(33.1)).toEqual({ label: "Obese", tone: "danger" });
  });
});

describe("computeMews", () => {
  it("scores a normal set as low (RR 16 contributes 1)", () => {
    expect(
      computeMews({ pulse_rate: 72, respiratory_rate: 16, systolic_bp: 130, temperature_celsius: 36.8 }),
    ).toBe(1);
  });
  it("scores a deteriorating set high", () => {
    // RR 32 (+3), pulse 135 (+3), systolic 68 (+3), temp 34.5 (+2) = 11
    expect(
      computeMews({ pulse_rate: 135, respiratory_rate: 32, systolic_bp: 68, temperature_celsius: 34.5 }),
    ).toBe(11);
  });
  it("returns null when any of the four inputs is missing", () => {
    expect(computeMews({ pulse_rate: 72, respiratory_rate: 16, systolic_bp: 130 })).toBeNull();
  });
});

describe("mewsBand", () => {
  it("bands the score", () => {
    expect(mewsBand(null).label).toBe("Incomplete");
    expect(mewsBand(1)).toMatchObject({ label: "Low risk", tone: "success" });
    expect(mewsBand(3)).toMatchObject({ label: "Moderate", tone: "warning" });
    expect(mewsBand(4)).toMatchObject({ label: "High", tone: "danger" });
    expect(mewsBand(11)).toMatchObject({ label: "Critical", tone: "danger" });
  });
});

describe("vitalFlag", () => {
  it("flags out-of-range readings against adult ranges", () => {
    expect(vitalFlag("temperature_celsius", 39.2)).toBe("high");
    expect(vitalFlag("pulse_rate", 55)).toBe("low");
    expect(vitalFlag("oxygen_saturation", 99)).toBeNull();
    expect(vitalFlag("systolic_bp", 150)).toBe("high");
    expect(vitalFlag("unknown_key", 5)).toBeNull();
    expect(vitalFlag("pulse_rate", null)).toBeNull();
  });
});
