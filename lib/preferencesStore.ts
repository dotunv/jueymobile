import { create } from 'zustand';
import { UserPreferences } from './types';

interface PreferencesStore {
  preferences: UserPreferences | null;
  setPreferences: (preferences: UserPreferences) => void;
  updatePreferences: (updates: Partial<UserPreferences>) => void;
  clearPreferences: () => void;
}

export const usePreferencesStore = create<PreferencesStore>((set) => ({
  preferences: null,
  setPreferences: (preferences) => set({ preferences }),
  updatePreferences: (updates) => set((state) => ({
    preferences: state.preferences ? { ...state.preferences, ...updates } : null,
  })),
  clearPreferences: () => set({ preferences: null }),
})); 