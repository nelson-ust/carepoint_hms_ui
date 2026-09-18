import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Video, RefreshCw, Stethoscope } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/api/api-error";
import { JitsiFrame } from "@/features/telemedicine/components/JitsiFrame";
import { SessionChat } from "@/features/telemedicine/components/SessionChat";
import {
  getPortalTelemedicineSessions,
  joinPortalTelemedicine,
  getPortalTelemedicineMessages,
  sendPortalTelemedicineMessage,
  type PortalTelemedicineJoinInfo,
} from "../api/portal.api";

function fmt(v?: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
function labelize(v?: string | null) { return v ? v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "—"; }

function statusVariant(status: string): any {
  switch (status) {
    case "IN_PROGRESS": return "success";
    case "WAITING": return "soft-warning";
    case "SCHEDULED": return "info";
    case "COMPLETED": return "secondary";
    default: return "soft-danger";
  }
}

const OPEN = ["SCHEDULED", "WAITING", "IN_PROGRESS"];

export function PortalTelehealthPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [active, setActive] = useState<{ id: number; join: PortalTelemedicineJoinInfo } | null>(null);

  const sessions = useQuery({ queryKey: ["portal-tele", "sessions"], queryFn: getPortalTelemedicineSessions });

  const messages = useQuery({
    queryKey: ["portal-tele", "messages", active?.id],
    queryFn: () => getPortalTelemedicineMessages(active!.id),
    enabled: !!active,
    refetchInterval: active ? 5000 : false,
  });

  const joinMut = useMutation({
    mutationFn: (id: number) => joinPortalTelemedicine(id),
    onSuccess: ({ join, session }) => {
      setActive({ id: session.id, join });
      qc.invalidateQueries({ queryKey: ["portal-tele", "sessions"] });
    },
    onError: (err) => toast.error("Couldn't join", apiErrorMessage(err, "Please try again.")),
  });

  const sendMut = useMutation({
    mutationFn: (body: string) => sendPortalTelemedicineMessage(active!.id, body),
    onSuccess: () => messages.refetch(),
    onError: (err) => toast.error("Couldn't send message", apiErrorMessage(err)),
  });

  const list = sessions.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Telehealth"
        description="Join your virtual consultations and message your care team securely."
        actions={
          <Button variant="ghost" size="sm" onClick={() => sessions.refetch()}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        }
      />

      {active && (
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-secondary-900 dark:text-white">
                In consultation • {active.join.session_code}
              </h3>
              <p className="text-sm text-secondary-500">{labelize(active.join.modality)} • {labelize(active.join.status)}</p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setActive(null)}>Leave</Button>
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              {active.join.modality !== "CHAT" ? (
                <JitsiFrame join={active.join as any} displayName={active.join.display_name} />
              ) : (
                <div className="flex h-[400px] items-center justify-center rounded-xl border border-dashed border-secondary-300 text-sm text-secondary-500 dark:border-secondary-700">
                  This is a chat-only consultation.
                </div>
              )}
            </div>
            <Card>
              <h4 className="mb-3 text-sm font-semibold text-secondary-900 dark:text-white">Secure chat</h4>
              <SessionChat
                messages={(messages.data ?? []) as any}
                onSend={(body) => sendMut.mutate(body)}
                isSending={sendMut.isPending}
                mineRole="PATIENT"
              />
            </Card>
          </div>
        </Card>
      )}

      <div className="space-y-3">
        {sessions.isLoading && <Skeleton className="h-24 w-full" />}
        {!sessions.isLoading && list.length === 0 && (
          <EmptyState icon={Stethoscope} title="No telehealth sessions" description="When your care team schedules a virtual consultation, it will appear here." />
        )}
        {list.map((s) => {
          const open = OPEN.includes(s.status);
          return (
            <Card key={s.id}>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-secondary-900 dark:text-white">{s.session_code}</span>
                    <Badge variant={statusVariant(s.status)}>{labelize(s.status)}</Badge>
                    <span className="text-xs text-secondary-500">{labelize(s.modality)}</span>
                  </div>
                  <p className="mt-1 text-sm text-secondary-500">
                    {s.reason || "Virtual consultation"} • Scheduled {fmt(s.scheduled_start_at)}
                    {s.clinician_name ? ` • ${s.clinician_name}` : ""}
                  </p>
                  {s.summary && s.status === "COMPLETED" && (
                    <p className="mt-2 rounded-lg bg-secondary-50 p-2 text-sm text-secondary-600 dark:bg-secondary-900/40 dark:text-secondary-300">
                      <span className="font-medium">Visit summary: </span>{s.summary}
                    </p>
                  )}
                </div>
                {open && (
                  <Button size="sm" onClick={() => joinMut.mutate(s.id)} disabled={joinMut.isPending}>
                    <Video className="h-4 w-4" /> {joinMut.isPending ? "Joining…" : "Join"}
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
