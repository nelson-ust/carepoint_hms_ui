import { DxBadge, humanize, type DxBadgeTone } from "@/components/dx";

const STATUS_TONES: Record<string, DxBadgeTone> = {
  PAID: "success",
  PARTIALLY_PAID: "warning",
  ISSUED: "info",
  OVERDUE: "danger",
  DRAFT: "neutral",
  WAIVED: "neutral",
  VOIDED: "danger",
  CANCELLED: "danger",
};

/** Invoice status tag on the DX kit. Unknown statuses fall back to neutral. */
export function InvoiceStatusBadge({ status }: { status: string }) {
  const normalized = (status || "").toUpperCase();
  return (
    <DxBadge tone={STATUS_TONES[normalized] ?? "neutral"} dot>
      {normalized ? humanize(normalized) : "Unknown"}
    </DxBadge>
  );
}
