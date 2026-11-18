import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Boxes, Plus, TrendingDown } from "lucide-react";
import {
  DxPage, DxPageHeader, DxPanel, DxBadge, DxButton, DxPopup, DxInput,
  DxGrid, type DxGridColumn,
} from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import { accountingApi, financeApi } from "../api/accounting.api";

const NGN = (v: string | number) => `₦${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

type Asset = {
  id: number; name: string; code: string; category?: string | null; acquisition_date: string;
  cost: string | number; accumulated_depreciation: string | number; net_book_value: string | number;
  last_depreciated_period?: string | null; status: string;
};

export function FixedAssetsPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);

  const assets = useQuery({ queryKey: ["fixed-assets"], queryFn: () => financeApi.listAssets() });

  const run = useMutation({
    mutationFn: () => financeApi.runDepreciation(),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["fixed-assets"] });
      toast.success("Depreciation posted", `${r.posted} asset(s) depreciated for ${r.period} · ${r.skipped_current} already current.`);
    },
    onError: (e: any) => toast.error("Depreciation failed", accountingApi.errMsg(e, "")),
  });

  const items = (assets.data ?? []) as Asset[];

  const columns: DxGridColumn<Asset>[] = [
    { key: "name", header: "Asset", render: (a) => (
        <div>
          <p className="font-semibold text-[var(--dx-text)]">{a.name}</p>
          <p className="dx-mono text-[11px] text-[var(--dx-text-faint)]">{a.code}{a.category ? ` · ${a.category}` : ""}</p>
        </div>) },
    { key: "acquisition_date", header: "Acquired", render: (a) => <span className="whitespace-nowrap">{a.acquisition_date}</span> },
    { key: "cost", header: "Cost", align: "right", render: (a) => <span className="dx-mono">{NGN(a.cost)}</span> },
    { key: "accumulated_depreciation", header: "Accum. dep.", align: "right", render: (a) => <span className="dx-mono">{NGN(a.accumulated_depreciation)}</span> },
    { key: "net_book_value", header: "Net book value", align: "right", render: (a) => <span className="dx-mono font-semibold">{NGN(a.net_book_value)}</span> },
    { key: "last_depreciated_period", header: "Last dep.", render: (a) => <span className="dx-mono text-[12px]">{a.last_depreciated_period || "—"}</span> },
    { key: "status", header: "Status", render: (a) => <DxBadge tone={a.status === "ACTIVE" ? "success" : a.status === "FULLY_DEPRECIATED" ? "info" : "danger"}>{a.status.replace(/_/g, " ")}</DxBadge> },
  ];

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Accounting" }, { label: "Fixed Assets" }]}
        title="Fixed Assets"
        subtitle="Asset register with straight-line depreciation posted straight into the ledger."
        actions={
          <>
            <DxButton variant="default" leftIcon={<TrendingDown className="h-4 w-4" />} isLoading={run.isPending} onClick={() => run.mutate()} title="Post this month's depreciation for every active asset (idempotent)">Run monthly depreciation</DxButton>
            <DxButton variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>Register asset</DxButton>
          </>
        }
      />

      <DxPanel flush>
        <DxGrid<Asset>
          borderless columns={columns} data={items} rowKey={(a) => a.id} isLoading={assets.isLoading}
          empty={{ icon: Boxes, title: "No fixed assets", description: "No fixed assets registered yet." }}
        />
      </DxPanel>

      <CreateAssetModal open={createOpen} onClose={() => setCreateOpen(false)} onDone={() => { setCreateOpen(false); qc.invalidateQueries({ queryKey: ["fixed-assets"] }); }} />
    </DxPage>
  );
}

function CreateAssetModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ name: "", category: "", acquisition_date: new Date().toISOString().slice(0, 10), cost: "", salvage_value: "0", useful_life_months: "60" });
  const create = useMutation({
    mutationFn: () => financeApi.createAsset({ name: f.name, category: f.category || undefined, acquisition_date: f.acquisition_date, cost: Number(f.cost), salvage_value: Number(f.salvage_value) || 0, useful_life_months: Number(f.useful_life_months) }),
    onSuccess: () => { toast.success("Asset registered"); onDone(); },
    onError: (e: any) => toast.error("Couldn't register asset", accountingApi.errMsg(e, "")),
  });
  return (
    <DxPopup isOpen={open} onClose={onClose} title="Register fixed asset" size="md">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
        <DxInput label="Asset name" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. GE Ultrasound Machine" />
        <div className="grid grid-cols-2 gap-3">
          <DxInput label="Category" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} placeholder="Medical Equipment" />
          <DxInput label="Acquisition date" type="date" required value={f.acquisition_date} onChange={(e) => setF({ ...f, acquisition_date: e.target.value })} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <DxInput label="Cost" type="number" mono min={0.01} step="0.01" required value={f.cost} onChange={(e) => setF({ ...f, cost: e.target.value })} />
          <DxInput label="Salvage value" type="number" mono min={0} step="0.01" value={f.salvage_value} onChange={(e) => setF({ ...f, salvage_value: e.target.value })} />
          <DxInput label="Useful life (months)" type="number" mono min={1} required value={f.useful_life_months} onChange={(e) => setF({ ...f, useful_life_months: e.target.value })} />
        </div>
        <div className="flex justify-end">
          <DxButton type="submit" variant="primary" isLoading={create.isPending}>Register asset</DxButton>
        </div>
      </form>
    </DxPopup>
  );
}
