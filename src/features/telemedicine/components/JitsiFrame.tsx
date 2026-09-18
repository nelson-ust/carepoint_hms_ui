import { useMemo } from "react";
import { Video } from "lucide-react";
import { buildJitsiUrl, type TelemedicineJoinInfo } from "../api/telemedicine.api";

/**
 * Embeds a Jitsi Meet room in an iframe. Jitsi (meet.jit.si) is credential-free
 * and embeddable, so a video consultation works out of the box; the backend
 * keeps the provider configurable for a self-hosted or Twilio deployment.
 */
export function JitsiFrame({
  join,
  displayName,
  height = 560,
}: {
  join: TelemedicineJoinInfo;
  displayName?: string | null;
  height?: number;
}) {
  const src = useMemo(() => buildJitsiUrl(join, displayName ?? join.display_name), [join, displayName]);

  return (
    <div className="overflow-hidden rounded-xl border border-secondary-200 bg-black dark:border-secondary-700">
      <iframe
        title={`Telemedicine room ${join.room_name}`}
        src={src}
        allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-write"
        style={{ height, width: "100%", border: 0 }}
        allowFullScreen
      />
    </div>
  );
}

export function JitsiPlaceholder({ message }: { message: string }) {
  return (
    <div className="flex h-[560px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-secondary-300 bg-secondary-50 text-center dark:border-secondary-700 dark:bg-secondary-900/40">
      <Video className="h-10 w-10 text-secondary-400" />
      <p className="max-w-sm text-sm text-secondary-500">{message}</p>
    </div>
  );
}
