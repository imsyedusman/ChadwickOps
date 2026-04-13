'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type UserPreferences = {
  userId?: string;
  columnVisibility: Record<string, boolean>;
  theme: 'light' | 'dark' | 'system';
  filters: Record<string, any>;
  isAdmin?: boolean; // For future role-based access
};

type UserPreferencesContextType = {
  preferences: UserPreferences;
  setPreference: <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => void;
  isLoading: boolean;
};

const defaultPreferences: UserPreferences = {
  columnVisibility: {
    projectNumber: true,
    itemName: true,
    projectName: true,
    client: true,
    projectManager: true,
    status: true,
    bayLocation: false,
    deliveryDate: true,
    drawingApprovalDate: false,
    drawingSubmittedDate: false,
    budgetHours: true,
    actualHours: true,
    remainingHours: true,
    progressPercent: true,
  },
  theme: 'system',
  filters: {},
  isAdmin: false,
};

const UserPreferencesContext = createContext<UserPreferencesContextType | undefined>(undefined);

export function UserPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load from localStorage for now, can be replaced with DB call later
    const saved = localStorage.getItem('user_preferences');
    if (saved) {
      try {
        setPreferences({ ...defaultPreferences, ...JSON.parse(saved) });
      } catch (e) {
        console.error('Failed to parse preferences', e);
      }
    }
    setIsLoading(false);
  }, []);

  const setPreference = <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
    setPreferences(prev => {
      const updated = { ...prev, [key]: value };
      localStorage.setItem('user_preferences', JSON.stringify(updated));
      return updated;
    });
  };

  return (
    <UserPreferencesContext.Provider value={{ preferences, setPreference, isLoading }}>
      {children}
    </UserPreferencesContext.Provider>
  );
}

export function useUserPreferences() {
  const context = useContext(UserPreferencesContext);
  if (context === undefined) {
    throw new Error('useUserPreferences must be used within a UserPreferencesProvider');
  }
  return context;
}
