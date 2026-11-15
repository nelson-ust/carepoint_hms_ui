import { useEffect, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { connectivityQueryKey } from "./useConnectivity";

/**
 * Nudges the connectivity query whenever the browser's own network state flips,
 * so the offline banner and cross-hospital gates react immediately instead of
 * waiting for the next 20s poll. The actual status comes from useConnectivity().
 */
export function ConnectivityProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  useEffect(() => {
    const nudge = () => qc.invalidateQueries({ queryKey: connectivityQueryKey });
    window.addEventListener("online", nudge);
    window.addEventListener("offline", nudge);
    return () => {
      window.removeEventListener("online", nudge);
      window.removeEventListener("offline", nudge);
    };
  }, [qc]);
  return <>{children}</>;
}
