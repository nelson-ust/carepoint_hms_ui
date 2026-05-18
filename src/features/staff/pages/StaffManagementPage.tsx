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
  LayoutGrid,
  List,
  Eye,
  Shield,
  Clock,
  Briefcase,
  ExternalLink,
  Lock,
  UserCheck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  getStaff,
  staffDisplayName,
  staffEmail,
  staffInitials,
} from "../api/staff.api";
import type { Staff } from "../api/staff.api";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";

export function StaffManagementPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);

  const [viewMode, setViewMode] = useState<'grid' | 'table'>(() => {
    return (localStorage.getItem('staff_view_mode') as 'grid' | 'table') || 'table';
  });

  useEffect(() => {
    localStorage.setItem('staff_view_mode', viewMode);
  }, [viewMode]);

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
      const username = (m.username || "").toLowerCase();
      const staffNo = (m.staff_no || m.staff_number || "").toLowerCase();
      return (
        name.includes(q) ||
        username.includes(q) ||
        staffNo.includes(q) ||
        m.designation?.toLowerCase().includes(q) ||
        m.department?.toLowerCase().includes(q) ||
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
        <div className="flex bg-white/40 p-1 rounded-2xl border border-secondary-400/50 mr-2">
          <button
            onClick={() => setViewMode('table')}
            className={`p-3 rounded-xl transition-all ${viewMode === 'table' ? 'bg-secondary-900 text-white shadow-lg' : 'text-secondary-400 hover:text-secondary-600'}`}
            title="Table View"
          >
            <List className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`p-3 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-secondary-900 text-white shadow-lg' : 'text-secondary-400 hover:text-secondary-600'}`}
            title="Grid View"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
        </div>
        <button
          onClick={load}
          className="btn-secondary p-4 rounded-2xl bg-white/80 border-secondary-400 hover:rotate-180 transition-transform duration-500"
          title="Refresh"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        </button>
        <button className="btn-primary gap-2">
          <Plus className="h-4 w-4" />
          <span>Onboard Staff</span>
        </button>
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
            <div className="md:col-span-2 lg:col-span-3 glass-card rounded-[2.5rem] overflow-hidden border border-secondary-400/50 shadow-premium bg-white/40">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-secondary-900 text-white shadow-lg">
                    <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em]">Personnel ID / No</th>
                    <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em]">Member Details</th>
                    <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em]">Designation & Unit</th>
                    <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em]">System Status</th>
                    <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em]">Last Activity</th>
                    <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-right">Access</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-secondary-100/50">
                  {filtered.map((member) => {
                    const status = (member.status || "ACTIVE").toUpperCase();
                    const isLocked = status === "LOCKED";
                    const lastLogin = member.last_login_at
                      ? new Date(member.last_login_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                      : "Never";

                    return (
                      <tr key={member.id} className="hover:bg-primary-50/30 transition-all group border-l-4 border-l-transparent hover:border-l-primary-500">
                        <td className="px-8 py-6">
                          <div className="flex flex-col">
                            <span className="text-xs font-black text-secondary-900">ID: {member.id}</span>
                            <span className="text-[10px] font-bold text-primary-500 uppercase tracking-widest mt-1">
                              {member.staff_no || member.staff_number || "NO-ASSIGNED-NO"}
                            </span>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-4">
                            <div className="h-11 w-11 shrink-0 rounded-xl bg-secondary-900 text-white flex items-center justify-center text-xs font-bold shadow-lg group-hover:bg-primary-600 transition-colors">
                              {staffInitials(member)}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-sm font-black text-secondary-900 truncate">{staffDisplayName(member)}</span>
                              <span className="text-xs font-medium text-secondary-400 truncate lowercase">{staffEmail(member)}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-secondary-700">{member.designation || "—"}</span>
                            <span className="text-[10px] font-bold text-secondary-400 uppercase tracking-wider">{member.department || "General Unit"}</span>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${isLocked ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                            }`}>
                            {status}
                          </span>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-2 text-secondary-500">
                            <Clock className="h-3.5 w-3.5" />
                            <span className="text-xs font-bold">{lastLogin}</span>
                          </div>
                        </td>
                        <td className="px-8 py-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setSelectedStaff(member)}
                              className="p-2.5 text-secondary-400 hover:text-primary-600 hover:bg-primary-50 rounded-xl transition-all"
                              title="Full Profile"
                            >
                              <Eye className="h-5 w-5" />
                            </button>
                            <button className="p-2.5 text-secondary-400 hover:text-secondary-900 hover:bg-secondary-100 rounded-xl transition-all">
                              <MoreVertical className="h-5 w-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Staff Details Modal */}
      <Modal
        isOpen={!!selectedStaff}
        onClose={() => setSelectedStaff(null)}
        title="Personnel Detailed Profile"
        size="lg"
      >
        {selectedStaff && (
          <div className="space-y-10 animate-in fade-in zoom-in duration-300">
            {/* Profile Header */}
            <div className="flex items-center gap-8 rounded-[2.5rem] bg-secondary-900 text-white shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-12 opacity-5">
                <Users className="h-40 w-40" />
              </div>
              <div className="h-28 w-28 rounded-3xl bg-primary-500 flex items-center justify-center text-3xl font-black shadow-xl ring-8 ring-white/10 shrink-0">
                {staffInitials(selectedStaff)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="text-3xl font-black truncate">{staffDisplayName(selectedStaff)}</h2>
                  {selectedStaff.is_superuser && (
                    <Badge variant="secondary" className="bg-amber-500 text-white border-none px-3 py-1 font-black text-[10px] uppercase tracking-widest">
                      System Admin
                    </Badge>
                  )}
                </div>
                {/* <p className="text-primary-400 font-bold uppercase tracking-[0.2em] text-sm mb-4">
                  {selectedStaff.designation} • {selectedStaff.department}
                </p> */}
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-xl backdrop-blur-md">
                    <Mail className="h-4 w-4 text-secondary-400" />
                    <span className="text-sm font-medium text-secondary-200">{staffEmail(selectedStaff)}</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-xl backdrop-blur-md">
                    <Hash className="h-4 w-4 text-secondary-400" />
                    <span className="text-sm font-medium text-secondary-200">{selectedStaff.staff_no || selectedStaff.staff_number}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* System Access & Security */}
              <div className="glass-card rounded-[2.5rem] p-8 border border-secondary-400 bg-secondary-50/30">
                <h4 className="text-xs font-black text-secondary-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  System Permissions
                </h4>
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-white border border-secondary-400">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center">
                        <Lock className="h-5 w-5" />
                      </div>
                      <div>
                        <span className="text-sm font-black text-secondary-900 block">Assigned Roles</span>
                        <span className="text-[10px] font-bold text-secondary-400 uppercase">{selectedStaff.role_count || 0} Permissions Configured</span>
                      </div>
                    </div>
                    <button className="text-xs font-black text-primary-600 hover:underline">Manage</button>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-2xl bg-white border border-secondary-400">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <UserCheck className="h-5 w-5" />
                      </div>
                      <div>
                        <span className="text-sm font-black text-secondary-900 block">Account Status</span>
                        <span className="text-[10px] font-bold text-emerald-500 uppercase">{selectedStaff.status}</span>
                      </div>
                    </div>
                    <div className={`h-3 w-3 rounded-full ${selectedStaff.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-rose-500'} animate-pulse`} />
                  </div>
                </div>
              </div>

              {/* Account Lifecycle */}
              <div className="glass-card rounded-[2.5rem] p-8 border border-secondary-400 bg-secondary-50/30">
                <h4 className="text-xs font-black text-secondary-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Activity Audit
                </h4>
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-5 rounded-2xl bg-white border border-secondary-400">
                      <span className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest block mb-1">Username</span>
                      <span className="text-sm font-black text-secondary-900">{selectedStaff.username || 'N/A'}</span>
                    </div>
                    <div className="p-5 rounded-2xl bg-white border border-secondary-400">
                      <span className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest block mb-1">Staff ID</span>
                      <span className="text-sm font-black text-secondary-900">#CP-{selectedStaff.id}</span>
                    </div>
                  </div>
                  <div className="p-5 rounded-2xl bg-white border border-secondary-400">
                    <span className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest block mb-1">Last System Access</span>
                    <span className="text-sm font-black text-secondary-900">
                      {selectedStaff.last_login_at ? new Date(selectedStaff.last_login_at).toLocaleString() : 'Never logged in'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-4 pt-4 border-t border-secondary-400">
              <button className="flex-1 btn-primary py-4 rounded-2xl font-black shadow-xl shadow-primary-500/20">
                Edit Profile Details
              </button>
              <button className="flex-1 py-4 rounded-2xl font-black text-secondary-600 bg-secondary-100 hover:bg-secondary-200 transition-all">
                Manage Access Levels
              </button>
              <button className="px-6 py-4 rounded-2xl font-black text-rose-600 bg-rose-50 hover:bg-rose-100 transition-all">
                Suspend Account
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
