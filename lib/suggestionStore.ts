import { create } from 'zustand';
import { Suggestion } from './types';

interface SuggestionStore {
  suggestions: Suggestion[];
  setSuggestions: (suggestions: Suggestion[]) => void;
  addSuggestion: (suggestion: Suggestion) => void;
  updateSuggestion: (suggestion: Suggestion) => void;
  removeSuggestion: (suggestionId: string) => void;
}

export const useSuggestionStore = create<SuggestionStore>((set) => ({
  suggestions: [],
  setSuggestions: (suggestions) => set({ suggestions }),
  addSuggestion: (suggestion) => set((state) => ({ suggestions: [suggestion, ...state.suggestions] })),
  updateSuggestion: (suggestion) => set((state) => ({
    suggestions: state.suggestions.map((s) => (s.id === suggestion.id ? { ...s, ...suggestion } : s)),
  })),
  removeSuggestion: (suggestionId) => set((state) => ({
    suggestions: state.suggestions.filter((s) => s.id !== suggestionId),
  })),
})); 