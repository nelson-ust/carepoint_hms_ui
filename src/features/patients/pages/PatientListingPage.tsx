import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowRight, Plus, RefreshCw, User, Users } from "lucide-react";
import {
  DxAvatar,
  DxBadge,
  DxButton,
  DxGrid,
  DxPage,
  DxPageHeader,
  DxPager,
  DxSearchBox,
  DxStatusBadge,
  DxStatusBar,
  DxStatusItem,
  DxToolbar,
  DxToolbarGroup,
  DxToolbarSeparator,
  DxToolbarSpacer,
  ageFrom,
  apiErrorMessage,
  formatDate,
  humanize,
  type DxGridColumn,
} from "@/components/dx";
import { routes } from "@/config/routes";
import { getPatients, searchPatients, type Patient } from "../api/patients.api";

const PAGE_SIZE_OPTIONS = [20, 50, 100];

function payerTone(p: Patient): "success" | "info" | "warning" | "neutral" {
  const cls = String(p.patient_class ?? p.payer_type ?? "").toUpperCase();
  if (cls.includes("HMO") || cls.includes("INSURANCE")) return "info";
  if (cls.includes("RETAINER") || cls.includes("CORPORATE")) return "warning";
  if (cls.includes("SELF") || cls.includes("CASH") || cls.includes("OUT")) return "success";
  return "neutral";
}

function payerLabel(p: Patient): string {
  const cls = p.patient_class ?? p.payer_type;
  if (!cls) return "Self-pay";
  const u = String(cls).toUpperCase();
  if (u === "SELF_PAY" || u === "CASH" || u === "OUT_OF_POCKET") return "Self-pay";
  if (u === "HMO" || u === "INSURANCE") return "HMO";
  return humanize(cls);
}

/**
 * Patient Registry — the front desk's starting point: find (or register) the
 * patient, then start a visit straight from the row.
 */
export function PatientListingPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");

  const query = useQuery({
    queryKey: ["patients", "registry", { page, pageSize, search }],
    queryFn: () => (search ? searchPatients(search, 50) : getPatients((page - 1) * pageSize, pageSize)),
    placeholderData: keepPreviousData,
  });

  const patients: Patient[] = query.data?.items ?? [];
  const meta = (query.data?.meta ?? {}) as { total?: number; total_pages?: number; current_page?: number; limit?: number; has_next?: boolean };

  const goToDetail = (patient: Patient) => navigate(routes.patientDetail.replace(":patientId", String(patient.id)));
  const startVisit = (patient: Patient) => navigate(routes.visitInitiate, { state: { patient } });

  const columns: DxGridColumn<Patient>[] = [
    {
      key: "hospital_number",
      header: "Hospital no.",
      width: 130,
      sortable: true,
      render: (p) => <span className="dx-mono font-semibold">{p.hospital_number}</span>,
    },
    {
      key: "name",
      header: "Patient",
      sortable: true,
      accessor: (p) => `${p.last_name} ${p.first_name}`,
      render: (p) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <DxAvatar name={`${p.first_name} ${p.last_name}`} />
          <div className="min-w-0">
            <div className="dx-row-primary truncate">
              {p.first_name} {p.middle_name ? `${p.middle_name} ` : ""}
              {p.last_name}
            </div>
            <div className="dx-row-secondary">
              {humanize(p.gender)} · {ageFrom(p.date_of_birth)}
            </div>
          </div>
        </div>
      ),
    },
    { key: "phone_number", header: "Phone", width: 140, render: (p) => <span className="dx-mono">{p.phone_number || "—"}</span> },
    { key: "city", header: "City", width: 140, sortable: true, render: (p) => p.city || <span className="dx-faint">—</span> },
    {
      key: "payer",
      header: "Payer",
      width: 120,
      sortable: true,
      accessor: (p) => payerLabel(p),
      render: (p) => <DxBadge tone={payerTone(p)}>{payerLabel(p)}</DxBadge>,
    },
    { key: "status", header: "Status", width: 110, render: (p) => <DxStatusBadge status={p.status} /> },
    { key: "created_at", header: "Registered", width: 120, sortable: true, render: (p) => <span className="dx-mono">{formatDate(p.created_at)}</span> },
    {
      key: "actions",
      header: "",
      width: 210,
      align: "right",
      render: (p) => (
        <div className="dx-td-actions" onClick={(e) => e.stopPropagation()}>
          <DxButton size="sm" variant="text" leftIcon={<User />} onClick={() => goToDetail(p)} title="Patient record">
            Record
          </DxButton>
          <DxButton size="sm" variant="primary" rightIcon={<ArrowRight />} onClick={() => startVisit(p)}>
            Initiate visit
          </DxButton>
        </div>
      ),
    },
  ];

  return (
    <DxPage>
      <DxPageHeader
        title="Patient Registry"
        subtitle="Every patient with their hospital number, contact and payer type. Start a visit directly from the row."
        actions={
          <Link to={routes.patientRegister} className="dx-btn dx-btn-primary">
            <Plus aria-hidden /> New patient
          </Link>
        }
      />

      <DxToolbar attached>
        <DxToolbarGroup>
          <DxSearchBox
            onSearch={(term) => {
              setSearch(term);
              setPage(1);
            }}
            placeholder="Search by hospital number, name or phone…"
            className="w-80"
            autoFocus
          />
          {search ? <DxBadge tone="accent">Search: “{search}”</DxBadge> : null}
        </DxToolbarGroup>
        <DxToolbarSeparator />
        <DxButton size="sm" variant="text" leftIcon={<RefreshCw className={query.isFetching ? "animate-spin" : undefined} />} onClick={() => query.refetch()}>
          Refresh
        </DxButton>
        <DxToolbarSpacer />
        <Link to={routes.membershipCards} className="dx-btn dx-btn-text dx-btn-sm">
          Membership cards
        </Link>
      </DxToolbar>

      <DxGrid
        attached
        columns={columns}
        data={patients}
        rowKey={(p) => p.id}
        isLoading={query.isLoading}
        error={query.isError ? apiErrorMessage(query.error, "Unable to connect to patient records.") : null}
        onRetry={() => query.refetch()}
        onRowClick={goToDetail}
        filterRow
        empty={{
          icon: Users,
          title: search ? `No patients match “${search}”` : "Registry is empty",
          description: search ? "Try a hospital number, surname or phone number." : "Register your first patient to begin.",
          action: (
            <Link to={routes.patientRegister} className="dx-btn dx-btn-primary dx-btn-sm">
              <Plus aria-hidden /> Register patient
            </Link>
          ),
        }}
        footer={
          search ? (
            <div className="dx-pager">
              <span>
                <b className="dx-strong">{patients.length}</b> result{patients.length === 1 ? "" : "s"} for “{search}”
              </span>
            </div>
          ) : (
            <DxPager
              page={meta.current_page ?? page}
              totalPages={meta.total_pages}
              totalItems={meta.total}
              pageSize={meta.limit ?? pageSize}
              hasNext={meta.has_next}
              onPageChange={setPage}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
              onPageSizeChange={(n) => {
                setPageSize(n);
                setPage(1);
              }}
            />
          )
        }
      />

      <DxStatusBar>
        <DxStatusItem>
          Patients on file: <b>{meta.total ?? patients.length}</b>
        </DxStatusItem>
        <span className="ml-auto">Click a row for the patient record · “Initiate visit” starts the Standard Outpatient Pathway.</span>
      </DxStatusBar>
    </DxPage>
  );
}
