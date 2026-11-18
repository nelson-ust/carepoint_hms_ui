import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderTree, Settings2, Sparkles } from "lucide-react";
import {
  DxPage, DxPageHeader, DxPanel, DxButton, DxBadge, DxInput, DxSelect, DxCheckbox,
} from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import { financeExtApi, type AccountNode, type SystemMapping } from "../api/finance-ext.api";

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
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Accounting" }, { label: "Settings" }]}
        title="Finance Settings"
        subtitle="Chart of accounts, system posting map, cost centers and controls."
        actions={
          <>
            <DxButton variant="default" leftIcon={<Sparkles className="h-4 w-4" />} onClick={() =>
              financeExtApi.seedDefaultCoa().then((o) => { toast.success(`Chart of accounts installed (${o.created} new).`); invalidate(); })}>
              Install default CoA
            </DxButton>
            <DxButton variant="default" onClick={() =>
              financeExtApi.seedDemoHmos().then(() => { toast.success("Demo HMOs installed."); invalidate(); })}>
              Demo HMOs
            </DxButton>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <DxPanel title="Chart of accounts" icon={<FolderTree className="h-4 w-4" />}>
          <div className="max-h-[28rem] overflow-y-auto pr-2">
            <TreeView nodes={tree.data ?? []} depth={0} />
          </div>
        </DxPanel>

        <div className="space-y-5">
          <DxPanel title="Controls" icon={<Settings2 className="h-4 w-4" />}>
            <div className="space-y-3 text-[13px]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[var(--dx-text)]">Journal approval threshold (maker-checker)</span>
                <div className="flex items-center gap-2">
                  <DxInput className="w-36" type="number" mono value={threshold ?? cfg?.journal_approval_threshold ?? ""} onChange={(e) => setThreshold(e.target.value)} />
                  <DxButton size="sm" variant="default" onClick={() =>
                    financeExtApi.updateConfig({ journal_approval_threshold: Number(threshold) }).then(() => { toast.success("Saved."); invalidate(); })}>Save</DxButton>
                </div>
              </div>
              <DxCheckbox label="Treat disallowances as expense (off = contra-revenue)" checked={!!cfg?.disallowance_as_expense} onChange={(e) => financeExtApi.updateConfig({ disallowance_as_expense: e.target.checked }).then(invalidate)} />
              <DxCheckbox label="Hard-block orders lacking pre-authorization" checked={!!cfg?.enforce_preauth_block} onChange={(e) => financeExtApi.updateConfig({ enforce_preauth_block: e.target.checked }).then(invalidate)} />
              <DxCheckbox label="Prompt eligibility check at check-in" checked={!!cfg?.require_eligibility_check} onChange={(e) => financeExtApi.updateConfig({ require_eligibility_check: e.target.checked }).then(invalidate)} />
              <div className="flex items-center justify-between">
                <span className="text-[var(--dx-text)]">Opening balance date (go-live)</span>
                <span className="font-medium text-[var(--dx-text)]">{cfg?.opening_balance_date ?? "not set"}</span>
              </div>
            </div>
          </DxPanel>

          <DxPanel
            title="Cost centers"
            actions={
              <DxButton size="sm" variant="default" onClick={() =>
                financeExtApi.generateCostCenters().then((o) => { toast.success(`${o.created} cost centers created from departments.`); invalidate(); })}>
                Generate from departments
              </DxButton>
            }
          >
            <div className="flex flex-wrap gap-2">
              {(costCenters.data ?? []).map((c) => (
                <DxBadge key={c.id} tone="neutral">{c.code} · {c.name}</DxBadge>
              ))}
              {costCenters.data?.length === 0 && <p className="text-[13px] text-[var(--dx-text-muted)]">None yet — generate them from your departments.</p>}
            </div>
          </DxPanel>
        </div>
      </div>

      <DxPanel title="System posting map">
        <p className="mb-4 text-[13px] text-[var(--dx-text-muted)]">Where each automatic posting lands. Repoint any key at your own account.</p>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {(mappings.data ?? []).map((m) => (
            <MappingRow key={m.key} mapping={m} accounts={flat} onSaved={() => { toast.success(`${m.key} remapped.`); invalidate(); }} />
          ))}
        </div>
      </DxPanel>
    </DxPage>
  );
}

function TreeView({ nodes, depth }: { nodes: AccountNode[]; depth: number }) {
  return (
    <ul className={depth ? "ml-4 border-l border-[var(--dx-border)] pl-3" : ""}>
      {nodes.map((n) => (
        <li key={n.id} className="py-0.5">
          <div className="flex items-center justify-between text-[13px]">
            <span className={n.is_postable ? "text-[var(--dx-text-muted)]" : "font-semibold text-[var(--dx-text)]"}>{n.code} · {n.name}</span>
            <span className="flex items-center gap-1">
              {!n.is_postable && <DxBadge tone="neutral">header</DxBadge>}
              {n.is_system && <DxBadge tone="info">system</DxBadge>}
              <span className="text-[11.5px] text-[var(--dx-text-faint)]">{n.account_type}</span>
            </span>
          </div>
          {n.children.length > 0 && <TreeView nodes={n.children} depth={depth + 1} />}
        </li>
      ))}
    </ul>
  );
}

function MappingRow({ mapping, accounts, onSaved }: {
  mapping: SystemMapping; accounts: { id: number; label: string }[]; onSaved: () => void;
}) {
  const [value, setValue] = useState(String(mapping.account_id));
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-[var(--dx-surface-sunken)] px-3 py-2">
      <div className="min-w-0">
        <div className="truncate text-[13px] font-medium text-[var(--dx-text)]">{mapping.key}</div>
        <div className="truncate text-[11.5px] text-[var(--dx-text-muted)]">{mapping.account_code} · {mapping.account_name}</div>
      </div>
      <div className="flex items-center gap-2">
        <DxSelect className="w-full sm:w-64" value={value} onChange={(e) => setValue(e.target.value)} options={accounts.map((a) => ({ value: String(a.id), label: a.label }))} />
        {Number(value) !== mapping.account_id && (
          <DxButton size="sm" variant="primary" onClick={() => financeExtApi.setMapping({ key: mapping.key, account_id: Number(value) }).then(onSaved)}>Save</DxButton>
        )}
      </div>
    </div>
  );
}
