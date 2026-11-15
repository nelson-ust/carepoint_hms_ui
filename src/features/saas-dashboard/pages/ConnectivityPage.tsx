// carepoint_hms_ui/src/features/saas-dashboard/pages/ConnectivityPage.tsx
import {
  Activity,
  CheckCircle2,
  Clock,
  Globe,
  Signal,
  TrendingUp,
  Wifi,
  Zap,
} from "lucide-react";
import {
  DxButton,
  DxKpi,
  DxPage,
  DxPageHeader,
  DxPanel,
} from "@/components/dx";
import { useSystemHealth } from "../hooks/use-system-health";
import { useConnectivityProbe } from "../hooks/use-connectivity";
import { format } from "date-fns";

type Tone = "success" | "warning" | "danger";
const healthTone = (s?: string): Tone =>
  s === "HEALTHY" ? "success" : s === "DEGRADED" ? "warning" : "danger";

export function ConnectivityPage() {
  const { data: health, isLoading: isHealthLoading, refetch: refetchHealth } = useSystemHealth();
  const probeMutation = useConnectivityProbe();
  const network = health?.network;

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "SaaS admin" }, { label: "Connectivity" }]}
        title="Network connectivity"
        subtitle="Monitor platform uptime, API latency, and core service health in real time."
        actions={
          <DxButton
            variant="primary"
            leftIcon={<Wifi className="h-4 w-4" />}
            isLoading={probeMutation.isPending || isHealthLoading}
            onClick={() => {
              probeMutation.mutate({ target_url: "self" });
              refetchHealth();
            }}
          >
            Run health check
          </DxButton>
        }
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <DxKpi label="Uptime (30d)" value={network?.uptime_30d || "0.00%"} icon={CheckCircle2} tone="success" />
        <DxKpi
          label="Avg. latency"
          value={`${network?.avg_latency_ms ?? 0}ms`}
          icon={Signal}
          tone="accent"
          sub={
            network?.latency_trend !== undefined ? (
              <span
                className={`inline-flex items-center gap-1 ${
                  network.latency_trend <= 0 ? "text-[var(--dx-success)]" : "text-[var(--dx-danger)]"
                }`}
              >
                <TrendingUp className={`h-3 w-3 ${network.latency_trend > 0 ? "rotate-180" : ""}`} />
                {Math.abs(network.latency_trend)}% vs last interval
              </span>
            ) : undefined
          }
        />
        <DxKpi
          label="Total probes"
          value={network?.total_probes_24h?.toLocaleString() || "0"}
          icon={Activity}
          tone="info"
          sub="Last 24 hours"
        />
        <DxKpi
          label="Global health"
          value={network?.global_health || "UNKNOWN"}
          icon={Globe}
          tone={healthTone(network?.global_health)}
          sub={network?.global_health_detail || "Checking system status…"}
        />
      </div>

      <DxPanel title="Core services status" icon={<Zap className="h-4 w-4" />}>
        <div className="grid gap-3 md:grid-cols-3">
          <ServiceTile
            icon={<Zap className="h-5 w-5" />}
            label="Database"
            value={health?.database.connected ? "Connected" : "Disconnected"}
            tone={health?.database.connected ? "success" : "danger"}
          />
          <ServiceTile
            icon={<Clock className="h-5 w-5" />}
            label="Scheduler"
            value={health?.scheduler.running ? "Running" : health?.scheduler.available ? "Available" : "Offline"}
            tone={health?.scheduler.running ? "success" : health?.scheduler.available ? "warning" : "danger"}
          />
          <ServiceTile
            icon={<Activity className="h-5 w-5" />}
            label="System uptime"
            value={
              network?.system.uptime_seconds
                ? `${Math.floor(network.system.uptime_seconds / 3600)}h ${Math.floor(
                    (network.system.uptime_seconds % 3600) / 60,
                  )}m`
                : "0s"
            }
            tone="info"
          />
        </div>
      </DxPanel>

      <div className="grid gap-4 lg:grid-cols-3">
        <DxPanel className="lg:col-span-2" title="Service performance" icon={<Signal className="h-4 w-4" />}>
          {network?.regional_performance.length ? (
            <div className="space-y-2.5">
              {network.regional_performance.map((r: { region: string; status: string; latency_ms: number }) => (
                <div
                  key={r.region}
                  className="flex items-center justify-between rounded-[var(--dx-radius)] border border-[var(--dx-border)] bg-[var(--dx-surface-alt)] px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="h-2 w-2 rounded-full" style={{ background: `var(--dx-${healthTone(r.status)})` }} />
                    <div>
                      <p className="font-medium text-[var(--dx-text)]">{r.region}</p>
                      <p className="text-[11px] text-[var(--dx-text-muted)]">Status: {r.status}</p>
                    </div>
                  </div>
                  <span className="font-mono text-[var(--dx-text)]">{r.latency_ms}ms</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-[var(--dx-text-muted)]">Running health checks…</p>
          )}
        </DxPanel>

        <DxPanel title="Recent probes" icon={<Activity className="h-4 w-4" />}>
          {network?.recent_probes.length ? (
            <div className="space-y-2">
              {network.recent_probes
                .slice(0, 6)
                .map((probe: { id: string; status: string; timestamp: string | number | Date; latency_ms: number }) => (
                  <div
                    key={probe.id}
                    className="flex items-center justify-between rounded-[var(--dx-radius)] border border-[var(--dx-border)] bg-[var(--dx-surface-alt)] px-3 py-2.5"
                  >
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2
                        className={`h-4 w-4 ${
                          probe.status === "HEALTHY" ? "text-[var(--dx-success)]" : "text-[var(--dx-warning)]"
                        }`}
                      />
                      <div>
                        <p className="font-medium text-[var(--dx-text)]">Probe #{probe.id}</p>
                        <p className="text-[11px] text-[var(--dx-text-muted)]">
                          {format(new Date(probe.timestamp), "HH:mm:ss")}
                        </p>
                      </div>
                    </div>
                    <span className="font-mono text-[12px] text-[var(--dx-text)]">{probe.latency_ms}ms</span>
                  </div>
                ))}
            </div>
          ) : (
            <p className="py-8 text-center text-[var(--dx-text-muted)]">No recent probes recorded.</p>
          )}
        </DxPanel>
      </div>
    </DxPage>
  );
}

function ServiceTile({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "success" | "warning" | "danger" | "info";
}) {
  return (
    <div className="flex items-center gap-3 rounded-[var(--dx-radius)] border border-[var(--dx-border)] bg-[var(--dx-surface-alt)] p-4">
      <span
        className="h-10 w-10 rounded-[var(--dx-radius)] flex items-center justify-center shrink-0"
        style={{ background: `var(--dx-${tone}-soft)`, color: `var(--dx-${tone})` }}
      >
        {icon}
      </span>
      <div>
        <p className="text-[11px] text-[var(--dx-text-muted)] uppercase tracking-wide">{label}</p>
        <p className="font-semibold text-[var(--dx-text)]">{value}</p>
      </div>
    </div>
  );
}
