import {
  CreditCard,
  Plus,
  RotateCcw,
  Settings as SettingsIcon,
  ShieldCheck,
  Zap,
} from "lucide-react";
import {
  DxPage, DxPageHeader, DxPanel, DxButton, DxBadge, type DxGridColumn, DxGrid,
} from "@/components/dx";
import { usePaymentGateways, useTestGateway } from "../hooks/use-patient-payment";

type Gateway = {
  id: number;
  gateway_name: string;
  is_active?: boolean;
  config: { merchant_id?: string | null };
};

export function PaymentGatewaysPage() {
  const { data, isLoading, refetch, isFetching } = usePaymentGateways();
  const testMutation = useTestGateway();

  const gateways: Gateway[] = (data?.items as Gateway[]) || [];

  const columns: DxGridColumn<Gateway>[] = [
    {
      key: "gateway",
      header: "Provider",
      render: (gw) => (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--dx-accent-soft)] text-[var(--dx-accent)]">
            <CreditCard className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[var(--dx-text)]">{gw.gateway_name}</span>
              {gw.is_active ? <DxBadge tone="success" dot>Live</DxBadge> : <DxBadge tone="neutral">Inactive</DxBadge>}
            </div>
            <div className="text-[11.5px] text-[var(--dx-text-muted)]">
              Merchant ID: <span className="dx-mono">{gw.config?.merchant_id || "Not set"}</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (gw) => (
        <div className="flex items-center justify-end gap-1">
          <DxButton
            size="sm"
            variant="default"
            isLoading={testMutation.isPending && testMutation.variables === gw.id}
            onClick={() => testMutation.mutate(gw.id)}
          >
            Test gateway
          </DxButton>
          <DxButton icon size="sm" variant="text" title="Configure">
            <SettingsIcon className="h-4 w-4" />
          </DxButton>
        </div>
      ),
    },
  ];

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Billing" }, { label: "Payment Gateways" }]}
        title="Payment Gateways"
        subtitle="Configure direct patient payment integrations via Paystack, Flutterwave, Stripe, or local banks."
        actions={
          <>
            <DxButton icon title="Refresh" onClick={() => refetch()} isLoading={isFetching}>
              <RotateCcw />
            </DxButton>
            <DxButton variant="primary" leftIcon={<Plus className="h-4 w-4" />}>
              Add gateway
            </DxButton>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <DxPanel>
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--dx-accent-soft)] text-[var(--dx-accent)]">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h4 className="text-[15px] font-bold text-[var(--dx-text)]">Secure transactions</h4>
            <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--dx-text-muted)]">
              All patient payments are processed through secure 3D-Secure gateways. Sensitive card
              data is never stored on hospital servers.
            </p>
            <p className="mt-5 text-[10px] font-semibold uppercase tracking-widest text-[var(--dx-text-faint)]">
              PCI-DSS compliant infrastructure
            </p>
          </DxPanel>
        </div>

        <div className="lg:col-span-2">
          <DxPanel title="Connected providers" icon={<Zap className="h-4 w-4 text-[var(--dx-accent)]" />} flush>
            <DxGrid<Gateway>
              borderless
              columns={columns}
              data={gateways}
              rowKey={(gw) => gw.id}
              isLoading={isLoading}
              empty={{
                icon: CreditCard,
                title: "No gateways configured",
                description: "Enable direct patient payments by connecting your first gateway.",
              }}
            />
          </DxPanel>
        </div>
      </div>
    </DxPage>
  );
}
