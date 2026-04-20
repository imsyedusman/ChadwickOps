"use client";

import React, { createContext, useContext, useSyncExternalStore, useMemo } from "react";

type SidebarContextType = {
  isCollapsed: boolean;
  toggle: () => void;
};

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

// Helper to subscribe to localStorage changes
const subscribe = (callback: () => void) => {
  window.addEventListener('storage', callback);
  window.addEventListener('sidebar-toggle', callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener('sidebar-toggle', callback);
  };
};

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const isCollapsed = useSyncExternalStore(
    subscribe,
    () => {
      if (typeof window === 'undefined') return false;
      const saved = localStorage.getItem("sidebar-collapsed");
      return saved === "true";
    },
    () => false
  );

  const toggle = useMemo(() => () => {
    const next = !isCollapsed;
    localStorage.setItem("sidebar-collapsed", String(next));
    window.dispatchEvent(new Event('sidebar-toggle'));
  }, [isCollapsed]);

  return (
    <SidebarContext.Provider value={{ isCollapsed, toggle }}>
      <div 
        style={{ 
          "--sidebar-width": isCollapsed ? "var(--sidebar-width-compact)" : "var(--sidebar-width-expanded)" 
        } as React.CSSProperties}
        className="contents"
      >
        {children}
      </div>
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
}
