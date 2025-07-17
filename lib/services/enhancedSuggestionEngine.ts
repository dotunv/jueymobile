import { getDatabase, DatabaseUtils } from '../database';
import { PatternDatabaseUtils, UserPattern, TemporalPattern } from '../patternDatabase';
import { Task, Suggestion, SuggestionCreateInput } from '../types';

/**
 * Enhanced intelligent suggestion generation engine that combines all pattern types
 * with improved ranking, diversity filtering, and context-aware refresh logic
 */

export interface UserContext {
  currentTime: Date;
  location?: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
  recentTasks: Task[];
  deviceContext?: {
    batteryLevel?: number;
    isCharging?: boolean;
    networkType?: string;
  };
  calendarEvents?: Array<{
    title: string;
    startTime: Date;
    endTime: Date;
  }>;
}

export interface SuggestionCandidate {
  title: string;
  description?: string;
  category: string;
  priority: 'low' | 'medium' | 'high';
  confidence: number;
  reasoning: string[];
  basedOn: string[];
  timeEstimate?: string;
  optimalTiming?: Date;
  expiresAt?: Date;
  patternStrength?: number;
  contextRelevance?: number;
}

export interface EnhancedSuggestionRanking {
  relevanceScore: number;
  timingScore: number;
  diversityScore: number;
  userPreferenceScore: number;
  contextScore: number;
  patternStrengthScore: number;
  finalScore: number;
}

export interface PatternCombination {
  patterns: (UserPattern | TemporalPattern)[];
  combinationType: 'temporal_frequency' | 'sequential_contextual' | 'temporal_contextual' | 'multi_pattern';
  strength: number;
  contextRelevance: number;
}

export class EnhancedSuggestionEngine {
  private userId: string;
  private maxSuggestions: number;
  private diversityThreshold: number;
  private minConfidenceThreshold: number;
  private contextChangeThreshold: number;
  private categoryDiversityWeight: number;
  private patternTypeWeight: number;

  constructor(
    userId: string, 
    maxSuggestions: number = 10, 
    diversityThreshold: number = 0.3,
    minConfidenceThreshold: number = 0.2,
    contextChangeThreshold: number = 0.4,
    categoryDiversityWeight: number = 0.4,
    patternTypeWeight: number = 0.3
  ) {
    this.userId = userId;
    this.maxSuggestions = maxSuggestions;
    this.diversityThreshold = diversityThreshold;
    this.minConfidenceThreshold = minConfidenceThreshold;
    this.contextChangeThreshold = contextChangeThreshold;
    this.categoryDiversityWeight = categoryDiversityWeight;
    this.patternTypeWeight = patternTypeWeight;
  }

  /**
   * Generate intelligent suggestions with enhanced pattern combination and ranking
   */
  async generateSuggestions(context: UserContext): Promise<Suggestion[]> {
    try {
      // Get all user patterns
      const patterns = await PatternDatabaseUtils.getUserPatterns(this.userId);
      const temporalPatterns = await PatternDatabaseUtils.getTemporalPatterns(this.userId);
      
      // Generate suggestion candidates from different pattern types
      const candidates: SuggestionCandidate[] = [];
      
      // Generate from individual pattern types
      candidates.push(...await this.generateFromTemporalPatterns(temporalPatterns, context));
      candidates.push(...await this.generateFromSequentialPatterns(patterns, context));
      candidates.push(...await this.generateFromContextualPatterns(patterns, context));
      candidates.push(...await this.generateFromFrequencyPatterns(patterns, context));
      
      // Generate hybrid suggestions combining multiple pattern types
      candidates.push(...await this.generateHybridSuggestions(patterns, temporalPatterns, context));
      
      // Filter out low-confidence candidates
      const filteredCandidates = candidates.filter(c => c.confidence >= this.minConfidenceThreshold);
      
      // Enhanced ranking with multiple factors
      const rankedSuggestions = await this.enhancedRankSuggestions(filteredCandidates, context);
      
      // Apply enhanced diversity algorithm
      const diverseSuggestions = this.applyEnhancedDiversityFilter(rankedSuggestions, context);
      
      // Convert to Suggestion objects and save to database
      const suggestions = await this.createSuggestionRecords(diverseSuggestions);
      
      return suggestions;
    } catch (error) {
      console.error('Error generating enhanced suggestions:', error);
      return [];
    }
  }
}  
/**
   * Generate hybrid suggestions combining multiple pattern types
   */
  private async generateHybridSuggestions(
    patterns: UserPattern[],
    temporalPatterns: TemporalPattern[],
    context: UserContext
  ): Promise<SuggestionCandidate[]> {
    const candidates: SuggestionCandidate[] = [];
    
    // Find patterns that can be combined for stronger suggestions
    const patternCombinations = this.findPatternCombinations(patterns, temporalPatterns, context);
    
    for (const combination of patternCombinations) {
      const hybridCandidate = this.createHybridSuggestion(combination, context);
      if (hybridCandidate && hybridCandidate.confidence >= this.minConfidenceThreshold) {
        candidates.push(hybridCandidate);
      }
    }
    
    return candidates;
  }

  /**
   * Find patterns that can be combined for stronger suggestions
   */
  private findPatternCombinations(
    patterns: UserPattern[],
    temporalPatterns: TemporalPattern[],
    context: UserContext
  ): PatternCombination[] {
    const combinations: PatternCombination[] = [];
    
    // Combine temporal and frequency patterns for the same task
    for (const temporalPattern of temporalPatterns) {
      const matchingFrequencyPatterns = patterns.filter(p => 
        p.pattern_type === 'frequency' &&
        p.pattern_data.taskTitle?.toLowerCase() === temporalPattern.task_title.toLowerCase()
      );
      
      for (const freqPattern of matchingFrequencyPatterns) {
        const combinedStrength = (temporalPattern.confidence + freqPattern.confidence) / 2;
        const contextRelevance = this.calculateContextRelevance(temporalPattern, context);
        
        if (combinedStrength > 0.5) {
          combinations.push({
            patterns: [temporalPattern, freqPattern],
            combinationType: 'temporal_frequency',
            strength: combinedStrength,
            contextRelevance
          });
        }
      }
    }
    
    // Combine sequential and contextual patterns
    const sequentialPatterns = patterns.filter(p => p.pattern_type === 'sequential');
    const contextualPatterns = patterns.filter(p => p.pattern_type === 'contextual');
    
    for (const seqPattern of sequentialPatterns) {
      for (const contextPattern of contextualPatterns) {
        if (this.patternsAreCompatible(seqPattern, contextPattern, context)) {
          const combinedStrength = (seqPattern.confidence + contextPattern.confidence) / 2;
          const contextRelevance = this.calculatePatternContextRelevance(contextPattern, context);
          
          if (combinedStrength > 0.4) {
            combinations.push({
              patterns: [seqPattern, contextPattern],
              combinationType: 'sequential_contextual',
              strength: combinedStrength,
              contextRelevance
            });
          }
        }
      }
    }
    
    // Sort by combined score and return top combinations
    return combinations
      .sort((a, b) => (b.strength + b.contextRelevance) - (a.strength + a.contextRelevance))
      .slice(0, 5); // Limit to top 5 combinations
  }

  /**
   * Calculate context relevance for temporal pattern
   */
  private calculateContextRelevance(temporalPattern: TemporalPattern, context: UserContext): number {
    const currentHour = context.currentTime.getHours();
    const currentDay = context.currentTime.getDay();
    
    // Time relevance
    const hourDiff = Math.abs(currentHour - temporalPattern.time_of_day);
    const timeRelevance = Math.max(0, 1 - (hourDiff / 12)); // Decay over 12 hours
    
    // Day relevance
    const dayRelevance = currentDay === temporalPattern.day_of_week ? 1 : 0.3;
    
    return (timeRelevance + dayRelevance) / 2;
  }

  /**
   * Calculate context relevance for user pattern
   */
  private calculatePatternContextRelevance(pattern: UserPattern, context: UserContext): number {
    const patternData = pattern.pattern_data;
    let relevance = 0.5; // Base relevance
    
    // Time context relevance
    if (patternData.timeContext) {
      const currentHour = context.currentTime.getHours();
      if (currentHour >= patternData.timeContext.start && currentHour <= patternData.timeContext.end) {
        relevance += 0.3;
      }
    }
    
    // Location context relevance
    if (context.location && patternData.location) {
      const distance = this.calculateDistance(
        context.location.latitude, context.location.longitude,
        patternData.location.latitude, patternData.location.longitude
      );
      
      if (distance < 0.5) { // Within 500 meters
        relevance += 0.4;
      } else if (distance < 2) { // Within 2 km
        relevance += 0.2;
      }
    }
    
    return Math.min(1, relevance);
  }

  /**
   * Check if two patterns are compatible for combination
   */
  private patternsAreCompatible(pattern1: UserPattern, pattern2: UserPattern, context: UserContext): boolean {
    const data1 = pattern1.pattern_data;
    const data2 = pattern2.pattern_data;
    
    // Category compatibility
    if (data1.category && data2.category && data1.category === data2.category) {
      return true;
    }
    
    // Time compatibility
    if (data1.timeContext && data2.timeContext) {
      const overlap = this.timeRangesOverlap(data1.timeContext, data2.timeContext);
      if (overlap) return true;
    }
    
    return false;
  }

  /**
   * Create a hybrid suggestion from combined patterns
   */
  private createHybridSuggestion(
    combination: PatternCombination,
    context: UserContext
  ): SuggestionCandidate | null {
    const { patterns, combinationType, strength, contextRelevance } = combination;
    
    if (patterns.length < 2) return null;
    
    // Extract information from combined patterns
    let title = '';
    let category = 'General';
    let priority: 'low' | 'medium' | 'high' = 'medium';
    const reasoning: string[] = [];
    const basedOn: string[] = [];
    let timeEstimate = '30-60 mins';
    
    // Process each pattern in the combination
    for (const pattern of patterns) {
      if ('task_title' in pattern) {
        // Temporal pattern
        title = pattern.task_title;
        category = pattern.task_category;
        priority = this.calculatePriorityFromFrequency(pattern.frequency);
        reasoning.push(`Matches your ${pattern.period_type} schedule on ${this.getDayName(pattern.day_of_week)}`);
        basedOn.push('temporal_pattern');
        timeEstimate = this.estimateTimeFromCategory(pattern.task_category);
      } else {
        // User pattern
        const patternData = pattern.pattern_data;
        
        if (!title && patternData.taskTitle) {
          title = patternData.taskTitle;
        }
        
        if (patternData.category) {
          category = patternData.category;
        }
        
        // Add pattern-specific reasoning
        switch (pattern.pattern_type) {
          case 'frequency':
            reasoning.push(`Due based on your ${patternData.intervalDays}-day cycle`);
            basedOn.push('frequency_pattern');
            break;
          case 'sequential':
            reasoning.push('Next step in your established workflow');
            basedOn.push('sequential_pattern');
            break;
          case 'contextual':
            reasoning.push('Matches your current context and environment');
            basedOn.push('contextual_pattern');
            break;
        }
      }
    }
    
    // Ensure we have a valid title
    if (!title) {
      title = `${category} Task`;
    }
    
    // Calculate enhanced confidence from combination
    const baseConfidence = strength;
    const combinationBonus = 0.1 * (patterns.length - 1); // Bonus for multiple patterns
    const contextBonus = contextRelevance * 0.15; // Bonus for context relevance
    const finalConfidence = Math.min(0.95, baseConfidence + combinationBonus + contextBonus);
    
    // Create description highlighting the combination
    const description = `Suggested based on multiple patterns: ${this.getCombinationDescription(combinationType)}`;
    
    return {
      title,
      description,
      category,
      priority,
      confidence: finalConfidence,
      reasoning,
      basedOn: [...new Set(basedOn)], // Remove duplicates
      timeEstimate,
      optimalTiming: this.calculateOptimalTimingFromCombination(patterns, context),
      expiresAt: this.calculateExpirationTime(context.currentTime, 6), // 6 hours for hybrid suggestions
      patternStrength: strength,
      contextRelevance
    };
  }  /
**
   * Enhanced ranking with multiple factors
   */
  private async enhancedRankSuggestions(
    candidates: SuggestionCandidate[], 
    context: UserContext
  ): Promise<Array<SuggestionCandidate & { ranking: EnhancedSuggestionRanking }>> {
    const rankedSuggestions = [];
    
    for (const candidate of candidates) {
      const ranking = await this.calculateEnhancedSuggestionRanking(candidate, context);
      rankedSuggestions.push({ ...candidate, ranking });
    }
    
    // Sort by final score
    rankedSuggestions.sort((a, b) => b.ranking.finalScore - a.ranking.finalScore);
    
    return rankedSuggestions.slice(0, this.maxSuggestions * 2); // Get more for diversity filtering
  }

  /**
   * Calculate enhanced ranking scores for a suggestion
   */
  private async calculateEnhancedSuggestionRanking(
    candidate: SuggestionCandidate, 
    context: UserContext
  ): Promise<EnhancedSuggestionRanking> {
    // Relevance score based on confidence and pattern strength
    const relevanceScore = candidate.confidence;
    
    // Timing score based on optimal timing vs current time
    let timingScore = 0.5; // Default neutral score
    if (candidate.optimalTiming) {
      const timeDiff = Math.abs(context.currentTime.getTime() - candidate.optimalTiming.getTime());
      const hoursDiff = timeDiff / (1000 * 60 * 60);
      timingScore = Math.max(0, 1 - (hoursDiff / 24)); // Decay over 24 hours
    }
    
    // User preference score based on historical feedback
    const userPreferenceScore = await this.calculateUserPreferenceScore(candidate);
    
    // Context score based on current context relevance
    const contextScore = candidate.contextRelevance || 0.5;
    
    // Pattern strength score
    const patternStrengthScore = candidate.patternStrength || candidate.confidence;
    
    // Diversity score (will be adjusted in diversity filter)
    const diversityScore = 1.0;
    
    // Calculate final weighted score with enhanced factors
    const finalScore = (
      relevanceScore * 0.25 +
      timingScore * 0.2 +
      userPreferenceScore * 0.2 +
      contextScore * 0.15 +
      patternStrengthScore * 0.15 +
      diversityScore * 0.05
    );
    
    return {
      relevanceScore,
      timingScore,
      diversityScore,
      userPreferenceScore,
      contextScore,
      patternStrengthScore,
      finalScore
    };
  }

  /**
   * Apply enhanced diversity filter to avoid repetitive recommendations
   */
  private applyEnhancedDiversityFilter(
    rankedSuggestions: Array<SuggestionCandidate & { ranking: EnhancedSuggestionRanking }>,
    context: UserContext
  ): SuggestionCandidate[] {
    const diverseSuggestions: SuggestionCandidate[] = [];
    const categoryCount: Record<string, number> = {};
    const patternTypeCount: Record<string, number> = {};
    const titleSimilarity: string[] = [];
    
    // Dynamic category limits based on total suggestions
    const maxPerCategory = Math.max(2, Math.floor(this.maxSuggestions / 3));
    const maxPerPatternType = Math.max(1, Math.floor(this.maxSuggestions / 4));
    
    for (const suggestion of rankedSuggestions) {
      const category = suggestion.category;
      const patternTypes = suggestion.basedOn;
      
      // Check category diversity
      const currentCategoryCount = categoryCount[category] || 0;
      if (currentCategoryCount >= maxPerCategory) {
        continue;
      }
      
      // Check pattern type diversity
      let patternTypeExceeded = false;
      for (const patternType of patternTypes) {
        const currentPatternCount = patternTypeCount[patternType] || 0;
        if (currentPatternCount >= maxPerPatternType) {
          patternTypeExceeded = true;
          break;
        }
      }
      
      if (patternTypeExceeded) {
        continue;
      }
      
      // Check title similarity to avoid near-duplicates
      const isSimilar = titleSimilarity.some(existingTitle => 
        this.calculateTitleSimilarity(suggestion.title, existingTitle) > 0.8
      );
      
      if (isSimilar) {
        continue;
      }
      
      // Calculate diversity penalties
      const categoryPenalty = currentCategoryCount * this.categoryDiversityWeight;
      const patternTypePenalty = Math.max(...patternTypes.map(pt => 
        (patternTypeCount[pt] || 0) * this.patternTypeWeight
      ));
      
      // Adjust diversity score
      const totalPenalty = categoryPenalty + patternTypePenalty;
      suggestion.ranking.diversityScore = Math.max(0, 1 - totalPenalty);
      
      // Recalculate final score with adjusted diversity
      suggestion.ranking.finalScore = (
        suggestion.ranking.relevanceScore * 0.25 +
        suggestion.ranking.timingScore * 0.2 +
        suggestion.ranking.userPreferenceScore * 0.2 +
        suggestion.ranking.contextScore * 0.15 +
        suggestion.ranking.patternStrengthScore * 0.15 +
        suggestion.ranking.diversityScore * 0.05
      );
      
      // Add to diverse suggestions
      diverseSuggestions.push(suggestion);
      titleSimilarity.push(suggestion.title);
      
      // Update counts
      categoryCount[category] = currentCategoryCount + 1;
      for (const patternType of patternTypes) {
        patternTypeCount[patternType] = (patternTypeCount[patternType] || 0) + 1;
      }
      
      // Stop if we have enough suggestions
      if (diverseSuggestions.length >= this.maxSuggestions) {
        break;
      }
    }
    
    // Sort again after diversity adjustment
    diverseSuggestions.sort((a, b) => (b as any).ranking.finalScore - (a as any).ranking.finalScore);
    
    return diverseSuggestions.slice(0, this.maxSuggestions);
  }

  /**
   * Calculate title similarity between two suggestions
   */
  private calculateTitleSimilarity(title1: string, title2: string): number {
    const words1 = title1.toLowerCase().split(/\s+/);
    const words2 = title2.toLowerCase().split(/\s+/);
    
    const commonWords = words1.filter(word => words2.includes(word));
    const totalWords = new Set([...words1, ...words2]).size;
    
    return commonWords.length / totalWords;
  }  
// Helper methods
  private getDayName(dayIndex: number): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayIndex] || 'Unknown';
  }

  private calculatePriorityFromFrequency(frequency: number): 'low' | 'medium' | 'high' {
    if (frequency >= 5) return 'high';
    if (frequency >= 2) return 'medium';
    return 'low';
  }

  private estimateTimeFromCategory(category: string): string {
    const timeEstimates: Record<string, string> = {
      'Work': '1-2 hours',
      'Personal': '30 mins',
      'Health': '45 mins',
      'Shopping': '1 hour',
      'Exercise': '1 hour',
      'Learning': '1-2 hours',
      'Social': '2-3 hours',
      'Household': '30-60 mins'
    };
    
    return timeEstimates[category] || '30-60 mins';
  }

  private getCombinationDescription(combinationType: string): string {
    switch (combinationType) {
      case 'temporal_frequency':
        return 'timing and frequency patterns';
      case 'sequential_contextual':
        return 'workflow and context patterns';
      case 'temporal_contextual':
        return 'timing and context patterns';
      case 'multi_pattern':
        return 'multiple behavioral patterns';
      default:
        return 'combined patterns';
    }
  }

  private calculateOptimalTimingFromCombination(
    patterns: (UserPattern | TemporalPattern)[],
    context: UserContext
  ): Date {
    // Find temporal patterns in the combination
    const temporalPattern = patterns.find(p => 'task_title' in p) as TemporalPattern;
    
    if (temporalPattern) {
      const optimalTime = new Date(context.currentTime);
      optimalTime.setHours(temporalPattern.time_of_day, 0, 0, 0);
      
      // If the optimal time has passed today, suggest for next occurrence
      if (optimalTime.getTime() < context.currentTime.getTime()) {
        const daysToAdd = temporalPattern.period_type === 'daily' ? 1 : 
                         temporalPattern.period_type === 'weekly' ? 7 : 30;
        optimalTime.setDate(optimalTime.getDate() + daysToAdd);
      }
      
      return optimalTime;
    }
    
    // Fallback to current time + 1 hour
    const optimalTime = new Date(context.currentTime);
    optimalTime.setHours(optimalTime.getHours() + 1);
    return optimalTime;
  }

  private calculateExpirationTime(currentTime: Date, hoursFromNow: number): Date {
    const expirationTime = new Date(currentTime);
    expirationTime.setHours(expirationTime.getHours() + hoursFromNow);
    return expirationTime;
  }

  private timeRangesOverlap(range1: { start: number; end: number }, range2: { start: number; end: number }): boolean {
    return range1.start <= range2.end && range2.start <= range1.end;
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private async calculateUserPreferenceScore(candidate: SuggestionCandidate): Promise<number> {
    try {
      const db = await getDatabase();
      
      // Get feedback for similar suggestions
      const feedbackRows = await db.getAllAsync<any>(`
        SELECT f.feedback_type, COUNT(*) as count
        FROM feedback f
        JOIN suggestions s ON f.suggestion_id = s.id
        WHERE s.user_id = ? AND s.category = ?
        GROUP BY f.feedback_type
      `, [this.userId, candidate.category]);
      
      let positiveCount = 0;
      let negativeCount = 0;
      
      for (const row of feedbackRows) {
        if (row.feedback_type === 'positive') {
          positiveCount = row.count;
        } else if (row.feedback_type === 'negative') {
          negativeCount = row.count;
        }
      }
      
      const totalFeedback = positiveCount + negativeCount;
      if (totalFeedback === 0) return 0.5; // Neutral score for no feedback
      
      return positiveCount / totalFeedback;
    } catch (error) {
      console.error('Error calculating user preference score:', error);
      return 0.5; // Default neutral score
    }
  }

  // Pattern generation methods (simplified implementations)
  private async generateFromTemporalPatterns(patterns: TemporalPattern[], context: UserContext): Promise<SuggestionCandidate[]> {
    const candidates: SuggestionCandidate[] = [];
    const currentHour = context.currentTime.getHours();
    const currentDay = context.currentTime.getDay();
    
    for (const pattern of patterns) {
      // Check if current time matches pattern timing
      const hourDiff = Math.abs(currentHour - pattern.time_of_day);
      const dayMatch = currentDay === pattern.day_of_week;
      
      if (hourDiff <= 1 && dayMatch && pattern.confidence > 0.3) {
        // Check if task hasn't been done recently
        const lastOccurrence = new Date(pattern.last_occurrence);
        const daysSinceLastOccurrence = (context.currentTime.getTime() - lastOccurrence.getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysSinceLastOccurrence >= this.getMinDaysBetweenOccurrences(pattern.period_type)) {
          candidates.push({
            title: pattern.task_title,
            description: `Based on your ${pattern.period_type} pattern`,
            category: pattern.task_category,
            priority: this.calculatePriorityFromFrequency(pattern.frequency),
            confidence: pattern.confidence * 0.9,
            reasoning: [
              `You typically do this task on ${this.getDayName(pattern.day_of_week)} around ${this.formatHour(pattern.time_of_day)}`,
              `Last completed ${Math.floor(daysSinceLastOccurrence)} days ago`
            ],
            basedOn: ['temporal_pattern'],
            timeEstimate: this.estimateTimeFromCategory(pattern.task_category),
            optimalTiming: this.calculateOptimalTiming(pattern, context.currentTime),
            expiresAt: this.calculateExpirationTime(context.currentTime, 2),
            contextRelevance: this.calculateContextRelevance(pattern, context)
          });
        }
      }
    }
    
    return candidates;
  }

  private async generateFromSequentialPatterns(patterns: UserPattern[], context: UserContext): Promise<SuggestionCandidate[]> {
    const candidates: SuggestionCandidate[] = [];
    const sequentialPatterns = patterns.filter(p => p.pattern_type === 'sequential');
    
    for (const pattern of sequentialPatterns) {
      if (pattern.confidence < 0.4) continue;
      
      const patternData = pattern.pattern_data;
      const taskSequence = patternData.sequence || [];
      const lastCompletedTasks = context.recentTasks
        .filter(t => t.completed)
        .slice(0, 5)
        .map(t => t.title.toLowerCase());
      
      // Find matching sequences
      for (let i = 0; i < taskSequence.length - 1; i++) {
        const currentTask = taskSequence[i].toLowerCase();
        const nextTask = taskSequence[i + 1];
        
        if (lastCompletedTasks.includes(currentTask)) {
          // Check if next task hasn't been completed recently
          const nextTaskCompleted = context.recentTasks.some(t => 
            t.completed && t.title.toLowerCase() === nextTask.toLowerCase() &&
            new Date(t.completed_at!).getTime() > Date.now() - (24 * 60 * 60 * 1000)
          );
          
          if (!nextTaskCompleted) {
            candidates.push({
              title: nextTask,
              description: `Next step in your workflow`,
              category: patternData.category || 'General',
              priority: 'medium',
              confidence: pattern.confidence * 0.85,
              reasoning: [
                `You typically do this after "${currentTask}"`,
                `Part of your established workflow pattern`
              ],
              basedOn: ['sequential_pattern'],
              timeEstimate: this.estimateTimeFromCategory(patternData.category || 'General'),
              expiresAt: this.calculateExpirationTime(context.currentTime, 4),
              contextRelevance: this.calculatePatternContextRelevance(pattern, context)
            });
          }
        }
      }
    }
    
    return candidates;
  }

  private async generateFromContextualPatterns(patterns: UserPattern[], context: UserContext): Promise<SuggestionCandidate[]> {
    const candidates: SuggestionCandidate[] = [];
    const contextualPatterns = patterns.filter(p => p.pattern_type === 'contextual');
    
    for (const pattern of contextualPatterns) {
      if (pattern.confidence < 0.3) continue;
      
      const patternData = pattern.pattern_data;
      let contextMatch = false;
      const matchReasons: string[] = [];
      
      // Check location context
      if (context.location && patternData.location) {
        const distance = this.calculateDistance(
          context.location.latitude, context.location.longitude,
          patternData.location.latitude, patternData.location.longitude
        );
        
        if (distance < 0.5) {
          contextMatch = true;
          matchReasons.push(`You're near ${patternData.location.name || 'a familiar location'}`);
        }
      }
      
      // Check time context
      if (patternData.timeContext) {
        const currentHour = context.currentTime.getHours();
        const timeRange = patternData.timeContext;
        
        if (currentHour >= timeRange.start && currentHour <= timeRange.end) {
          contextMatch = true;
          matchReasons.push(`Time matches your usual pattern (${timeRange.start}:00-${timeRange.end}:00)`);
        }
      }
      
      if (contextMatch) {
        candidates.push({
          title: patternData.taskTitle || 'Contextual Task',
          description: patternData.description || 'Based on your current context',
          category: patternData.category || 'General',
          priority: patternData.priority || 'medium',
          confidence: pattern.confidence * 0.8,
          reasoning: matchReasons,
          basedOn: ['contextual_pattern'],
          timeEstimate: patternData.timeEstimate,
          expiresAt: this.calculateExpirationTime(context.currentTime, 3),
          contextRelevance: this.calculatePatternContextRelevance(pattern, context)
        });
      }
    }
    
    return candidates;
  }

  private async generateFromFrequencyPatterns(patterns: UserPattern[], context: UserContext): Promise<SuggestionCandidate[]> {
    const candidates: SuggestionCandidate[] = [];
    const frequencyPatterns = patterns.filter(p => p.pattern_type === 'frequency');
    
    for (const pattern of frequencyPatterns) {
      if (pattern.confidence < 0.4) continue;
      
      const patternData = pattern.pattern_data;
      const lastOccurrence = pattern.last_occurrence ? new Date(pattern.last_occurrence) : null;
      
      if (!lastOccurrence) continue;
      
      const daysSinceLastOccurrence = (context.currentTime.getTime() - lastOccurrence.getTime()) / (1000 * 60 * 60 * 24);
      const expectedInterval = patternData.intervalDays || 7;
      
      // Check if it's time for the next occurrence
      if (daysSinceLastOccurrence >= expectedInterval * 0.8) {
        const urgency = daysSinceLastOccurrence > expectedInterval ? 'high' : 'medium';
        
        candidates.push({
          title: patternData.taskTitle || 'Recurring Task',
          description: patternData.description || `You typically do this every ${expectedInterval} days`,
          category: patternData.category || 'General',
          priority: urgency,
          confidence: pattern.confidence * (daysSinceLastOccurrence / expectedInterval),
          reasoning: [
            `You typically do this every ${expectedInterval} days`,
            `Last completed ${Math.floor(daysSinceLastOccurrence)} days ago`
          ],
          basedOn: ['frequency_pattern'],
          timeEstimate: patternData.timeEstimate,
          expiresAt: this.calculateExpirationTime(context.currentTime, 24),
          contextRelevance: 0.5 // Neutral context relevance for frequency patterns
        });
      }
    }
    
    return candidates;
  }

  // Additional helper methods
  private getMinDaysBetweenOccurrences(periodType: string): number {
    switch (periodType) {
      case 'daily': return 1;
      case 'weekly': return 7;
      case 'monthly': return 30;
      default: return 7;
    }
  }

  private formatHour(hour: number): string {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:00 ${period}`;
  }

  private calculateOptimalTiming(pattern: TemporalPattern, currentTime: Date): Date {
    const optimalTime = new Date(currentTime);
    optimalTime.setHours(pattern.time_of_day, 0, 0, 0);
    
    // If the optimal time has passed today, suggest for next occurrence
    if (optimalTime.getTime() < currentTime.getTime()) {
      const daysToAdd = pattern.period_type === 'daily' ? 1 : 
                       pattern.period_type === 'weekly' ? 7 : 30;
      optimalTime.setDate(optimalTime.getDate() + daysToAdd);
    }
    
    return optimalTime;
  }  p
rivate async createSuggestionRecords(candidates: SuggestionCandidate[]): Promise<Suggestion[]> {
    const suggestions: Suggestion[] = [];
    const db = await getDatabase();
    
    for (const candidate of candidates) {
      const suggestionId = DatabaseUtils.generateId();
      const now = DatabaseUtils.formatDate(new Date());
      
      const suggestionInput: SuggestionCreateInput = {
        title: candidate.title,
        description: candidate.description,
        category: candidate.category,
        confidence: Math.round(candidate.confidence * 100),
        reasoning: candidate.reasoning.join('; '),
        time_estimate: candidate.timeEstimate,
        priority: candidate.priority,
        based_on: candidate.basedOn,
        expires_at: candidate.expiresAt ? DatabaseUtils.formatDate(candidate.expiresAt) : undefined
      };
      
      await db.runAsync(`
        INSERT INTO suggestions (
          id, user_id, title, description, category, confidence, reasoning,
          time_estimate, priority, based_on, status, created_at, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
      `, [
        suggestionId, this.userId, suggestionInput.title, suggestionInput.description,
        suggestionInput.category, suggestionInput.confidence, suggestionInput.reasoning,
        suggestionInput.time_estimate, suggestionInput.priority,
        DatabaseUtils.serializeJSON(suggestionInput.based_on), now, suggestionInput.expires_at
      ]);
      
      const suggestion: Suggestion = {
        id: suggestionId,
        user_id: this.userId,
        title: suggestionInput.title,
        description: suggestionInput.description,
        category: suggestionInput.category,
        confidence: suggestionInput.confidence,
        reasoning: suggestionInput.reasoning,
        time_estimate: suggestionInput.time_estimate,
        priority: suggestionInput.priority,
        based_on: suggestionInput.based_on,
        status: 'pending',
        created_at: now,
        expires_at: suggestionInput.expires_at
      };
      
      suggestions.push(suggestion);
    }
    
    return suggestions;
  }
}

/**
 * Enhanced suggestion refresh and expiration management with context-aware logic
 */
export class EnhancedSuggestionManager {
  private userId: string;
  private contextChangeThreshold: number;
  private lastContext?: UserContext;
  private maxSuggestions: number;

  constructor(userId: string, contextChangeThreshold: number = 0.4, maxSuggestions: number = 10) {
    this.userId = userId;
    this.contextChangeThreshold = contextChangeThreshold;
    this.maxSuggestions = maxSuggestions;
  }

  /**
   * Refresh suggestions based on context changes with intelligent refresh logic
   */
  async refreshSuggestions(context: UserContext): Promise<Suggestion[]> {
    // Check if context has changed significantly
    const shouldRefresh = await this.shouldRefreshSuggestions(context);
    
    if (!shouldRefresh) {
      // Return existing active suggestions if context hasn't changed much
      return await this.getActiveSuggestions();
    }
    
    // Clean up expired suggestions
    await this.cleanupExpiredSuggestions();
    
    // Generate new suggestions with enhanced engine
    const engine = new EnhancedSuggestionEngine(this.userId);
    const newSuggestions = await engine.generateSuggestions(context);
    
    // Update last context
    this.lastContext = context;
    
    return newSuggestions;
  }

  /**
   * Determine if suggestions should be refreshed based on context changes
   */
  private async shouldRefreshSuggestions(context: UserContext): Promise<boolean> {
    // Always refresh if no previous context
    if (!this.lastContext) {
      return true;
    }
    
    // Check time-based refresh (refresh every 2 hours minimum)
    const timeDiff = context.currentTime.getTime() - this.lastContext.currentTime.getTime();
    const hoursDiff = timeDiff / (1000 * 60 * 60);
    
    if (hoursDiff >= 2) {
      return true;
    }
    
    // Check location change
    if (context.location && this.lastContext.location) {
      const distance = this.calculateDistance(
        context.location.latitude, context.location.longitude,
        this.lastContext.location.latitude, this.lastContext.location.longitude
      );
      
      if (distance > 1) { // More than 1km change
        return true;
      }
    }
    
    // Check significant task completion
    const recentTaskCount = context.recentTasks.filter(t => t.completed).length;
    const lastTaskCount = this.lastContext.recentTasks.filter(t => t.completed).length;
    
    if (recentTaskCount > lastTaskCount + 2) { // 2+ new completed tasks
      return true;
    }
    
    // Check device context changes
    if (context.deviceContext && this.lastContext.deviceContext) {
      const batteryChange = Math.abs(
        (context.deviceContext.batteryLevel || 0) - (this.lastContext.deviceContext.batteryLevel || 0)
      );
      
      if (batteryChange > 20) { // 20% battery change
        return true;
      }
    }
    
    return false;
  }

  /**
   * Clean up expired suggestions with enhanced logic
   */
  async cleanupExpiredSuggestions(): Promise<void> {
    const db = await getDatabase();
    const now = DatabaseUtils.formatDate(new Date());
    
    // Mark expired suggestions as dismissed
    await db.runAsync(`
      UPDATE suggestions 
      SET status = 'dismissed' 
      WHERE user_id = ? AND expires_at < ? AND status = 'pending'
    `, [this.userId, now]);
    
    // Also clean up very old suggestions (older than 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoString = DatabaseUtils.formatDate(weekAgo);
    
    await db.runAsync(`
      UPDATE suggestions 
      SET status = 'dismissed' 
      WHERE user_id = ? AND created_at < ? AND status = 'pending'
    `, [this.userId, weekAgoString]);
  }

  /**
   * Get active suggestions with enhanced filtering
   */
  async getActiveSuggestions(): Promise<Suggestion[]> {
    const db = await getDatabase();
    const now = DatabaseUtils.formatDate(new Date());
    
    const rows = await db.getAllAsync<any>(`
      SELECT * FROM suggestions 
      WHERE user_id = ? AND status = 'pending' 
      AND (expires_at IS NULL OR expires_at > ?)
      ORDER BY confidence DESC, created_at DESC
      LIMIT ?
    `, [this.userId, now, this.maxSuggestions]);
    
    return rows.map(row => ({
      ...row,
      based_on: DatabaseUtils.deserializeJSON(row.based_on)
    }));
  }

  /**
   * Check if suggestions need refresh based on context changes
   */
  async checkContextualRefresh(context: UserContext): Promise<{
    needsRefresh: boolean;
    reason: string;
    contextChangeScore: number;
  }> {
    if (!this.lastContext) {
      return {
        needsRefresh: true,
        reason: 'No previous context available',
        contextChangeScore: 1.0
      };
    }

    let contextChangeScore = 0;
    const reasons: string[] = [];

    // Time change score
    const timeDiff = context.currentTime.getTime() - this.lastContext.currentTime.getTime();
    const hoursDiff = timeDiff / (1000 * 60 * 60);
    const timeChangeScore = Math.min(1, hoursDiff / 4); // Max score after 4 hours
    contextChangeScore += timeChangeScore * 0.3;
    
    if (timeChangeScore > 0.5) {
      reasons.push(`Significant time change (${Math.round(hoursDiff)} hours)`);
    }

    // Location change score
    if (context.location && this.lastContext.location) {
      const distance = this.calculateDistance(
        context.location.latitude, context.location.longitude,
        this.lastContext.location.latitude, this.lastContext.location.longitude
      );
      const locationChangeScore = Math.min(1, distance / 5); // Max score after 5km
      contextChangeScore += locationChangeScore * 0.4;
      
      if (locationChangeScore > 0.2) {
        reasons.push(`Location change (${distance.toFixed(1)}km)`);
      }
    }

    // Task completion change score
    const recentTaskCount = context.recentTasks.filter(t => t.completed).length;
    const lastTaskCount = this.lastContext.recentTasks.filter(t => t.completed).length;
    const taskChangeScore = Math.min(1, Math.abs(recentTaskCount - lastTaskCount) / 5);
    contextChangeScore += taskChangeScore * 0.3;
    
    if (taskChangeScore > 0.2) {
      reasons.push(`Task completion changes (${Math.abs(recentTaskCount - lastTaskCount)} tasks)`);
    }

    const needsRefresh = contextChangeScore >= this.contextChangeThreshold;
    const reason = needsRefresh ? reasons.join(', ') : 'Context change below threshold';

    return {
      needsRefresh,
      reason,
      contextChangeScore
    };
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}