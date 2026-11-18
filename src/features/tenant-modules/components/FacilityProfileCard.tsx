import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, Eye, Pill, Stethoscope, Lock, CheckCircle2 } from "lucide-react";
import { DxPanel, DxBadge, DxMessage } from "@/components/dx";
import { usePermissionGate } from "@/lib/permissions/usePermissionGate";
import {
  listFacilityProfiles,
  getMyFacilityProfile,
  type FacilityProfileCode,
} from "@/features/tenant-modules/api/tenant-modules.api";

const PROFILE_ICON: Record<FacilityProfileCode, typeof Building2> = {
  HOSPITAL: Building2,
  DENTAL: Stethoscope,
  EYE: Eye,
  PHARMACY: Pill,
};

/**
 * Read-only facility-profile summary for a tenant super-admin.
 *
 * The facility type is chosen at registration and gates which modules the
 * workspace runs. It can only be changed by the Carepoint (SaaS) team, so this
 * card shows the current type and the modules it enables — it does not switch it.
 */
export function FacilityProfileCard() {
  const gate = usePermissionGate();
  const profilesQ = useQuery({ queryKey: ["facility-profiles"], queryFn: listFacilityProfiles });
  const currentQ = useQuery({ queryKey: ["facility-profile", "me", "current"], queryFn: getMyFacilityProfile });

  const currentCode = (currentQ.data?.code ?? "HOSPITAL") as FacilityProfileCode;
  const profiles = useMemo(() => profilesQ.data ?? [], [profilesQ.data]);
  const current = profiles.find((p) => p.code === currentCode);
  const Icon = PROFILE_ICON[currentCode] ?? Building2;

  // Tenant super-admins only. (SaaS admins manage this from the tenant console.)
  if (gate.known && !gate.isSuperuser) return null;

  return (
    <DxPanel
      title="Facility Type"
      description="How this workspace is provisioned. Set at registration and managed by the Carepoint team."
      icon={<Building2 className="h-4 w-4" />}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[var(--dx-accent-soft)] text-[var(--dx-accent)]">
            <Icon className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-bold text-[var(--dx-text)]">{current?.label ?? currentQ.data?.label ?? "Integrated Hospital"}</span>
              <DxBadge tone="success" dot>Active</DxBadge>
            </div>
            <p className="mt-1 max-w-xl text-[13px] text-[var(--dx-text-muted)]">
              {current?.description ?? "Your workspace is configured for this facility type."}
            </p>
          </div>
        </div>
      </div>

      {current && current.code !== "HOSPITAL" && (current.modules ?? []).length > 0 ? (
        <div className="mt-4 border-t border-[var(--dx-border)] pt-4">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-[var(--dx-text-muted)]">
            <CheckCircle2 className="h-3 w-3" /> Enabled modules
          </p>
          <div className="flex flex-wrap gap-1.5">
            {(current.modules ?? []).map((m) => (
              <DxBadge key={m} tone="neutral">{m}</DxBadge>
            ))}
          </div>
        </div>
      ) : null}

      <DxMessage tone="info" className="mt-4">
        <span className="inline-flex items-center gap-1.5">
          <Lock className="h-3.5 w-3.5" />
          Changing your facility type is handled by the Carepoint team — contact support to switch verticals.
        </span>
      </DxMessage>
    </DxPanel>
  );
}
