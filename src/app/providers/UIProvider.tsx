import React, { createContext, useContext, useState, useEffect } from 'react';

interface UIContextType {
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar_collapsed');
    // Default to false (expanded) if not set
    return saved !== null ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', JSON.stringify(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  const toggleSidebar = () => setIsSidebarCollapsed((prev: boolean) => !prev);
  const setSidebarCollapsed = (collapsed: boolean) => setIsSidebarCollapsed(collapsed);

  return (
    <UIContext.Provider value={{ isSidebarCollapsed, toggleSidebar, setSidebarCollapsed }}>
      {children}
    </UIContext.Provider>
  );
};

export const useUI = () => {
  const context = useContext(UIContext);
  if (!context) throw new Error('useUI must be used within UIProvider');
  return context;
};
