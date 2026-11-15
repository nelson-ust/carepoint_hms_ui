import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

// ---- shared stubs ----
vi.mock("@/features/patients/api/patients.api", () => ({
  searchPatients: vi.fn(async () => ({ items: [] })),
}));
vi.mock("@/components/feedback/ToastProvider", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
}));

// ---- api modules: keep real pure exports, override the api object ----
vi.mock("@/features/dental/api/dental.api", async (orig) => ({
  ...(await orig<typeof import("@/features/dental/api/dental.api")>()),
  dentalApi: {
    listCharts: vi.fn(async () => ({ success: true, message: "", items: [], count: 0, meta: {} })),
    stats: vi.fn(async () => ({ charts_total: 3, charts_open: 1, procedures_planned: 2, procedures_completed: 4, completed_revenue: "50000", condition_distribution: [] })),
    worklist: vi.fn(async () => []),
  },
}));
vi.mock("@/features/eye/api/eye.api", async (orig) => ({
  ...(await orig<typeof import("@/features/eye/api/eye.api")>()),
  eyeApi: {
    listExams: vi.fn(async () => ({ success: true, message: "", items: [], count: 0, meta: {} })),
    stats: vi.fn(async () => ({ exams_total: 2, exams_open: 1, prescriptions_total: 5, raised_iop_flagged: 1 })),
  },
}));
vi.mock("@/features/ortho/api/ortho.api", async (orig) => ({
  ...(await orig<typeof import("@/features/ortho/api/ortho.api")>()),
  orthoApi: {
    listAssessments: vi.fn(async () => ({ success: true, message: "", items: [], count: 0, meta: {} })),
    stats: vi.fn(async () => ({ assessments_total: 4, assessments_open: 2, fractures_total: 3, active_immobilisations: 1, procedures_planned: 1, procedures_completed: 2, completed_revenue: "80000" })),
  },
}));

import { TOOTH_CONDITION_META, DENTAL_CONDITIONS, FDI_PERMANENT } from "@/features/dental/api/dental.api";
import { LENS_TYPES } from "@/features/eye/api/eye.api";
import { LATERALITY_OPTIONS, lateralityLabel } from "@/features/ortho/api/ortho.api";
import { DentalWorklistPage } from "@/features/dental/pages/DentalWorklistPage";
import { EyeWorklistPage } from "@/features/eye/pages/EyeWorklistPage";
import { OrthoWorklistPage } from "@/features/ortho/pages/OrthoWorklistPage";

function renderPage(ui: React.ReactElement, route: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Dental module — pure data", () => {
  it("covers every charted condition with a label + colour", () => {
    for (const c of DENTAL_CONDITIONS) {
      expect(TOOTH_CONDITION_META[c].label).toBeTruthy();
      expect(TOOTH_CONDITION_META[c].color).toMatch(/^(#|var\()/);
    }
  });
  it("lays out a full permanent dentition (32 teeth)", () => {
    const all = [
      ...FDI_PERMANENT.upperRight, ...FDI_PERMANENT.upperLeft,
      ...FDI_PERMANENT.lowerRight, ...FDI_PERMANENT.lowerLeft,
    ];
    expect(all).toHaveLength(32);
    expect(new Set(all).size).toBe(32); // no duplicate tooth numbers
  });
});

describe("Eye module — pure data", () => {
  it("exposes the standard spectacle lens types", () => {
    const values = LENS_TYPES.map((l) => l.value);
    expect(values).toContain("SINGLE_VISION");
    expect(values).toContain("PROGRESSIVE");
  });
});

describe("Ortho module — pure data", () => {
  it("maps laterality codes to friendly labels", () => {
    expect(lateralityLabel("RIGHT")).toBe("Right");
    expect(lateralityLabel("NOT_APPLICABLE")).toBe("N/A");
    expect(lateralityLabel(undefined)).toBe("N/A");
    expect(LATERALITY_OPTIONS.map((o) => o.value)).toContain("BILATERAL");
  });
});

describe("Specialty worklist pages render", () => {
  it("Dental worklist shows its title and primary action", async () => {
    renderPage(<DentalWorklistPage />, "/dental");
    expect(await screen.findByRole("heading", { name: "Dental Clinic", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /New chart/i })).toBeInTheDocument();
  });
  it("Eye worklist shows its title and primary action", async () => {
    renderPage(<EyeWorklistPage />, "/eye-clinic");
    expect(await screen.findByRole("heading", { name: "Eye Clinic", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /New exam/i })).toBeInTheDocument();
  });
  it("Ortho worklist shows its title and primary action", async () => {
    renderPage(<OrthoWorklistPage />, "/orthopaedics");
    expect(await screen.findByRole("heading", { name: "Orthopaedics Clinic", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /New assessment/i })).toBeInTheDocument();
  });
});
