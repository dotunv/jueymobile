import { Task, Suggestion, SuggestionCreateInput } from '../types';
import { DatabaseUtils } from '../database';
import { temporalPatternService } from './temporalPatternService';
import { sequentialPatternService } from './sequentialPatternService';
import { contextualPatternService, LocationContext, EnvironmentalContext } from './contextualPatternService';
import { useSuggestionStore } from '../suggestionStore';

/**
 * Suggestion Generation Engine
 * Combines all pattern types to generate intelligent task suggestions
 */

export interface SuggestionContext {
  userId: string;
  recentTasks: Task[];
  completedTasks: Task[];
  currentTime: Date;
  location?: LocationContext;
  environment?: EnvironmentalContext;
  userPreferences?: {
    preferredCategories?: string[];
    disabledCategories?: string[];
    suggestionFrequency?: 'low' | 'medium' | 'high';
    priorityPreference?: 'balanced' | 'important-first' | 'quick-wins';
  };
}

export interface RankedSuggestion {
  title: string;
  description?: string;
  category: string;
  confidence: number;
  reasoning: string;
  priority: 'low' | 'medium' | 'high';
  sources: string[];
  timeEstimate?: number;
  expiresIn?: number; // Minutes until expiration
}

export class SuggestionEngine {
  private readonly MIN_CONFIDENCE_THRESHOLD = 0.25;
  private readonly DIVERSITY_THRESHOLD = 0.3; // Minimum similarity for suggestions to be considered duplicates
  private readonly MAX_SUGGESTIONS_PER_CATEGORY = 2;
  private readonly DEFAULT_EXPIRATION_MINUTES = 120; // 2 hours
  private readonly CONTEXT_EXPIRATION_MINUTES = 30; // 30 minutes for context-sensitive suggestions

  /**
   * Generate intelligent suggestions based on all pattern types
   */
  async generateSuggestions(context: SuggestionContext, limit: number = 5): Promise<Suggestion[]> {
    // Get suggestions from each pattern type
    const temporalSuggestions = await this.getTemporalSuggestions(context);
    const sequentialSuggestions = await this.getSequentialSuggestions(context);
    const contextualSuggestions = await this.getContextualSuggestions(context);

    // Combine and rank all suggestions
    const rankedSuggestions = this.rankSuggestions([
      ...temporalSuggestions,
      ...sequentialSuggestions,
      ...contextualSuggestions
    ], context);

    // Apply diversity algorithm to avoid repetitive suggestions
    const diverseSuggestions = this.ensureSuggestionDiversity(rankedSuggestions);

    // Convert to Suggestion model and store in database
    const suggestions = await this.createSuggestions(
      context.userId,
      diverseSuggestions.slice(0, limit)
    );

    // Update suggestion store
    useSuggestionStore.getState().setSuggestions(suggestions);

    return suggestions;
  }
  /**

   * Get suggestions based on temporal patterns
   */
  private async getTemporalSuggestions(context: SuggestionContext): Promise<RankedSuggestion[]> {
    const { userId, currentTime } = context;
    
    // Get temporal patterns from service
    const patterns = await temporalPatternService.getTemporalPatternsForVisualization(userId);
    const suggestions: RankedSuggestion[] = [];

    // Current time context
    const currentHour = currentTime.getHours();
    const currentDay = currentTime.getDay();
    const currentDayOfMonth = currentTime.getDate();

    // Check hourly distribution for time-based suggestions
    const hourlyDistribution = patterns.hourlyDistribution;
    const relevantHours = Object.entries(hourlyDistribution)
      .filter(([hour, score]) => {
        const hourNum = parseInt(hour);
        // Consider current hour and next 2 hours
        return (hourNum >= currentHour && hourNum <= currentHour + 2) && score > 0;
      })
      .sort((a, b) => b[1] - a[1]); // Sort by score descending

    // Check daily distribution for day-based suggestions
    const dailyDistribution = patterns.dailyDistribution;
    const dayScore = dailyDistribution[currentDay] || 0;

    // Check category-time distribution
    const categoryTimeDistribution = patterns.categoryTimeDistribution;
    
    for (const [category, timeDistribution] of Object.entries(categoryTimeDistribution)) {
      // Skip empty categories
      if (context.userPreferences?.disabledCategories?.includes(category)) {
        continue;
      }

      // Check if this category has tasks typically done at this time
      const timeScore = timeDistribution[currentHour] || 0;
      
      if (timeScore > 0) {
        const confidence = this.calculateTemporalConfidence(timeScore, dayScore);
        
        if (confidence >= this.MIN_CONFIDENCE_THRESHOLD) {
          suggestions.push({
            title: this.generateTaskTitleForCategory(category),
            category,
            confidence,
            reasoning: `You often do ${category} tasks at this time of day`,
            priority: this.determinePriority(confidence),
            sources: ['temporal'],
            timeEstimate: this.estimateTimeForCategory(category),
            expiresIn: this.DEFAULT_EXPIRATION_MINUTES
          });
        }
      }
    }

    return suggestions;
  } 
 /**
   * Get suggestions based on sequential patterns
   */
  private async getSequentialSuggestions(context: SuggestionContext): Promise<RankedSuggestion[]> {
    const { userId, recentTasks } = context;
    
    // Get workflow suggestions from sequential pattern service
    const workflowSuggestions = await sequentialPatternService.generateWorkflowSuggestions(
      userId,
      recentTasks,
      10 // Get more than we need for diversity
    );

    // Convert to ranked suggestions
    return workflowSuggestions.map(suggestion => ({
      title: suggestion.nextTask,
      category: suggestion.category,
      confidence: suggestion.confidence,
      reasoning: suggestion.reasoning,
      priority: suggestion.confidence > 0.7 ? 'high' : suggestion.confidence > 0.4 ? 'medium' : 'low',
      sources: ['sequential'],
      timeEstimate: suggestion.estimatedTime,
      expiresIn: this.DEFAULT_EXPIRATION_MINUTES
    }));
  }

  /**
   * Get suggestions based on contextual patterns
   */
  private async getContextualSuggestions(context: SuggestionContext): Promise<RankedSuggestion[]> {
    const { userId, currentTime, location, environment } = context;
    
    if (!location && !environment) {
      return []; // No contextual data available
    }

    // Get context-aware suggestions
    const contextSuggestions = await contextualPatternService.generateContextAwareSuggestions(
      userId,
      {
        location,
        environment,
        timeOfDay: currentTime.getHours()
      },
      10 // Get more than we need for diversity
    );

    // Convert to ranked suggestions
    return contextSuggestions.map(suggestion => ({
      title: suggestion.taskTitle,
      category: suggestion.category,
      confidence: suggestion.confidence,
      reasoning: suggestion.reasoning,
      priority: suggestion.priority,
      sources: ['contextual'],
      timeEstimate: suggestion.estimatedDuration,
      expiresIn: this.CONTEXT_EXPIRATION_MINUTES // Context-sensitive suggestions expire faster
    }));
  }  /**

   * Rank suggestions based on multiple factors
   */
  private rankSuggestions(suggestions: RankedSuggestion[], context: SuggestionContext): RankedSuggestion[] {
    if (suggestions.length === 0) {
      return [];
    }

    // Apply user preferences
    const rankedSuggestions = suggestions.map(suggestion => {
      let adjustedConfidence = suggestion.confidence;

      // Boost preferred categories
      if (context.userPreferences?.preferredCategories?.includes(suggestion.category)) {
        adjustedConfidence *= 1.2;
      }

      // Apply priority preference
      if (context.userPreferences?.priorityPreference) {
        switch (context.userPreferences.priorityPreference) {
          case 'important-first':
            if (suggestion.priority === 'high') {
              adjustedConfidence *= 1.3;
            }
            break;
          case 'quick-wins':
            if (suggestion.timeEstimate && suggestion.timeEstimate < 15) {
              adjustedConfidence *= 1.2;
            }
            break;
          // 'balanced' is default, no adjustment needed
        }
      }

      // Adjust based on suggestion frequency preference
      if (context.userPreferences?.suggestionFrequency) {
        switch (context.userPreferences.suggestionFrequency) {
          case 'low':
            adjustedConfidence *= 0.8;
            break;
          case 'high':
            adjustedConfidence *= 1.2;
            break;
          // 'medium' is default, no adjustment needed
        }
      }

      // Boost multi-source suggestions
      if (suggestion.sources.length > 1) {
        adjustedConfidence *= 1 + (suggestion.sources.length * 0.1);
      }

      return {
        ...suggestion,
        confidence: Math.min(1, adjustedConfidence) // Cap at 1.0
      };
    });

    // Sort by adjusted confidence
    return rankedSuggestions.sort((a, b) => b.confidence - a.confidence);
  } 
 /**
   * Ensure suggestion diversity to avoid repetitive recommendations
   */
  private ensureSuggestionDiversity(suggestions: RankedSuggestion[]): RankedSuggestion[] {
    if (suggestions.length <= 1) {
      return suggestions;
    }

    const diverseSuggestions: RankedSuggestion[] = [];
    const categoryCount: Record<string, number> = {};

    for (const suggestion of suggestions) {
      // Skip if we already have enough suggestions from this category
      const category = suggestion.category;
      categoryCount[category] = categoryCount[category] || 0;
      
      if (categoryCount[category] >= this.MAX_SUGGESTIONS_PER_CATEGORY) {
        continue;
      }

      // Check if this suggestion is too similar to existing ones
      const isTooSimilar = diverseSuggestions.some(existingSuggestion => 
        this.calculateSimilarity(suggestion, existingSuggestion) > this.DIVERSITY_THRESHOLD
      );

      if (!isTooSimilar) {
        diverseSuggestions.push(suggestion);
        categoryCount[category]++;
      }
    }

    return diverseSuggestions;
  }

  /**
   * Calculate similarity between two suggestions
   */
  private calculateSimilarity(a: RankedSuggestion, b: RankedSuggestion): number {
    // Simple similarity based on title and category
    let similarity = 0;
    
    // Same category
    if (a.category === b.category) {
      similarity += 0.3;
    }
    
    // Similar title (basic string similarity)
    const titleSimilarity = this.calculateStringSimilarity(a.title, b.title);
    similarity += titleSimilarity * 0.7;
    
    return similarity;
  }  /**

   * Calculate string similarity (basic implementation)
   */
  private calculateStringSimilarity(a: string, b: string): number {
    const aLower = a.toLowerCase();
    const bLower = b.toLowerCase();
    
    // Check for exact match or substring
    if (aLower === bLower) {
      return 1;
    }
    if (aLower.includes(bLower) || bLower.includes(aLower)) {
      return 0.8;
    }
    
    // Check for word overlap
    const aWords = aLower.split(/\s+/);
    const bWords = bLower.split(/\s+/);
    const commonWords = aWords.filter(word => bWords.includes(word));
    
    if (commonWords.length > 0) {
      return commonWords.length / Math.max(aWords.length, bWords.length);
    }
    
    return 0;
  }

  /**
   * Create suggestion records from ranked suggestions
   */
  private async createSuggestions(userId: string, rankedSuggestions: RankedSuggestion[]): Promise<Suggestion[]> {
    const now = new Date();
    const suggestions: Suggestion[] = [];

    for (const rankedSuggestion of rankedSuggestions) {
      const expiresAt = new Date(now.getTime() + (rankedSuggestion.expiresIn || this.DEFAULT_EXPIRATION_MINUTES) * 60000);
      
      const suggestion: Suggestion = {
        id: DatabaseUtils.generateId(),
        user_id: userId,
        title: rankedSuggestion.title,
        description: rankedSuggestion.description,
        category: rankedSuggestion.category,
        confidence: rankedSuggestion.confidence * 100, // Convert to 0-100 scale
        reasoning: rankedSuggestion.reasoning,
        time_estimate: rankedSuggestion.timeEstimate ? `${rankedSuggestion.timeEstimate} mins` : undefined,
        priority: rankedSuggestion.priority,
        based_on: rankedSuggestion.sources,
        status: 'pending',
        created_at: DatabaseUtils.formatDate(now),
        expires_at: DatabaseUtils.formatDate(expiresAt)
      };

      suggestions.push(suggestion);
    }

    return suggestions;
  } 
 /**
   * Helper methods
   */
  private calculateTemporalConfidence(timeScore: number, dayScore: number): number {
    // Combine time and day scores with weights
    return (timeScore * 0.7) + (dayScore * 0.3);
  }

  private determinePriority(confidence: number): 'low' | 'medium' | 'high' {
    if (confidence > 0.7) return 'high';
    if (confidence > 0.4) return 'medium';
    return 'low';
  }

  private generateTaskTitleForCategory(category: string): string {
    // Generate contextually relevant task titles
    const templates: Record<string, string[]> = {
      'Work': ['Review emails', 'Prepare for meeting', 'Update project status'],
      'Personal': ['Call family', 'Plan weekend', 'Organize photos'],
      'Health': ['Take vitamins', 'Drink water', 'Stretch'],
      'Shopping': ['Buy groceries', 'Pick up prescription', 'Get gas'],
      'Exercise': ['Go for a walk', 'Do a workout', 'Stretch'],
      'Learning': ['Study for 30 minutes', 'Read an article', 'Watch a tutorial'],
      'Home': ['Clean kitchen', 'Do laundry', 'Water plants']
    };
    
    const categoryTemplates = templates[category] || [`${category} task`];
    return categoryTemplates[Math.floor(Math.random() * categoryTemplates.length)];
  }

  private estimateTimeForCategory(category: string): number {
    // Rough estimates in minutes
    const durations: Record<string, number> = {
      'Work': 30,
      'Personal': 15,
      'Health': 10,
      'Shopping': 45,
      'Exercise': 60,
      'Learning': 30,
      'Home': 20
    };
    
    return durations[category] || 20;
  }
}

// Export singleton instance
export const suggestionEngine = new SuggestionEngine();