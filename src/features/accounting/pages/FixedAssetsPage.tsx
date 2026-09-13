import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Boxes, Plus, TrendingDown } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/feedback/ToastProvider";
import { accountingApi, financeApi } from "../api/accounting.api";

const NGN = (v: string | number) => `₦${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

export function FixedAssetsPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);

  const assets = useQuery({ queryKey: ["fixed-assets"], queryFn: () => financeApi.listAssets() });

  const run = useMutation({
    mutationFn: () => financeApi.runDepreciation(),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["fixed-assets"] });
      toast.success("Depreciation posted",
        `${r.posted} asset(s) depreciated for ${r.period} · ${r.skipped_current} already current.`);
    },
    onError: (e: any) => toast.error("Depreciation failed", accountingApi.errMsg(e, "")),
  });

  const items = assets.data ?? [];

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <PageHeader title="Fixed Assets" description="Asset register with straight-line depreciation posted straight into the ledger." />
        <div className="flex gap-3">
          <Button variant="secondary" leftIcon={<TrendingDown className="h-4 w-4" />} isLoading={run.isPending}
            onClick={() => run.mutate()}
            title="Post this month's depreciation for every active asset (idempotent)">
            Run monthly depreciation
          </Button>
          <Button leftIcon={<Plus className="h-5 w-5" />} onClick={() => setCreateOpen(true)}>Register asset</Button>
        </div>
      </div>

      {assets.isLoading ? <Skeleton className="h-40 w-full" /> : items.length === 0 ? (
        <Card className="p-10 text-center text-secondary-500">
          <Boxes className="h-8 w-8 mx-auto mb-3 opacity-40" /> No fixed assets registered yet.
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-secondary-50 text-secondary-500 text-[10px] uppercase tracking-widest dark:bg-white/5">
              <tr>
                <th className="text-left px-5 py-3">Asset</th>
                <th className="text-left px-5 py-3">Acquired</th>
                <th className="text-right px-5 py-3">Cost</th>
                <th className="text-right px-5 py-3">Accum. dep.</th>
                <th className="text-right px-5 py-3">Net book value</th>
                <th className="text-left px-5 py-3">Last dep.</th>
                <th className="text-left px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-100 dark:divide-white/5">
              {items.map((a) => (
                <tr key={a.id} className="hover:bg-secondary-50/60 dark:hover:bg-white/5">
                  <td className="px-5 py-3">
                    <p className="font-bold">{a.name}</p>
                    <p className="data-mono text-xs text-secondary-400">{a.code}{a.category ? ` · ${a.category}` : ""}</p>
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap">{a.acquisition_date}</td>
                  <td className="px-5 py-3 text-right data-mono">{NGN(a.cost)}</td>
                  <td className="px-5 py-3 text-right data-mono">{NGN(a.accumulated_depreciation)}</td>
                  <td className="px-5 py-3 text-right data-mono font-bold">{NGN(a.net_book_value)}</td>
                  <td className="px-5 py-3 data-mono text-xs">{a.last_depreciated_period || "—"}</td>
                  <td className="px-5 py-3">
                    <Badge variant={a.status === "ACTIVE" ? "soft-success" : a.status === "FULLY_DEPRECIATED" ? "soft-info" : "soft-danger"}>
                      {a.status.replace(/_/g, " ")}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <CreateAssetModal open={createOpen} onClose={() => setCreateOpen(false)}
        onDone={() => { setCreateOpen(false); qc.invalidateQueries({ queryKey: ["fixed-assets"] }); }} />
    </div>
  );
}

function CreateAssetModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({
    name: "", category: "", acquisition_date: new Date().toISOString().slice(0, 10),
    cost: "", salvage_value: "0", useful_life_months: "60",
  });
  const create = useMutation({
    mutationFn: () => financeApi.createAsset({
      name: f.name, category: f.category || undefined, acquisition_date: f.acquisition_date,
      cost: Number(f.cost), salvage_value: Number(f.salvage_value) || 0,
      useful_life_months: Number(f.useful_life_months),
    }),
    onSuccess: () => { toast.success("Asset registered"); onDone(); },
    onError: (e: any) => toast.error("Couldn't register asset", accountingApi.errMsg(e, "")),
  });
  return (
    <Modal isOpen={open} onClose={onClose} title="Register fixed asset" size="lg">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
        <Input label="Asset name" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. GE Ultrasound Machine" />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Category" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} placeholder="Medical Equipment" />
          <Input label="Acquisition date" type="date" required value={f.acquisition_date} onChange={(e) => setF({ ...f, acquisition_date: e.target.value })} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Input label="Cost" type="number" min={0.01} step="0.01" required value={f.cost} onChange={(e) => setF({ ...f, cost: e.target.value })} />
          <Input label="Salvage value" type="number" min={0} step="0.01" value={f.salvage_value} onChange={(e) => setF({ ...f, salvage_value: e.target.value })} />
          <Input label="Useful life (months)" type="number" min={1} required value={f.useful_life_months} onChange={(e) => setF({ ...f, useful_life_months: e.target.value })} />
        </div>
        <Button type="submit" isLoading={create.isPending}>Register asset</Button>
      </form>
    </Modal>
  );
}
