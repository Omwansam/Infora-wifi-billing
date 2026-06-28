import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

import { STORAGE_KEYS, LEGACY_STORAGE_KEYS } from '../lib/brand';
import { useIsMobileNav } from '../hooks/useMediaQuery';

export const SIDEBAR_WIDTH_EXPANDED = 256;
export const SIDEBAR_WIDTH_COLLAPSED = 72;

const SidebarContext = createContext(null);

export function SidebarProvider({ children }) {
  const isMobile = useIsMobileNav();
  const [collapsed, setCollapsed] = useState(() => {
    const stored =
      localStorage.getItem(STORAGE_KEYS.sidebarCollapsed) ??
      localStorage.getItem(LEGACY_STORAGE_KEYS.sidebarCollapsed);
    return stored === 'true';
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEYS.sidebarCollapsed, String(next));
      return next;
    });
  }, []);

  const openMobile = useCallback(() => setMobileOpen(true), []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);
  const toggleMobile = useCallback(() => setMobileOpen((prev) => !prev), []);

  useEffect(() => {
    if (!isMobile) setMobileOpen(false);
  }, [isMobile]);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') closeMobile();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [mobileOpen, closeMobile]);

  const width = isMobile ? 0 : collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED;

  return (
    <SidebarContext.Provider
      value={{
        collapsed,
        toggleCollapsed,
        width,
        isMobile,
        mobileOpen,
        openMobile,
        closeMobile,
        toggleMobile,
      }}
    >
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
