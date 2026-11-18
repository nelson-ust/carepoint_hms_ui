import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { RotateCcw, Search, Glasses, Contact } from "lucide-react";
import {
  DxBadge, DxButton, DxGrid, DxKpi, DxPage, DxPageHeader, DxPageLoading, DxPanel,
  DxPopup, DxInput, DxTabs, type DxGridColumn,
} from "@/components/dx";
import { routes } from "@/config/routes";
import {
  eyeApi, type SpectaclePrescription, type ContactLensPrescription,
} from "../api/eye.api";

type Tab = "glasses" | "contacts";
const fmt = (v?: string | number | null) => (v === null || v === undefined || v === "" ? "—" : String(v));
const dstr = (s?: string | null) => (s ? new Date(s).toLocaleDateString() : "—");

function RxEyeTable({ rows }: { rows: { eye: string; sphere?: string | null; cyl?: string | null; axis?: number | null; add?: string | null; extra?: string | null }[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--dx-border)]">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="bg-[var(--dx-surface-sunken)] text-left text-[11px] uppercase tracking-wide text-[var(--dx-text-muted)]">
            <th className="px-3 py-2 font-semibold">Eye</th>
            <th className="px-3 py-2 text-right font-semibold">Sphere</th>
            <th className="px-3 py-2 text-right font-semibold">Cyl</th>
            <th className="px-3 py-2 text-right font-semibold">Axis</th>
            <th className="px-3 py-2 text-right font-semibold">Add</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--dx-border)]">
          {rows.map((r) => (
            <tr key={r.eye}>
              <td className="px-3 py-2 font-semibold">{r.eye}</td>
              <td className="px-3 py-2 text-right dx-mono">{fmt(r.sphere)}</td>
              <td className="px-3 py-2 text-right dx-mono">{fmt(r.cyl)}</td>
              <td className="px-3 py-2 text-right dx-mono">{fmt(r.axis)}</td>
              <td className="px-3 py-2 text-right dx-mono">{fmt(r.add)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EyePrescriptionsPage() {
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>("glasses");
  const [search, setSearch] = useState("");
  const [glasses, setGlasses] = useState<SpectaclePrescription | null>(null);
  const [contacts, setContacts] = useState<ContactLensPrescription | null>(null);

  const glassesQ = useQuery({ queryKey: ["eye", "prescriptions", "all"], queryFn: () => eyeApi.listPrescriptions({ limit: 300 }) });
  const contactsQ = useQuery({ queryKey: ["eye", "contact-lens", "all"], queryFn: () => eyeApi.listContactLens({ limit: 300 }) });

  const term = search.trim().toLowerCase();

  const glassesRows = useMemo(
    () => (glassesQ.data?.items ?? []).filter(
      (r) => !term || `${r.patient?.name ?? ""} ${r.patient?.hospital_number ?? ""}`.toLowerCase().includes(term),
    ),
    [glassesQ.data, term],
  );
  const contactsRows = useMemo(
    () => contactsQ.data?.items ?? [],
    [contactsQ.data],
  );

  const glassesCols: DxGridColumn<SpectaclePrescription>[] = [
    { key: "patient", header: "Patient", render: (r) => (
      <div className="min-w-0"><div className="truncate font-semibold">{r.patient?.name ?? `Patient #${r.patient_id}`}</div>
        <div className="text-[11.5px] text-[var(--dx-text-muted)]">{r.patient?.hospital_number}</div></div>
    ) },
    { key: "lens_type", header: "Lens", render: (r) => <DxBadge tone="accent">{r.lens_type?.replace(/_/g, " ")}</DxBadge> },
    { key: "rx", header: "OD / OS (sph)", render: (r) => <span className="dx-mono text-[12.5px]">{fmt(r.od_sphere)} / {fmt(r.os_sphere)}</span> },
    { key: "pd", header: "PD", align: "right", render: (r) => <span className="dx-mono">{fmt(r.pd)}</span> },
    { key: "prescribed_date", header: "Date", render: (r) => dstr(r.prescribed_date) },
    { key: "actions", header: "", align: "right", render: (r) => <DxButton size="sm" variant="text" onClick={(e) => { e.stopPropagation(); setGlasses(r); }}>Open</DxButton> },
  ];

  const contactsCols: DxGridColumn<ContactLensPrescription>[] = [
    { key: "patient", header: "Patient", render: (r) => <div className="font-semibold">Patient #{r.patient_id}</div> },
    { key: "modality", header: "Modality", render: (r) => <DxBadge tone="info">{fmt(r.modality)}</DxBadge> },
    { key: "rx", header: "OD / OS (sph)", render: (r) => <span className="dx-mono text-[12.5px]">{fmt(r.od_sphere)} / {fmt(r.os_sphere)}</span> },
    { key: "bc", header: "BC / Dia", render: (r) => <span className="dx-mono text-[12.5px]">{fmt(r.od_base_curve)} / {fmt(r.od_diameter)}</span> },
    { key: "prescribed_date", header: "Date", render: (r) => dstr(r.prescribed_date) },
    { key: "actions", header: "", align: "right", render: (r) => <DxButton size="sm" variant="text" onClick={(e) => { e.stopPropagation(); setContacts(r); }}>Open</DxButton> },
  ];

  if (glassesQ.isLoading || contactsQ.isLoading) return <DxPageLoading label="Loading prescriptions..." />;

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Eye Clinic" }, { label: "Prescriptions" }]}
        title="Prescriptions"
        subtitle="Every glasses and contact-lens prescription issued across the clinic — ready to review or dispense."
        actions={
          <DxButton icon title="Refresh" onClick={() => { glassesQ.refetch(); contactsQ.refetch(); }} isLoading={glassesQ.isFetching || contactsQ.isFetching}><RotateCcw /></DxButton>
        }
      />

      <div className="grid grid-cols-2 gap-3">
        <DxKpi label="Glasses prescriptions" value={glassesQ.data?.count ?? glassesRows.length} icon={Glasses} tone="accent" />
        <DxKpi label="Contact-lens prescriptions" value={contactsQ.data?.count ?? contactsRows.length} icon={Contact} tone="info" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <DxTabs<Tab>
          value={tab}
          onChange={setTab}
          items={[
            { key: "glasses", label: "Glasses", icon: <Glasses className="h-4 w-4" />, count: glassesRows.length },
            { key: "contacts", label: "Contact lenses", icon: <Contact className="h-4 w-4" />, count: contactsRows.length },
          ]}
        />
        <div className="w-full sm:w-72">
          <DxInput leftIcon={<Search className="h-4 w-4 text-[var(--dx-text-faint)]" />} placeholder="Filter by patient" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {tab === "glasses" ? (
        <DxPanel title="Glasses prescriptions" icon={<Glasses />} flush>
          <DxGrid<SpectaclePrescription>
            borderless columns={glassesCols} data={glassesRows} rowKey={(r) => r.id} onRowClick={(r) => setGlasses(r)}
            empty={{ icon: Glasses, title: "No glasses prescriptions", description: "Spectacle prescriptions written during an eye exam appear here." }}
          />
        </DxPanel>
      ) : (
        <DxPanel title="Contact-lens prescriptions" icon={<Contact />} flush>
          <DxGrid<ContactLensPrescription>
            borderless columns={contactsCols} data={contactsRows} rowKey={(r) => r.id} onRowClick={(r) => setContacts(r)}
            empty={{ icon: Contact, title: "No contact-lens prescriptions", description: "Contact-lens prescriptions issued during an eye exam appear here." }}
          />
        </DxPanel>
      )}

      {/* Glasses detail */}
      <DxPopup
        isOpen={glasses !== null}
        onClose={() => setGlasses(null)}
        title={glasses ? `Glasses Rx · ${glasses.patient?.name ?? `Patient #${glasses.patient_id}`}` : "Prescription"}
        size="md"
        footer={
          <>
            <DxButton variant="text" onClick={() => setGlasses(null)}>Close</DxButton>
            <DxButton variant="primary" leftIcon={<Glasses className="h-4 w-4" />} onClick={() => nav(routes.opticalOrders)}>Dispense</DxButton>
          </>
        }
      >
        {glasses ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-[var(--dx-text-muted)]">
              <DxBadge tone="accent">{glasses.lens_type?.replace(/_/g, " ")}</DxBadge>
              {glasses.usage ? <DxBadge tone="neutral">{glasses.usage}</DxBadge> : null}
              <span>PD {fmt(glasses.pd)}</span>
              <span>· {dstr(glasses.prescribed_date)}</span>
              {glasses.prescriber ? <span>· {glasses.prescriber}</span> : null}
            </div>
            <RxEyeTable rows={[
              { eye: "OD (right)", sphere: glasses.od_sphere, cyl: glasses.od_cyl, axis: glasses.od_axis, add: glasses.od_add },
              { eye: "OS (left)", sphere: glasses.os_sphere, cyl: glasses.os_cyl, axis: glasses.os_axis, add: glasses.os_add },
            ]} />
            {glasses.notes ? <p className="text-[13px] text-[var(--dx-text-muted)]">{glasses.notes}</p> : null}
          </div>
        ) : null}
      </DxPopup>

      {/* Contact-lens detail */}
      <DxPopup
        isOpen={contacts !== null}
        onClose={() => setContacts(null)}
        title={contacts ? `Contact-lens Rx · Patient #${contacts.patient_id}` : "Prescription"}
        size="md"
        footer={<DxButton variant="text" onClick={() => setContacts(null)}>Close</DxButton>}
      >
        {contacts ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-[var(--dx-text-muted)]">
              <DxBadge tone="info">{fmt(contacts.modality)}</DxBadge>
              <span>· {dstr(contacts.prescribed_date)}</span>
              {contacts.prescriber ? <span>· {contacts.prescriber}</span> : null}
            </div>
            <RxEyeTable rows={[
              { eye: "OD (right)", sphere: contacts.od_sphere, cyl: contacts.od_cyl, axis: contacts.od_axis, add: contacts.od_add },
              { eye: "OS (left)", sphere: contacts.os_sphere, cyl: contacts.os_cyl, axis: contacts.os_axis, add: contacts.os_add },
            ]} />
            <div className="grid grid-cols-2 gap-2 text-[12.5px]">
              <div className="rounded-md border border-[var(--dx-border)] px-3 py-2">
                <div className="text-[11px] uppercase tracking-wide text-[var(--dx-text-muted)]">OD base curve / dia / brand</div>
                <div className="dx-mono">{fmt(contacts.od_base_curve)} / {fmt(contacts.od_diameter)} / {fmt(contacts.od_brand)}</div>
              </div>
              <div className="rounded-md border border-[var(--dx-border)] px-3 py-2">
                <div className="text-[11px] uppercase tracking-wide text-[var(--dx-text-muted)]">OS base curve / dia / brand</div>
                <div className="dx-mono">{fmt(contacts.os_base_curve)} / {fmt(contacts.os_diameter)} / {fmt(contacts.os_brand)}</div>
              </div>
            </div>
            {contacts.notes ? <p className="text-[13px] text-[var(--dx-text-muted)]">{contacts.notes}</p> : null}
          </div>
        ) : null}
      </DxPopup>
    </DxPage>
  );
}
