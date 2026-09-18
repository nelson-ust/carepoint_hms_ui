import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { format, isValid } from "date-fns";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { TelemedicineMessage } from "../api/telemedicine.api";

function time(v?: string | null): string {
  if (!v) return "";
  const d = new Date(v);
  return isValid(d) ? format(d, "h:mm a") : "";
}

/**
 * In-session secure chat. `mineRole` is the viewer's role so their own bubbles
 * align right; SYSTEM lines render as centered status notices.
 */
export function SessionChat({
  messages,
  onSend,
  isSending,
  disabled,
  mineRole,
  emptyHint = "No messages yet. Say hello 👋",
}: {
  messages: TelemedicineMessage[];
  onSend: (body: string) => void;
  isSending?: boolean;
  disabled?: boolean;
  mineRole: "CLINICIAN" | "PATIENT";
  emptyHint?: string;
}) {
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const submit = () => {
    const body = text.trim();
    if (!body) return;
    onSend(body);
    setText("");
  };

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-1" style={{ maxHeight: 420 }}>
        {messages.length === 0 && (
          <p className="py-8 text-center text-sm text-secondary-400">{emptyHint}</p>
        )}
        {messages.map((m) => {
          if (m.sender_role === "SYSTEM") {
            return (
              <div key={m.id} className="text-center">
                <span className="inline-block rounded-full bg-secondary-100 px-3 py-1 text-xs text-secondary-500 dark:bg-secondary-800">
                  {m.body}
                </span>
              </div>
            );
          }
          const mine = m.sender_role === mineRole;
          return (
            <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                  mine
                    ? "bg-primary-600 text-white"
                    : "bg-secondary-100 text-secondary-900 dark:bg-secondary-800 dark:text-white"
                }`}
              >
                {m.body}
              </div>
              <span className="mt-1 text-[11px] text-secondary-400">
                {m.sender_name || m.sender_role} • {time(m.sent_at)}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-end gap-2 border-t border-secondary-100 pt-3 dark:border-secondary-800">
        <div className="flex-1">
          <Input
            placeholder={disabled ? "Chat is closed for this session" : "Type a message…"}
            value={text}
            disabled={disabled}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
          />
        </div>
        <Button onClick={submit} disabled={disabled || isSending || !text.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
