import { Badge, type BadgeProps } from "@/components/ui/Badge";

const STATUS_VARIANTS: Record<string, BadgeProps["variant"]> = {
  PAID: "soft-success",
  PARTIALLY_PAID: "soft-warning",
  ISSUED: "soft-info",
  DRAFT: "secondary",
  WAIVED: "secondary",
  VOIDED: "soft-danger",
  CANCELLED: "soft-danger",
};

export function InvoiceStatusBadge({ status }: { status: string }) {
  const normalized = (status || "").toUpperCase();
  return (
    <Badge variant={STATUS_VARIANTS[normalized] ?? "secondary"}>
      {normalized.replace(/_/g, " ") || "UNKNOWN"}
    </Badge>
  );
}
