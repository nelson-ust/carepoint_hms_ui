import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Building2, CalendarClock, Hash, Stethoscope } from "lucide-react";
import { DxAvatar, DxBadge, DxStatusBadge, DxSteps, formatDateTime, humanize } from "@/components/dx";
import { routes } from "@/config/routes";
import type { Visit } from "../api/visits.api";
import { pathwaySteps, patientDisplayName, visitPriorityTone } from "../lib/clinic-flow";

/**
 * Patient + encounter context strip shown at the top of every clinic-flow
 * workstation (triage, consultation, eligibility, …). Includes the care
 * pathway stepper when the visit follows a template.
 */
export function VisitBanner({
  visit,
  extra,
  actions,
  showPathway = true,
}: {
  visit: Visit;
  /** Extra inline facts rendered after the standard ones. */
  extra?: ReactNode;
  actions?: ReactNode;
  showPathway?: boolean;
}) {
  const p = visit.patient;
  const name = patientDisplayName(p);
  const steps = showPathway ? pathwaySteps(visit) : [];
  const sdp = visit.current_service_delivery_point ?? visit.first_service_delivery_point;

  return (
    <section className="dx-panel">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <DxAvatar name={name} size="lg" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to={routes.patientDetail.replace(":patientId", String(visit.patient_id))}
                className="truncate text-[15px] font-semibold text-[var(--dx-text)] hover:underline"
              >
                {name}
              </Link>
              <DxBadge tone={visitPriorityTone(visit.priority)}>{humanize(visit.priority)}</DxBadge>
              <DxStatusBadge status={visit.status} />
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-[var(--dx-text-muted)]">
              <span className="dx-mono inline-flex items-center gap-1">
                <Hash className="h-3 w-3" aria-hidden />
                {p?.hospital_number ?? `Patient #${visit.patient_id}`}
              </span>
              {p?.gender ? <span>{humanize(p.gender)}</span> : null}
              {p?.phone_number ? <span className="dx-mono">{p.phone_number}</span> : null}
            </div>
          </div>
        </div>

        <span className="dx-divider hidden h-9 w-px sm:block" aria-hidden />

        <dl className="grid flex-1 grid-cols-2 gap-x-6 gap-y-1 text-[12px] sm:grid-cols-3 xl:grid-cols-4">
          <div className="min-w-0">
            <dt className="dx-caption">Visit</dt>
            <dd className="dx-mono truncate font-medium" title={visit.visit_code ?? undefined}>{visit.visit_code}</dd>
          </div>
          <div className="min-w-0">
            <dt className="dx-caption">Checked in</dt>
            <dd
              className="flex min-w-0 items-center gap-1 font-medium"
              title={formatDateTime(visit.check_in_time ?? visit.visit_date)}
            >
              <CalendarClock className="h-3 w-3 shrink-0 text-[var(--dx-text-faint)]" aria-hidden />
              <span className="truncate">{formatDateTime(visit.check_in_time ?? visit.visit_date)}</span>
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="dx-caption">Current point</dt>
            <dd className="flex min-w-0 items-center gap-1 font-medium" title={sdp?.name ?? undefined}>
              <Building2 className="h-3 w-3 shrink-0 text-[var(--dx-text-faint)]" aria-hidden />
              <span className="truncate">{sdp?.name ?? "—"}</span>
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="dx-caption">Reason</dt>
            <dd className="flex min-w-0 items-center gap-1 font-medium" title={visit.visit_reason ?? undefined}>
              <Stethoscope className="h-3 w-3 shrink-0 text-[var(--dx-text-faint)]" aria-hidden />
              <span className="truncate">{visit.visit_reason || "—"}</span>
            </dd>
          </div>
          {extra}
        </dl>

        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>

      {steps.length ? (
        <div className="border-t border-[var(--dx-border)] px-2 py-1.5">
          <DxSteps items={steps} />
        </div>
      ) : null}
    </section>
  );
}
