import type { CSSProperties } from "react";
import { useTheme } from "@/lib/theme/ThemeProvider";

/**
 * Theme-aware recharts tokens. Use instead of hardcoded hex values so charts
 * render correctly in both light and dark mode.
 *
 * const chart = useChartTheme();
 * <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" vertical={false} />
 * <XAxis tick={chart.tick} axisLine={false} tickLine={false} />
 * <Tooltip cursor={chart.cursor} contentStyle={chart.tooltip} />
 * <Bar fill={chart.series[0]} radius={[8, 8, 0, 0]} />
 */
export interface ChartTheme {
  /** Categorical series palette (emerald-led, dark-aware). */
  series: string[];
  grid: string;
  tick: { fill: string; fontSize: number; fontWeight: number };
  cursor: { fill: string };
  tooltip: CSSProperties;
  /** Muted comparison bars / secondary areas. */
  muted: string;
  /** Gradient stop colors for <defs> area fills. */
  areaGradient: { from: string; to: string };
}

export function useChartTheme(): ChartTheme {
  const { theme } = useTheme();
  const dark = theme === "dark";

  return {
    series: dark
      ? ["#34d399", "#22d3ee", "#a78bfa", "#fbbf24", "#fb7185", "#818cf8"]
      : ["#10B981", "#06b6d4", "#8b5cf6", "#f59e0b", "#f43f5e", "#6366f1"],
    muted: dark ? "rgba(148, 163, 184, 0.18)" : "#e2e8f0",
    grid: dark ? "rgba(148, 163, 184, 0.12)" : "#f1f5f9",
    tick: {
      fill: dark ? "#64748b" : "#94a3b8",
      fontSize: 12,
      fontWeight: 600,
    },
    cursor: { fill: dark ? "rgba(255, 255, 255, 0.04)" : "#f8fafc" },
    tooltip: {
      borderRadius: "1rem",
      border: dark ? "1px solid rgba(255,255,255,0.1)" : "none",
      backgroundColor: dark ? "rgba(15, 23, 42, 0.95)" : "rgba(255, 255, 255, 0.98)",
      color: dark ? "#e2e8f0" : "#0f172a",
      boxShadow: "0 20px 40px -12px rgba(2, 6, 23, 0.35)",
      fontSize: "12px",
      fontWeight: 600,
    },
    areaGradient: dark
      ? { from: "rgba(52, 211, 153, 0.35)", to: "rgba(52, 211, 153, 0)" }
      : { from: "rgba(16, 185, 129, 0.25)", to: "rgba(16, 185, 129, 0)" },
  };
}
