import { useState, type ReactNode } from "react";
import { CloudOff, RefreshCw } from "lucide-react";
import { useConnectivity, useRefreshConnectivity } from "@/lib/connectivity/useConnectivity";

/**
 * Route guard for cross-hospital-only areas (interoperability / inter-facility
 * referrals). These screens read and write data that lives in the central
 * cloud, so when the hospital is offline they cannot function — we show a clear
 * "paused" state with a retry instead of a broken console. The local clinic
 * flow is never wrapped in this guard, so it always works offline.
 */
export function OnlineRequiredRoute({ area, children }: { area?: string; children: ReactNode }) {
  const net = useConnectivity();
  const refresh = useRefreshConnectivity();
  const [checking, setChecking] = useState(false);

  if (net.isLoading || net.online) return <>{children}</>;

  const onRetry = async () => {
    setChecking(true);
    try {
      await refresh();
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="dx mx-auto max-w-xl rounded border border-[var(--dx-border)] bg-[var(--dx-surface)] p-8 text-center">
      <CloudOff className="mx-auto mb-3 h-10 w-10 text-[var(--dx-text-muted)]" aria-hidden />
      <h2 className="text-lg font-semibold text-[var(--dx-text)]">
        {area ?? "This area"} needs an internet connection
      </h2>
      <p className="mt-1.5 text-sm text-[var(--dx-text-muted)]">
        This hospital is currently offline, so cross-hospital features are paused. Everything local
        to this hospital keeps working. This page returns automatically once the connection is restored.
      </p>
      <button
        type="button"
        onClick={onRetry}
        disabled={checking}
        className="dx-btn dx-btn-primary dx-btn-sm mx-auto mt-4"
      >
        <RefreshCw className={checking ? "animate-spin" : undefined} aria-hidden /> Check again
      </button>
    </div>
  );
}
