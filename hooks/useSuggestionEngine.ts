import { useState, useEffect, useCallback } from 'react';
import { Suggestion, Task } from '../lib/types';
import { useSuggestionStore } from '../lib/suggestionStore';
import { suggestionEngine } from '../lib/services/suggestionEngine';
import { suggestionRefreshService } from '../lib/services/suggestionRefreshService';
import { LocationContext, EnvironmentalContext } from '../lib/services/contextualPatternService';

interface UseSuggestionEngineOptions {
  userId: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface UseSuggestionEngineResult {
  suggestions: Suggestion[];
  loading: boolean;
  error: Error | null;
  refreshSuggestions: () => Promise<void>;
  handleContextChange: (contextType: 'location' | 'time' | 'task_completion' | 'preference') => Promise<void>;
}

/**
 * Hook for using the suggestion engine in React components
 */
export function useSuggestionEngine(
  options: UseSuggestionEngineOptions,
  recentTasks: Task[] = [],
  completedTasks: Task[] = [],
  location?: LocationContext,
  environment?: EnvironmentalContext
): UseSuggestionEngineResult {
  const { userId, autoRefresh = true } = options;
  const suggestions = useSuggestionStore(state => state.suggestions);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // Refresh suggestions
  const refreshSuggestions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const context = {
        userId,
        recentTasks,
        completedTasks,
        currentTime: new Date(),
        location,
        environment,
        userPreferences: {
          // These would typically come from a user preferences store
          suggestionFrequency: 'medium' as const,
          priorityPreference: 'balanced' as const
        }
      };

      await suggestionEngine.generateSuggestions(context);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to refresh suggestions'));
      console.error('Error refreshing suggestions:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, recentTasks, completedTasks, location, environment]);

  // Handle context changes
  const handleContextChange = useCallback(async (
    contextType: 'location' | 'time' | 'task_completion' | 'preference'
  ) => {
    try {
      setLoading(true);
      await suggestionRefreshService.refreshOnContextChange(userId, contextType);
    } catch (err) {
      console.error(`Error refreshing suggestions on ${contextType} change:`, err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Initial load and auto-refresh setup
  useEffect(() => {
    // Initial load if no suggestions
    if (suggestions.length === 0 && !loading) {
      refreshSuggestions();
    }

    // Set up auto-refresh
    if (autoRefresh) {
      suggestionRefreshService.startRefreshService(userId);
    }

    // Clean up
    return () => {
      if (autoRefresh) {
        suggestionRefreshService.stopRefreshService();
      }
    };
  }, [userId, autoRefresh, suggestions.length, loading, refreshSuggestions]);

  return {
    suggestions,
    loading,
    error,
    refreshSuggestions,
    handleContextChange
  };
}