import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { UserPreferences } from './types';

interface PreferencesStore {
  preferences: UserPreferences | null;
  setPreferences: (preferences: UserPreferences) => void;
  updatePreferences: (updates: Partial<UserPreferences>) => void;
  clearPreferences: () => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export const usePreferencesStore = create<PreferencesStore>()(
  persist(
    (set) => ({
      preferences: null,
      isLoading: false,
      setPreferences: (preferences) => set({ preferences }),
      updatePreferences: (updates) => set((state) => ({
        preferences: state.preferences ? { ...state.preferences, ...updates } : null,
      })),
      clearPreferences: () => set({ preferences: null }),
      setIsLoading: (loading) => set({ isLoading: loading }),
    }),
    {
      name: 'preferences-storage',
      partialize: (state) => ({ preferences: state.preferences }),
    }
  )
); 