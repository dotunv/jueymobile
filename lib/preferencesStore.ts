import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { UserPreferences } from './types';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface PreferencesStore {
  preferences: UserPreferences | null;
  setPreferences: (preferences: UserPreferences) => void;
  updatePreferences: (updates: Partial<UserPreferences>) => void;
  clearPreferences: () => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  _hasHydrated: boolean;
  setHasHydrated: (hydrated: boolean) => void;
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
      _hasHydrated: false,
      setHasHydrated: (hydrated) => set({ _hasHydrated: hydrated }),
    }),
    {
      name: 'preferences-storage',
      partialize: (state) => ({ preferences: state.preferences }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated?.(true);
      },
      getStorage: () => AsyncStorage,
    }
  )
); 