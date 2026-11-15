import { useState } from "react";
import { CloudOff, RefreshCw } from "lucide-react";
import { useConnectivity, useRefreshConnectivity } from "@/lib/connectivity/useConnectivity";

/**
 * Shell banner shown whenever this hospital can't reach the central cloud. The
 * local clinic flow keeps working; only cross-hospital actions (inter-facility
 * referrals, data exchange, and the online steps of A&E care) are paused.
 */
export function OfflineBanner() {
  const net = useConnectivity();
  const refresh = useRefreshConnectivity();
  const [checking, setChecking] = useState(false);

  if (net.isLoading || net.online) return null;

  const onRetry = async () => {
    setChecking(true);
    try {
      await refresh();
    } finally {
      setChecking(false);
    }
  };

  return (
    <div role="status" className="dx-msg dx-msg-warning mb-4 flex items-center gap-3">
      <CloudOff className="h-4 w-4 shrink-0" aria-hidden />
      <span className="font-medium">
        Offline — no internet connection. The clinic flow works normally; cross-hospital
        referrals, data exchange and A&amp;E online steps are paused until the connection returns.
      </span>
      <button
        type="button"
        onClick={onRetry}
        disabled={checking}
        className="dx-btn dx-btn-text dx-btn-sm ml-auto shrink-0"
      >
        <RefreshCw className={checking ? "animate-spin" : undefined} aria-hidden /> Retry
      </button>
    </div>
  );
}
