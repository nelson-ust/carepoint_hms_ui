import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { appModules, navGroups, type AppModule } from "@/config/module-registry";
import { ChevronDown, LogOut, Search, Settings as SettingsIcon, User } from "lucide-react";
import { localStorageService, storageKeys } from "@/lib/storage/local-storage";
import { routes } from "@/config/routes";
import { useUI, SIDEBAR_COLLAPSED_WIDTH } from "@/app/providers/UIProvider";
import { useMyModules } from "@/lib/modules/useMyModules";
import { usePermissionGate } from "@/lib/permissions/usePermissionGate";
import { useTenantSettings } from "@/features/settings/hooks/use-branding";
import { resolveAssetUrl } from "@/lib/api/asset-url";
import { cn } from "@/lib/utils/cn";
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

/**
 * Navigation rail — flat, DevExpress-style: a light surface with a hairline
 * border, compact 34px rows, uppercase section captions and an accent bar on
 * the active entry. Collapses to a 64px icon rail.
 */
export function Sidebar() {
  const { isSidebarCollapsed, sidebarWidth, setSidebarWidth, resetSidebarWidth } = useUI();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { isEnabled } = useMyModules();
  const permissionGate = usePermissionGate();
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(loadCollapsedSections);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // --- Resizable sidebar: drag the right edge to stretch / shrink. ---
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);
  const startDrag = (e: React.MouseEvent) => {
    if (isSidebarCollapsed) return;
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startW: sidebarWidth };
    setDragging(true);
  };
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      setSidebarWidth(dragRef.current.startW + (e.clientX - dragRef.current.startX));
    };
    const onUp = () => setDragging(false);
    const prevCursor = document.body.style.cursor;
    const prevSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevSelect;
    };
  }, [dragging, setSidebarWidth]);

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
    : (["Core", "Clinical", "Dental", "Eye Clinic", "Orthopaedics", "Financial", "HR & Payroll", "Administrative", "Mortuary"] as const);

  // Subscription-aware menu: a tenant only sees entries whose moduleCode is
  // effective on their plan (core entries have no moduleCode and always show).
  const visibleByCategory = useMemo(() => {
    const map: Record<string, AppModule[]> = {};
    for (const category of categories) {
      map[category] = appModules.filter(
        (m) => m.category === category && isEnabled(m.moduleCode) && permissionGate.hasAny(m.permissions),
      );
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSaaSAdmin, isEnabled, permissionGate.known, permissionGate.isSuperuser, permissionGate.codes]);

  // Every visible entry, flattened for the command palette.
  const paletteItems = useMemo(() => Object.values(visibleByCategory).flat(), [visibleByCategory]);

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
  const groupedCodes = useMemo(() => new Set(navGroups.flatMap((g) => g.children)), []);

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
        className={cn(
          "dx-nav-item",
          active && "dx-nav-active",
          isChild && !isSidebarCollapsed && "dx-nav-child",
          isSidebarCollapsed && "mx-auto h-9 w-9 justify-center px-0",
        )}
        title={isSidebarCollapsed ? module.label : module.description || undefined}
      >
        <module.icon aria-hidden />
        {!isSidebarCollapsed && <span className="min-w-0 flex-1 truncate">{module.label}</span>}
      </NavLink>
    );
  };

  return (
    <aside
      style={{ width: isSidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : sidebarWidth }}
      className={cn(
        "dx dx-sidebar print:!hidden hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:flex-col",
        !dragging && "transition-[width] duration-200",
      )}
    >
      {/* Brand */}
      <div className={cn("flex h-12 items-center gap-2.5 border-b border-[var(--dx-border)] px-3", isSidebarCollapsed && "justify-center px-0")}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded border border-[var(--dx-border)] bg-white p-0.5">
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
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[13px] font-semibold text-[var(--dx-text)]">Carepoint HMS</p>
            <p className="truncate text-[10.5px] font-medium text-[var(--dx-text-faint)]">
              {isSaaSAdmin ? "Platform Admin" : "Hospital Workspace"}
            </p>
          </div>
        )}
      </div>

      {/* Jump anywhere (⌘K) */}
      <div className={cn("px-3 py-2", isSidebarCollapsed && "px-2")}>
        {isSidebarCollapsed ? (
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            title="Jump anywhere (⌘K)"
            className="dx-icon-btn mx-auto flex border-[var(--dx-border-strong)]"
          >
            <Search />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="dx-editor dx-editor-sm dx-editor-trigger gap-2 text-left text-[var(--dx-text-faint)]"
          >
            <Search className="h-3.5 w-3.5" aria-hidden />
            <span className="flex-1 truncate">Jump anywhere…</span>
            <kbd className="dx-kbd">⌘K</kbd>
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-3 overflow-y-auto px-2 pb-3">
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
              kids: g.children.map((code) => byCode.get(code)).filter((m): m is AppModule => !!m),
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
            <div key={category} className="space-y-0.5">
              {!isSidebarCollapsed ? (
                <button
                  type="button"
                  onClick={() => toggleSection(category)}
                  className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left hover:bg-[var(--dx-neutral-soft)]"
                  aria-expanded={!sectionCollapsed}
                >
                  <span className="dx-sidebar-section">{category}</span>
                  <ChevronDown
                    className={cn(
                      "h-3 w-3 text-[var(--dx-text-faint)] transition-transform duration-150",
                      sectionCollapsed && "-rotate-90",
                    )}
                    aria-hidden
                  />
                </button>
              ) : (
                <div className="dx-divider mx-auto my-1 w-6" />
              )}

              {!sectionCollapsed && (
                <div className="space-y-0.5">
                  {isSidebarCollapsed
                    ? // Icon rail: nesting collapses to a flat list of icons.
                      modules.map((module) => renderItem(module, false))
                    : rows.map((row) => {
                        if (row.kind === "module") return renderItem(row.module, false);
                        const { group, kids } = row;
                        const key = `grp:${group.code}`;
                        const containsActive = kids.some((k) => k.path === activePath);
                        const expanded = containsActive || collapsedSections[key] === false;
                        return (
                          <div key={group.code} className="space-y-0.5">
                            <button
                              type="button"
                              onClick={() => toggleSection(key, expanded)}
                              aria-expanded={expanded}
                              className={cn("dx-nav-item w-full", containsActive && "text-[var(--dx-text)]")}
                            >
                              <group.icon aria-hidden />
                              <span className="flex-1 truncate text-left">{group.label}</span>
                              <ChevronDown
                                className={cn("!h-3 !w-3 transition-transform duration-150", !expanded && "-rotate-90")}
                                aria-hidden
                              />
                            </button>
                            {expanded && (
                              <div className="ml-4 space-y-0.5 border-l border-[var(--dx-border)] pl-1.5">
                                {kids.map((k) => renderItem(k, true))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer / User */}
      <div className={cn("mt-auto space-y-2 border-t border-[var(--dx-border)] p-2", isSidebarCollapsed && "px-1.5")}>
        <button
          type="button"
          onClick={() => navigate(routes.profile)}
          title={isSidebarCollapsed ? "My Profile" : "View my profile"}
          className={cn("dx-nav-item w-full", isSidebarCollapsed && "mx-auto h-9 w-9 justify-center px-0")}
        >
          <User aria-hidden />
          {!isSidebarCollapsed && (
            <span className="min-w-0 flex-1 text-left leading-tight">
              <span className="block truncate text-[12.5px] font-semibold text-[var(--dx-text)]">
                {user?.email || "User"}
              </span>
              <span className="block truncate text-[11px] text-[var(--dx-text-faint)]">
                {isSaaSAdmin ? "Global SaaS Administrator" : user?.status || "Staff"}
              </span>
            </span>
          )}
        </button>

        <div className={cn("grid gap-1.5", isSidebarCollapsed ? "grid-cols-1" : "grid-cols-2")}>
          <button
            type="button"
            onClick={() => navigate(routes.settings)}
            className={cn("dx-btn dx-btn-sm", isSidebarCollapsed && "dx-btn-icon mx-auto")}
            title={isSidebarCollapsed ? "System Setup" : undefined}
          >
            <SettingsIcon aria-hidden />
            {!isSidebarCollapsed && <span>Setup</span>}
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className={cn("dx-btn dx-btn-sm dx-btn-outline-danger", isSidebarCollapsed && "dx-btn-icon mx-auto")}
            title={isSidebarCollapsed ? "Sign Out" : undefined}
          >
            <LogOut aria-hidden />
            {!isSidebarCollapsed && <span>Sign out</span>}
          </button>
        </div>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} items={paletteItems} brand="Carepoint" />

      {/* Resize handle — drag to stretch, double-click to reset. */}
      {!isSidebarCollapsed && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          title="Drag to resize · double-click to reset"
          onMouseDown={startDrag}
          onDoubleClick={resetSidebarWidth}
          className={cn(
            "group absolute inset-y-0 right-0 z-10 hidden w-1.5 cursor-col-resize lg:block",
            dragging ? "bg-[var(--dx-accent)]" : "hover:bg-[var(--dx-accent)]/40",
          )}
        >
          <span
            className={cn(
              "pointer-events-none absolute right-0 top-1/2 h-10 w-1 -translate-y-1/2 rounded-full bg-[var(--dx-border-strong)] transition-opacity",
              dragging ? "opacity-0" : "opacity-0 group-hover:opacity-100",
            )}
          />
        </div>
      )}
    </aside>
  );
}
