import * as React from "react";
import {
  Building,
  Eye,
  LayoutGrid,
  List,
  Lock,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react";
import {
  DxPage, DxPageHeader, DxPanel, DxKpi, DxGrid, DxPager, DxBadge, DxButton, DxInput, DxSelect, DxSegmented,
  type DxGridColumn, type DxBadgeTone,
} from "@/components/dx";
import { useDisclosure } from "@/hooks/useDisclosure";
import { cn } from "@/lib/utils/cn";
import {
  adminUserDisplayName,
  adminUserInitials,
  getStaffAdminErrorMessage,
  relativeTime,
} from "../api/staff-admin.api";
import type { AdminUserListItem } from "../api/staff-admin.api";
import { useStaffUserCount, useStaffUsers } from "../hooks/use-staff-admin";
import { OnboardStaffModal } from "../components/OnboardStaffModal";
import { StaffDetailModal } from "../components/StaffDetailModal";

const PAGE_SIZE = 20;
const VIEW_MODE_KEY = "staff_view_mode";

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "SUSPENDED", label: "Suspended" },
  { value: "LOCKED", label: "Locked" },
  { value: "INACTIVE", label: "Inactive" },
];

function statusTone(status?: string | null): DxBadgeTone {
  switch ((status ?? "").toUpperCase()) {
    case "ACTIVE": return "success";
    case "SUSPENDED": return "warning";
    case "LOCKED": return "danger";
    case "PENDING": return "info";
    default: return "neutral";
  }
}

type ViewMode = "grid" | "table";

function Avatar({ user, size = "md" }: { user: AdminUserListItem; size?: "md" | "lg" }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg bg-[var(--dx-accent-soft)] font-bold text-[var(--dx-accent)]",
        size === "lg" ? "h-14 w-14 text-[18px]" : "h-10 w-10 text-[12px]",
      )}
      aria-hidden
    >
      {adminUserInitials(user)}
    </div>
  );
}

export function StaffManagementPage() {
  const [page, setPage] = React.useState(1);
  const [term, setTerm] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [selectedUserId, setSelectedUserId] = React.useState<number | null>(null);
  const [viewMode, setViewMode] = React.useState<ViewMode>(() => {
    const stored = localStorage.getItem(VIEW_MODE_KEY);
    return stored === "grid" ? "grid" : "table";
  });
  const onboardModal = useDisclosure();
  const detailModal = useDisclosure();

  React.useEffect(() => {
    localStorage.setItem(VIEW_MODE_KEY, viewMode);
  }, [viewMode]);

  // Debounce the server-side search so typing doesn't fire a request per keystroke.
  React.useEffect(() => {
    const t = setTimeout(() => { setSearch(term); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [term]);

  const listParams = {
    skip: (page - 1) * PAGE_SIZE,
    limit: PAGE_SIZE,
    search: search || undefined,
    status: status || undefined,
  };
  const usersQuery = useStaffUsers(listParams);

  // Honest, server-side status totals (meta.total probes, unaffected by the
  // current search) — except 2FA, which the API can't filter, so it's derived
  // from the visible page and labelled as such.
  const totalCount = useStaffUserCount(undefined);
  const activeCount = useStaffUserCount("ACTIVE");
  const suspendedCount = useStaffUserCount("SUSPENDED");
  const lockedCount = useStaffUserCount("LOCKED");

  const items = usersQuery.data?.items ?? [];
  const meta = usersQuery.data?.meta;
  const twoFactorOnPage = items.filter((u) => u.is_two_factor_enabled).length;
  const lockedOrSuspended =
    lockedCount.data != null || suspendedCount.data != null
      ? (lockedCount.data ?? 0) + (suspendedCount.data ?? 0)
      : undefined;

  const errorMessage = usersQuery.isError
    ? getStaffAdminErrorMessage(usersQuery.error, "Unable to load staff records.")
    : null;

  const openDetail = (userId: number) => {
    setSelectedUserId(userId);
    detailModal.open();
  };

  const handleStatusChange = (value: string) => {
    setStatus(value);
    setPage(1);
  };

  const columns: DxGridColumn<AdminUserListItem>[] = [
    { key: "staff_no", header: "Staff No", render: (row) => <span className="dx-mono text-[12px] text-[var(--dx-text-muted)]">{row.staff_no ?? "—"}</span> },
    {
      key: "member", header: "Member",
      render: (row) => (
        <div className="flex items-center gap-3">
          <Avatar user={row} />
          <div className="min-w-0">
            <p className="flex items-center gap-2 truncate text-[13px] font-semibold text-[var(--dx-text)]">
              {adminUserDisplayName(row)}
              {row.is_superuser ? <DxBadge tone="warning">Super</DxBadge> : null}
            </p>
            <p className="truncate text-[12px] font-medium text-[var(--dx-text-muted)]">{row.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "role_unit", header: "Job Title & Department",
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-[var(--dx-text)]">{row.job_title ?? "—"}</p>
          <p className="mt-0.5 flex items-center gap-1 truncate text-[12px] font-medium text-[var(--dx-text-muted)]">
            <Building className="h-3 w-3 shrink-0" aria-hidden />
            {row.department_name ?? "Unassigned"}
          </p>
        </div>
      ),
    },
    { key: "roles", header: "Roles", align: "center", render: (row) => <DxBadge tone="neutral">{row.role_count} {row.role_count === 1 ? "role" : "roles"}</DxBadge> },
    { key: "status", header: "Status", render: (row) => <DxBadge tone={statusTone(row.status)}>{row.status}</DxBadge> },
    { key: "last_login", header: "Last Login", render: (row) => <span className="text-[12px] font-medium text-[var(--dx-text-muted)]">{relativeTime(row.last_login_at)}</span> },
    {
      key: "actions", header: <span className="sr-only">Actions</span>, align: "right",
      render: (row) => (
        <DxButton variant="text" size="sm" leftIcon={<Eye className="h-3.5 w-3.5" />} onClick={(event) => { event.stopPropagation(); openDetail(row.id); }}>View</DxButton>
      ),
    },
  ];

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Administration" }, { label: "Staff" }]}
        title="Staff Management"
        subtitle="Onboard personnel, manage system access, and administer staff accounts."
        actions={
          <>
            <DxButton icon title="Refresh" onClick={() => usersQuery.refetch()} isLoading={usersQuery.isFetching}><RotateCcw /></DxButton>
            <DxButton variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={onboardModal.open}>Onboard staff</DxButton>
          </>
        }
      />

      {/* ---- KPI row ---- */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DxKpi label="Total Staff" value={totalCount.data ?? "—"} icon={Users} tone="accent" isLoading={totalCount.isLoading} />
        <DxKpi label="Active Accounts" value={activeCount.data ?? "—"} icon={UserCheck} tone="info" isLoading={activeCount.isLoading} />
        <DxKpi label="Locked / Suspended" value={lockedOrSuspended ?? "—"} icon={Lock} tone="danger" isLoading={lockedCount.isLoading || suspendedCount.isLoading} />
        <DxKpi label="2FA Enabled (this page)" value={twoFactorOnPage} icon={ShieldCheck} tone="neutral" isLoading={usersQuery.isLoading} />
      </div>

      {/* ---- List surface ---- */}
      <DxPanel flush>
        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          <div className="w-full sm:w-80">
            <DxInput leftIcon={<Search className="h-3.5 w-3.5" />} placeholder="Search name, username, email, staff no, job title…" value={term} onChange={(e) => setTerm(e.target.value)} />
          </div>
          <div className="w-44">
            <DxSelect aria-label="Filter by status" options={STATUS_OPTIONS} value={status} onChange={(e) => handleStatusChange(e.target.value)} editorSize="sm" />
          </div>
          <div className="ml-auto">
            <DxSegmented<ViewMode>
              ariaLabel="View mode"
              value={viewMode}
              onChange={setViewMode}
              items={[
                { key: "table", label: <List className="h-4 w-4" /> },
                { key: "grid", label: <LayoutGrid className="h-4 w-4" /> },
              ]}
            />
          </div>
        </div>

        {viewMode === "table" ? (
          <DxGrid
            columns={columns}
            data={items}
            rowKey={(row) => row.id}
            isLoading={usersQuery.isLoading}
            error={errorMessage}
            onRetry={() => usersQuery.refetch()}
            onRowClick={(row) => openDetail(row.id)}
            empty={{
              icon: Users,
              title: "No staff found",
              description: search || status ? "No staff match the current filters. Adjust the search or status filter." : "Onboard your first team member to begin.",
              action: <DxButton variant="primary" size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={onboardModal.open}>Onboard staff</DxButton>,
            }}
            footer={meta ? <DxPager page={page} totalPages={meta.total_pages} totalItems={meta.total} pageSize={PAGE_SIZE} onPageChange={setPage} /> : null}
          />
        ) : (
          <div className="border-t border-[var(--dx-border)]">
            {usersQuery.isLoading ? (
              <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="dx-skeleton h-36 w-full" />)}</div>
            ) : errorMessage ? (
              <div className="py-14 text-center">
                <Users className="mx-auto mb-3 h-10 w-10 text-[var(--dx-text-faint)]" />
                <p className="text-[14px] font-semibold text-[var(--dx-text)]">{errorMessage}</p>
                <p className="mt-1 text-[13px] text-[var(--dx-text-muted)]">Check your connection and try again.</p>
                <DxButton className="mx-auto mt-4" size="sm" onClick={() => usersQuery.refetch()}>Retry</DxButton>
              </div>
            ) : items.length === 0 ? (
              <div className="py-14 text-center">
                <Users className="mx-auto mb-3 h-10 w-10 text-[var(--dx-text-faint)]" />
                <p className="text-[14px] font-semibold text-[var(--dx-text)]">No staff found</p>
                <p className="mx-auto mt-1 max-w-md text-[13px] text-[var(--dx-text-muted)]">{search || status ? "No staff match the current filters. Adjust the search or status filter." : "Onboard your first team member to begin."}</p>
                <DxButton className="mx-auto mt-4" variant="primary" size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={onboardModal.open}>Onboard staff</DxButton>
              </div>
            ) : (
              <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((member) => (
                  <div key={member.id} className="flex flex-col rounded-lg border border-[var(--dx-border)] bg-[var(--dx-surface)] p-4">
                    <div className="flex items-start gap-4">
                      <Avatar user={member} size="lg" />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 truncate text-[13px] font-semibold text-[var(--dx-text)]">
                          {adminUserDisplayName(member)}
                          {member.is_superuser ? <DxBadge tone="warning">Super</DxBadge> : null}
                        </p>
                        <p className="mt-0.5 truncate text-[12px] font-medium text-[var(--dx-text-muted)]">{member.job_title ?? "—"}</p>
                        <p className="mt-0.5 flex items-center gap-1 truncate text-[12px] font-medium text-[var(--dx-text-muted)]">
                          <Building className="h-3 w-3 shrink-0" aria-hidden />
                          {member.department_name ?? "Unassigned"}
                        </p>
                      </div>
                      <DxBadge tone={statusTone(member.status)}>{member.status}</DxBadge>
                    </div>
                    <div className="mt-5 flex items-center justify-between border-t border-[var(--dx-border)] pt-4">
                      <div className="flex items-center gap-2">
                        <DxBadge tone="neutral">{member.role_count} {member.role_count === 1 ? "role" : "roles"}</DxBadge>
                        {member.is_two_factor_enabled ? <DxBadge tone="info">2FA</DxBadge> : null}
                      </div>
                      <DxButton variant="text" size="sm" leftIcon={<Eye className="h-3.5 w-3.5" />} onClick={() => openDetail(member.id)}>View</DxButton>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {meta ? (
              <div className="border-t border-[var(--dx-border)]">
                <DxPager page={page} totalPages={meta.total_pages} totalItems={meta.total} pageSize={PAGE_SIZE} onPageChange={setPage} />
              </div>
            ) : null}
          </div>
        )}
      </DxPanel>

      {/* ---- Modals ---- */}
      <OnboardStaffModal isOpen={onboardModal.isOpen} onClose={onboardModal.close} />
      <StaffDetailModal
        userId={selectedUserId}
        isOpen={detailModal.isOpen}
        onClose={() => {
          detailModal.close();
          setSelectedUserId(null);
        }}
      />
    </DxPage>
  );
}
