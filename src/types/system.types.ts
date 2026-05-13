export interface HealthResponse {
  status: string;
  application: string;
  version: string;
  environment: string;
  startup_completed: boolean;
  database: {
    connected: boolean;
  };
  scheduler: {
    configured_enabled: boolean;
    available: boolean;
    running: boolean;
    import_error: string | null;
  };
  network: {
    uptime_30d: string;
    avg_latency_ms: number;
    latency_trend: number;
    total_probes_24h: number;
    global_health: string;
    global_health_detail: string;
    regional_performance: Array<{
      region: string;
      status: string;
      latency_ms: number;
      active: boolean;
    }>;
    recent_probes: Array<{
      id: number;
      latency_ms: number;
      status: string;
      timestamp: string;
    }>;
    system: {
      memory_usage_mb: number;
      cpu_percent: number;
      uptime_seconds: number;
    };
  };
}
