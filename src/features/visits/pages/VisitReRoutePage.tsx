import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, RotateCcw, Waypoints } from "lucide-react";
import {
  DxButton,
  DxCheckbox,
  DxForm,
  DxMessage,
  DxPage,
  DxPageHeader,
  DxPageLoading,
  DxPanel,
  DxProps,
  DxSelect,
  DxStatusBar,
  DxStatusItem,
  DxTextarea,
  apiErrorMessage,
} from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import { routes } from "@/config/routes";
import { getCurrentStaff } from "@/features/staff/api/staff.api";
import { getServiceDeliveryPoints, getVisitDetails, rerouteVisit } from "../api/visits.api";
import type { ServiceDeliveryPoint } from "../api/visits.api";
import { VisitBanner } from "../components/VisitBanner";
import { nextPathwayStep, patientDisplayName, sdpTypeLabel } from "../lib/clinic-flow";

/**
 * Re-route a visit to any service point, outside (or ahead of) its pathway.
 * Raises a queue ticket at the destination and, by default, makes it the
 * patient's current stop.
 */
export function VisitReRoutePage() {
  const { visitId } = useParams<{ visitId: string }>();
  const id = Number(visitId);
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();

  const [targetId, setTargetId] = useState("");
  const [reason, setReason] = useState("");
  const [createTicket, setCreateTicket] = useState(true);
  const [markCurrent, setMarkCurrent] = useState(true);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const visitQuery = useQuery({
    queryKey: ["visits", "detail", id],
    queryFn: () => getVisitDetails(id),
    enabled: Number.isFinite(id),
  });
  const sdpQuery = useQuery({
    queryKey: ["service-delivery-points", "active", "reroute"],
    queryFn: () => getServiceDeliveryPoints({ limit: 200 }),
    enabled: Number.isFinite(id),
  });

  const visit = visitQuery.data ?? null;
  const currentSdpId = visit?.current_service_delivery_point_id;

  // Active service points other than the one the patient is at, grouped by desk type.
  const groups = useMemo(() => {
    const options = (sdpQuery.data ?? []).filter((s) => s.is_active && s.id !== currentSdpId);
    const byType = new Map<string, ServiceDeliveryPoint[]>();
    options.forEach((s) => {
      const label = sdpTypeLabel(s.service_point_type);
      byType.set(label, [...(byType.get(label) ?? []), s]);
    });
    return [...byType.entries()]
      .map(([label, items]) => ({ label, items: items.sort((a, b) => a.name.localeCompare(b.name)) }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [sdpQuery.data, currentSdpId]);
  const allOptions = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  // Default to the next pathway step when it is a valid target, else the first option.
  const suggested = nextPathwayStep(visit);
  const defaultTarget =
    allOptions.find((s) => s.id === suggested?.service_delivery_point_id)?.id ?? allOptions[0]?.id ?? null;
  const effectiveTargetId = targetId !== "" ? Number(targetId) : defaultTarget;
  const target = allOptions.find((s) => s.id === effectiveTargetId) ?? null;

  const rerouteMutation = useMutation({
    mutationFn: async () => {
      if (!target) throw new Error("Select a destination service point.");
      const staff = await getCurrentStaff();
      if (!staff) throw new Error("Unable to identify the current clinician. Please sign in again.");
      return rerouteVisit(id, {
        service_delivery_point_id: target.id,
        routed_by_id: staff.id,
        reason: reason.trim() || undefined,
        create_queue_ticket: createTicket,
        queue_status: createTicket ? "WAITING" : undefined,
        queue_position: createTicket ? 1 : undefined,
        mark_as_current: markCurrent,
      });
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["visits"] });
      qc.invalidateQueries({ queryKey: ["queue"] });
      toast.success(
        "Patient re-routed",
        res.message || `${patientDisplayName(visit?.patient)} sent to ${target?.name ?? "the selected service point"}.`,
      );
      navigate(routes.visits);
    },
    onError: (err) => toast.error("Re-route failed", apiErrorMessage(err, "The target service point may be at capacity.")),
  });

  const submit = () => {
    if (!target) {
      setFieldError("Select a destination service point.");
      return;
    }
    setFieldError(null);
    rerouteMutation.mutate();
  };

  if (!Number.isFinite(id)) {
    return (
      <DxPage>
        <DxMessage tone="danger" title="Invalid visit">
          The re-route page needs a visit identifier. Open a visit from the registry.
        </DxMessage>
      </DxPage>
    );
  }
  if (visitQuery.isLoading) return <DxPageLoading label="Loading encounter…" />;
  if (visitQuery.isError || !visit) {
    return (
      <DxPage>
        <DxMessage
          tone="danger"
          title="Could not load the visit"
          action={
            <DxButton size="sm" onClick={() => visitQuery.refetch()} leftIcon={<RotateCcw />}>
              Retry
            </DxButton>
          }
        >
          {apiErrorMessage(visitQuery.error, "Please verify the visit record and try again.")}
        </DxMessage>
      </DxPage>
    );
  }

  const detailPath = routes.visitDetail.replace(":visitId", String(visit.id));
  const currentSdp = visit.current_service_delivery_point ?? visit.first_service_delivery_point;
  const busy = rerouteMutation.isPending;

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[
          { label: "Visits", to: routes.visits },
          { label: visit.visit_code || `#${visit.id}`, to: detailPath },
          { label: "Re-route" },
        ]}
        title="Re-route visit"
        subtitle="Send the patient to another service point. A queue ticket is raised at the destination."
        actions={
          <DxButton leftIcon={<ArrowLeft />} onClick={() => navigate(detailPath)}>
            Back to visit
          </DxButton>
        }
      />

      <VisitBanner visit={visit} />

      <div className="grid gap-4 xl:grid-cols-12">
        <DxPanel
          className="xl:col-span-8"
          title="Destination"
          icon={<Waypoints />}
          description="Pick the service point to route the patient to and record why."
          footer={
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[12px] text-[var(--dx-text-muted)]">
                {target ? (
                  <>
                    {currentSdp?.name ?? "Current point"} <ArrowRight className="inline h-3 w-3" aria-hidden /> <b className="dx-strong">{target.name}</b>
                  </>
                ) : (
                  "No destination selected."
                )}
              </span>
              <span className="flex items-center gap-2">
                <DxButton onClick={() => navigate(detailPath)} disabled={busy}>
                  Cancel
                </DxButton>
                <DxButton variant="primary" leftIcon={<ArrowRight />} onClick={submit} isLoading={busy} disabled={!target && !sdpQuery.isLoading}>
                  Re-route patient
                </DxButton>
              </span>
            </div>
          }
        >
          {sdpQuery.isError ? (
            <DxMessage
              tone="danger"
              title="Could not load service points"
              className="mb-3"
              action={
                <DxButton size="sm" onClick={() => sdpQuery.refetch()} leftIcon={<RotateCcw />}>
                  Retry
                </DxButton>
              }
            >
              {apiErrorMessage(sdpQuery.error)}
            </DxMessage>
          ) : null}
          {!sdpQuery.isLoading && !sdpQuery.isError && allOptions.length === 0 ? (
            <DxMessage tone="warning" title="No other active service points" className="mb-3">
              Every active service point is either the patient's current stop or inactive.
            </DxMessage>
          ) : null}

          <DxForm cols={2}>
            <DxSelect
              label="Target service point"
              required
              fieldClassName="dx-col-span-full"
              value={effectiveTargetId != null ? String(effectiveTargetId) : ""}
              onChange={(e) => {
                setTargetId(e.target.value);
                setFieldError(null);
              }}
              disabled={busy || sdpQuery.isLoading}
              error={fieldError}
              hint={
                suggested && target?.id === suggested.service_delivery_point_id
                  ? "This is the next step on the patient's pathway."
                  : "Routing outside the pathway inserts a new step after the current one."
              }
            >
              {sdpQuery.isLoading ? <option value="">Loading service points…</option> : null}
              {!sdpQuery.isLoading && allOptions.length === 0 ? <option value="">No service points available</option> : null}
              {groups.map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.items.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </optgroup>
              ))}
            </DxSelect>
            <DxTextarea
              label="Reason for re-route"
              fieldClassName="dx-col-span-full"
              rows={4}
              placeholder="e.g. Clinical referral, investigations completed, wrong desk at registration…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={busy}
              hint="Recorded on the new flow step and in the visit activity."
            />
            <DxCheckbox
              label="Create a queue ticket at the destination"
              description="The patient joins the destination queue as waiting."
              checked={createTicket}
              onChange={(e) => setCreateTicket(e.target.checked)}
              disabled={busy}
            />
            <DxCheckbox
              label="Mark destination as the current service point"
              description="Closes the current stop and makes the destination the active step."
              checked={markCurrent}
              onChange={(e) => setMarkCurrent(e.target.checked)}
              disabled={busy}
            />
          </DxForm>
        </DxPanel>

        <DxPanel className="xl:col-span-4" title="Routing context" flush>
          <DxProps
            items={[
              { label: "Current point", value: currentSdp?.name ?? "—" },
              { label: "Desk type", value: currentSdp ? sdpTypeLabel(currentSdp.service_point_type) : "—" },
              { label: "Next on pathway", value: suggested?.service_delivery_point?.name ?? "No pathway step pending" },
              { label: "Destination", value: target?.name ?? "—" },
              { label: "Destination type", value: target ? sdpTypeLabel(target.service_point_type) : "—" },
              { label: "Reason", value: visit.visit_reason || "—" },
            ]}
          />
        </DxPanel>
      </div>

      <DxStatusBar>
        <DxStatusItem>
          Visit <b className="dx-mono">{visit.visit_code}</b>
        </DxStatusItem>
        <DxStatusItem>
          Service points available: <b>{allOptions.length}</b>
        </DxStatusItem>
        <span className="ml-auto">Use "Advance to next step" on the visit to follow the pathway instead.</span>
      </DxStatusBar>
    </DxPage>
  );
}
