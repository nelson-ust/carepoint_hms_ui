import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Workflow, RotateCcw, CheckCircle2, CircleDashed, ChevronRight, Sparkles, Info, Settings2,
} from "lucide-react";
import {
  DxBadge, DxButton, DxKpi, DxPage, DxPageHeader, DxPageLoading, DxPanel,
  DxMessage, apiErrorMessage,
} from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import { routes } from "@/config/routes";
import { eyeApi, type EyeFlowStage } from "../api/eye.api";

const EYE_FLOW_BUILDER = `${routes.visitFlows}?code=EYE_CLINIC_PATHWAY`;

const typeTone = (t?: string | null): "accent" | "info" | "success" | "warning" | "neutral" => {
  switch ((t ?? "").toUpperCase()) {
    case "REGISTRATION": return "accent";
    case "CLINIC": return "info";
    case "TRIAGE": return "success";
    case "CASHIER": return "warning";
    default: return "neutral";
  }
};

function StageCard({ stage }: { stage: EyeFlowStage }) {
  const configured = stage.configured;
  return (
    <div className={`flex items-start gap-3 rounded-lg border px-3.5 py-3 ${configured ? "border-[var(--dx-border)] bg-[var(--dx-surface)]" : "border-dashed border-[var(--dx-border)] bg-[var(--dx-surface-sunken)]"}`}>
      <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold ${configured ? "bg-[var(--dx-accent)] text-white" : "bg-[var(--dx-surface-hover)] text-[var(--dx-text-muted)]"}`}>
        {stage.order}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-semibold text-[var(--dx-text)]">{stage.label}</span>
          {stage.required ? <DxBadge tone="neutral">required</DxBadge> : <DxBadge tone="neutral">optional</DxBadge>}
          {stage.eye_specific ? <DxBadge tone="info" dot>eye-specific</DxBadge> : <DxBadge tone="neutral">shared</DxBadge>}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12.5px]">
          {configured ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 text-[var(--dx-success,#10b981)]" aria-hidden />
              <span className="text-[var(--dx-text-muted)]">{stage.service_delivery_point}</span>
              {stage.type ? <DxBadge tone={typeTone(stage.type)}>{stage.type}</DxBadge> : null}
              {stage.code ? <span className="dx-mono text-[11px] text-[var(--dx-text-faint)]">{stage.code}</span> : null}
            </>
          ) : (
            <>
              <CircleDashed className="h-3.5 w-3.5 text-[var(--dx-text-faint)]" aria-hidden />
              <span className="text-[var(--dx-text-faint)]">No service point configured — add one in the flow builder or under Settings.</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function EyeClinicFlowPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const nav = useNavigate();

  const flowQ = useQuery({ queryKey: ["eye", "flow"], queryFn: () => eyeApi.getFlow() });
  const flow = flowQ.data;
  const stages = useMemo(() => flow?.stages ?? [], [flow]);

  const seed = useMutation({
    mutationFn: () => eyeApi.seedFlow(),
    onSuccess: (res) => { toast.success(res.message || "Eye Clinic pathway ready."); qc.invalidateQueries({ queryKey: ["eye", "flow"] }); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const configured = stages.filter((s) => s.configured).length;

  if (flowQ.isLoading) return <DxPageLoading label="Loading Eye Clinic flow..." />;

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Eye Clinic" }, { label: "Clinic Flow" }]}
        title="Eye Clinic Flow"
        subtitle="The eye-care pathway a patient travels — a visit-flow template built from service delivery points, standalone or inside an integrated hospital. Seeded by default at provisioning and editable in the Visit Flow builder."
        actions={
          <>
            <DxButton icon title="Refresh" onClick={() => flowQ.refetch()} isLoading={flowQ.isFetching}><RotateCcw /></DxButton>
            {flow?.seeded ? (
              <DxButton variant="primary" leftIcon={<Settings2 className="h-4 w-4" />} onClick={() => nav(EYE_FLOW_BUILDER)}>
                Edit in Flow Builder
              </DxButton>
            ) : (
              <DxButton variant="primary" leftIcon={<Sparkles className="h-4 w-4" />} isLoading={seed.isPending} onClick={() => seed.mutate()}>
                Activate pathway
              </DxButton>
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <DxKpi label="Pathway stages" value={stages.length} icon={Workflow} tone="accent" />
        <DxKpi label="Service points ready" value={`${configured}/${stages.length}`} icon={CheckCircle2} tone={configured === stages.length ? "success" : "warning"} />
        <DxKpi label="Visit-flow template" value={flow?.seeded ? "Active" : "Not set"} icon={Sparkles} tone={flow?.seeded ? "success" : "neutral"} sub={flow?.is_default ? "default pathway" : undefined} />
      </div>

      {!flow?.seeded ? (
        <DxMessage tone="info" title="Activate the Eye Clinic pathway" action={<DxButton size="sm" variant="primary" isLoading={seed.isPending} onClick={() => seed.mutate()}>Activate</DxButton>}>
          This creates a reusable visit-flow template ("{flow?.template_name}") from your service points, using the standard Visit Flow feature. Once active, eye visits can follow these stages and you can refine them in the Flow Builder.
        </DxMessage>
      ) : (
        <DxMessage tone="info" title="Defined with the Visit Flow feature" action={<DxButton size="sm" leftIcon={<Settings2 className="h-4 w-4" />} onClick={() => nav(EYE_FLOW_BUILDER)}>Open Flow Builder</DxButton>}>
          This pathway is the <b>{flow?.template_name}</b> visit-flow template. Add, reorder or make stages optional in the Flow Builder — changes appear here automatically.
        </DxMessage>
      )}

      <DxPanel title="Patient journey" icon={<Workflow />}>
        <div className="space-y-2.5">
          {stages.map((s, i) => (
            <div key={s.order}>
              <StageCard stage={s} />
              {i < stages.length - 1 ? (
                <div className="flex justify-center py-0.5 text-[var(--dx-text-faint)]"><ChevronRight className="h-4 w-4 rotate-90" aria-hidden /></div>
              ) : null}
            </div>
          ))}
        </div>
      </DxPanel>

      <DxPanel title="How this flow works" icon={<Info />}>
        <div className="space-y-2 text-[13px] text-[var(--dx-text-muted)]">
          <p><b className="text-[var(--dx-text)]">Standalone eye clinic</b> — the pathway runs on its own service points (Vision Screening, Optometry/Refraction, Ophthalmology Consultation, Imaging, Optical Dispensing). Registration, pharmacy and billing are the clinic's own desks.</p>
          <p><b className="text-[var(--dx-text)]">Integrated hospital</b> — the eye-specific points slot into the hospital's shared Registration, Insurance, Pharmacy and Billing, so an eye visit reuses the same front desk and cashier as every other clinic.</p>
          <p>Stages marked <b>optional</b> are skipped when they do not apply (no imaging ordered, no glasses dispensed). It is a standard visit-flow template, so everything here is defined and edited through the <b>Visit Flow</b> feature.</p>
        </div>
      </DxPanel>
    </DxPage>
  );
}
