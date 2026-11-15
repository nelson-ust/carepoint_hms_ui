import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  Box,
  BriefcaseMedical,
  CheckCircle2,
  LogOut,
  MapPin,
  Plus,
  Receipt,
  Scissors,
  ShieldAlert,
  Snowflake,
  UserPlus,
} from "lucide-react";
import {
  DxBadge,
  DxButton,
  DxCheckbox,
  DxForm,
  DxGrid,
  DxInput,
  DxKpi,
  DxPage,
  DxPageHeader,
  DxPanel,
  DxPopup,
  DxSearchBox,
  DxSelect,
  DxStatusBar,
  DxStatusItem,
  DxTabs,
  DxTextarea,
  DxToolbar,
  DxToolbarSeparator,
  DxToolbarSpacer,
  apiErrorMessage,
  formatDateTime,
  type DxGridColumn,
} from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import { routes } from "@/config/routes";
import {
  mortuaryApi,
  type DeceasedRecord,
  type Autopsy,
  type Charge,
  type MortuaryUnit,
  type PatientDeath,
  type RegisterDeceasedPayload,
} from "../api/mortuary.api";

const naira = (n: number | string) => `\u20a6 ${Number(n).toLocaleString()}`;

type TabKey = "deceased" | "units" | "autopsies" | "billing";

const SOURCE_LABEL: Record<string, string> = { IN_HOSPITAL: "In-hospital", BROUGHT_IN: "Brought-in" };
const UNIT_TYPE_OPTIONS = [
  { value: "COLD_CHAMBER", label: "Cold chamber" },
  { value: "FREEZER", label: "Freezer" },
  { value: "SHELF", label: "Shelf" },
  { value: "OTHER", label: "Other" },
];

function statusTone(s: string) {
  switch (s) {
    case "IN_STORAGE":
      return "info" as const;
    case "REGISTERED":
      return "warning" as const;
    case "RELEASED":
      return "success" as const;
    case "TRANSFERRED":
      return "neutral" as const;
    default:
      return "neutral" as const;
  }
}
function unitTone(s: string) {
  switch (s) {
    case "AVAILABLE":
      return "success" as const;
    case "PARTIAL":
      return "info" as const;
    case "FULL":
      return "warning" as const;
    case "OUT_OF_SERVICE":
      return "danger" as const;
    default:
      return "neutral" as const;
  }
}

const EMPTY_REGISTER: RegisterDeceasedPayload = {
  source: "IN_HOSPITAL",
  deceased_name: "",
  is_police_case: false,
};

/**
 * Mortuary / morgue management. Register deceased persons — both patients who
 * died in the hospital and bodies brought in from outside — assign them to
 * cold-storage units, and release or transfer them to next of kin.
 */
export function MortuaryPage() {
  const toast = useToast();
  const qc = useQueryClient();

  const navigate = useNavigate();
  const location = useLocation();
  const tab: TabKey = location.pathname.endsWith("/units")
    ? "units"
    : location.pathname.endsWith("/autopsies")
      ? "autopsies"
      : location.pathname.endsWith("/billing")
        ? "billing"
        : "deceased";
  const tabRoute: Record<TabKey, string> = {
    deceased: routes.mortuary,
    units: routes.mortuaryUnits,
    autopsies: routes.mortuaryAutopsies,
    billing: routes.mortuaryBilling,
  };
  const setTab = (k: TabKey) => navigate(tabRoute[k]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");

  // Dialog state
  const [registerOpen, setRegisterOpen] = useState(false);
  const [registerForm, setRegisterForm] = useState<RegisterDeceasedPayload>(EMPTY_REGISTER);
  const [assignFor, setAssignFor] = useState<DeceasedRecord | null>(null);
  const [assignUnitId, setAssignUnitId] = useState("");
  const [releaseFor, setReleaseFor] = useState<DeceasedRecord | null>(null);
  const EMPTY_RELEASE = { released_to_name: "", released_to_relationship: "", released_to_contact: "", release_authorized_by: "", release_notes: "", transfer: false, storage_daily_rate: "", pay_amount: "", pay_method: "CASH", pay_reference: "", waive: false, waiver_reason: "" };
  const [releaseForm, setReleaseForm] = useState(EMPTY_RELEASE);
  const [unitOpen, setUnitOpen] = useState(false);
  const [unitForm, setUnitForm] = useState({ code: "", name: "", unit_type: "COLD_CHAMBER", capacity: "1", location: "", notes: "" });

  // ---------- Data ----------
  const statsQuery = useQuery({ queryKey: ["mortuary", "stats"], queryFn: mortuaryApi.getStats });
  const deceasedQuery = useQuery({
    queryKey: ["mortuary", "deceased", { statusFilter, sourceFilter }],
    queryFn: () => mortuaryApi.listDeceased({ limit: 200, status: statusFilter || undefined, source: sourceFilter || undefined }),
  });
  const unitsQuery = useQuery({ queryKey: ["mortuary", "units"], queryFn: () => mortuaryApi.listUnits({ limit: 200 }) });
  const pendingDeathsQuery = useQuery({ queryKey: ["mortuary", "pending-deaths"], queryFn: mortuaryApi.listPendingDeaths });
  const autopsiesQuery = useQuery({ queryKey: ["mortuary", "autopsies"], queryFn: () => mortuaryApi.listAutopsies(), enabled: location.pathname.endsWith("/autopsies") });
  const chargesQuery = useQuery({ queryKey: ["mortuary", "charges"], queryFn: () => mortuaryApi.listCharges(), enabled: location.pathname.endsWith("/billing") });
  const releaseBillQuery = useQuery({ queryKey: ["mortuary", "deceased", releaseFor?.id, "billing"], queryFn: () => mortuaryApi.getBillingSummary(releaseFor!.id), enabled: releaseFor != null });
  const chargeStatusMut = useMutation({
    mutationFn: ({ id, status }: { id: number; status: "PAID" | "WAIVED" }) => mortuaryApi.setChargeStatus(id, status),
    onSuccess: () => { toast.success("Charge updated"); qc.invalidateQueries({ queryKey: ["mortuary", "charges"] }); },
    onError: (e) => toast.error("Could not update charge", apiErrorMessage(e)),
  });

  const stats = statsQuery.data;
  const units = useMemo(() => unitsQuery.data?.items ?? [], [unitsQuery.data]);
  const unitOptions = useMemo(
    () => units.filter((u) => u.status !== "OUT_OF_SERVICE" && u.available_slots > 0).map((u) => ({ value: String(u.id), label: `${u.name} (${u.available_slots} free)` })),
    [units],
  );

  const pendingDeaths = useMemo<PatientDeath[]>(() => pendingDeathsQuery.data?.items ?? [], [pendingDeathsQuery.data]);
  const pendingDeathOptions = useMemo(
    () =>
      pendingDeaths.map((d) => ({
        value: String(d.id),
        label: `${d.patient_name ?? `Patient #${d.patient_id}`}${d.hospital_number ? ` · ${d.hospital_number}` : ""}${d.visit_code ? ` · ${d.visit_code}` : ""}`,
      })),
    [pendingDeaths],
  );
  const selectedDeath = useMemo(
    () => pendingDeaths.find((d) => d.id === registerForm.death_record_id) ?? null,
    [pendingDeaths, registerForm.death_record_id],
  );
  const selectDeath = (idStr: string) => {
    const d = pendingDeaths.find((x) => String(x.id) === idStr);
    setRegisterForm((f) => ({
      ...f,
      death_record_id: d ? d.id : undefined,
      patient_id: d?.patient_id,
      visit_id: d?.visit_id,
      deceased_name: d?.patient_name ?? "",
      cause_of_death: d?.cause_of_death ?? undefined,
      date_of_death: d?.date_of_death ?? undefined,
    }));
  };

  const records = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = deceasedQuery.data?.items ?? [];
    if (!q) return list;
    return list.filter((r) => `${r.deceased_name} ${r.tag_number}`.toLowerCase().includes(q));
  }, [deceasedQuery.data, search]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["mortuary"] });
  };

  // ---------- Mutations ----------
  const registerMut = useMutation({
    mutationFn: () => mortuaryApi.register(cleanRegister(registerForm)),
    onSuccess: (res) => {
      toast.success("Deceased registered", `${res.record.deceased_name} · ${res.record.tag_number}`);
      setRegisterOpen(false);
      setRegisterForm(EMPTY_REGISTER);
      refresh();
    },
    onError: (e) => toast.error("Could not register", apiErrorMessage(e)),
  });
  const assignMut = useMutation({
    mutationFn: () => mortuaryApi.assignStorage(assignFor!.id, { mortuary_unit_id: Number(assignUnitId) }),
    onSuccess: () => {
      toast.success("Body assigned to storage");
      setAssignFor(null);
      setAssignUnitId("");
      refresh();
    },
    onError: (e) => toast.error("Could not assign storage", apiErrorMessage(e)),
  });
  const releaseMut = useMutation({
    mutationFn: () => {
      const payAmt = Number(releaseForm.pay_amount) || 0;
      const rate = Number(releaseForm.storage_daily_rate) || 0;
      return mortuaryApi.release(releaseFor!.id, {
        released_to_name: releaseForm.released_to_name,
        released_to_relationship: releaseForm.released_to_relationship || undefined,
        released_to_contact: releaseForm.released_to_contact || undefined,
        release_authorized_by: releaseForm.release_authorized_by || undefined,
        release_notes: releaseForm.release_notes || undefined,
        transfer: releaseForm.transfer,
        storage_daily_rate: rate > 0 ? rate : undefined,
        payment: payAmt > 0 ? { amount: payAmt, method: releaseForm.pay_method, reference: releaseForm.pay_reference || undefined, payer_name: releaseForm.released_to_name || undefined } : undefined,
        waive_outstanding: releaseForm.waive || undefined,
        waiver_reason: releaseForm.waive ? (releaseForm.waiver_reason || undefined) : undefined,
      });
    },
    onSuccess: () => {
      toast.success(releaseForm.transfer ? "Body transferred" : "Body released", "Bill settled and body cleared for release.");
      setReleaseFor(null);
      setReleaseForm(EMPTY_RELEASE);
      refresh();
    },
    onError: (e) => toast.error("Could not release", apiErrorMessage(e)),
  });
  const unitMut = useMutation({
    mutationFn: () =>
      mortuaryApi.createUnit({
        code: unitForm.code,
        name: unitForm.name,
        unit_type: unitForm.unit_type as MortuaryUnit["unit_type"],
        capacity: Number(unitForm.capacity) || 1,
        location: unitForm.location || undefined,
        notes: unitForm.notes || undefined,
      }),
    onSuccess: () => {
      toast.success("Storage unit added");
      setUnitOpen(false);
      setUnitForm({ code: "", name: "", unit_type: "COLD_CHAMBER", capacity: "1", location: "", notes: "" });
      refresh();
    },
    onError: (e) => toast.error("Could not add unit", apiErrorMessage(e)),
  });

  // ---------- Columns ----------
  const deceasedColumns: DxGridColumn<DeceasedRecord>[] = [
    { key: "tag_number", header: "Tag", render: (r) => <span className="dx-mono font-semibold">{r.tag_number}</span> },
    {
      key: "deceased_name",
      header: "Deceased",
      render: (r) => (
        <div className="min-w-0">
          <div className="truncate font-semibold text-[var(--dx-text)]">{r.deceased_name}</div>
          <div className="text-[11px] text-[var(--dx-text-muted)]">
            {[r.gender, r.age_years != null ? `${r.age_years} yrs` : null].filter(Boolean).join(" · ") || "—"}
          </div>
        </div>
      ),
    },
    { key: "source", header: "Source", align: "center", render: (r) => <DxBadge tone={r.source === "BROUGHT_IN" ? "accent" : "info"}>{SOURCE_LABEL[r.source] ?? r.source}</DxBadge> },
    { key: "status", header: "Status", align: "center", render: (r) => <DxBadge tone={statusTone(r.status)}>{r.status.replace("_", " ")}</DxBadge> },
    { key: "mortuary_unit_name", header: "Storage", render: (r) => r.mortuary_unit_name ?? <span className="text-[var(--dx-text-faint)]">—</span> },
    { key: "next_of_kin_name", header: "Next of kin", render: (r) => r.next_of_kin_name ?? <span className="text-[var(--dx-text-faint)]">—</span> },
    { key: "registered_at", header: "Registered", render: (r) => formatDateTime(r.registered_at) },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) =>
        r.status === "RELEASED" || r.status === "TRANSFERRED" ? (
          r.is_police_case ? <DxBadge tone="danger" dot>Police</DxBadge> : <span className="text-[var(--dx-text-faint)] text-[11px]">Closed</span>
        ) : (
          <div className="flex items-center justify-end gap-1.5">
            <DxButton size="sm" leftIcon={<Box />} onClick={(e) => { e.stopPropagation(); setAssignFor(r); }}>
              {r.mortuary_unit_id ? "Move" : "Store"}
            </DxButton>
            <DxButton size="sm" variant="outline-danger" leftIcon={<LogOut />} onClick={(e) => { e.stopPropagation(); setReleaseFor(r); }}>
              Release
            </DxButton>
          </div>
        ),
    },
  ];

  const unitColumns: DxGridColumn<MortuaryUnit>[] = [
    { key: "code", header: "Code", render: (u) => <span className="dx-mono font-semibold">{u.code}</span> },
    { key: "name", header: "Name" },
    { key: "unit_type", header: "Type", align: "center", render: (u) => <DxBadge tone="neutral">{u.unit_type.replace("_", " ")}</DxBadge> },
    { key: "occupied", header: "Occupancy", align: "center", render: (u) => `${u.occupied} / ${u.capacity}` },
    { key: "available_slots", header: "Free", align: "center" },
    { key: "location", header: "Location", render: (u) => u.location ?? <span className="text-[var(--dx-text-faint)]">—</span> },
    { key: "status", header: "Status", align: "center", render: (u) => <DxBadge tone={unitTone(u.status)}>{u.status.replace("_", " ")}</DxBadge> },
  ];

  const autopsyColumns: DxGridColumn<Autopsy>[] = [
    { key: "deceased", header: "Deceased", render: (a) => (
      <div className="min-w-0">
        <div className="truncate font-semibold text-[var(--dx-text)]">{a.deceased_name ?? `Record #${a.deceased_record_id}`}</div>
        <div className="dx-mono text-[11px] text-[var(--dx-text-muted)]">{a.tag_number ?? ""}</div>
      </div>
    ) },
    { key: "autopsy_type", header: "Type", align: "center", render: (a) => <DxBadge tone={a.autopsy_type === "MEDICO_LEGAL" ? "danger" : "info"}>{a.autopsy_type.replace("_", " ")}</DxBadge> },
    { key: "status", header: "Status", align: "center", render: (a) => <DxBadge tone={a.status === "COMPLETED" ? "success" : a.status === "CANCELLED" ? "neutral" : a.status === "SCHEDULED" ? "info" : "warning"}>{a.status}</DxBadge> },
    { key: "pathologist", header: "Pathologist", render: (a) => a.pathologist ?? <span className="text-[var(--dx-text-faint)]">—</span> },
    { key: "when", header: "Scheduled / performed", render: (a) => formatDateTime(a.performed_at ?? a.scheduled_at) },
  ];

  const chargeColumns: DxGridColumn<Charge>[] = [
    { key: "deceased", header: "Deceased", render: (c) => (
      <div className="min-w-0">
        <div className="truncate font-semibold text-[var(--dx-text)]">{c.deceased_name ?? `Record #${c.deceased_record_id}`}</div>
        <div className="dx-mono text-[11px] text-[var(--dx-text-muted)]">{c.tag_number ?? ""}</div>
      </div>
    ) },
    { key: "charge_type", header: "Type", align: "center", render: (c) => <DxBadge tone="neutral">{c.charge_type.replace("_", " ")}</DxBadge> },
    { key: "description", header: "Description", render: (c) => c.description ?? <span className="text-[var(--dx-text-faint)]">—</span> },
    { key: "amount", header: "Amount", align: "right", render: (c) => `₦ ${Number(c.amount).toLocaleString()}` },
    { key: "status", header: "Status", align: "center", render: (c) => <DxBadge tone={c.status === "PAID" ? "success" : c.status === "WAIVED" ? "neutral" : "warning"}>{c.status}</DxBadge> },
    { key: "actions", header: "", align: "right", render: (c) =>
      c.status === "PENDING" ? (
        <div className="flex items-center justify-end gap-1.5">
          <DxButton size="sm" leftIcon={<CheckCircle2 />} onClick={() => chargeStatusMut.mutate({ id: c.id, status: "PAID" })}>Paid</DxButton>
          <DxButton size="sm" variant="text" onClick={() => chargeStatusMut.mutate({ id: c.id, status: "WAIVED" })}>Waive</DxButton>
        </div>
      ) : <span className="text-[var(--dx-text-faint)] text-[11px]">Settled</span>
    },
  ];

  const broughtIn = registerForm.source === "BROUGHT_IN";
  const setReg = (k: keyof RegisterDeceasedPayload) => (e: { target: { value: string } }) =>
    setRegisterForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <DxPage>
      <DxPageHeader
        title="Mortuary"
        subtitle="Register deceased persons, manage cold-storage units, and release bodies to next of kin."
        actions={
          <>
            {tab === "units" ? (
              <DxButton variant="primary" leftIcon={<Plus />} onClick={() => setUnitOpen(true)}>
                Add storage unit
              </DxButton>
            ) : (
              <DxButton variant="primary" leftIcon={<UserPlus />} onClick={() => { setRegisterForm(EMPTY_REGISTER); setRegisterOpen(true); }}>
                Register deceased
              </DxButton>
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <DxKpi label="In storage" value={stats?.in_storage ?? 0} icon={Snowflake} tone="info" isLoading={statsQuery.isLoading} sub="bodies held" />
        <DxKpi label="Registered" value={stats?.registered ?? 0} icon={Archive} tone="warning" isLoading={statsQuery.isLoading} sub="awaiting storage" />
        <DxKpi label="In-hospital" value={stats?.in_hospital_total ?? 0} icon={BriefcaseMedical} tone="accent" isLoading={statsQuery.isLoading} sub="died in hospital" />
        <DxKpi label="Brought-in" value={stats?.brought_in_total ?? 0} icon={UserPlus} tone="neutral" isLoading={statsQuery.isLoading} sub="from outside" />
        <DxKpi label="Police cases" value={stats?.police_cases ?? 0} icon={ShieldAlert} tone="danger" isLoading={statsQuery.isLoading} sub="medico-legal" />
        <DxKpi label="Capacity" value={`${stats?.occupied_total ?? 0}/${stats?.capacity_total ?? 0}`} icon={Box} tone="success" isLoading={statsQuery.isLoading} sub={`${stats?.units_total ?? 0} units`} />
      </div>

      <DxTabs<TabKey>
        value={tab}
        onChange={setTab}
        className="mt-4 mb-3"
        items={[
          { key: "deceased", label: "Deceased records", icon: <Archive />, count: records.length },
          { key: "units", label: "Storage units", icon: <Snowflake />, count: units.length },
          { key: "autopsies", label: "Autopsies", icon: <Scissors /> },
          { key: "billing", label: "Billing", icon: <Receipt /> },
        ]}
      />

      {tab === "deceased" ? (
        <>
          <DxToolbar attached>
            <DxSearchBox onSearch={setSearch} placeholder="Name or tag number…" className="w-72" />
            <DxToolbarSeparator />
            <DxSelect editorSize="sm" aria-label="Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-40"
              options={[{ value: "", label: "All statuses" }, { value: "REGISTERED", label: "Registered" }, { value: "IN_STORAGE", label: "In storage" }, { value: "RELEASED", label: "Released" }, { value: "TRANSFERRED", label: "Transferred" }]} />
            <DxSelect editorSize="sm" aria-label="Source" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="w-40"
              options={[{ value: "", label: "All sources" }, { value: "IN_HOSPITAL", label: "In-hospital" }, { value: "BROUGHT_IN", label: "Brought-in" }]} />
            <DxToolbarSpacer />
          </DxToolbar>
          <DxGrid
            columns={deceasedColumns}
            data={records}
            rowKey={(r) => r.id}
            onRowClick={(r) => navigate(routes.mortuaryDeceasedDetail.replace(":recordId", String(r.id)))}
            isLoading={deceasedQuery.isLoading}
            error={deceasedQuery.isError ? apiErrorMessage(deceasedQuery.error) : null}
            empty={{ icon: Archive, title: "No deceased records", description: "Register a patient who died in the hospital, or a body brought in from outside." }}
          />
        </>
      ) : tab === "units" ? (
        <DxGrid
          columns={unitColumns}
          data={units}
          rowKey={(u) => u.id}
          isLoading={unitsQuery.isLoading}
          error={unitsQuery.isError ? apiErrorMessage(unitsQuery.error) : null}
          onRetry={() => unitsQuery.refetch()}
          empty={{ icon: Snowflake, title: "No storage units", description: "Add cold chambers, freezers or shelves to hold bodies." }}
        />
      ) : tab === "autopsies" ? (
        <DxGrid<Autopsy>
          columns={autopsyColumns}
          data={autopsiesQuery.data?.items ?? []}
          rowKey={(a) => a.id}
          onRowClick={(a) => navigate(routes.mortuaryDeceasedDetail.replace(":recordId", String(a.deceased_record_id)))}
          isLoading={autopsiesQuery.isLoading}
          error={autopsiesQuery.isError ? apiErrorMessage(autopsiesQuery.error) : null}
          onRetry={() => autopsiesQuery.refetch()}
          empty={{ icon: Scissors, title: "No autopsies", description: "Request a post-mortem from a deceased record." }}
        />
      ) : (
        <DxGrid<Charge>
          columns={chargeColumns}
          data={chargesQuery.data?.items ?? []}
          rowKey={(c) => c.id}
          isLoading={chargesQuery.isLoading}
          error={chargesQuery.isError ? apiErrorMessage(chargesQuery.error) : null}
          onRetry={() => chargesQuery.refetch()}
          empty={{ icon: Receipt, title: "No charges", description: "Add storage, embalming or autopsy charges from a deceased record." }}
        />
      )}

      <DxStatusBar>
        <DxStatusItem>In storage: <b>{stats?.in_storage ?? 0}</b></DxStatusItem>
        <DxStatusItem>Units: <b>{stats?.units_total ?? 0}</b></DxStatusItem>
        <DxStatusItem>Capacity: <b>{stats?.occupied_total ?? 0}/{stats?.capacity_total ?? 0}</b></DxStatusItem>
      </DxStatusBar>

      {/* ---------- Register deceased ---------- */}
      <DxPopup
        isOpen={registerOpen}
        onClose={() => setRegisterOpen(false)}
        title="Register deceased"
        size="lg"
        locked={registerMut.isPending}
        footer={
          <>
            <DxButton onClick={() => setRegisterOpen(false)} disabled={registerMut.isPending}>Cancel</DxButton>
            <DxButton variant="primary" leftIcon={<UserPlus />} isLoading={registerMut.isPending} disabled={broughtIn ? !registerForm.deceased_name.trim() : !registerForm.death_record_id} onClick={() => registerMut.mutate()}>
              Register
            </DxButton>
          </>
        }
      >
        <DxForm cols={2}>
          <DxSelect label="Source" fieldClassName="dx-col-span-full" value={registerForm.source} onChange={(e) => setRegisterForm({ ...EMPTY_REGISTER, source: e.target.value as RegisterDeceasedPayload["source"] })}
            options={[{ value: "IN_HOSPITAL", label: "Patient who died in the hospital" }, { value: "BROUGHT_IN", label: "Body brought in from outside" }]} />

          {broughtIn ? (
            <>
              <DxInput label="Brought in by" value={registerForm.brought_in_by ?? ""} onChange={setReg("brought_in_by")} placeholder="Person / undertaker" />
              <DxInput label="From location" value={registerForm.from_location ?? ""} onChange={setReg("from_location")} placeholder="Home, scene, other facility…" />
              <DxInput label="Deceased name" required value={registerForm.deceased_name} onChange={setReg("deceased_name")} placeholder="Full name" />
              <DxInput label="Contact phone" value={registerForm.brought_in_contact ?? ""} onChange={setReg("brought_in_contact")} />
              <DxSelect label="Gender" value={registerForm.gender ?? ""} onChange={setReg("gender")} placeholder="Select gender" options={[{ value: "Male", label: "Male" }, { value: "Female", label: "Female" }]} />
              <DxInput label="Age (years)" type="number" value={registerForm.age_years ?? ""} onChange={(e) => setRegisterForm((f) => ({ ...f, age_years: e.target.value ? Number(e.target.value) : undefined }))} />
              <DxInput label="Date / time of death" type="datetime-local" value={registerForm.date_of_death ?? ""} onChange={setReg("date_of_death")} />
              <DxInput label="Cause of death" value={registerForm.cause_of_death ?? ""} onChange={setReg("cause_of_death")} />
            </>
          ) : (
            <>
              <DxSelect label="Deceased patient" required fieldClassName="dx-col-span-full"
                value={registerForm.death_record_id ? String(registerForm.death_record_id) : ""}
                onChange={(e) => selectDeath(e.target.value)}
                placeholder="Select a deceased patient awaiting deposit"
                options={pendingDeathOptions}
                hint={pendingDeathOptions.length ? "Patients recorded deceased and not yet deposited at the mortuary." : "No pending deceased patients — record a death from the patient's visit first."} />
              <DxInput label="Visit" readOnly value={selectedDeath?.visit_code ?? (registerForm.visit_id ? `#${registerForm.visit_id}` : "")} hint="Auto-filled from the visit where death was declared." />
              <DxInput label="Deceased name" readOnly value={registerForm.deceased_name} />
              <DxInput label="Cause of death" readOnly fieldClassName="dx-col-span-full" value={registerForm.cause_of_death ?? ""} />
            </>
          )}

          <DxInput label="Next of kin" value={registerForm.next_of_kin_name ?? ""} onChange={setReg("next_of_kin_name")} />
          <DxInput label="Next of kin phone" value={registerForm.next_of_kin_phone ?? ""} onChange={setReg("next_of_kin_phone")} />
          <DxInput label="Relationship" value={registerForm.next_of_kin_relationship ?? ""} onChange={setReg("next_of_kin_relationship")} />

          <DxSelect label="Place in storage now (optional)" value={registerForm.mortuary_unit_id ? String(registerForm.mortuary_unit_id) : ""} onChange={(e) => setRegisterForm((f) => ({ ...f, mortuary_unit_id: e.target.value ? Number(e.target.value) : undefined }))}
            options={[{ value: "", label: "Not yet — register only" }, ...unitOptions]} />

          <DxCheckbox label="Police / medico-legal case" checked={!!registerForm.is_police_case} onChange={(e) => setRegisterForm((f) => ({ ...f, is_police_case: (e.target as HTMLInputElement).checked }))} />
          {registerForm.is_police_case ? <DxInput label="Police reference" value={registerForm.police_reference ?? ""} onChange={setReg("police_reference")} /> : null}

          <DxTextarea label="Notes" fieldClassName="dx-col-span-full" rows={2} value={registerForm.notes ?? ""} onChange={setReg("notes")} />
        </DxForm>
      </DxPopup>

      {/* ---------- Assign storage ---------- */}
      <DxPopup
        isOpen={assignFor != null}
        onClose={() => setAssignFor(null)}
        title={`Assign storage — ${assignFor?.deceased_name ?? ""}`}
        locked={assignMut.isPending}
        footer={
          <>
            <DxButton onClick={() => setAssignFor(null)} disabled={assignMut.isPending}>Cancel</DxButton>
            <DxButton variant="primary" leftIcon={<Box />} isLoading={assignMut.isPending} disabled={!assignUnitId} onClick={() => assignMut.mutate()}>Assign</DxButton>
          </>
        }
      >
        <DxForm cols={1}>
          <DxSelect label="Storage unit" required value={assignUnitId} onChange={(e) => setAssignUnitId(e.target.value)} placeholder="Select a unit with free space" options={unitOptions} hint={unitOptions.length ? undefined : "No units with free capacity — add or free one first."} />
        </DxForm>
      </DxPopup>

      {/* ---------- Release / transfer (with settlement) ---------- */}
      {(() => {
        const bill = releaseBillQuery.data;
        const outstandingNow = bill ? Number(bill.outstanding) : 0;
        const daysHeld = bill?.days_in_storage ?? 0;
        const rate = Number(releaseForm.storage_daily_rate) || 0;
        const hasStorageCharge = (bill?.charges ?? []).some((c) => c.charge_type === "STORAGE");
        const storageAddition = rate > 0 && !hasStorageCharge ? rate * Math.max(daysHeld, 1) : 0;
        const payAmt = Number(releaseForm.pay_amount) || 0;
        const projected = Math.max(outstandingNow + storageAddition - payAmt, 0);
        const cleared = projected <= 0 || releaseForm.waive;
        const canRelease = !!releaseForm.released_to_name.trim() && cleared && !releaseBillQuery.isLoading;
        return (
          <DxPopup
            isOpen={releaseFor != null}
            onClose={() => setReleaseFor(null)}
            title={`${releaseForm.transfer ? "Transfer" : "Release"} — ${releaseFor?.deceased_name ?? ""}`}
            size="lg"
            locked={releaseMut.isPending}
            footer={
              <>
                <DxButton onClick={() => setReleaseFor(null)} disabled={releaseMut.isPending}>Cancel</DxButton>
                <DxButton variant="primary" leftIcon={<LogOut />} isLoading={releaseMut.isPending} disabled={!canRelease} onClick={() => releaseMut.mutate()}>
                  {releaseForm.transfer ? "Transfer" : "Release"}
                </DxButton>
              </>
            }
          >
            <div className="mb-3 rounded-xl border border-[var(--dx-border)] bg-[var(--dx-surface-alt)] p-3">
              {releaseBillQuery.isLoading ? (
                <span className="text-[12px] text-[var(--dx-text-muted)]">Loading bill…</span>
              ) : (
                <div className="grid grid-cols-2 gap-2 text-[12px] sm:grid-cols-4">
                  <div><div className="dx-caption">Billed</div><div className="font-semibold">{naira(bill?.total_billed ?? 0)}</div></div>
                  <div><div className="dx-caption">Paid</div><div className="font-semibold">{naira(bill?.total_paid ?? 0)}</div></div>
                  <div><div className="dx-caption">Outstanding</div><div className={`font-semibold ${projected > 0 ? "text-[var(--dx-danger)]" : "text-[var(--dx-success)]"}`}>{naira(projected)}</div></div>
                  <div><div className="dx-caption">Days held</div><div className="font-semibold">{daysHeld}</div></div>
                </div>
              )}
            </div>
            <DxForm cols={2}>
              <DxInput label="Released to" required fieldClassName="dx-col-span-full" value={releaseForm.released_to_name} onChange={(e) => setReleaseForm((f) => ({ ...f, released_to_name: e.target.value }))} placeholder="Name of recipient / undertaker" />
              <DxInput label="Relationship" value={releaseForm.released_to_relationship} onChange={(e) => setReleaseForm((f) => ({ ...f, released_to_relationship: e.target.value }))} />
              <DxInput label="Contact" value={releaseForm.released_to_contact} onChange={(e) => setReleaseForm((f) => ({ ...f, released_to_contact: e.target.value }))} />
              <DxInput label="Authorized by" fieldClassName="dx-col-span-full" value={releaseForm.release_authorized_by} onChange={(e) => setReleaseForm((f) => ({ ...f, release_authorized_by: e.target.value }))} placeholder="Officer / doctor authorising release" />

              <DxInput label="Storage fee / day (₦)" type="number" value={releaseForm.storage_daily_rate} onChange={(e) => setReleaseForm((f) => ({ ...f, storage_daily_rate: e.target.value }))} hint={hasStorageCharge ? "Storage already billed" : daysHeld ? `${daysHeld} day(s) → ${naira(storageAddition)}` : undefined} />
              <DxSelect label="Payment method" value={releaseForm.pay_method} onChange={(e) => setReleaseForm((f) => ({ ...f, pay_method: e.target.value }))} options={[{ value: "CASH", label: "Cash" }, { value: "POS", label: "POS" }, { value: "TRANSFER", label: "Transfer" }, { value: "CARD", label: "Card" }, { value: "HMO", label: "HMO" }]} />
              <DxInput label="Amount collected (₦)" type="number" value={releaseForm.pay_amount} onChange={(e) => setReleaseForm((f) => ({ ...f, pay_amount: e.target.value }))} hint={projected > 0 && payAmt > 0 ? `${naira(projected)} would remain` : undefined} />
              <DxInput label="Payment reference" value={releaseForm.pay_reference} onChange={(e) => setReleaseForm((f) => ({ ...f, pay_reference: e.target.value }))} />

              <DxTextarea label="Release notes" fieldClassName="dx-col-span-full" rows={2} value={releaseForm.release_notes} onChange={(e) => setReleaseForm((f) => ({ ...f, release_notes: e.target.value }))} />
              <DxCheckbox className="dx-col-span-full" label="Transfer to another facility (instead of release to next of kin)" checked={releaseForm.transfer} onChange={(e) => setReleaseForm((f) => ({ ...f, transfer: (e.target as HTMLInputElement).checked }))} />
              <DxCheckbox className="dx-col-span-full" label="Waive the outstanding balance (requires an authoriser above)" checked={releaseForm.waive} onChange={(e) => setReleaseForm((f) => ({ ...f, waive: (e.target as HTMLInputElement).checked }))} />
              {releaseForm.waive ? (
                <DxInput label="Waiver reason" fieldClassName="dx-col-span-full" value={releaseForm.waiver_reason} onChange={(e) => setReleaseForm((f) => ({ ...f, waiver_reason: e.target.value }))} />
              ) : null}
              {projected > 0 && !releaseForm.waive ? (
                <div className="dx-col-span-full rounded-lg border border-[var(--dx-warning)] bg-[var(--dx-warning-soft)] px-3 py-2 text-[12px] text-[var(--dx-warning)]">
                  {naira(projected)} outstanding — collect payment or waive the balance to release.
                </div>
              ) : null}
            </DxForm>
          </DxPopup>
        );
      })()}

      {/* ---------- Add storage unit ---------- */}
      <DxPopup
        isOpen={unitOpen}
        onClose={() => setUnitOpen(false)}
        title="Add storage unit"
        locked={unitMut.isPending}
        footer={
          <>
            <DxButton onClick={() => setUnitOpen(false)} disabled={unitMut.isPending}>Cancel</DxButton>
            <DxButton variant="primary" leftIcon={<Plus />} isLoading={unitMut.isPending} disabled={!unitForm.code.trim() || !unitForm.name.trim()} onClick={() => unitMut.mutate()}>Add unit</DxButton>
          </>
        }
      >
        <DxForm cols={2}>
          <DxInput label="Code" required value={unitForm.code} onChange={(e) => setUnitForm((f) => ({ ...f, code: e.target.value }))} placeholder="CC-01" />
          <DxInput label="Name" required value={unitForm.name} onChange={(e) => setUnitForm((f) => ({ ...f, name: e.target.value }))} placeholder="Cold Chamber 1" />
          <DxSelect label="Type" value={unitForm.unit_type} onChange={(e) => setUnitForm((f) => ({ ...f, unit_type: e.target.value }))} options={UNIT_TYPE_OPTIONS} />
          <DxInput label="Capacity" type="number" value={unitForm.capacity} onChange={(e) => setUnitForm((f) => ({ ...f, capacity: e.target.value }))} />
          <DxInput label="Location" fieldClassName="dx-col-span-full" leftIcon={<MapPin className="h-3.5 w-3.5" />} value={unitForm.location} onChange={(e) => setUnitForm((f) => ({ ...f, location: e.target.value }))} placeholder="Mortuary wing, ground floor" />
          <DxTextarea label="Notes" fieldClassName="dx-col-span-full" rows={2} value={unitForm.notes} onChange={(e) => setUnitForm((f) => ({ ...f, notes: e.target.value }))} />
        </DxForm>
      </DxPopup>
    </DxPage>
  );
}

function cleanRegister(f: RegisterDeceasedPayload): RegisterDeceasedPayload {
  const out: RegisterDeceasedPayload = { source: f.source, deceased_name: f.deceased_name.trim(), is_police_case: !!f.is_police_case };
  const copy: (keyof RegisterDeceasedPayload)[] = [
    "patient_id", "visit_id", "death_record_id", "gender", "age_years", "date_of_death", "cause_of_death",
    "brought_in_by", "brought_in_contact", "from_location",
    "next_of_kin_name", "next_of_kin_phone", "next_of_kin_relationship",
    "police_reference", "mortuary_unit_id", "notes",
  ];
  for (const k of copy) {
    const v = f[k];
    if (v !== undefined && v !== null && v !== "") (out as Record<string, unknown>)[k] = v;
  }
  if (f.source === "IN_HOSPITAL") { delete out.brought_in_by; delete out.brought_in_contact; delete out.from_location; }
  else { delete out.patient_id; delete out.visit_id; }
  if (!out.is_police_case) delete out.police_reference;
  return out;
}
