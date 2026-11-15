import { describe, it, expect } from "vitest";
import {
  normalizeSdpType,
  sdpTypeLabel,
  workstationPathFor,
  visitPriorityTone,
  patientDisplayName,
  pathwaySteps,
  nextPathwayStep,
} from "@/features/visits/lib/clinic-flow";

// A visit following Registration → Triage → Lab, currently at Triage.
const visit: any = {
  id: 7,
  current_service_delivery_point_id: 2,
  flow_steps: [
    { id: 1, step_order: 1, status: "COMPLETED", is_current: false, is_required: true, is_skipped: false, service_delivery_point_id: 1, service_delivery_point: { name: "Front Desk" } },
    { id: 2, step_order: 2, status: "IN_PROGRESS", is_current: true, is_required: true, is_skipped: false, service_delivery_point_id: 2, service_delivery_point: { name: "Triage" } },
    { id: 3, step_order: 3, status: "PENDING", is_current: false, is_required: false, is_skipped: false, service_delivery_point_id: 3, service_delivery_point: { name: "Laboratory" } },
  ],
};

describe("normalizeSdpType", () => {
  it("uppercases and strips enum prefixes", () => {
    expect(normalizeSdpType("triage")).toBe("TRIAGE");
    expect(normalizeSdpType("ServicePointType.CLINIC")).toBe("CLINIC");
    expect(normalizeSdpType(null)).toBe("OTHER");
    expect(normalizeSdpType("")).toBe("OTHER");
  });
});

describe("workstationPathFor", () => {
  it("maps each desk type to the right workstation + label", () => {
    expect(workstationPathFor("TRIAGE", 7)).toEqual({ path: expect.stringContaining("/7"), label: "Open Triage" });
    expect(workstationPathFor("CLINIC", 7).label).toBe("Open Consultation");
    expect(workstationPathFor("INSURANCE_CONFIRMATION", 7).label).toBe("Confirm Eligibility");
    expect(workstationPathFor("LABORATORY", 7)).toEqual({ path: expect.stringContaining("visit=7"), label: "Open Lab Worklist" });
    expect(workstationPathFor("PHARMACY", 7).label).toBe("Open Pharmacy");
    expect(workstationPathFor("CASHIER", 7).label).toBe("Open Billing");
    expect(workstationPathFor("REGISTRATION", 7).label).toBe("Open Visit");
  });
});

describe("sdpTypeLabel", () => {
  it("gives human desk names", () => {
    expect(sdpTypeLabel("TRIAGE")).toBe("Triage");
    expect(sdpTypeLabel("CLINIC")).toBe("Consultation");
    expect(sdpTypeLabel("CASHIER")).toBe("Billing & Payment");
    expect(sdpTypeLabel("INSURANCE_CONFIRMATION")).toBe("HMO / Insurance Desk");
  });
});

describe("visitPriorityTone", () => {
  it("maps priority to a tone", () => {
    expect(visitPriorityTone("EMERGENCY")).toBe("danger");
    expect(visitPriorityTone("URGENT")).toBe("warning");
    expect(visitPriorityTone("ROUTINE")).toBe("neutral");
    expect(visitPriorityTone(null)).toBe("neutral");
  });
});

describe("patientDisplayName", () => {
  it("joins the available name parts", () => {
    expect(patientDisplayName({ first_name: "Amaka", last_name: "Okafor" })).toBe("Amaka Okafor");
    expect(patientDisplayName({ first_name: "Ada", middle_name: "N", last_name: "Eze" })).toBe("Ada N Eze");
    expect(patientDisplayName(null)).toBe("Unknown patient");
  });
});

describe("pathwaySteps", () => {
  it("classifies each step by status, in order", () => {
    const steps = pathwaySteps(visit);
    expect(steps.map((s) => s.status)).toEqual(["done", "current", "pending"]);
    expect(steps[2].sub).toBe("optional"); // Lab is not required
    expect(steps.map((s) => s.label)).toEqual(["Front Desk", "Triage", "Laboratory"]);
  });
  it("is empty for a visit with no flow steps", () => {
    expect(pathwaySteps({ flow_steps: [] } as any)).toEqual([]);
    expect(pathwaySteps(null)).toEqual([]);
  });
});

describe("nextPathwayStep", () => {
  it("returns the next non-terminal step after the current one", () => {
    const next = nextPathwayStep(visit);
    expect(next?.service_delivery_point_id).toBe(3);
  });
  it("returns null when the current step is the last", () => {
    const atLast: any = {
      current_service_delivery_point_id: 3,
      flow_steps: [
        { id: 1, step_order: 1, status: "COMPLETED", is_current: false, is_required: true, is_skipped: false, service_delivery_point_id: 1, service_delivery_point: { name: "A" } },
        { id: 3, step_order: 3, status: "IN_PROGRESS", is_current: true, is_required: true, is_skipped: false, service_delivery_point_id: 3, service_delivery_point: { name: "Lab" } },
      ],
    };
    expect(nextPathwayStep(atLast)).toBeNull();
  });
});
