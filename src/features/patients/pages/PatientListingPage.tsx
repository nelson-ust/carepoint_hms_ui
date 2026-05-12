import { PageHeader } from "@/components/layout/PageHeader";
import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  User,
  Phone,
  MapPin,
  ArrowRight,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { routes } from "@/config/routes";
import { useState, useEffect, useRef, useCallback } from "react";
import { getPatients } from "../api/patients.api";
import type { Patient } from "../api/patients.api";

export function PatientListingPage() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track the latest in-flight request so we can ignore stale responses.
  // React 19's StrictMode double-mounts components in dev, which can cause
  // an aborted first request's catch to overwrite a successful retry's state.
  const requestIdRef = useRef(0);

  const loadPatients = useCallback(async () => {
    const myRequestId = ++requestIdRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const response = await getPatients();
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
  }, []);

  useEffect(() => {
    loadPatients();
    // Bumping the ref on unmount means any in-flight response that lands
    // after unmount is treated as stale and discarded.
    return () => {
      requestIdRef.current++;
    };
  }, [loadPatients]);

  return (
    <div className="space-y-10 animate-fade-in pb-20">
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

      <div className="grid gap-8">
        {/* Advanced Filters Bar */}
        <div className="glass-card rounded-[2rem] p-4 flex flex-col md:flex-row gap-4 items-center bg-white/40 backdrop-blur-md">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-secondary-400" />
            <input
              type="text"
              placeholder="Search by hospital number, name, or phone..."
              className="w-full bg-white/50 border-none rounded-2xl pl-14 pr-6 py-4 text-sm focus:ring-2 focus:ring-primary-500/50 transition-all font-medium"
            />
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <button className="btn-secondary flex-1 md:flex-none gap-2 px-6 py-4 rounded-2xl bg-white/80 border-secondary-100">
              <Filter className="h-4 w-4" />
              <span className="text-sm font-bold">Filters</span>
            </button>
            <button onClick={loadPatients} className="btn-secondary p-4 rounded-2xl bg-white/80 border-secondary-100 hover:rotate-180 transition-transform duration-500">
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Records Table */}
        <div className="glass-card rounded-[2.5rem] overflow-hidden border border-secondary-100/50 shadow-premium bg-white/40">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-secondary-900/5">
                  <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500">Patient Profile</th>
                  <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500">Hospital ID</th>
                  <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500">Engagement</th>
                  <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500">Payer Type</th>
                  <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500 text-right">Operations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-100/50">
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={5} className="px-8 py-8">
                        <div className="h-16 bg-secondary-100/30 rounded-2xl w-full" />
                      </td>
                    </tr>
                  ))
                ) : error ? (
                  <tr>
                    <td colSpan={5} className="px-8 py-20 text-center">
                      <div className="max-w-xs mx-auto space-y-4">
                        <AlertCircle className="h-12 w-12 mx-auto text-rose-500/50" />
                        <p className="text-secondary-600 font-bold">{error}</p>
                        <button onClick={loadPatients} className="btn-primary w-full py-3">Try Again</button>
                      </div>
                    </td>
                  </tr>
                ) : patients.length > 0 ? (
                  patients.map((patient) => (
                    <tr key={patient.id} className="hover:bg-primary-50/30 transition-all group">
                      <td className="px-8 py-6">
                          <Link 
                            to={routes.patientDetail.replace(':patientId', String(patient.id))}
                            className="flex items-center gap-4 hover:opacity-80 transition-opacity"
                          >
                            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 text-white flex items-center justify-center text-base font-bold shadow-lg shadow-primary-500/20">
                              {patient.first_name?.[0] || '?'}{patient.last_name?.[0] || '?'}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-secondary-900 group-hover:text-primary-600 transition-colors">
                                {patient.first_name} {patient.last_name}
                              </p>
                              <p className="text-[11px] font-bold text-secondary-400 uppercase tracking-tighter mt-0.5">
                                {patient.gender} • {patient.date_of_birth ? `${new Date().getFullYear() - new Date(patient.date_of_birth).getFullYear()} Years` : 'Age Unknown'}
                              </p>
                            </div>
                          </Link>
                      </td>
                      <td className="px-8 py-6">
                        <div className="inline-flex items-center gap-2 bg-secondary-900/5 border border-secondary-900/10 px-3 py-1.5 rounded-xl">
                          <span className="text-[11px] font-mono font-bold text-secondary-600 tracking-tight">
                            {patient.hospital_number}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 text-xs font-bold text-secondary-700">
                            <Phone className="h-3.5 w-3.5 text-primary-500" />
                            <span>{patient.phone_number}</span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] font-bold text-secondary-400">
                            <MapPin className="h-3.5 w-3.5" />
                            <span className="truncate max-w-[120px]">{patient.city || 'No Address'}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span className="px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest bg-emerald-50 text-emerald-600 border border-emerald-100">
                          {patient.payer_type || 'OUT-OF-POCKET'}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            to={routes.patientDetail.replace(':patientId', String(patient.id))}
                            className="p-2.5 hover:bg-primary-50 text-primary-600 rounded-xl transition-all shadow-sm border border-primary-100"
                            title="Patient Dashboard"
                          >
                            <User className="h-5 w-5" />
                          </Link>
                          <button
                            onClick={() => navigate(routes.visitInitiate, { state: { patient } })}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-primary-700 transition-all shadow-lg shadow-primary-500/10"
                          >
                            <span>Initiate Visit</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                          <div className="relative group/menu">
                            <button className="p-2.5 hover:bg-secondary-100 rounded-xl transition-all">
                              <MoreHorizontal className="h-5 w-5 text-secondary-400" />
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-8 py-32 text-center">
                      <div className="max-w-sm mx-auto space-y-6">
                        <div className="h-20 w-20 bg-secondary-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                          <User className="h-10 w-10 text-secondary-200" />
                        </div>
                        <h4 className="text-xl font-bold text-secondary-900">Registry is Empty</h4>
                        <p className="text-sm text-secondary-500">No patient records were found in this facility. Start by admitting your first patient to the registry.</p>
                        <Link to={routes.patientRegister} className="btn-primary inline-flex items-center gap-2 px-8 py-3">
                          <Plus className="h-4 w-4" />
                          <span>Admission Form</span>
                        </Link>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Luxury Pagination */}
          {meta && (
            <div className="px-8 py-6 bg-secondary-50/50 border-t border-secondary-100/50 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-4">
                <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-[0.2em]">
                  Showing <span className="text-secondary-900">{meta.skip + 1} - {Math.min(meta.skip + meta.limit, meta.total)}</span> of {meta.total} Records
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  disabled={!meta.has_previous}
                  className="px-6 py-2 rounded-xl border border-secondary-200 text-[10px] font-bold uppercase tracking-widest hover:bg-white disabled:opacity-30 transition-all"
                >
                  Previous
                </button>
                <button
                  disabled={!meta.has_next}
                  className="px-6 py-2 rounded-xl border border-secondary-200 bg-white text-[10px] font-bold uppercase tracking-widest hover:bg-secondary-900 hover:text-white disabled:opacity-30 transition-all"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
