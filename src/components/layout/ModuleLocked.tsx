import { Link } from "react-router-dom";
import { Lock, ArrowLeft, Sparkles } from "lucide-react";

/**
 * Shown when a tenant navigates to a module that is not part of their
 * subscription (plan default off, or disabled by a per-tenant override).
 */
export function ModuleLocked({ moduleName }: { moduleName: string }) {
  const label = moduleName
    .split(/[_-]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return (
    <div className="flex min-h-[60vh] items-center justify-center animate-fade-in">
      <div className="glass-card max-w-lg p-10 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-500/10 text-amber-500 shadow-glow-amber">
          <Lock className="h-8 w-8" aria-hidden />
        </div>
        <h1 className="mt-6 text-2xl font-display font-bold text-secondary-900">
          {label} isn't part of your plan
        </h1>
        <p className="mt-3 text-sm font-medium leading-relaxed text-secondary-500">
          Your hospital's current subscription doesn't include the {label} module,
          so this area is hidden from your workspace. Your administrator can
          upgrade the plan — or ask CarePoint support to enable it — and it will
          appear here immediately.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link to="/dashboard" className="btn-secondary text-xs">
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>
          <Link to="/settings" className="btn-primary text-xs">
            <Sparkles className="h-4 w-4" />
            View plan &amp; settings
          </Link>
        </div>
      </div>
    </div>
  );
}
