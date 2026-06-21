import React, { createContext, useContext, useState, useCallback } from 'react';

import { STORAGE_KEYS, LEGACY_STORAGE_KEYS } from '../lib/brand';

export const SIDEBAR_WIDTH_EXPANDED = 256;
export const SIDEBAR_WIDTH_COLLAPSED = 72;

const SidebarContext = createContext(null);

export function SidebarProvider({ children }) {
  const [collapsed, setCollapsed] = useState(() => {
    const stored =
      localStorage.getItem(STORAGE_KEYS.sidebarCollapsed) ??
      localStorage.getItem(LEGACY_STORAGE_KEYS.sidebarCollapsed);
    return stored === 'true';
  });

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEYS.sidebarCollapsed, String(next));
      return next;
    });
  }, []);

  const width = collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED;

  return (
    <SidebarContext.Provider value={{ collapsed, toggleCollapsed, width }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
}
