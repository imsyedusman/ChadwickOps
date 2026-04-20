'use client';

import React, { createContext, useContext, useSyncExternalStore, useMemo } from 'react';

type UserPreferences = {
  userId?: string;
  isAdmin?: boolean;
  columnVisibility: Record<string, boolean>;
  pageSize: number;
};

const defaultPreferences: UserPreferences = {
  columnVisibility: {
    projectNumber: true,
    projectName: true,
    itemName: true,
    status: true,
    budgetHours: true,
    actualHours: true,
    remainingHours: true,
    progressPercent: true,
    deliveryDate: true,
    bayLocation: true,
    drawingApprovalDate: false,
    drawingSubmittedDate: false,
    sheetmetalOrderedDate: false,
    sheetmetalDeliveredDate: false,
    switchgearOrderedDate: false,
    switchgearDeliveredDate: false,
    projectManager: true,
    total: true,
  },
  pageSize: 20,
  isAdmin: false,
};

type UserPreferencesContextType = {
  preferences: UserPreferences;
  setPreference: <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => void;
  isLoading: boolean;
};

const UserPreferencesContext = createContext<UserPreferencesContextType | undefined>(undefined);

// Simple external store to ensure stable references
let cachedPreferences: UserPreferences = defaultPreferences;
let isInitialized = false;

const getSnapshot = () => {
    if (typeof window === 'undefined') return defaultPreferences;
    
    if (!isInitialized) {
        const saved = localStorage.getItem('user_preferences');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                cachedPreferences = {
                    ...defaultPreferences,
                    ...parsed,
                    columnVisibility: {
                        ...defaultPreferences.columnVisibility,
                        ...(parsed.columnVisibility || {})
                    }
                };
            } catch {
                cachedPreferences = defaultPreferences;
            }
        }
        isInitialized = true;
    }
    return cachedPreferences;
};

// Helper to subscribe to localStorage changes
const subscribe = (callback: () => void) => {
  const handleStorage = (e: StorageEvent) => {
    if (e.key === 'user_preferences') {
        isInitialized = false; // Force re-parse on next snapshot
        callback();
    }
  };
  
  const handleInternal = () => {
    isInitialized = false; // Force re-parse on next snapshot
    callback();
  };

  window.addEventListener('storage', handleStorage);
  window.addEventListener('preferences-updated', handleInternal);
  
  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener('preferences-updated', handleInternal);
  };
};

export const UserPreferencesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const preferences = useSyncExternalStore(subscribe, getSnapshot, () => defaultPreferences);

  const setPreference = useMemo(() => <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
    const currentRaw = localStorage.getItem('user_preferences');
    const current = currentRaw ? JSON.parse(currentRaw) : {};
    const updated = { ...current, [key]: value };
    localStorage.setItem('user_preferences', JSON.stringify(updated));
    window.dispatchEvent(new Event('preferences-updated'));
  }, []);

  return (
    <UserPreferencesContext.Provider value={{ preferences, setPreference, isLoading: false }}>
      {children}
    </UserPreferencesContext.Provider>
  );
};

export const useUserPreferences = () => {
  const context = useContext(UserPreferencesContext);
  if (context === undefined) {
    throw new Error('useUserPreferences must be used within a UserPreferencesProvider');
  }
  return context;
};
