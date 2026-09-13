import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderTree, Settings2, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/feedback/ToastProvider";
import {
  financeExtApi, type AccountNode, type SystemMapping,
} from "../api/finance-ext.api";

export function FinanceSettingsPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const tree = useQuery({ queryKey: ["fin", "tree"], queryFn: financeExtApi.accountTree });
  const mappings = useQuery({ queryKey: ["fin", "mappings"], queryFn: financeExtApi.systemMappings });
  const config = useQuery({ queryKey: ["fin", "config"], queryFn: financeExtApi.getConfig });
  const costCenters = useQuery({ queryKey: ["fin", "cc"], queryFn: financeExtApi.listCostCenters });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["fin"] });

  const flat: { id: number; label: string }[] = [];
  const walk = (nodes: AccountNode[], depth = 0) => {
    for (const n of nodes) {
      flat.push({ id: n.id, label: `${"— ".repeat(depth)}${n.code} · ${n.name}` });
      walk(n.children, depth + 1);
    }
  };
  walk(tree.data ?? []);

  const [threshold, setThreshold] = useState<string | null>(null);
  const cfg = config.data;

  return (
    <div>
      <PageHeader title="Finance Settings"
        description="Chart of accounts, system posting map, cost centers and controls."
        actions={<div className="flex gap-2">
          <Button variant="secondary" onClick={() =>
            financeExtApi.seedDefaultCoa().then((o) =>
              { toast.success(`Chart of accounts installed (${o.created} new).`); invalidate(); })}>
            <Sparkles className="mr-1 h-4 w-4" /> Install default CoA
          </Button>
          <Button variant="secondary" onClick={() =>
            financeExtApi.seedDemoHmos().then(() =>
              { toast.success("Demo HMOs installed."); invalidate(); })}>
            Demo HMOs
          </Button>
        </div>} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-secondary-900">
            <FolderTree className="h-5 w-5" /> Chart of accounts
          </h2>
          <div className="max-h-[28rem] overflow-y-auto pr-2">
            <TreeView nodes={tree.data ?? []} depth={0} />
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="p-4">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-secondary-900">
              <Settings2 className="h-5 w-5" /> Controls
            </h2>
            <div className="space-y-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>Journal approval threshold (maker-checker)</span>
                <div className="flex items-center gap-2">
                  <Input className="w-36" type="number"
                    value={threshold ?? cfg?.journal_approval_threshold ?? ""}
                    onChange={(e) => setThreshold(e.target.value)} />
                  <Button size="sm" variant="secondary" onClick={() =>
                    financeExtApi.updateConfig({ journal_approval_threshold: Number(threshold) })
                      .then(() => { toast.success("Saved."); invalidate(); })}>Save</Button>
                </div>
              </div>
              <ToggleRow label="Treat disallowances as expense (off = contra-revenue)"
                value={!!cfg?.disallowance_as_expense}
                onChange={(v) => financeExtApi.updateConfig({ disallowance_as_expense: v }).then(invalidate)} />
              <ToggleRow label="Hard-block orders lacking pre-authorization"
                value={!!cfg?.enforce_preauth_block}
                onChange={(v) => financeExtApi.updateConfig({ enforce_preauth_block: v }).then(invalidate)} />
              <ToggleRow label="Prompt eligibility check at check-in"
                value={!!cfg?.require_eligibility_check}
                onChange={(v) => financeExtApi.updateConfig({ require_eligibility_check: v }).then(invalidate)} />
              <div className="flex items-center justify-between">
                <span>Opening balance date (go-live)</span>
                <span className="font-medium">{cfg?.opening_balance_date ?? "not set"}</span>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-secondary-900">Cost centers</h2>
              <Button size="sm" variant="secondary" onClick={() =>
                financeExtApi.generateCostCenters().then((o) =>
                  { toast.success(`${o.created} cost centers created from departments.`); invalidate(); })}>
                Generate from departments
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {(costCenters.data ?? []).map((c) => (
                <Badge key={c.id} variant="secondary">{c.code} · {c.name}</Badge>
              ))}
              {costCenters.data?.length === 0 && (
                <p className="text-sm text-secondary-500">None yet — generate them from your departments.</p>)}
            </div>
          </Card>
        </div>
      </div>

      <Card className="mt-6 p-4">
        <h2 className="mb-1 text-lg font-semibold text-secondary-900">System posting map</h2>
        <p className="mb-4 text-sm text-secondary-500">
          Where each automatic posting lands. Repoint any key at your own account.
        </p>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {(mappings.data ?? []).map((m) => (
            <MappingRow key={m.key} mapping={m} accounts={flat}
              onSaved={() => { toast.success(`${m.key} remapped.`); invalidate(); }} />
          ))}
        </div>
      </Card>
    </div>
  );
}

function TreeView({ nodes, depth }: { nodes: AccountNode[]; depth: number }) {
  return (
    <ul className={depth ? "ml-4 border-l border-secondary-200 pl-3" : ""}>
      {nodes.map((n) => (
        <li key={n.id} className="py-0.5">
          <div className="flex items-center justify-between text-sm">
            <span className={n.is_postable ? "text-secondary-800" : "font-semibold text-secondary-900"}>
              {n.code} · {n.name}
            </span>
            <span className="flex items-center gap-1">
              {!n.is_postable && <Badge variant="secondary">header</Badge>}
              {n.is_system && <Badge variant="soft-info">system</Badge>}
              <span className="text-xs text-secondary-400">{n.account_type}</span>
            </span>
          </div>
          {n.children.length > 0 && <TreeView nodes={n.children} depth={depth + 1} />}
        </li>
      ))}
    </ul>
  );
}

function ToggleRow({ label, value, onChange }: {
  label: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span>{label}</span>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
    </div>
  );
}

function MappingRow({ mapping, accounts, onSaved }: {
  mapping: SystemMapping; accounts: { id: number; label: string }[]; onSaved: () => void;
}) {
  const [value, setValue] = useState(String(mapping.account_id));
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-secondary-50 px-3 py-2">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-secondary-800">{mapping.key}</div>
        <div className="truncate text-xs text-secondary-500">
          {mapping.account_code} · {mapping.account_name}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Select className="w-full sm:w-64" value={value} onChange={(e) => setValue(e.target.value)}
          options={accounts.map((a) => ({ value: String(a.id), label: a.label }))} />
        {Number(value) !== mapping.account_id && (
          <Button size="sm" onClick={() =>
            financeExtApi.setMapping({ key: mapping.key, account_id: Number(value) }).then(onSaved)}>
            Save
          </Button>
        )}
      </div>
    </div>
  );
}
