import { useEffect, useMemo, useState } from "react";
import { Activity, MonitorPlay, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { resolveTenantCode } from "@/lib/tenant/tenant-resolver";
import { useDisplayBoard } from "../hooks/use-queue";
import type { DisplayBoardEntry } from "../api/queues.api";

const WAITING_LIMIT = 6;

function formatClock(date: Date) {
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatStamp(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

/**
 * Full-screen waiting-room display. Routed OUTSIDE the dashboard shell —
 * renders its own dark root, no sidebar/topbar assumptions, and shows queue
 * numbers only (no patient identifiers).
 */
export function QueueDisplayBoardPage() {
  const boardQuery = useDisplayBoard(WAITING_LIMIT);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const tenantName = useMemo(() => resolveTenantCode() ?? "CarePoint HMS", []);
  const servicePoints = boardQuery.data?.service_points ?? [];
  const hasActivity = servicePoints.some(
    (sp) =>
      sp.now_serving.length > 0 ||
      sp.now_called.length > 0 ||
      sp.next_waiting.length > 0 ||
      sp.waiting_count > 0,
  );

  return (
    <div className="min-h-screen bg-secondary-950 ambient-bg text-white">
      <div className="mx-auto flex min-h-screen max-w-[1800px] flex-col gap-8 px-8 py-8 xl:px-14">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-300 shadow-glow-sm">
              <MonitorPlay className="h-7 w-7" aria-hidden />
            </div>
            <div>
              <h1 className="font-display text-3xl font-bold tracking-tight text-white">
                {tenantName}
              </h1>
              <p className="mt-0.5 text-xs font-bold uppercase tracking-[0.3em] text-white/40">
                Patient Queue · Now Serving
              </p>
            </div>
          </div>
          <div className="flex items-center gap-8">
            <div className="text-right">
              <p className="data-mono font-display text-4xl font-bold tabular-nums tracking-tight text-white">
                {formatClock(now)}
              </p>
              <p className="mt-0.5 text-xs font-bold uppercase tracking-widest text-white/40">
                {now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1.5 text-xs font-bold text-white/50">
              <span className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                </span>
                Live · refreshes every 10s
              </span>
              <span className="data-mono">
                Updated {formatStamp(boardQuery.data?.generated_at)}
              </span>
            </div>
          </div>
        </header>

        {/* Body */}
        {boardQuery.isLoading ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4">
            <Activity className="h-10 w-10 animate-pulse text-emerald-300" aria-hidden />
            <p className="text-sm font-bold uppercase tracking-[0.3em] text-white/40">
              Loading queue board…
            </p>
          </div>
        ) : boardQuery.isError ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <p className="font-display text-2xl font-bold text-white/80">Display temporarily unavailable</p>
            <p className="text-sm font-medium text-white/40">
              Reconnecting automatically — the board retries every 10 seconds.
            </p>
          </div>
        ) : servicePoints.length === 0 || !hasActivity ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white/5 text-white/30">
              <Volume2 className="h-10 w-10" aria-hidden />
            </div>
            <p className="font-display text-3xl font-bold text-white/80">No active queues</p>
            <p className="text-sm font-medium text-white/40">
              Queue numbers will appear here as soon as patients are checked in.
            </p>
          </div>
        ) : (
          <main className="grid flex-1 content-start gap-6 md:grid-cols-2 2xl:grid-cols-3">
            {servicePoints.map((sp) => (
              <ServicePointPanel key={sp.service_delivery_point_id} entry={sp} />
            ))}
          </main>
        )}
      </div>
    </div>
  );
}

function ServicePointPanel({ entry }: { entry: DisplayBoardEntry }) {
  const serving = entry.now_serving;
  const called = entry.now_called;
  const upNext = entry.next_waiting;

  return (
    <section className="flex flex-col gap-5 rounded-[2rem] border border-white/10 bg-white/[0.04] p-7 backdrop-blur-xl">
      {/* Panel header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate font-display text-xl font-bold tracking-tight text-white">
            {entry.service_delivery_point_name}
          </h2>
          {entry.service_delivery_point_code ? (
            <p className="data-mono mt-0.5 text-xs font-bold uppercase tracking-widest text-white/30">
              {entry.service_delivery_point_code}
            </p>
          ) : null}
        </div>
        <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-white/60">
          {entry.waiting_count} waiting
        </span>
      </div>

      {/* Now serving */}
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-400">
          Now Serving
        </p>
        {serving.length > 0 ? (
          <div className="mt-2 flex flex-wrap items-baseline gap-x-6 gap-y-2">
            {serving.map((t) => (
              <span
                key={t.queue_number}
                className="font-display text-6xl font-bold tracking-tight text-emerald-300 drop-shadow-[0_0_28px_rgba(16,185,129,0.55)] xl:text-7xl"
              >
                {t.queue_number}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-3 font-display text-3xl font-bold text-white/20">—</p>
        )}
      </div>

      {/* Just called */}
      {called.length > 0 ? (
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-400">
            Just Called
          </p>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-5 gap-y-1.5">
            {called.map((t) => (
              <span
                key={t.queue_number}
                className="animate-pulse font-display text-4xl font-bold tracking-tight text-amber-300"
              >
                {t.queue_number}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {/* Up next */}
      <div className={cn("mt-auto", upNext.length === 0 && "opacity-50")}>
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">Up Next</p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {upNext.length > 0 ? (
            upNext.map((t) => (
              <span
                key={t.queue_number}
                className="data-mono rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-sm font-bold text-white/80"
              >
                {t.queue_number}
              </span>
            ))
          ) : (
            <span className="text-sm font-medium text-white/30">Queue is clear</span>
          )}
        </div>
      </div>
    </section>
  );
}
