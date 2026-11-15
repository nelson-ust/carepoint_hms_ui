import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// vi.mock is hoisted above the module, so the mock fns must be created inside
// vi.hoisted() to be available when the factory runs.
const { extendSubscription, grantFreeSubscription, listTenantIncentives } = vi.hoisted(() => ({
  extendSubscription: vi.fn(async () => ({ success: true, message: "Subscription extended." })),
  grantFreeSubscription: vi.fn(async () => ({ success: true, message: "Granted." })),
  listTenantIncentives: vi.fn(async () => []),
}));

vi.mock("@/features/tenants/api/tenants.api", () => ({
  extendSubscription,
  grantFreeSubscription,
  listTenantIncentives,
}));

import { SubscriptionIncentives } from "@/features/tenants/components/SubscriptionIncentives";

const plans = [
  { code: "STANDARD", name: "Standard" },
  { code: "PREMIUM", name: "Premium" },
] as any;

beforeEach(() => {
  extendSubscription.mockClear();
  grantFreeSubscription.mockClear();
  listTenantIncentives.mockClear();
});

describe("SubscriptionIncentives", () => {
  it("shows a trial countdown for a trialing subscription", async () => {
    const trialEnd = new Date(Date.now() + 10 * 86400000).toISOString();
    render(
      <SubscriptionIncentives
        tenantId={1}
        subscription={{ id: 1, tenant_id: 1, plan_id: 1, status: "TRIALING", trial_end_date: trialEnd } as any}
        plans={plans}
        onChanged={vi.fn()}
      />,
    );
    expect(await screen.findByText(/trial remaining/i)).toBeInTheDocument();
    expect(screen.getByText(/all features/i)).toBeInTheDocument();
  });

  it("shows a complimentary-access banner for a comp subscription", async () => {
    const end = new Date(Date.now() + 30 * 86400000).toISOString();
    render(
      <SubscriptionIncentives
        tenantId={2}
        subscription={{ id: 2, tenant_id: 2, plan_id: 1, status: "ACTIVE", is_complimentary: true, current_period_end: end } as any}
        plans={plans}
        onChanged={vi.fn()}
      />,
    );
    expect(await screen.findByText(/free access remaining/i)).toBeInTheDocument();
  });

  it("renders extend + grant-free controls and calls the API on extend", async () => {
    const onChanged = vi.fn();
    render(
      <SubscriptionIncentives
        tenantId={7}
        subscription={{ id: 7, tenant_id: 7, plan_id: 1, status: "ACTIVE" } as any}
        plans={plans}
        onChanged={onChanged}
      />,
    );
    expect(screen.getByRole("button", { name: /^Extend$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Grant free access/i })).toBeInTheDocument();

    // Enter 14 days into the first (extend) days field, then click Extend.
    const numberFields = screen.getAllByRole("spinbutton");
    fireEvent.change(numberFields[0], { target: { value: "14" } });
    fireEvent.click(screen.getByRole("button", { name: /^Extend$/i }));

    await waitFor(() => expect(extendSubscription).toHaveBeenCalledTimes(1));
    expect(extendSubscription).toHaveBeenCalledWith(7, expect.objectContaining({ days: 14, months: 0 }));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it("blocks a zero-duration grant and does not call the API", async () => {
    render(
      <SubscriptionIncentives
        tenantId={9}
        subscription={{ id: 9, tenant_id: 9, plan_id: 1, status: "ACTIVE" } as any}
        plans={plans}
        onChanged={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Grant free access/i }));
    await screen.findByText(/days and\/or months of free access/i);
    expect(grantFreeSubscription).not.toHaveBeenCalled();
  });
});
