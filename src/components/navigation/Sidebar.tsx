import { useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { appModules, navGroups, type AppModule } from "@/config/module-registry";
import { ChevronRight, ChevronDown, LogOut, Search, Settings as SettingsIcon, User } from "lucide-react";
import { localStorageService, storageKeys } from "@/lib/storage/local-storage";
import { routes } from "@/config/routes";
import { useUI } from "@/app/providers/UIProvider";
import { useMyModules } from "@/lib/modules/useMyModules";
import { usePermissionGate } from "@/lib/permissions/usePermissionGate";
import { useTenantSettings } from "@/features/settings/hooks/use-branding";
import { resolveAssetUrl } from "@/lib/api/asset-url";
import logo from "@/assets/logo.jpeg";
import { CommandPalette } from "./CommandPalette";

const SECTIONS_KEY = "carepoint.sidebar_sections";

function loadCollapsedSections(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(SECTIONS_KEY) || "{}");
  } catch {
    return {};
  }
}

export function Sidebar() {
  const { isSidebarCollapsed } = useUI();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { isEnabled } = useMyModules();
  const permissionGate = usePermissionGate();
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(loadCollapsedSections);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Global ⌘K / Ctrl+K opens the "Jump anywhere" palette.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const userStr = localStorageService.get(storageKeys.user);
  const user = userStr ? JSON.parse(userStr) : null;
  const isSaaSAdmin = user?.username === "superadmin@carepointhms.com" || user?.is_saas_admin;

  // Tenant branding: show the hospital's uploaded logo (SaaS admin keeps the
  // platform mark). Falls back to the bundled logo when none is set.
  const { data: tenantSettings } = useTenantSettings(!isSaaSAdmin);
  const brandLogo = resolveAssetUrl(tenantSettings?.logo_url) ?? logo;

  const categories = isSaaSAdmin
    ? (["SaaS"] as const)
    : (["Core", "Clinical", "Financial", "HR & Payroll", "Administrative"] as const);

  // Subscription-aware menu: a tenant only sees entries whose moduleCode is
  // effective on their plan (core entries have no moduleCode and always show).
  const visibleByCategory = useMemo(() => {
    const map: Record<string, AppModule[]> = {};
    for (const category of categories) {
      map[category] = appModules.filter(
        (m) =>
          m.category === category &&
          isEnabled(m.moduleCode) &&
          permissionGate.hasAny(m.permissions)
      );
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSaaSAdmin, isEnabled, permissionGate.known, permissionGate.isSuperuser, permissionGate.codes]);

  // Every visible entry, flattened for the command palette.
  const paletteItems = useMemo(
    () => Object.values(visibleByCategory).flat(),
    [visibleByCategory],
  );

  // Exactly one item should be highlighted: the most specific menu path that
  // matches the current URL. A prefix match (e.g. /hr) yields to a deeper
  // match (e.g. /hr/roster) so parent and child links never light up together.
  const activePath = useMemo(() => {
    const all = Object.values(visibleByCategory).flat();
    const p = location.pathname;
    let best = "";
    for (const m of all) {
      if ((p === m.path || p.startsWith(m.path + "/")) && m.path.length > best.length) {
        best = m.path;
      }
    }
    return best;
  }, [visibleByCategory, location.pathname]);

  // Codes that live inside a sub-group; everything else stays top-level.
  const groupedCodes = useMemo(
    () => new Set(navGroups.flatMap((g) => g.children)),
    [],
  );

  const toggleSection = (key: string, forceCollapsed?: boolean) => {
    setCollapsedSections((prev) => {
      const next = {
        ...prev,
        [key]: forceCollapsed !== undefined ? forceCollapsed : !prev[key],
      };
      try {
        localStorage.setItem(SECTIONS_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const handleLogout = () => {
    localStorageService.clearAuth();
    // Drop all cached queries so the next user never inherits this user's
    // permissions, modules, or data.
    queryClient.clear();
    navigate(routes.login);
  };

  // A single navigable menu row. `isChild` nests it under a group parent.
  const renderItem = (module: AppModule, isChild: boolean) => {
    const active = module.path === activePath;
    return (
      <NavLink
        key={module.code}
        to={module.path}
        end
        className={`sidebar-link group relative ${
          active
            ? "bg-primary-500/15 text-primary-300 shadow-inner-highlight ring-1 ring-primary-500/25"
            : "text-secondary-400 hover:bg-white/5 hover:text-white"
        } ${isSidebarCollapsed ? "justify-center px-0 h-12 w-12 mx-auto rounded-2xl" : ""} ${
          isChild && !isSidebarCollapsed ? "py-2" : ""
        }`}
        title={isSidebarCollapsed ? module.label : ""}
      >
        {active && !isSidebarCollapsed && (
          <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-primary-400 shadow-glow-sm" />
        )}
        <module.icon
          className={`${isChild && !isSidebarCollapsed ? "h-4 w-4" : "h-5 w-5"} shrink-0 transition-transform group-hover:scale-110 ${
            active ? "text-primary-300" : ""
          }`}
        />
        {!isSidebarCollapsed && (
          <span className={`min-w-0 flex-1 animate-in fade-in slide-in-from-left-2 ${isChild ? "text-[13px]" : ""}`}>
            <span className="block truncate leading-tight">{module.label}</span>
            {module.description && (
              <span
                className={`block truncate text-[10px] font-medium leading-tight ${
                  active ? "text-primary-400/80" : "text-secondary-600 group-hover:text-secondary-400"
                }`}
              >
                {module.description}
              </span>
            )}
          </span>
        )}
        {!isSidebarCollapsed && (
          <ChevronRight
            className={`h-4 w-4 transition-all ${
              active
                ? "opacity-100"
                : "opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0"
            }`}
          />
        )}
      </NavLink>
    );
  };

  return (
    <aside
      className={`print:!hidden hidden lg:fixed lg:inset-y-0 lg:flex lg:flex-col bg-secondary-950/95 backdrop-blur-2xl border-r border-white/5 transition-all duration-300 z-50 ${
        isSidebarCollapsed ? "lg:w-24" : "lg:w-72"
      }`}
    >
      {/* Ambient accent — faint emerald aurora at the top of the rail */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-primary-500/10 to-transparent" />

      {/* Brand Logo */}
      <div className={`relative px-8 py-10 flex items-center gap-3 ${isSidebarCollapsed ? "justify-center px-0" : ""}`}>
        <div className="h-12 w-12 shrink-0 rounded-2xl bg-white flex items-center justify-center shadow-glow-sm ring-1 ring-white/10 overflow-hidden p-1">
          <img
            src={brandLogo}
            alt="Hospital logo"
            className="h-full w-full object-contain"
            onError={(e) => {
              if (e.currentTarget.src !== logo) e.currentTarget.src = logo;
            }}
          />
        </div>
        {!isSidebarCollapsed && (
          <div className="animate-in fade-in duration-500">
            <h1 className="text-xl font-bold text-white tracking-tight leading-tight">Carepoint</h1>
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-primary-400">
              {isSaaSAdmin ? "Platform Admin" : "HMS Suite"}
            </p>
          </div>
        )}
      </div>

      {/* Jump anywhere (⌘K) */}
      <div className={`relative px-4 pb-4 ${isSidebarCollapsed ? "px-2" : ""}`}>
        {isSidebarCollapsed ? (
          <button
            onClick={() => setPaletteOpen(true)}
            title="Jump anywhere (⌘K)"
            className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-secondary-400 hover:bg-white/10 hover:text-white transition-all"
          >
            <Search className="h-5 w-5" />
          </button>
        ) : (
          <button
            onClick={() => setPaletteOpen(true)}
            className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-secondary-500 transition-all hover:border-primary-500/30 hover:bg-white/10 hover:text-secondary-300"
          >
            <Search className="h-4 w-4 shrink-0" />
            <span className="flex-1 truncate">Jump anywhere...</span>
            <kbd className="rounded-md border border-white/15 bg-white/5 px-1.5 py-0.5 text-[10px] font-bold text-secondary-500">
              ⌘K
            </kbd>
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="relative flex-1 overflow-y-auto px-4 pb-4 space-y-6 scrollbar-hide">
        {categories.map((category) => {
          const modules = visibleByCategory[category] ?? [];
          if (modules.length === 0) return null;
          const sectionCollapsed = !!collapsedSections[category] && !isSidebarCollapsed;

          // Group parents for this category that have at least one visible child.
          const byCode = new Map(modules.map((m) => [m.code, m]));
          const groupsForCat = navGroups
            .filter((g) => g.category === category)
            .map((g) => ({
              group: g,
              kids: g.children
                .map((code) => byCode.get(code))
                .filter((m): m is AppModule => !!m),
            }))
            .filter((g) => g.kids.length > 0);
          const standalone = modules.filter((m) => !groupedCodes.has(m.code));

          // Render groups and standalone entries in registry order: a group
          // sits where its first visible child appears, so e.g. Dashboard
          // stays above the Requests sub-menu in Core.
          const idxOf = new Map(modules.map((m, i) => [m.code, i]));
          const rows = [
            ...groupsForCat.map((g) => ({
              kind: "group" as const,
              group: g.group,
              kids: g.kids,
              idx: Math.min(...g.kids.map((k) => idxOf.get(k.code) ?? 0)),
            })),
            ...standalone.map((m) => ({
              kind: "module" as const,
              module: m,
              idx: idxOf.get(m.code) ?? 0,
            })),
          ].sort((a, b) => a.idx - b.idx);

          return (
            <div key={category} className="space-y-1.5">
              {!isSidebarCollapsed ? (
                <button
                  onClick={() => toggleSection(category)}
                  className="group/section flex w-full items-center justify-between rounded-xl px-4 py-1.5 text-left transition-colors hover:bg-white/[0.03]"
                  aria-expanded={!sectionCollapsed}
                >
                  <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-secondary-500 group-hover/section:text-secondary-300 transition-colors">
                    {category}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="rounded-full bg-white/5 px-1.5 py-0.5 text-[9px] font-bold text-secondary-500">
                      {modules.length}
                    </span>
                    <ChevronDown
                      className={`h-3.5 w-3.5 text-secondary-600 transition-transform duration-200 ${
                        sectionCollapsed ? "-rotate-90" : ""
                      }`}
                    />
                  </span>
                </button>
              ) : (
                <div className="mx-auto h-px w-8 bg-white/10" />
              )}

              {!sectionCollapsed && (
                <div className="space-y-1 animate-in fade-in duration-200">
                  {isSidebarCollapsed ? (
                    // Icon rail: nesting collapses to a flat list of icons.
                    modules.map((module) => renderItem(module, false))
                  ) : (
                    rows.map((row) => {
                      if (row.kind === "module") return renderItem(row.module, false);
                      const { group, kids } = row;
                      const key = `grp:${group.code}`;
                      const containsActive = kids.some((k) => k.path === activePath);
                      const expanded = containsActive || collapsedSections[key] === false;
                      return (
                        <div key={group.code} className="space-y-1">
                          <button
                            onClick={() => toggleSection(key, expanded)}
                            aria-expanded={expanded}
                            className={`sidebar-link group w-full ${
                              containsActive
                                ? "text-primary-300"
                                : "text-secondary-300 hover:bg-white/5 hover:text-white"
                            }`}
                          >
                            <group.icon className="h-5 w-5 shrink-0 transition-transform group-hover:scale-110" />
                            <span className="flex-1 text-left">{group.label}</span>
                            <span className="rounded-full bg-white/5 px-1.5 py-0.5 text-[9px] font-bold text-secondary-500">
                              {kids.length}
                            </span>
                            <ChevronDown
                              className={`h-3.5 w-3.5 text-secondary-500 transition-transform duration-200 ${
                                expanded ? "" : "-rotate-90"
                              }`}
                            />
                          </button>
                          {expanded && (
                            <div className="ml-4 space-y-1 border-l border-white/10 pl-2 animate-in fade-in duration-200">
                              {kids.map((k) => renderItem(k, true))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer / User Profile */}
      <div className={`relative p-4 mt-auto border-t border-white/5 space-y-4 bg-secondary-950/60 ${isSidebarCollapsed ? "px-2" : ""}`}>
        <button
          type="button"
          onClick={() => navigate(routes.profile)}
          title={isSidebarCollapsed ? "My Profile" : "View my profile"}
          className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-all hover:bg-white/5 ${isSidebarCollapsed ? "justify-center px-0" : ""}`}
        >
          <div className="h-10 w-10 shrink-0 rounded-xl bg-secondary-800 flex items-center justify-center text-secondary-400 border border-white/10 group-hover:text-primary-400 group-hover:border-primary-500/40 transition-colors">
            <User className="h-5 w-5" />
          </div>
          {!isSidebarCollapsed && (
            <div className="flex-1 min-w-0 animate-in fade-in slide-in-from-left-2">
              <p className="text-sm font-bold text-white truncate">{user?.email || "User"}</p>
              <p className="text-xs text-secondary-500 truncate font-medium">
                {isSaaSAdmin ? "Global SaaS Administrator" : user?.status || "Staff"}
              </p>
            </div>
          )}
          {!isSidebarCollapsed && (
            <ChevronRight className="h-4 w-4 shrink-0 text-secondary-600 group-hover:text-primary-400 transition-colors" />
          )}
        </button>

        <div className={`grid gap-2 ${isSidebarCollapsed ? "grid-cols-1" : "grid-cols-2"}`}>
          <button
            onClick={() => navigate(routes.settings)}
            className="flex items-center justify-center gap-2 rounded-xl bg-white/5 py-2.5 text-xs font-bold text-secondary-300 hover:bg-white/10 hover:text-white transition-all"
            title={isSidebarCollapsed ? "System Setup" : ""}
          >
            <SettingsIcon className="h-4 w-4" />
            {!isSidebarCollapsed && <span>Setup</span>}
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 rounded-xl bg-rose-500/10 py-2.5 text-xs font-bold text-rose-400 hover:bg-rose-500/20 transition-all"
            title={isSidebarCollapsed ? "Sign Out" : ""}
          >
            <LogOut className="h-4 w-4" />
            {!isSidebarCollapsed && <span>Exit</span>}
          </button>
        </div>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        items={paletteItems}
        brand="Carepoint"
      />
    </aside>
  );
}
