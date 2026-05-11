import { PageHeader } from "@/components/layout/PageHeader";
import {
  AlertCircle,
  Building,
  Hash,
  Mail,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  getStaff,
  staffDisplayName,
  staffEmail,
  staffInitials,
} from "../api/staff.api";
import type { Staff } from "../api/staff.api";

export function StaffManagementPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getStaff(0, 200);
      setStaff(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error("Failed to load staff", err);
      setError(err?.response?.data?.message || "Unable to load staff records.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return staff;
    return staff.filter((m) => {
      const name = staffDisplayName(m).toLowerCase();
      return (
        name.includes(q) ||
        m.designation?.toLowerCase().includes(q) ||
        m.department?.toLowerCase().includes(q) ||
        m.staff_number?.toLowerCase().includes(q) ||
        staffEmail(m).toLowerCase().includes(q)
      );
    });
  }, [staff, search]);

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <PageHeader
          title="Workforce Management"
          description="Oversee hospital personnel, designations, and system access levels."
        />
        <div className="flex items-center gap-3">
          <button
            onClick={load}
            className="btn-secondary p-4 rounded-2xl bg-white/80 border-secondary-100 hover:rotate-180 transition-transform duration-500"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
          <button className="btn-primary gap-2">
            <Plus className="h-4 w-4" />
            <span>Onboard Staff</span>
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="glass-card rounded-[2rem] p-4 bg-white/40 backdrop-blur-md">
        <div className="relative">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-secondary-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, designation, department, staff number..."
            className="w-full bg-white/50 border-none rounded-2xl pl-14 pr-6 py-4 text-sm focus:ring-2 focus:ring-primary-500/50 transition-all font-medium"
          />
        </div>
      </div>

      {error ? (
        <div className="glass-card rounded-[2.5rem] p-16 text-center max-w-md mx-auto">
          <AlertCircle className="h-12 w-12 mx-auto text-rose-500/50 mb-4" />
          <p className="text-secondary-600 font-bold mb-4">{error}</p>
          <button onClick={load} className="btn-primary py-3 px-8">
            Try Again
          </button>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-48 glass-card rounded-[2rem] animate-pulse" />
            ))
          ) : filtered.length === 0 ? (
            <div className="md:col-span-2 lg:col-span-3 glass-card rounded-[2.5rem] p-16 text-center">
              <div className="h-20 w-20 bg-secondary-50 rounded-3xl flex items-center justify-center mx-auto mb-4">
                <Users className="h-10 w-10 text-secondary-200" />
              </div>
              <h4 className="text-xl font-bold text-secondary-900">No Staff</h4>
              <p className="text-sm text-secondary-500 mt-2">
                {staff.length === 0
                  ? "No staff records yet. Onboard your first team member to begin."
                  : "No staff match your search."}
              </p>
            </div>
          ) : (
            filtered.map((member) => {
              const displayName = staffDisplayName(member);
              const email = staffEmail(member);
              const initials = staffInitials(member);
              const status = (member.status || "ACTIVE").toUpperCase();
              const statusActive = status === "ACTIVE";
              return (
                <div
                  key={member.id}
                  className="glass-card rounded-[2rem] p-8 group hover:shadow-premium transition-all duration-300"
                >
                  <div className="flex items-start justify-between mb-6">
                    <div className="h-14 w-14 rounded-2xl bg-secondary-900 text-white flex items-center justify-center font-bold shadow-lg shadow-secondary-900/10 group-hover:bg-primary-500 group-hover:shadow-primary-500/20 transition-all">
                      {initials}
                    </div>
                    <button className="p-2 hover:bg-secondary-50 rounded-xl transition-colors">
                      <MoreVertical className="h-5 w-5 text-secondary-400" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-bold text-secondary-900">
                        {displayName}
                      </h3>
                      <p className="text-xs font-bold text-primary-600 uppercase tracking-widest">
                        {member.designation || "—"}
                      </p>
                    </div>

                    <div className="space-y-2 pt-4 border-t border-secondary-100">
                      <div className="flex items-center gap-3 text-xs text-secondary-500">
                        <Building className="h-3.5 w-3.5" />
                        <span className="font-medium">{member.department || "—"}</span>
                      </div>
                      {email ? (
                        <div className="flex items-center gap-3 text-xs text-secondary-500">
                          <Mail className="h-3.5 w-3.5" />
                          <span className="font-medium truncate">{email}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 text-xs text-secondary-400">
                          <Mail className="h-3.5 w-3.5" />
                          <span className="font-medium italic">No email on file</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-4">
                      <div className="flex items-center gap-2">
                        <div
                          className={`h-2 w-2 rounded-full ${
                            statusActive ? "bg-primary-500" : "bg-secondary-300"
                          }`}
                        />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-secondary-400">
                          {status}
                        </span>
                      </div>
                      {member.staff_number && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-secondary-400">
                          <Hash className="h-2.5 w-2.5" />
                          {member.staff_number}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
