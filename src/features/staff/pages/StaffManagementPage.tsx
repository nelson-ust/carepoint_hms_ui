import * as React from "react";
import {
  Building,
  Eye,
  LayoutGrid,
  List,
  Lock,
  Plus,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/EmptyState";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { SearchInput } from "@/components/forms/SearchInput";
import { DataTable, type DataTableColumn } from "@/components/data-table/DataTable";
import { Pagination } from "@/components/data-table/Pagination";
import { MetricCard } from "@/components/charts/MetricCard";
import { useDisclosure } from "@/hooks/useDisclosure";
import { cn } from "@/lib/utils/cn";
import {
  adminUserDisplayName,
  adminUserInitials,
  getStaffAdminErrorMessage,
  relativeTime,
  statusPillVariant,
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

type ViewMode = "grid" | "table";

function Avatar({ user, size = "md" }: { user: AdminUserListItem; size?: "md" | "lg" }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-2xl bg-primary-500/15 font-black text-primary-600 dark:text-primary-300",
        size === "lg" ? "h-14 w-14 text-lg" : "h-10 w-10 text-xs",
      )}
      aria-hidden
    >
      {adminUserInitials(user)}
    </div>
  );
}

export function StaffManagementPage() {
  const [page, setPage] = React.useState(1);
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

  const handleSearch = (term: string) => {
    setSearch(term);
    setPage(1);
  };

  const handleStatusChange = (value: string) => {
    setStatus(value);
    setPage(1);
  };

  const columns: DataTableColumn<AdminUserListItem>[] = [
    {
      key: "staff_no",
      header: "Staff No",
      render: (row) => (
        <span className="data-mono text-xs text-secondary-500">{row.staff_no ?? "—"}</span>
      ),
    },
    {
      key: "member",
      header: "Member",
      render: (row) => (
        <div className="flex items-center gap-3">
          <Avatar user={row} />
          <div className="min-w-0">
            <p className="flex items-center gap-2 truncate text-sm font-bold text-secondary-900">
              {adminUserDisplayName(row)}
              {row.is_superuser ? <Badge variant="soft-warning">Super</Badge> : null}
            </p>
            <p className="truncate text-xs font-medium text-secondary-400">{row.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "role_unit",
      header: "Job Title & Department",
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-secondary-700 dark:text-secondary-200">
            {row.job_title ?? "—"}
          </p>
          <p className="mt-0.5 flex items-center gap-1 truncate text-xs font-medium text-secondary-400">
            <Building className="h-3 w-3 shrink-0" aria-hidden />
            {row.department_name ?? "Unassigned"}
          </p>
        </div>
      ),
    },
    {
      key: "roles",
      header: "Roles",
      align: "center",
      render: (row) => (
        <Badge variant="secondary">
          {row.role_count} {row.role_count === 1 ? "role" : "roles"}
        </Badge>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <Badge variant={statusPillVariant(row.status)}>{row.status}</Badge>,
    },
    {
      key: "last_login",
      header: "Last Login",
      render: (row) => (
        <span className="text-xs font-medium text-secondary-500">
          {relativeTime(row.last_login_at)}
        </span>
      ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      render: (row) => (
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<Eye className="h-3.5 w-3.5" />}
          onClick={(event) => {
            event.stopPropagation();
            openDetail(row.id);
          }}
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Staff Management"
        description="Onboard personnel, manage system access, and administer staff accounts."
        actions={
          <>
            <Button
              variant="ghost"
              leftIcon={
                <RefreshCw
                  className={cn("h-4 w-4", usersQuery.isFetching && "animate-spin")}
                />
              }
              onClick={() => usersQuery.refetch()}
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              leftIcon={<Plus className="h-4 w-4" />}
              onClick={onboardModal.open}
            >
              Onboard Staff
            </Button>
          </>
        }
      />

      {/* ---- KPI row ---- */}
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total Staff"
          value={totalCount.data ?? "—"}
          icon={Users}
          tone="primary"
          isLoading={totalCount.isLoading}
        />
        <MetricCard
          label="Active Accounts"
          value={activeCount.data ?? "—"}
          icon={UserCheck}
          tone="cyan"
          isLoading={activeCount.isLoading}
        />
        <MetricCard
          label="Locked / Suspended"
          value={lockedOrSuspended ?? "—"}
          icon={Lock}
          tone="rose"
          isLoading={lockedCount.isLoading || suspendedCount.isLoading}
        />
        <MetricCard
          label="2FA Enabled (this page)"
          value={twoFactorOnPage}
          icon={ShieldCheck}
          tone="violet"
          isLoading={usersQuery.isLoading}
        />
      </div>

      {/* ---- List surface ---- */}
      <Card padding="none">
        <div className="flex flex-wrap items-center gap-3 px-6 py-4">
          <SearchInput
            onSearch={handleSearch}
            placeholder="Search name, username, email, staff no, job title…"
            className="w-full sm:w-80"
          />
          <Select
            aria-label="Filter by status"
            options={STATUS_OPTIONS}
            value={status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="w-44 py-2.5"
          />
          <div className="ml-auto flex items-center gap-1 rounded-2xl border border-secondary-200 bg-white/60 p-1 dark:border-white/10 dark:bg-white/5">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              title="Table view"
              aria-label="Table view"
              aria-pressed={viewMode === "table"}
              className={cn(
                "rounded-xl p-2 transition-colors",
                viewMode === "table"
                  ? "bg-primary-500/15 text-primary-600 dark:text-primary-300"
                  : "text-secondary-400 hover:text-secondary-700 dark:hover:text-secondary-200",
              )}
            >
              <List className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              title="Grid view"
              aria-label="Grid view"
              aria-pressed={viewMode === "grid"}
              className={cn(
                "rounded-xl p-2 transition-colors",
                viewMode === "grid"
                  ? "bg-primary-500/15 text-primary-600 dark:text-primary-300"
                  : "text-secondary-400 hover:text-secondary-700 dark:hover:text-secondary-200",
              )}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        </div>

        {viewMode === "table" ? (
          <DataTable
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
              description:
                search || status
                  ? "No staff match the current filters. Adjust the search or status filter."
                  : "Onboard your first team member to begin.",
              action: (
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Plus className="h-3.5 w-3.5" />}
                  onClick={onboardModal.open}
                >
                  Onboard Staff
                </Button>
              ),
            }}
            footer={
              meta ? (
                <Pagination
                  page={page}
                  totalPages={meta.total_pages}
                  totalItems={meta.total}
                  pageSize={PAGE_SIZE}
                  onPageChange={setPage}
                />
              ) : null
            }
          />
        ) : (
          <div className="border-t border-secondary-100 dark:border-white/5">
            {usersQuery.isLoading ? (
              <div className="grid gap-6 p-6 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <CardSkeleton key={i} />
                ))}
              </div>
            ) : errorMessage ? (
              <EmptyState
                title={errorMessage}
                description="Check your connection and try again."
                action={
                  <Button variant="secondary" size="sm" onClick={() => usersQuery.refetch()}>
                    Retry
                  </Button>
                }
              />
            ) : items.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No staff found"
                description={
                  search || status
                    ? "No staff match the current filters. Adjust the search or status filter."
                    : "Onboard your first team member to begin."
                }
                action={
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<Plus className="h-3.5 w-3.5" />}
                    onClick={onboardModal.open}
                  >
                    Onboard Staff
                  </Button>
                }
              />
            ) : (
              <div className="grid gap-6 p-6 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((member) => (
                  <Card key={member.id} variant="panel" padding="md" className="flex flex-col">
                    <div className="flex items-start gap-4">
                      <Avatar user={member} size="lg" />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 truncate text-sm font-bold text-secondary-900">
                          {adminUserDisplayName(member)}
                          {member.is_superuser ? (
                            <Badge variant="soft-warning">Super</Badge>
                          ) : null}
                        </p>
                        <p className="mt-0.5 truncate text-xs font-medium text-secondary-400">
                          {member.job_title ?? "—"}
                        </p>
                        <p className="mt-0.5 flex items-center gap-1 truncate text-xs font-medium text-secondary-400">
                          <Building className="h-3 w-3 shrink-0" aria-hidden />
                          {member.department_name ?? "Unassigned"}
                        </p>
                      </div>
                      <Badge variant={statusPillVariant(member.status)}>{member.status}</Badge>
                    </div>
                    <div className="mt-5 flex items-center justify-between border-t border-secondary-100 pt-4 dark:border-white/5">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          {member.role_count} {member.role_count === 1 ? "role" : "roles"}
                        </Badge>
                        {member.is_two_factor_enabled ? (
                          <Badge variant="soft-info">2FA</Badge>
                        ) : null}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        leftIcon={<Eye className="h-3.5 w-3.5" />}
                        onClick={() => openDetail(member.id)}
                      >
                        View
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
            {meta ? (
              <Pagination
                page={page}
                totalPages={meta.total_pages}
                totalItems={meta.total}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
              />
            ) : null}
          </div>
        )}
      </Card>

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
    </div>
  );
}
