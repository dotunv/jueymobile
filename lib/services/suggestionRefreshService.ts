import { Suggestion } from '../types';
import { DatabaseUtils } from '../database';
import { useSuggestionStore } from '../suggestionStore';
import { suggestionEngine } from './suggestionEngine';

/**
 * Suggestion Refresh Service
 * Handles suggestion expiration and refresh logic based on context changes
 */

export class SuggestionRefreshService {
  private readonly REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
  private refreshTimer: NodeJS.Timeout | null = null;
  private isRefreshing = false;

  /**
   * Start the suggestion refresh service
   */
  startRefreshService(userId: string): void {
    // Clear any existing timer
    this.stopRefreshService();

    // Set up periodic refresh
    this.refreshTimer = setInterval(() => {
      this.refreshExpiredSuggestions(userId);
    }, this.REFRESH_INTERVAL_MS);
  }

  /**
   * Stop the suggestion refresh service
   */
  stopRefreshService(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
   * Refresh expired suggestions
   */
  async refreshExpiredSuggestions(userId: string): Promise<void> {
    if (this.isRefreshing) {
      return; // Prevent concurrent refreshes
    }

    try {
      this.isRefreshing = true;

      // Get current suggestions from store
      const currentSuggestions = useSuggestionStore.getState().suggestions;
      
      // Check for expired suggestions
      const now = new Date();
      const expiredSuggestions = currentSuggestions.filter(suggestion => {
        if (!suggestion.expires_at) return false;
        return new Date(suggestion.expires_at) <= now;
      });

      // If we have expired suggestions, generate new ones
      if (expiredSuggestions.length > 0) {
        await this.generateNewSuggestions(userId, expiredSuggestions.length);
      }
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * Refresh suggestions based on context change
   */
  async refreshOnContextChange(
    userId: string, 
    contextChange: 'location' | 'time' | 'task_completion' | 'preference'
  ): Promise<void> {
    if (this.isRefreshing) {
      return; // Prevent concurrent refreshes
    }

    try {
      this.isRefreshing = true;

      // Get current suggestions from store
      const currentSuggestions = useSuggestionStore.getState().suggestions;
      
      // Determine which suggestions to refresh based on context change
      let suggestionsToRefresh: Suggestion[] = [];
      
      switch (contextChange) {
        case 'location':
          // Refresh location-based suggestions
          suggestionsToRefresh = currentSuggestions.filter(
            suggestion => suggestion.based_on.includes('contextual')
          );
          break;
        
        case 'time':
          // Refresh time-sensitive suggestions
          suggestionsToRefresh = currentSuggestions.filter(
            suggestion => suggestion.based_on.includes('temporal')
          );
          break;
        
        case 'task_completion':
          // Refresh sequential suggestions
          suggestionsToRefresh = currentSuggestions.filter(
            suggestion => suggestion.based_on.includes('sequential')
          );
          break;
        
        case 'preference':
          // Refresh all suggestions when preferences change
          suggestionsToRefresh = [...currentSuggestions];
          break;
      }

      // If we have suggestions to refresh, generate new ones
      if (suggestionsToRefresh.length > 0) {
        // Remove suggestions to be refreshed
        const refreshIds = suggestionsToRefresh.map(s => s.id);
        const remainingSuggestions = currentSuggestions.filter(
          suggestion => !refreshIds.includes(suggestion.id)
        );
        
        // Update store with remaining suggestions
        useSuggestionStore.getState().setSuggestions(remainingSuggestions);
        
        // Generate new suggestions
        await this.generateNewSuggestions(userId, suggestionsToRefresh.length);
      }
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * Generate new suggestions
   */
  private async generateNewSuggestions(userId: string, count: number): Promise<void> {
    try {
      // Get current context (simplified - in a real app, this would come from a context service)
      const context = {
        userId,
        recentTasks: [], // Would be populated from task store
        completedTasks: [], // Would be populated from task store
        currentTime: new Date(),
        // Other context would be populated from appropriate services
      };

      // Generate new suggestions
      await suggestionEngine.generateSuggestions(context, count);
    } catch (error) {
      console.error('Failed to generate new suggestions:', error);
    }
  }
}

// Export singleton instance
export const suggestionRefreshService = new SuggestionRefreshService();