import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

// The console lands on the provider's desk and shows an empty "attend" state
// until a patient is called. We stub the data hooks and the heavy capture
// panels so the test exercises the console shell, not the whole app tree.
vi.mock("@/features/queues/hooks/use-queue", () => ({
  useMyServicePoints: () => ({ data: [{ id: 1, name: "Triage Desk", code: "TRG", service_point_type: "TRIAGE" }], isLoading: false }),
  useActiveServicePoints: () => ({ data: { items: [] }, isLoading: false }),
  useMyWorklist: () => ({ data: { service_delivery_point_id: 1, waiting: [], serving: [] }, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() }),
  useServicePointWorklist: () => ({ data: undefined, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() }),
  useCallTicket: () => ({ mutate: vi.fn(), isPending: false }),
  useServeTicket: () => ({ mutate: vi.fn(), isPending: false }),
  useCompleteAndEndVisitTicket: () => ({ mutate: vi.fn(), isPending: false }),
}));

// Stub the embedded capture panels and visit widgets (heavy, not under test here).
vi.mock("@/features/clinical/pages/TriagePage", () => ({ TriagePage: () => null }));
vi.mock("@/features/clinical/pages/ConsultationPage", () => ({ ConsultationPage: () => null }));
vi.mock("@/features/insurance/pages/EligibilityConfirmPage", () => ({ EligibilityConfirmPage: () => null }));
vi.mock("@/features/laboratory/pages/LabOrdersPage", () => ({ LabOrdersPage: () => null }));
vi.mock("@/features/laboratory/pages/LabResultsPage", () => ({ LabResultsPage: () => null }));
vi.mock("@/features/pharmacy/pages/PharmacyQueuePage", () => ({ PharmacyQueuePage: () => null }));
vi.mock("@/features/billing/pages/BillingListPage", () => ({ BillingListPage: () => null }));
vi.mock("@/features/visits/components/VisitBanner", () => ({ VisitBanner: () => null }));
vi.mock("@/features/visits/components/RoutePatientPopup", () => ({ RoutePatientPopup: () => null }));
vi.mock("@/components/feedback/ToastProvider", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
}));

import { ServiceDeskPage } from "@/features/service-desk/pages/ServiceDeskPage";

function renderConsole() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/service-desk"]}>
        <ServiceDeskPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ServiceDeskPage", () => {
  it("lands on the provider's desk with an empty attend state", () => {
    renderConsole();
    expect(screen.getByRole("heading", { name: "Service Desk" })).toBeInTheDocument();
    expect(screen.getByText("Triage Desk")).toBeInTheDocument();
    expect(screen.getByText(/no patient in service/i)).toBeInTheDocument();
  });

  it("disables Call next when the queue is empty", () => {
    renderConsole();
    const callNext = screen.getByRole("button", { name: /call next/i });
    expect(callNext).toBeDisabled();
  });
});
