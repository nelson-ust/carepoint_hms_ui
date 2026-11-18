import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ShoppingCart, Receipt, TrendingUp, Boxes, Package, AlertTriangle, CalendarClock, Pill } from "lucide-react";
import { DxPage, DxPageHeader, DxPanel, DxKpi, DxButton, DxBadge, DxSkeleton } from "@/components/dx";
import { routes } from "@/config/routes";
import { getPharmacyStoreDashboard } from "../api/pharmacy.api";

const NGN = (n: number) => `₦${(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export function PharmacyStoreDashboardPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["pharmacy", "store-dashboard"],
    queryFn: () => getPharmacyStoreDashboard(),
    refetchInterval: 60_000,
  });

  const today = data?.today;
  const week = data?.week;
  const marginPct = today && today.revenue > 0 ? Math.round((today.margin / today.revenue) * 100) : 0;
  const paymentMix = Object.entries(data?.payment_mix ?? {});

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Pharmacy" }, { label: "Store Dashboard" }]}
        title="Store Dashboard"
        subtitle="Today's trading, margin and stock health at a glance."
        actions={
          <div className="flex items-center gap-2">
            <DxButton variant="default" leftIcon={<Receipt className="h-4 w-4" />} onClick={() => navigate(routes.pharmacySales)}>
              Sales
            </DxButton>
            <DxButton variant="primary" leftIcon={<ShoppingCart className="h-4 w-4" />} onClick={() => navigate(routes.pharmacyPos)}>
              New Sale
            </DxButton>
          </div>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <DxKpi label="Sales today" value={today?.sales ?? 0} icon={Receipt} tone="accent" isLoading={isLoading} />
        <DxKpi label="Revenue today" value={NGN(today?.revenue ?? 0)} icon={TrendingUp} tone="success" isLoading={isLoading} />
        <DxKpi label="Gross margin today" value={NGN(today?.margin ?? 0)} sub={`${marginPct}% of revenue`} icon={TrendingUp} tone="info" isLoading={isLoading} />
        <DxKpi label="Revenue (7 days)" value={NGN(week?.revenue ?? 0)} icon={TrendingUp} tone="accent" isLoading={isLoading} />
        <DxKpi label="Inventory value" value={NGN(data?.inventory_value ?? 0)} sub={`${data?.stock_item_count ?? 0} items`} icon={Boxes} tone="neutral" isLoading={isLoading} />
        <DxKpi label="Stock alerts" value={(data?.low_stock_count ?? 0) + (data?.expiring_count ?? 0)} sub={`${data?.low_stock_count ?? 0} low · ${data?.expiring_count ?? 0} expiring`} icon={AlertTriangle} tone={((data?.low_stock_count ?? 0) + (data?.expiring_count ?? 0)) > 0 ? "warning" : "neutral"} isLoading={isLoading} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top sellers */}
        <DxPanel title="Top sellers (7 days)" icon={<Pill className="h-5 w-5 text-[var(--dx-accent)]" />}>
          {isLoading ? (
            <DxSkeleton className="h-40 w-full" />
          ) : (data?.top_sellers?.length ?? 0) === 0 ? (
            <p className="py-10 text-center text-sm text-[var(--dx-text-muted)]">No sales in the last 7 days.</p>
          ) : (
            <ul className="space-y-2">
              {data!.top_sellers.map((t) => (
                <li key={t.item_name} className="flex items-center justify-between gap-3 rounded-md border border-[var(--dx-border)] px-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[var(--dx-text)]">{t.item_name}</span>
                  <span className="text-[12px] text-[var(--dx-text-muted)]">{t.quantity} sold</span>
                  <span className="w-24 text-right text-[13px] font-bold text-[var(--dx-text)]">{NGN(t.revenue)}</span>
                </li>
              ))}
            </ul>
          )}
        </DxPanel>

        {/* Payment mix */}
        <DxPanel title="Payment mix (today)" icon={<Receipt className="h-5 w-5 text-[var(--dx-accent)]" />}>
          {isLoading ? (
            <DxSkeleton className="h-40 w-full" />
          ) : paymentMix.length === 0 ? (
            <p className="py-10 text-center text-sm text-[var(--dx-text-muted)]">No sales yet today.</p>
          ) : (
            <ul className="space-y-2">
              {paymentMix.map(([method, amount]) => (
                <li key={method} className="flex items-center justify-between gap-3 rounded-md border border-[var(--dx-border)] px-3 py-2">
                  <DxBadge tone="neutral">{method.replace(/_/g, " ")}</DxBadge>
                  <span className="text-[13px] font-bold text-[var(--dx-text)]">{NGN(amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </DxPanel>

        {/* Low stock */}
        <DxPanel
          title="Low stock"
          icon={<Package className="h-5 w-5 text-[var(--dx-warning)]" />}
          actions={<DxButton size="sm" variant="text" onClick={() => navigate(routes.inventoryStores)}>Open stores</DxButton>}
        >
          {isLoading ? (
            <DxSkeleton className="h-40 w-full" />
          ) : (data?.low_stock?.length ?? 0) === 0 ? (
            <p className="py-10 text-center text-sm text-[var(--dx-text-muted)]">Everything is above reorder level.</p>
          ) : (
            <ul className="space-y-2">
              {data!.low_stock.map((it) => (
                <li key={it.item_name} className="flex items-center justify-between gap-3 rounded-md border border-[var(--dx-border)] px-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[var(--dx-text)]">{it.item_name}</span>
                  <DxBadge tone="warning">{it.quantity_on_hand} / {it.reorder_level}</DxBadge>
                </li>
              ))}
            </ul>
          )}
        </DxPanel>

        {/* Expiring soon */}
        <DxPanel title="Expiring within 60 days" icon={<CalendarClock className="h-5 w-5 text-[var(--dx-danger)]" />}>
          {isLoading ? (
            <DxSkeleton className="h-40 w-full" />
          ) : (data?.expiring_soon?.length ?? 0) === 0 ? (
            <p className="py-10 text-center text-sm text-[var(--dx-text-muted)]">Nothing expiring soon.</p>
          ) : (
            <ul className="space-y-2">
              {data!.expiring_soon.map((it) => (
                <li key={`${it.item_name}-${it.expiry_date}`} className="flex items-center justify-between gap-3 rounded-md border border-[var(--dx-border)] px-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[var(--dx-text)]">{it.item_name}</span>
                  <span className="text-[12px] text-[var(--dx-text-muted)]">{it.quantity_on_hand} on hand</span>
                  <DxBadge tone="danger">{it.expiry_date}</DxBadge>
                </li>
              ))}
            </ul>
          )}
        </DxPanel>
      </div>
    </DxPage>
  );
}

export default PharmacyStoreDashboardPage;
