import { describe, it, expect } from "vitest";
import {
  statusTone,
  humanize,
  formatNaira,
  ageFrom,
  apiErrorMessage,
} from "@/components/dx/dx-utils";

describe("statusTone", () => {
  it("maps backend statuses to tones", () => {
    expect(statusTone("COMPLETED")).toBe("success");
    expect(statusTone("WAITING")).toBe("warning");
    expect(statusTone("CANCELLED")).toBe("danger");
    expect(statusTone("CALLED")).toBe("info");
    expect(statusTone("")).toBe("neutral");
    expect(statusTone(null)).toBe("neutral");
  });
});

describe("humanize", () => {
  it("turns SNAKE_CASE into sentence case", () => {
    expect(humanize("IN_PROGRESS")).toBe("In progress");
    expect(humanize("ServicePointType.TRIAGE")).toBe("Triage");
    expect(humanize(null)).toBe("—");
  });
});

describe("formatNaira", () => {
  it("groups thousands and handles empties", () => {
    expect(formatNaira(1700)).toContain("1,700");
    expect(formatNaira("17000")).toContain("17,000");
    expect(formatNaira(null)).toBe("—");
    expect(formatNaira(undefined)).toBe("—");
  });
});

describe("ageFrom", () => {
  it("returns whole years with a unit, or a dash", () => {
    expect(ageFrom(null)).toBe("—");
    expect(ageFrom("1990-01-01")).toMatch(/\d+\s*yrs/);
  });
});

describe("apiErrorMessage", () => {
  it("pulls the message out of common error shapes", () => {
    expect(apiErrorMessage({ response: { data: { message: "boom" } } })).toBe("boom");
    expect(apiErrorMessage({ response: { data: { detail: "bad request" } } })).toBe("bad request");
    expect(
      apiErrorMessage({ response: { data: { detail: [{ loc: ["body", "x"], msg: "required" }] } } }),
    ).toContain("required");
    expect(apiErrorMessage(new Error("network"))).toBe("network");
    expect(apiErrorMessage(undefined)).toBeTruthy();
  });
});
