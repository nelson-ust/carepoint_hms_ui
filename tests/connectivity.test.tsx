import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock the connectivity hook so we can drive online/offline states. The source
// of truth (useConnectivity) is covered implicitly through these components.
const connectivity = {
  online: true,
  isLoading: false,
  reason: "",
  gatedOperations: [] as string[],
};
vi.mock("@/lib/connectivity/useConnectivity", () => ({
  useConnectivity: () => connectivity,
  useRefreshConnectivity: () => vi.fn(),
  connectivityQueryKey: ["system", "connectivity-status"],
}));

import { OnlineRequiredRoute } from "@/components/layout/OnlineRequiredRoute";
import { OfflineBanner } from "@/components/layout/OfflineBanner";

beforeEach(() => {
  connectivity.online = true;
  connectivity.isLoading = false;
});

describe("OnlineRequiredRoute", () => {
  it("renders the guarded children when online", () => {
    render(
      <OnlineRequiredRoute area="Cross-hospital">
        <div data-testid="console">Interoperability console</div>
      </OnlineRequiredRoute>,
    );
    expect(screen.getByTestId("console")).toBeInTheDocument();
    expect(screen.queryByText(/needs an internet connection/i)).not.toBeInTheDocument();
  });

  it("blocks the children and shows a paused state when offline", () => {
    connectivity.online = false;
    render(
      <OnlineRequiredRoute area="Cross-hospital data exchange & referrals">
        <div data-testid="console">Interoperability console</div>
      </OnlineRequiredRoute>,
    );
    expect(screen.queryByTestId("console")).not.toBeInTheDocument();
    expect(
      screen.getByText(/Cross-hospital data exchange & referrals needs an internet connection/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /check again/i })).toBeInTheDocument();
  });

  it("does not block while connectivity is still loading", () => {
    connectivity.isLoading = true;
    connectivity.online = false; // ignored while loading
    render(
      <OnlineRequiredRoute>
        <div data-testid="console">ok</div>
      </OnlineRequiredRoute>,
    );
    expect(screen.getByTestId("console")).toBeInTheDocument();
  });
});

describe("OfflineBanner", () => {
  it("is hidden when online", () => {
    const { container } = render(<OfflineBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the offline notice and a retry when offline", () => {
    connectivity.online = false;
    render(<OfflineBanner />);
    expect(screen.getByText(/Offline — no internet connection/i)).toBeInTheDocument();
    expect(screen.getByText(/cross-hospital/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });
});
