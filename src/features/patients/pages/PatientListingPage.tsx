import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { SearchInput } from "@/components/forms/SearchInput";
import { DataTable, type DataTableColumn } from "@/components/data-table/DataTable";
import { Pagination } from "@/components/data-table/Pagination";
import {
  Plus,
  User,
  Phone,
  MapPin,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { routes } from "@/config/routes";
import { useState, useEffect, useRef, useCallback } from "react";
import { getPatients, searchPatients } from "../api/patients.api";
import type { Patient } from "../api/patients.api";

const PAGE_SIZE = 20;

export function PatientListingPage() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  // Track the latest in-flight request so we can ignore stale responses.
  // React 19's StrictMode double-mounts components in dev, which can cause
  // an aborted first request's catch to overwrite a successful retry's state.
  const requestIdRef = useRef(0);

  const loadPatients = useCallback(async () => {
    const myRequestId = ++requestIdRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const response = search
        ? await searchPatients(search)
        : await getPatients((page - 1) * PAGE_SIZE, PAGE_SIZE);
      // Ignore the response if a newer request has already started or finished
      if (myRequestId !== requestIdRef.current) return;
      // Backend returns PaginatedResponse envelope
      setPatients(response.items || []);
      setMeta(response.meta);
      setError(null); // explicit clear on success in case a stale error sneaks in
    } catch (err: any) {
      // Ignore aborts and superseded requests
      if (myRequestId !== requestIdRef.current) return;
      if (err?.code === "ERR_CANCELED" || err?.name === "CanceledError") return;
      console.error("Failed to load patients", err);
      setError("Unable to connect to patient records. Please check your connection.");
    } finally {
      if (myRequestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [page, search]);

  useEffect(() => {
    loadPatients();
    // Bumping the ref on unmount means any in-flight response that lands
    // after unmount is treated as stale and discarded.
    return () => {
      requestIdRef.current++;
    };
  }, [loadPatients]);

  const goToDetail = (patient: Patient) =>
    navigate(routes.patientDetail.replace(":patientId", String(patient.id)));

  const columns: DataTableColumn<Patient>[] = [
    {
      key: "profile",
      header: "Patient Profile",
      render: (patient) => (
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 text-base font-bold text-white shadow-lg shadow-primary-500/20">
            {patient.first_name?.[0] || "?"}
            {patient.last_name?.[0] || "?"}
          </div>
          <div>
            <p className="text-sm font-bold text-secondary-900">
              {patient.first_name} {patient.last_name}
            </p>
            <p className="mt-0.5 text-[11px] font-bold uppercase tracking-tighter text-secondary-400">
              {patient.gender} •{" "}
              {patient.date_of_birth
                ? `${new Date().getFullYear() - new Date(patient.date_of_birth).getFullYear()} Years`
                : "Age Unknown"}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "hospital_number",
      header: "Hospital ID",
      render: (patient) => (
        <span className="data-mono text-xs font-bold text-secondary-600 dark:text-secondary-300">
          {patient.hospital_number}
        </span>
      ),
    },
    {
      key: "engagement",
      header: "Engagement",
      render: (patient) => (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-bold text-secondary-700">
            <Phone className="h-3.5 w-3.5 text-primary-500" />
            <span>{patient.phone_number}</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-bold text-secondary-400">
            <MapPin className="h-3.5 w-3.5" />
            <span className="max-w-[120px] truncate">{patient.city || "No Address"}</span>
          </div>
        </div>
      ),
    },
    {
      key: "payer_type",
      header: "Payer Type",
      render: (patient) => (
        <Badge variant="soft-success">{patient.payer_type || "OUT-OF-POCKET"}</Badge>
      ),
    },
    {
      key: "operations",
      header: "Operations",
      align: "right",
      render: (patient) => (
        <div className="flex items-center justify-end gap-2">
          <Link
            to={routes.patientDetail.replace(":patientId", String(patient.id))}
            onClick={(e) => e.stopPropagation()}
            className="rounded-xl border border-primary-500/20 p-2.5 text-primary-600 shadow-sm transition-all hover:bg-primary-500/10 dark:text-primary-400"
            title="Patient Dashboard"
          >
            <User className="h-5 w-5" />
          </Link>
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(routes.visitInitiate, { state: { patient } });
            }}
            className="flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-white shadow-lg shadow-primary-500/10 transition-all hover:bg-primary-700"
          >
            <span>Initiate Visit</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <PageHeader
          title="Patient Registry"
          description="Access comprehensive electronic medical records and manage patient onboarding."
        />
        <Link to={routes.patientRegister} className="btn-primary gap-3 py-3 px-8 shadow-xl shadow-primary-500/20">
          <Plus className="h-5 w-5" />
          <span className="font-bold">New Patient</span>
        </Link>
      </div>

      <Card padding="none">
        {/* Filters Bar */}
        <div className="flex flex-wrap items-center gap-3 px-6 py-4">
          <SearchInput
            onSearch={(term) => {
              setSearch(term);
              setPage(1);
            }}
            placeholder="Search by hospital number, name, or phone..."
            className="w-full sm:w-80"
          />
          <button
            onClick={loadPatients}
            className="btn-ghost p-2.5"
            aria-label="Refresh patient list"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Records Table */}
        <DataTable
          columns={columns}
          data={patients}
          rowKey={(patient) => patient.id}
          isLoading={isLoading}
          error={error}
          onRetry={loadPatients}
          onRowClick={goToDetail}
          empty={{
            icon: User,
            title: "Registry is Empty",
            description:
              "No patient records were found in this facility. Start by admitting your first patient to the registry.",
            action: (
              <Link to={routes.patientRegister} className="btn-primary inline-flex items-center gap-2 px-8 py-3">
                <Plus className="h-4 w-4" />
                <span>Admission Form</span>
              </Link>
            ),
          }}
          footer={
            meta ? (
              <Pagination
                page={meta.current_page ?? page}
                totalPages={meta.total_pages}
                totalItems={meta.total}
                pageSize={meta.limit ?? PAGE_SIZE}
                onPageChange={setPage}
              />
            ) : null
          }
        />
      </Card>
    </div>
  );
}
