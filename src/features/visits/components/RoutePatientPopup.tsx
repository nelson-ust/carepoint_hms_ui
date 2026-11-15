import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { DxButton, DxMessage, DxPopup, DxSelect, DxTextarea, apiErrorMessage } from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import { getServiceDeliveryPoints, rerouteVisit, type RerouteVisitResponse, type Visit } from "../api/visits.api";
import { normalizeSdpType, sdpTypeLabel, type ServicePointType } from "../lib/clinic-flow";

/**
 * Manual routing dialog used when a visit has no care pathway (or staff need
 * to send the patient somewhere off-pathway). Pre-selects the first service
 * point of `preferType` when given (e.g. TRIAGE after the HMO desk).
 */
export function RoutePatientPopup({
  visit,
  isOpen,
  onClose,
  onRouted,
  preferType,
  intro,
  defaultReason,
}: {
  visit: Visit;
  isOpen: boolean;
  onClose: () => void;
  onRouted?: (res: RerouteVisitResponse) => void;
  preferType?: ServicePointType;
  intro?: string;
  defaultReason?: string;
}) {
  const toast = useToast();
  const qc = useQueryClient();
  const [target, setTarget] = useState<string>("");
  const [reason, setReason] = useState(defaultReason ?? "");

  const sdpQuery = useQuery({
    queryKey: ["service-delivery-points", "active", "route-popup"],
    queryFn: () => getServiceDeliveryPoints({ limit: 200 }),
    enabled: isOpen,
    staleTime: 5 * 60_000,
  });

  const options = useMemo(
    () =>
      (sdpQuery.data ?? [])
        .filter((s) => s.id !== visit.current_service_delivery_point_id)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((s) => ({
          value: String(s.id),
          label: `${s.name} (${s.code}) — ${sdpTypeLabel(s.service_point_type)}`,
        })),
    [sdpQuery.data, visit.current_service_delivery_point_id],
  );

  const preferred = useMemo(() => {
    if (!preferType) return "";
    const hit = (sdpQuery.data ?? []).find(
      (s) => normalizeSdpType(s.service_point_type) === preferType && s.id !== visit.current_service_delivery_point_id,
    );
    return hit ? String(hit.id) : "";
  }, [preferType, sdpQuery.data, visit.current_service_delivery_point_id]);

  const effectiveTarget = target || preferred;

  const mutation = useMutation({
    mutationFn: () =>
      rerouteVisit(visit.id, {
        service_delivery_point_id: Number(effectiveTarget),
        reason: reason.trim() || undefined,
        create_queue_ticket: true,
        mark_as_current: true,
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["visits"] });
      qc.invalidateQueries({ queryKey: ["queue"] });
      toast.success("Patient routed", res.message);
      onRouted?.(res);
      onClose();
    },
    onError: (err) => toast.error("Could not route patient", apiErrorMessage(err)),
  });

  return (
    <DxPopup
      isOpen={isOpen}
      onClose={onClose}
      title="Route the patient"
      size="sm"
      locked={mutation.isPending}
      footer={
        <>
          <DxButton onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </DxButton>
          <DxButton
            variant="primary"
            rightIcon={<ArrowRight />}
            disabled={!effectiveTarget}
            isLoading={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            Route patient
          </DxButton>
        </>
      }
    >
      <div className="space-y-3">
        {intro ? <DxMessage tone="info">{intro}</DxMessage> : null}
        <DxSelect
          label="Next service point"
          required
          placeholder={sdpQuery.isLoading ? "Loading service points…" : "Select a service point…"}
          value={effectiveTarget}
          onChange={(e) => setTarget(e.target.value)}
          options={options}
          disabled={sdpQuery.isLoading}
          error={sdpQuery.isError ? apiErrorMessage(sdpQuery.error, "Could not load service points.") : undefined}
        />
        <DxTextarea label="Reason / hand-over note" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
    </DxPopup>
  );
}
