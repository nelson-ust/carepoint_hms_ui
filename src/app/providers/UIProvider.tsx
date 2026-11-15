import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// Resizable-sidebar bounds (px). Collapsed width is fixed at 64 (lg:w-16).
export const SIDEBAR_MIN_WIDTH = 208;
export const SIDEBAR_MAX_WIDTH = 460;
export const SIDEBAR_DEFAULT_WIDTH = 256; // matches the previous lg:w-64
export const SIDEBAR_COLLAPSED_WIDTH = 64;

const clampWidth = (w: number) =>
  Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, Math.round(w)));

interface UIContextType {
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  /** Expanded-sidebar width in px (ignored while collapsed). */
  sidebarWidth: number;
  setSidebarWidth: (width: number) => void;
  resetSidebarWidth: () => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem('sidebar_collapsed');
      return saved !== null ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });

  const [sidebarWidth, setSidebarWidthState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('sidebar_width');
      const n = saved !== null ? Number(JSON.parse(saved)) : NaN;
      return Number.isFinite(n) ? clampWidth(n) : SIDEBAR_DEFAULT_WIDTH;
    } catch {
      return SIDEBAR_DEFAULT_WIDTH;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('sidebar_collapsed', JSON.stringify(isSidebarCollapsed));
    } catch {
      /* ignore */
    }
  }, [isSidebarCollapsed]);

  useEffect(() => {
    try {
      localStorage.setItem('sidebar_width', JSON.stringify(sidebarWidth));
    } catch {
      /* ignore */
    }
  }, [sidebarWidth]);

  const toggleSidebar = () => setIsSidebarCollapsed((prev: boolean) => !prev);
  const setSidebarCollapsed = (collapsed: boolean) => setIsSidebarCollapsed(collapsed);
  const setSidebarWidth = useCallback((width: number) => setSidebarWidthState(clampWidth(width)), []);
  const resetSidebarWidth = useCallback(() => setSidebarWidthState(SIDEBAR_DEFAULT_WIDTH), []);

  return (
    <UIContext.Provider
      value={{
        isSidebarCollapsed,
        toggleSidebar,
        setSidebarCollapsed,
        sidebarWidth,
        setSidebarWidth,
        resetSidebarWidth,
      }}
    >
      {children}
    </UIContext.Provider>
  );
};

export const useUI = () => {
  const context = useContext(UIContext);
  if (!context) throw new Error('useUI must be used within UIProvider');
  return context;
};
