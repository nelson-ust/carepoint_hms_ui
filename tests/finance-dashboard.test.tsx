import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

// Avoid the ThemeProvider dependency inside useChartTheme.
vi.mock("@/components/charts/chart-theme", () => ({
  useChartTheme: () => ({
    series: ["#10B981", "#06b6d4", "#8b5cf6", "#f59e0b", "#f43f5e", "#6366f1"],
    grid: "#f1f5f9", muted: "#e2e8f0",
    tick: { fill: "#94a3b8", fontSize: 12, fontWeight: 600 },
    cursor: { fill: "#f8fafc" }, tooltip: {},
    areaGradient: { from: "", to: "" },
  }),
}));

const DASHBOARD = {
  as_of: "2026-11-15",
  kpis: {
    revenue_billed_mtd: "100000", revenue_billed_ytd: "1200000",
    collected_today: "5000", collected_mtd: "90000", collected_ytd: "900000",
    expense_mtd: "40000", expense_ytd: "500000",
    surplus_mtd: "60000", surplus_ytd: "700000", collection_rate: "75.0",
    ar_outstanding: "300000", ar_overdue: "120000",
    ap_outstanding: "80000", ap_overdue: "20000",
    cash_on_hand: "450000", net_working_position: "670000",
  },
  ar_aging: { current: "180000", d1_30: "60000", d31_60: "40000", d61_90: "10000", d90_plus: "10000" },
  ap: { outstanding: "80000", overdue: "20000", overdue_count: 2, open_bills: 5 },
  cash_accounts: [{ name: "GTB Main", subtitle: "GTBank", type: "BANK", balance: "450000" }],
  trend: [{ month: "Nov 26", billed: "100000", collected: "90000", expense: "40000" }],
  ar_segments: { patient_self_pay: "200000", hmo_fee_for_service: "80000", capitation: "20000", total: "300000" },
  period: { code: "2026-11", name: "November 2026", status: "OPEN", end_date: "2026-11-30" },
  alerts: [{ severity: "warning", title: "3 overdue invoice(s)", detail: "NGN 120,000 past due" }],
};

vi.mock("@/features/accounting/api/finance-ext.api", async (orig) => ({
  ...(await orig<typeof import("@/features/accounting/api/finance-ext.api")>()),
  financeExtApi: { financeDashboard: vi.fn(async () => DASHBOARD) },
}));

import { FinanceDashboardPage } from "@/features/accounting/pages/FinanceDashboardPage";

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/accounting/dashboard"]}>
        <FinanceDashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("FinanceDashboardPage", () => {
  it("renders the command-center title and headline KPIs", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "Finance Dashboard", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Collected (YTD)")).toBeInTheDocument();
    expect(screen.getByText("Receivables")).toBeInTheDocument();
    expect(screen.getByText("Payables")).toBeInTheDocument();
  });

  it("surfaces an actionable alert", async () => {
    renderPage();
    // Alert title + detail each render as a single text node.
    expect(await screen.findByText(/overdue invoice/i)).toBeInTheDocument();
    expect(screen.getByText(/120,000 past due/i)).toBeInTheDocument();
  });
});
