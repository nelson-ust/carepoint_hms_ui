import type { ReactNode } from "react";
import { Link } from "react-router-dom";

/**
 * Carepoint HMS brand lockup — the heartbeat mark plus the "Carepoint HMS"
 * wordmark, rendered crisply from inline SVG + the app's display font so it
 * represents the company and the product name everywhere it appears.
 *
 * Variants:
 *  - "inline"  → mark beside the name (nav bars, headers)
 *  - "stacked" → mark above the name (login / splash cards)
 *  - "mark"    → the badge only (compact chips, favicons-in-UI)
 */
export type LogoVariant = "inline" | "stacked" | "mark";
export type LogoProps = {
  variant?: LogoVariant;
  /** Mark size in px (the wordmark scales with it). */
  size?: number;
  /** Render the wordmark in white for dark / photographic backgrounds. */
  onDark?: boolean;
  /** Show the "Hospital Management System" tagline (stacked only). */
  tagline?: boolean;
  /** Wrap the lockup in a link to a route. */
  to?: string;
  className?: string;
};

export function LogoMark({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role="img"
      aria-label="Carepoint HMS"
      className={className}
    >
      <defs>
        <linearGradient id="cpMarkBg" x1="6" y1="2" x2="58" y2="62" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#5EEAD4" />
          <stop offset=".45" stopColor="#10B981" />
          <stop offset="1" stopColor="#047857" />
        </linearGradient>
        <linearGradient id="cpMarkSheen" x1="0" y1="0" x2="0" y2="34" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" stopOpacity=".30" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#cpMarkBg)" />
      <rect width="64" height="30" rx="16" fill="url(#cpMarkSheen)" />
      <path
        d="M9 34 H21 L26 22 L33 45 L38 31 H55"
        fill="none"
        stroke="#ffffff"
        strokeWidth="4.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="55" cy="31" r="3.1" fill="#ffffff" />
    </svg>
  );
}

function Wordmark({ size, onDark, tagline, stacked }: { size: number; onDark?: boolean; tagline?: boolean; stacked?: boolean }) {
  const nameColor = onDark ? "text-white" : "text-secondary-900 dark:text-white";
  const nameSize = size >= 56 ? "text-3xl lg:text-4xl" : size >= 40 ? "text-xl" : "text-base";
  return (
    <div className={stacked ? "text-center" : "text-left leading-none"}>
      <div className={`font-display font-black tracking-tight ${nameSize} ${nameColor}`}>
        Carepoint
        <span className="text-emerald-500 dark:text-emerald-400">.</span>
        <span className="ml-1.5 align-middle rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[0.5em] font-black uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400">
          HMS
        </span>
      </div>
      {tagline ? (
        <p className={`mt-2 text-[10px] font-bold uppercase tracking-[0.35em] ${onDark ? "text-emerald-400/80" : "text-secondary-500 dark:text-secondary-400"}`}>
          Hospital Management System
        </p>
      ) : (
        <p className={`text-[9px] font-bold uppercase tracking-[0.25em] ${onDark ? "text-emerald-400/80" : "text-primary-600 dark:text-primary-400"}`}>
          Healthcare Suite
        </p>
      )}
    </div>
  );
}

export function Logo({ variant = "inline", size = 40, onDark, tagline, to, className = "" }: LogoProps) {
  const chip = (
    <span className="inline-flex items-center justify-center rounded-2xl bg-white p-1 shadow-lg shadow-emerald-500/10 ring-1 ring-black/5">
      <LogoMark size={size} />
    </span>
  );

  let content: ReactNode;
  if (variant === "mark") {
    content = chip;
  } else if (variant === "stacked") {
    content = (
      <div className={`flex flex-col items-center gap-4 ${className}`}>
        {chip}
        <Wordmark size={size} onDark={onDark} tagline={tagline} stacked />
      </div>
    );
  } else {
    content = (
      <div className={`flex items-center gap-3 ${className}`}>
        {chip}
        <Wordmark size={size} onDark={onDark} />
      </div>
    );
  }

  if (to) {
    return (
      <Link to={to} className="group inline-flex transition-transform hover:scale-[1.02]">
        {content}
      </Link>
    );
  }
  return content;
}
