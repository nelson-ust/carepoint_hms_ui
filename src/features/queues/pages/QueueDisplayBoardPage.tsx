import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Activity, MonitorPlay, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { resolveTenantCode } from "@/lib/tenant/tenant-resolver";
import { useDisplayBoard } from "../hooks/use-queue";
import type { DisplayBoardEntry } from "../api/queues.api";

const WAITING_LIMIT = 6;

// The board is a public wall display that must stay dark regardless of the
// operator's app theme, so it pins the DevExpress-inspired dark token palette
// on its own root. Every surface below reads these via var(--dx-*), keeping it
// visually part of the dx design system while independent of `html.dark`.
const BOARD_THEME: CSSProperties = {
  ["--dx-canvas" as string]: "#0d1420",
  ["--dx-surface" as string]: "#1b2230",
  ["--dx-surface-sunken" as string]: "#161c28",
  ["--dx-border" as string]: "#2c3545",
  ["--dx-border-strong" as string]: "#3b465a",
  ["--dx-text" as string]: "#e5e9f0",
  ["--dx-text-muted" as string]: "#9aa5b6",
  ["--dx-text-faint" as string]: "#6b768a",
  ["--dx-accent" as string]: "#10b981",
  ["--dx-accent-soft" as string]: "rgba(16, 185, 129, 0.16)",
  ["--dx-warning" as string]: "#fbbf24",
  ["--dx-info" as string]: "#60a5fa",
  background:
    "radial-gradient(1200px 600px at 50% -10%, rgba(16,185,129,0.10), transparent 60%), var(--dx-canvas)",
};

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
    <div className="dx min-h-screen text-[var(--dx-text)]" style={BOARD_THEME}>
      <div className="mx-auto flex min-h-screen max-w-[1800px] flex-col gap-8 px-8 py-8 xl:px-14">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-6 border-b border-[var(--dx-border)] pb-6">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--dx-accent-soft)] text-[var(--dx-accent)]">
              <MonitorPlay className="h-7 w-7" aria-hidden />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-[var(--dx-text)]">{tenantName}</h1>
              <p className="mt-0.5 text-xs font-semibold uppercase tracking-[0.3em] text-[var(--dx-text-muted)]">
                Patient Queue · Now Serving
              </p>
            </div>
          </div>
          <div className="flex items-center gap-8">
            <div className="text-right">
              <p className="dx-mono text-4xl font-bold tabular-nums tracking-tight text-[var(--dx-text)]">{formatClock(now)}</p>
              <p className="mt-0.5 text-xs font-semibold uppercase tracking-widest text-[var(--dx-text-muted)]">
                {now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1.5 text-xs font-semibold text-[var(--dx-text-muted)]">
              <span className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--dx-accent)] opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[var(--dx-accent)]" />
                </span>
                Live · refreshes every 10s
              </span>
              <span className="dx-mono">Updated {formatStamp(boardQuery.data?.generated_at)}</span>
            </div>
          </div>
        </header>

        {/* Body */}
        {boardQuery.isLoading ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4">
            <Activity className="h-10 w-10 animate-pulse text-[var(--dx-accent)]" aria-hidden />
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--dx-text-muted)]">Loading queue board…</p>
          </div>
        ) : boardQuery.isError ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <p className="text-2xl font-bold text-[var(--dx-text)]">Display temporarily unavailable</p>
            <p className="text-sm font-medium text-[var(--dx-text-muted)]">Reconnecting automatically — the board retries every 10 seconds.</p>
          </div>
        ) : servicePoints.length === 0 || !hasActivity ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[var(--dx-surface)] text-[var(--dx-text-faint)]">
              <Volume2 className="h-10 w-10" aria-hidden />
            </div>
            <p className="text-3xl font-bold text-[var(--dx-text)]">No active queues</p>
            <p className="text-sm font-medium text-[var(--dx-text-muted)]">Queue numbers will appear here as soon as patients are checked in.</p>
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
    <section className="flex flex-col gap-5 rounded-xl border border-[var(--dx-border)] bg-[var(--dx-surface)] p-7 shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
      {/* Panel header */}
      <div className="flex items-center justify-between gap-3 border-b border-[var(--dx-border)] pb-4">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-bold tracking-tight text-[var(--dx-text)]">{entry.service_delivery_point_name}</h2>
          {entry.service_delivery_point_code ? (
            <p className="dx-mono mt-0.5 text-xs font-semibold uppercase tracking-widest text-[var(--dx-text-faint)]">{entry.service_delivery_point_code}</p>
          ) : null}
        </div>
        <span className="shrink-0 rounded-md border border-[var(--dx-border)] bg-[var(--dx-surface-sunken)] px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-[var(--dx-text-muted)]">
          {entry.waiting_count} waiting
        </span>
      </div>

      {/* Now serving */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--dx-accent)]">Now Serving</p>
        {serving.length > 0 ? (
          <div className="mt-2 flex flex-wrap items-baseline gap-x-6 gap-y-2">
            {serving.map((t) => (
              <span
                key={t.queue_number}
                className="text-6xl font-bold tracking-tight text-[var(--dx-accent)] drop-shadow-[0_0_28px_rgba(16,185,129,0.5)] xl:text-7xl"
              >
                {t.queue_number}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-3xl font-bold text-[var(--dx-text-faint)]">—</p>
        )}
      </div>

      {/* Just called */}
      {called.length > 0 ? (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--dx-warning)]">Just Called</p>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-5 gap-y-1.5">
            {called.map((t) => (
              <span key={t.queue_number} className="animate-pulse text-4xl font-bold tracking-tight text-[var(--dx-warning)]">
                {t.queue_number}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {/* Up next */}
      <div className={cn("mt-auto", upNext.length === 0 && "opacity-50")}>
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--dx-text-muted)]">Up Next</p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {upNext.length > 0 ? (
            upNext.map((t) => (
              <span
                key={t.queue_number}
                className="dx-mono rounded-md border border-[var(--dx-border)] bg-[var(--dx-surface-sunken)] px-3.5 py-1.5 text-sm font-bold text-[var(--dx-text)]"
              >
                {t.queue_number}
              </span>
            ))
          ) : (
            <span className="text-sm font-medium text-[var(--dx-text-faint)]">Queue is clear</span>
          )}
        </div>
      </div>
    </section>
  );
}
