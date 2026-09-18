import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Bell, CalendarClock, Dna, FlaskConical, HeartPulse, Home, LogOut, MessageSquare, Receipt, UserRound, Video } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { resolveAssetUrl } from "@/lib/api/asset-url";
import { clearPortalSession, getStoredPortalSession } from "../api/portal.api";
import { usePortalBranding, usePortalDashboard, usePortalMessagesUnreadCount } from "../hooks/use-portal";

const navItems = [
  { to: "/portal/home", label: "Home", icon: Home },
  { to: "/portal/appointments", label: "Appointments", icon: CalendarClock },
  { to: "/portal/home-care", label: "Home Care", icon: HeartPulse },
  { to: "/portal/telehealth", label: "Telehealth", icon: Video },
  { to: "/portal/lab-results", label: "Lab Results", icon: FlaskConical },
  { to: "/portal/baseline-diagnostics", label: "Diagnostics", icon: Dna },
  { to: "/portal/invoices", label: "Invoices", icon: Receipt },
  { to: "/portal/messages", label: "Messages", icon: MessageSquare },
  { to: "/portal/notifications", label: "Notifications", icon: Bell },
  { to: "/portal/profile", label: "Profile", icon: UserRound },
];

/** Patient portal shell — top nav + ambient main area. */
export function PortalLayout() {
  const navigate = useNavigate();
  const session = getStoredPortalSession();
  const { data: branding } = usePortalBranding();
  const { data: dashboard } = usePortalDashboard();
  const logoUrl = resolveAssetUrl(branding?.logo_url);
  const hospitalName = branding?.hospital_name;
  const unreadCount = dashboard?.unread_notifications_count ?? 0;
  const { data: unreadMessages } = usePortalMessagesUnreadCount();
  const unreadMessageCount = unreadMessages ?? 0;

  function handleLogout() {
    clearPortalSession();
    navigate("/portal/login", { replace: true });
  }

  return (
    <div className="ambient-bg min-h-screen bg-brand-gray transition-colors duration-500 selection:bg-primary-100 selection:text-primary-900 dark:bg-secondary-950">
      <header className="sticky top-0 z-40 border-b border-secondary-100/70 bg-white/70 backdrop-blur-2xl dark:border-white/10 dark:bg-secondary-950/70">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          {/* Brand — hospital logo/name when available, else the default mark */}
          <NavLink to="/portal/home" className="flex items-center gap-2.5">
            {logoUrl ? (
              <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-2xl bg-white p-1 shadow-glow-sm ring-1 ring-secondary-100">
                <img
                  src={logoUrl}
                  alt={hospitalName ? `${hospitalName} logo` : "Hospital logo"}
                  className="h-full w-full object-contain"
                />
              </span>
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary-500/10 text-primary-500 shadow-glow-sm">
                <HeartPulse className="h-5 w-5" aria-hidden />
              </span>
            )}
            <span className="hidden font-display text-lg font-black tracking-tight text-secondary-900 sm:block dark:text-white">
              {hospitalName ? (
                hospitalName
              ) : (
                <>
                  CarePoint<span className="text-primary-500"> Patient</span>
                </>
              )}
            </span>
          </NavLink>

          {/* Nav */}
          <nav className="flex items-center gap-1" aria-label="Portal navigation">
            {navItems.map(({ to, label, icon: Icon }) => {
              const badgeCount =
                to === "/portal/notifications"
                  ? unreadCount
                  : to === "/portal/messages"
                    ? unreadMessageCount
                    : 0;
              const showBadge = badgeCount > 0;
              return (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    cn(
                      "relative flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-bold uppercase tracking-widest transition-all sm:px-4",
                      isActive
                        ? "bg-primary-500/10 text-primary-600 shadow-glow-sm dark:text-primary-300"
                        : "text-secondary-500 hover:bg-secondary-500/5 hover:text-secondary-900 dark:hover:bg-white/5 dark:hover:text-secondary-100",
                    )
                  }
                >
                  <span className="relative">
                    <Icon className="h-4 w-4" aria-hidden />
                    {showBadge ? (
                      <span
                        className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary-500 px-1 text-[9px] font-black leading-none text-white"
                        aria-label={`${badgeCount} unread`}
                      >
                        {badgeCount > 9 ? "9+" : badgeCount}
                      </span>
                    ) : null}
                  </span>
                  <span className="hidden sm:inline">{label}</span>
                </NavLink>
              );
            })}
          </nav>

          {/* Session / logout */}
          <div className="flex items-center gap-3">
            {session ? (
              <span className="data-mono hidden text-xs text-secondary-400 md:block">
                {session.hospital_number}
              </span>
            ) : null}
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-bold uppercase tracking-widest text-secondary-500 transition-all hover:bg-rose-500/10 hover:text-rose-500 sm:px-4"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
