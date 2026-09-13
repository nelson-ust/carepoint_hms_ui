/**
 * Futuristic section eyebrow — a glowing chip identifying the suite a page
 * belongs to (e.g. "HR & PAYROLL"). Pass into PageHeader's `eyebrow` slot so
 * grouped pages share one visual identity.
 */
export function SuiteEyebrow({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-gradient-to-r from-primary-500/10 to-cyan-500/10 px-3 py-1 shadow-[0_0_16px_-6px_rgba(6,182,212,0.6)]">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-60" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan-400" />
      </span>
      <span className="bg-gradient-to-r from-primary-500 to-cyan-500 bg-clip-text text-[10px] font-black uppercase tracking-[0.22em] text-transparent">
        {label}
      </span>
    </span>
  );
}
