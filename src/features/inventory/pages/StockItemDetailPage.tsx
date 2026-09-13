import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  Boxes,
  CalendarClock,
  History,
  Package,
  Warehouse,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge, type BadgeProps } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { MetricCard } from "@/components/charts/MetricCard";
import { DataTable, type DataTableColumn } from "@/components/data-table/DataTable";
import { routes } from "@/config/routes";
import {
  getStockItem,
  listInventoryMovements,
  listStockItems,
  type StockItem,
  type StockMovement,
} from "../api/inventory.api";

// ---------- Helpers ----------

const qty = new Intl.NumberFormat();

function fmtDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

const INBOUND_TYPES = new Set(["RECEIPT", "TRANSFER_IN", "RETURN"]);
const OUTBOUND_TYPES = new Set(["ISSUE", "TRANSFER_OUT", "WASTAGE"]);

function movementDirection(type: string): "in" | "out" | "neutral" {
  if (INBOUND_TYPES.has(type)) return "in";
  if (OUTBOUND_TYPES.has(type)) return "out";
  return "neutral";
}

const movementVariant: Record<"in" | "out" | "neutral", BadgeProps["variant"]> = {
  in: "soft-success",
  out: "soft-danger",
  neutral: "soft-info",
};

function isLowStock(item: StockItem): boolean {
  return item.reorder_level !== undefined && item.reorder_level !== null
    ? item.quantity_on_hand <= item.reorder_level
    : false;
}

function expiryDays(item: StockItem): number | null {
  if (!item.expiry_date) return null;
  const d = new Date(item.expiry_date);
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86_400_000);
}

/** Metric tone rotation for per-store stock tiles. */
const STORE_TONES = ["primary", "cyan", "violet", "amber"] as const;

// ---------- Page ----------

export function StockItemDetailPage() {
  const navigate = useNavigate();
  const { itemId } = useParams<{ itemId: string }>();
  const id = Number(itemId);
  const validId = Number.isFinite(id) && id > 0;

  const itemQuery = useQuery({
    queryKey: ["inventory", "item", id],
    queryFn: () => getStockItem(id),
    enabled: validId,
  });
  const item = itemQuery.data;

  const movementsQuery = useQuery({
    queryKey: ["inventory", "item-movements", id],
    queryFn: () => listInventoryMovements({ stock_item_id: id, limit: 50 }),
    enabled: validId,
  });
  const movements = movementsQuery.data?.items ?? [];

  // Stock level for this item (same SKU / name) across all stores.
  const siblingSearch = item?.sku || item?.item_name || "";
  const siblingsQuery = useQuery({
    queryKey: ["inventory", "item-siblings", siblingSearch],
    queryFn: () => listStockItems({ search: siblingSearch, limit: 200 }),
    enabled: siblingSearch.length > 0,
  });

  const storeLevels = useMemo(() => {
    if (!item) return [];
    const candidates = siblingsQuery.data?.items ?? [];
    const matches = candidates.filter((s) =>
      item.sku ? s.sku === item.sku : s.item_name === item.item_name,
    );
    // Always include the item itself, even if the search missed it.
    if (!matches.some((s) => s.id === item.id)) matches.unshift(item);
    return matches;
  }, [item, siblingsQuery.data]);

  const daysToExpiry = item ? expiryDays(item) : null;

  const columns: DataTableColumn<StockMovement>[] = [
    {
      key: "movement_date",
      header: "Date",
      render: (m) => (
        <span className="text-sm font-medium text-secondary-700">
          {fmtDate(m.movement_date ?? m.created_at)}
        </span>
      ),
    },
    {
      key: "reference_no",
      header: "Reference",
      render: (m) => (
        <div>
          <p className="data-mono text-sm font-bold text-secondary-900">
            {m.reference_no ?? `MOV-${m.id}`}
          </p>
          {m.note ? (
            <p className="max-w-[220px] truncate text-[10px] font-medium text-secondary-400">
              {m.note}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      key: "movement_type",
      header: "Type",
      render: (m) => {
        const dir = movementDirection(m.movement_type);
        return (
          <Badge variant={movementVariant[dir]}>
            {dir === "in" ? (
              <ArrowUpRight className="h-3 w-3" aria-hidden />
            ) : dir === "out" ? (
              <ArrowDownLeft className="h-3 w-3" aria-hidden />
            ) : null}
            {m.movement_type.replace(/_/g, " ")}
          </Badge>
        );
      },
    },
    {
      key: "quantity",
      header: "Quantity",
      align: "right",
      render: (m) => {
        const dir = movementDirection(m.movement_type);
        return (
          <span
            className={
              dir === "out"
                ? "data-mono text-sm font-bold text-rose-500"
                : dir === "in"
                  ? "data-mono text-sm font-bold text-emerald-500"
                  : "data-mono text-sm font-bold text-secondary-900"
            }
          >
            {dir === "in" ? "+" : dir === "out" ? "-" : ""}
            {qty.format(Math.abs(m.quantity))}
          </span>
        );
      },
    },
    {
      key: "balance_after",
      header: "Balance",
      align: "right",
      render: (m) => (
        <span className="data-mono text-sm text-secondary-700">{qty.format(m.balance_after)}</span>
      ),
    },
  ];

  if (!validId) {
    return (
      <div className="space-y-8 animate-fade-in pb-16">
        <EmptyState
          icon={Package}
          title="Stock item not found"
          description="The requested stock item id is invalid."
          action={
            <Button size="sm" onClick={() => navigate(routes.inventoryItems)}>
              Back to Inventory
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      <PageHeader
        eyebrow={
          <Breadcrumbs
            items={[
              { label: "Inventory", to: routes.inventoryItems },
              { label: item?.item_name ?? `Item #${id}` },
            ]}
          />
        }
        title={item?.item_name ?? "Stock Item"}
        description="Live balance, per-store stock levels and the full movement ledger for this item."
        actions={
          <Button
            variant="secondary"
            leftIcon={<ArrowLeft className="h-4 w-4" />}
            onClick={() => navigate(routes.inventoryItems)}
          >
            Back to Inventory
          </Button>
        }
      />

      {/* Item header card */}
      <Card padding="lg">
        {itemQuery.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : itemQuery.isError || !item ? (
          <EmptyState
            icon={Package}
            title="Could not load this stock item"
            description="The item details failed to load."
            action={
              <Button size="sm" variant="secondary" onClick={() => itemQuery.refetch()}>
                Retry
              </Button>
            }
          />
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="soft-info">{item.item_type}</Badge>
              {isLowStock(item) ? (
                <Badge variant="soft-danger">
                  <AlertTriangle className="h-3 w-3" aria-hidden />
                  Low Stock
                </Badge>
              ) : (
                <Badge variant="soft-success">In Stock</Badge>
              )}
              {daysToExpiry !== null ? (
                <Badge variant={daysToExpiry <= 90 ? "soft-warning" : "secondary"}>
                  <CalendarClock className="h-3 w-3" aria-hidden />
                  {daysToExpiry <= 0 ? "Expired" : `Expires in ${daysToExpiry}d`}
                </Badge>
              ) : null}
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <HeaderStat label="SKU" value={item.sku ?? "—"} mono />
              <HeaderStat label="Batch No." value={item.batch_no ?? "—"} mono />
              <HeaderStat
                label="Reorder Level"
                value={
                  item.reorder_level !== undefined && item.reorder_level !== null
                    ? `${qty.format(item.reorder_level)} ${item.unit_of_measure ?? ""}`.trim()
                    : "—"
                }
                mono
              />
              <HeaderStat
                label="Home Store"
                value={item.store?.name ?? `Store #${item.store_id}`}
              />
              <HeaderStat
                label="Unit Cost"
                value={
                  item.unit_cost !== undefined && item.unit_cost !== null
                    ? qty.format(item.unit_cost)
                    : "—"
                }
                mono
              />
              <HeaderStat label="Unit of Measure" value={item.unit_of_measure ?? "—"} />
              <HeaderStat label="Expiry Date" value={fmtDate(item.expiry_date)} />
              <HeaderStat
                label="Linked Drug"
                value={item.drug?.name ?? (item.drug_id ? `Drug #${item.drug_id}` : "—")}
              />
            </div>
          </div>
        )}
      </Card>

      {/* Per-store stock levels */}
      <div>
        <div className="mb-4 flex items-center gap-2">
          <Warehouse className="h-4 w-4 text-secondary-400" aria-hidden />
          <h3 className="font-display text-lg font-bold text-secondary-900">Stock by Store</h3>
        </div>
        {itemQuery.isLoading || siblingsQuery.isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <MetricCard key={i} label="Store" value="" isLoading />
            ))}
          </div>
        ) : storeLevels.length === 0 ? (
          <Card>
            <EmptyState
              icon={Boxes}
              title="No stock records"
              description="This item has no stock level records in any store."
            />
          </Card>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            {storeLevels.map((s, i) => (
              <MetricCard
                key={s.id}
                label={s.store?.name ?? `Store #${s.store_id}`}
                value={
                  <>
                    {qty.format(s.quantity_on_hand)}
                    {s.unit_of_measure ? (
                      <span className="ml-1 text-sm font-bold uppercase text-secondary-400">
                        {s.unit_of_measure}
                      </span>
                    ) : null}
                  </>
                }
                icon={Boxes}
                tone={isLowStock(s) ? "rose" : STORE_TONES[i % STORE_TONES.length]}
              />
            ))}
          </div>
        )}
      </div>

      {/* Movement ledger */}
      <Card padding="none">
        <CardHeader
          className="px-6 pt-6"
          title={
            <span className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary-500" aria-hidden />
              Recent Movements
            </span>
          }
          description="Receipts, issues, transfers and adjustments posted against this item."
        />
        <DataTable
          columns={columns}
          data={movements}
          rowKey={(m) => m.id}
          isLoading={movementsQuery.isLoading}
          error={movementsQuery.isError ? "Could not load stock movements." : null}
          onRetry={() => movementsQuery.refetch()}
          empty={{
            icon: History,
            title: "No movements recorded",
            description: "No stock movements have been posted against this item yet.",
          }}
        />
      </Card>
    </div>
  );
}

function HeaderStat({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-secondary-500/5 px-4 py-3 dark:bg-white/5">
      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-secondary-400">
        {label}
      </p>
      <p
        className={
          mono
            ? "data-mono mt-1 truncate text-sm font-bold text-secondary-900"
            : "mt-1 truncate text-sm font-bold text-secondary-900"
        }
      >
        {value}
      </p>
    </div>
  );
}
