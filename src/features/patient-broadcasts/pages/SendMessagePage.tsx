import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Mail,
  MessageSquare,
  Search,
  Send,
  Smartphone,
  User as UserIcon,
  Users,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/feedback/ToastProvider";
import { cn } from "@/lib/utils/cn";
import { searchPatients, type Patient } from "@/features/patients/api/patients.api";
import {
  useAudiencePreview,
  useBroadcasts,
  useSendBroadcast,
} from "../hooks/use-patient-broadcasts";
import type {
  BroadcastAudience,
  BroadcastChannel,
} from "../api/patient-broadcasts.api";

const HISTORY_PAGE_SIZE = 10;

function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function patientLabel(p: Patient): string {
  const name = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "Unnamed patient";
  return `${name} · ${p.hospital_number}`;
}

const AUDIENCES: { key: BroadcastAudience; label: string; icon: any; hint: string }[] = [
  { key: "SINGLE", label: "One patient", icon: UserIcon, hint: "Send to a single selected patient." },
  { key: "GROUP", label: "Group", icon: Users, hint: "Select several patients to message together." },
  { key: "ALL", label: "All patients", icon: Users, hint: "Every patient registered with the hospital." },
];

const CHANNELS: { key: BroadcastChannel; label: string; icon: any; locked?: boolean; hint: string }[] = [
  { key: "IN_APP", label: "Patient portal", icon: MessageSquare, locked: true, hint: "Always delivered to the patient's portal inbox." },
  { key: "EMAIL", label: "Email", icon: Mail, hint: "Also email patients who have an email on file." },
  { key: "SMS", label: "SMS", icon: Smartphone, hint: "Also text patients who have a phone number on file." },
];

export function SendMessagePage() {
  const toast = useToast();

  const [audience, setAudience] = useState<BroadcastAudience>("SINGLE");
  const [selected, setSelected] = useState<Patient[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [channels, setChannels] = useState<BroadcastChannel[]>(["IN_APP"]);
  const [search, setSearch] = useState("");
  const [historyPage, setHistoryPage] = useState(1);

  const send = useSendBroadcast();
  const history = useBroadcasts({ page: historyPage, pageSize: HISTORY_PAGE_SIZE });

  const selectedIds = useMemo(() => selected.map((p) => p.id), [selected]);

  // Live recipient-count preview.
  const previewEnabled = audience === "ALL" || selectedIds.length > 0;
  const preview = useAudiencePreview(audience, selectedIds, previewEnabled);

  // Patient search (only relevant for SINGLE / GROUP).
  const trimmedSearch = search.trim();
  const searchQuery = useQuery({
    queryKey: ["broadcast-patient-search", trimmedSearch],
    queryFn: () => searchPatients(trimmedSearch, 8),
    enabled: audience !== "ALL" && trimmedSearch.length >= 2,
    staleTime: 20_000,
  });
  const searchResults = searchQuery.data?.items ?? [];

  function chooseAudience(next: BroadcastAudience) {
    setAudience(next);
    if (next === "ALL") setSelected([]);
    if (next === "SINGLE" && selected.length > 1) setSelected(selected.slice(0, 1));
  }

  function addPatient(p: Patient) {
    setSearch("");
    if (audience === "SINGLE") {
      setSelected([p]);
      return;
    }
    setSelected((prev) => (prev.some((x) => x.id === p.id) ? prev : [...prev, p]));
  }

  function removePatient(id: number) {
    setSelected((prev) => prev.filter((p) => p.id !== id));
  }

  function toggleChannel(key: BroadcastChannel) {
    if (key === "IN_APP") return; // always on
    setChannels((prev) =>
      prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key],
    );
  }

  const audienceReady =
    audience === "ALL" ||
    (audience === "SINGLE" && selected.length === 1) ||
    (audience === "GROUP" && selected.length >= 1);
  const canSend = audienceReady && body.trim().length > 0 && !send.isPending;

  function handleSend() {
    if (!canSend) return;
    send.mutate(
      {
        audience_type: audience,
        patient_ids: audience === "ALL" ? [] : selectedIds,
        subject: subject.trim() || null,
        body: body.trim(),
        channels,
      },
      {
        onSuccess: (b) => {
          toast.success(
            "Message sent",
            `Delivered to ${b.recipient_count} patient${b.recipient_count === 1 ? "" : "s"}.`,
          );
          setSubject("");
          setBody("");
          setSelected([]);
          setChannels(["IN_APP"]);
          setHistoryPage(1);
        },
        onError: (err: any) => {
          const detail =
            err?.response?.data?.detail ??
            err?.response?.data?.message ??
            "Please try again.";
          toast.error(
            "Couldn't send message",
            typeof detail === "string" ? detail : "Please try again.",
          );
        },
      },
    );
  }

  const recipientCountText = (() => {
    if (!previewEnabled) return null;
    if (preview.isLoading) return "Calculating reach…";
    const n = preview.data ?? 0;
    return `This message will reach ${n} patient${n === 1 ? "" : "s"}.`;
  })();

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        eyebrow={
          <span className="text-xs font-bold uppercase tracking-widest text-primary-500">
            Communications
          </span>
        }
        title="Send a message to patients"
        description="Compose an announcement and deliver it to one patient, a group, or everyone registered with the hospital."
      />

      <div className="grid gap-8 lg:grid-cols-5">
        {/* Compose */}
        <Card variant="panel" className="lg:col-span-3 p-6 space-y-6">
          {/* Audience */}
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-secondary-500">
              Who should receive this?
            </p>
            <div className="grid grid-cols-3 gap-3">
              {AUDIENCES.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => chooseAudience(key)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-2xl border p-4 text-center transition-all",
                    audience === key
                      ? "border-primary-500/40 bg-primary-500/10 text-primary-600 shadow-glow-sm dark:text-primary-300"
                      : "border-secondary-100 text-secondary-500 hover:border-secondary-200 hover:text-secondary-900 dark:border-white/10",
                  )}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                  <span className="text-xs font-bold uppercase tracking-widest">{label}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-secondary-400">
              {AUDIENCES.find((a) => a.key === audience)?.hint}
            </p>
          </div>

          {/* Patient picker */}
          {audience !== "ALL" ? (
            <div className="space-y-3">
              <Input
                label={audience === "SINGLE" ? "Find the patient" : "Add patients"}
                placeholder="Search by name, hospital number, or phone…"
                leftIcon={<Search className="h-4 w-4" />}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              {trimmedSearch.length >= 2 ? (
                <Card variant="plain" className="max-h-64 overflow-auto border border-secondary-100 p-2 dark:border-white/10">
                  {searchQuery.isLoading ? (
                    <div className="flex items-center gap-2 p-3 text-sm text-secondary-400">
                      <Loader2 className="h-4 w-4 animate-spin" /> Searching…
                    </div>
                  ) : searchResults.length === 0 ? (
                    <p className="p-3 text-sm text-secondary-400">No patients matched “{trimmedSearch}”.</p>
                  ) : (
                    <ul className="divide-y divide-secondary-100 dark:divide-white/10">
                      {searchResults.map((p) => {
                        const chosen = selected.some((x) => x.id === p.id);
                        return (
                          <li key={p.id}>
                            <button
                              type="button"
                              onClick={() => addPatient(p)}
                              disabled={chosen}
                              className={cn(
                                "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors",
                                chosen
                                  ? "cursor-default text-secondary-400"
                                  : "hover:bg-primary-500/5 text-secondary-800 dark:text-secondary-100",
                              )}
                            >
                              <span className="min-w-0 truncate">
                                <span className="font-semibold">{`${p.first_name} ${p.last_name}`.trim()}</span>
                                <span className="ml-2 text-xs text-secondary-400">{p.hospital_number}</span>
                              </span>
                              {chosen ? (
                                <Check className="h-4 w-4 text-emerald-500" />
                              ) : (
                                <span className="text-xs font-bold uppercase tracking-widest text-primary-500">Add</span>
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Card>
              ) : null}

              {selected.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {selected.map((p) => (
                    <span
                      key={p.id}
                      className="inline-flex items-center gap-1.5 rounded-full border border-primary-500/20 bg-primary-500/10 px-3 py-1 text-xs font-semibold text-primary-600 dark:text-primary-300"
                    >
                      {patientLabel(p)}
                      <button
                        type="button"
                        onClick={() => removePatient(p.id)}
                        className="rounded-full p-0.5 hover:bg-primary-500/20"
                        aria-label={`Remove ${p.first_name} ${p.last_name}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Subject + body */}
          <Input
            label="Subject (optional)"
            placeholder="e.g. Clinic closure notice"
            value={subject}
            maxLength={255}
            onChange={(e) => setSubject(e.target.value)}
          />
          <Textarea
            label="Message"
            placeholder="Write the message patients will receive…"
            rows={6}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />

          {/* Channels */}
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-secondary-500">
              Delivery channels
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {CHANNELS.map(({ key, label, icon: Icon, locked, hint }) => {
                const on = channels.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleChannel(key)}
                    disabled={locked}
                    title={hint}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl border p-3 text-left transition-all",
                      on
                        ? "border-primary-500/40 bg-primary-500/10 text-primary-600 dark:text-primary-300"
                        : "border-secondary-100 text-secondary-500 hover:border-secondary-200 dark:border-white/10",
                      locked && "opacity-90",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                        on ? "bg-primary-500/15" : "bg-secondary-500/10",
                      )}
                    >
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs font-bold uppercase tracking-widest">{label}</span>
                      <span className="block text-[11px] text-secondary-400">
                        {locked ? "Always on" : on ? "Enabled" : "Off"}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reach + send */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-secondary-100 pt-5 dark:border-white/10">
            <p className="text-sm font-medium text-secondary-500">
              {recipientCountText ?? "Choose an audience to see how many patients will be reached."}
            </p>
            <Button
              onClick={handleSend}
              disabled={!canSend}
              isLoading={send.isPending}
              leftIcon={<Send className="h-4 w-4" />}
            >
              Send message
            </Button>
          </div>
        </Card>

        {/* History */}
        <Card variant="panel" className="lg:col-span-2 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-widest text-secondary-500">
              Recently sent
            </h2>
          </div>

          {history.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (history.data?.items.length ?? 0) === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title="No messages yet"
              description="Messages you send to patients will show up here."
            />
          ) : (
            <>
              <ul className="space-y-3">
                {history.data!.items.map((b) => (
                  <li
                    key={b.id}
                    className="rounded-2xl border border-secondary-100 p-4 dark:border-white/10"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 flex-1 truncate text-sm font-semibold text-secondary-900 dark:text-secondary-100">
                        {b.subject || b.body.slice(0, 60) || "(no subject)"}
                      </p>
                      <Badge
                        variant={
                          b.status === "SENT"
                            ? "soft-success"
                            : b.status === "PARTIAL"
                              ? "soft-warning"
                              : "soft-danger"
                        }
                      >
                        {b.status}
                      </Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-secondary-500">{b.body}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-secondary-400">
                      <Badge variant="secondary">
                        {b.audience_type === "ALL"
                          ? "All patients"
                          : b.audience_type === "GROUP"
                            ? "Group"
                            : "One patient"}
                      </Badge>
                      <span>{b.recipient_count} recipient{b.recipient_count === 1 ? "" : "s"}</span>
                      <span>·</span>
                      <span>{b.read_count} read</span>
                      {(b.channels ?? []).includes("EMAIL") ? (
                        <span title={`${b.email_sent_count} emailed`}>· ✉ {b.email_sent_count}</span>
                      ) : null}
                      {(b.channels ?? []).includes("SMS") ? (
                        <span title={`${b.sms_sent_count} texted`}>· ✆ {b.sms_sent_count}</span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-[11px] text-secondary-400">
                      {formatDateTime(b.sent_at)}
                      {b.sent_by_name ? ` · by ${b.sent_by_name}` : ""}
                    </p>
                  </li>
                ))}
              </ul>

              {history.data!.totalPages > 1 ? (
                <div className="mt-4 flex items-center justify-between">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={historyPage <= 1}
                    onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                    leftIcon={<ChevronLeft className="h-4 w-4" />}
                  >
                    Prev
                  </Button>
                  <span className="text-xs font-bold uppercase tracking-widest text-secondary-400">
                    Page {history.data!.page} / {history.data!.totalPages}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!history.data!.hasNext}
                    onClick={() => setHistoryPage((p) => p + 1)}
                    rightIcon={<ChevronRight className="h-4 w-4" />}
                  >
                    Next
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
