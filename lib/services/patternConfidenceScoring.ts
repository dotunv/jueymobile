import { DatabaseUtils } from '../database';
import { UserPattern, TemporalPattern } from '../patternDatabase';
import { Task, Feedback } from '../types';

/**
 * Pattern confidence scoring algorithm based on frequency, recency, and user feedback
 */

export interface ConfidenceFactors {
  frequency: number;        // 0-1: How often the pattern occurs
  recency: number;         // 0-1: How recent the pattern occurrences are
  consistency: number;     // 0-1: How consistent the pattern timing is
  userFeedback: number;    // 0-1: User feedback on related suggestions
  dataQuality: number;     // 0-1: Quality and completeness of pattern data
  contextRelevance: number; // 0-1: Relevance to current context
}

export interface ConfidenceWeights {
  frequency: number;
  recency: number;
  consistency: number;
  userFeedback: number;
  dataQuality: number;
  contextRelevance: number;
}

export interface ConfidenceScore {
  overall: number;
  factors: ConfidenceFactors;
  explanation: string[];
  reliability: 'high' | 'medium' | 'low';
}

export class PatternConfidenceScoring {
  private static readonly DEFAULT_WEIGHTS: ConfidenceWeights = {
    frequency: 0.25,      // 25% - How often pattern occurs
    recency: 0.20,        // 20% - How recent the occurrences are
    consistency: 0.20,    // 20% - How consistent the pattern is
    userFeedback: 0.15,   // 15% - User feedback on suggestions
    dataQuality: 0.10,    // 10% - Quality of underlying data
    contextRelevance: 0.10 // 10% - Current context relevance
  };

  private userId: string;
  private weights: ConfidenceWeights;

  constructor(userId: string, customWeights?: Partial<ConfidenceWeights>) {
    this.userId = userId;
    this.weights = { ...PatternConfidenceScoring.DEFAULT_WEIGHTS, ...customWeights };
  }

  /**
   * Calculate confidence score for a temporal pattern
   */
  async calculateTemporalPatternConfidence(
    pattern: TemporalPattern,
    relatedTasks: Task[],
    currentContext?: { time: Date; dayOfWeek: number }
  ): Promise<ConfidenceScore> {
    const factors = await this.calculateTemporalFactors(pattern, relatedTasks, currentContext);
    const overall = this.calculateWeightedScore(factors);
    const explanation = this.generateTemporalExplanation(factors, pattern);
    const reliability = this.determineReliability(overall, relatedTasks.length);

    return {
      overall,
      factors,
      explanation,
      reliability
    };
  }

  /**
   * Calculate confidence score for a general user pattern
   */
  async calculateUserPatternConfidence(
    pattern: UserPattern,
    relatedTasks: Task[],
    feedbackData?: Feedback[]
  ): Promise<ConfidenceScore> {
    const factors = await this.calculateGeneralFactors(pattern, relatedTasks, feedbackData);
    const overall = this.calculateWeightedScore(factors);
    const explanation = this.generateGeneralExplanation(factors, pattern);
    const reliability = this.determineReliability(overall, relatedTasks.length);

    return {
      overall,
      factors,
      explanation,
      reliability
    };
  }

  /**
   * Calculate factors for temporal patterns
   */
  private async calculateTemporalFactors(
    pattern: TemporalPattern,
    relatedTasks: Task[],
    currentContext?: { time: Date; dayOfWeek: number }
  ): Promise<ConfidenceFactors> {
    // Frequency factor: based on how often the pattern occurs
    const frequency = this.calculateFrequencyFactor(pattern.frequency, pattern.period_type);

    // Recency factor: based on how recent the last occurrence was
    const recency = this.calculateRecencyFactor(pattern.last_occurrence, pattern.period_type);

    // Consistency factor: based on timing variance
    const consistency = this.calculateTemporalConsistency(relatedTasks, pattern);

    // User feedback factor: based on feedback for similar suggestions
    const userFeedback = await this.calculateUserFeedbackFactor(pattern.task_category);

    // Data quality factor: based on completeness and accuracy of data
    const dataQuality = this.calculateDataQualityFactor(relatedTasks, pattern);

    // Context relevance factor: how relevant to current context
    const contextRelevance = this.calculateContextRelevance(pattern, currentContext);

    return {
      frequency,
      recency,
      consistency,
      userFeedback,
      dataQuality,
      contextRelevance
    };
  }

  /**
   * Calculate factors for general patterns
   */
  private async calculateGeneralFactors(
    pattern: UserPattern,
    relatedTasks: Task[],
    feedbackData?: Feedback[]
  ): Promise<ConfidenceFactors> {
    // Frequency factor
    const frequency = this.calculateFrequencyFactor(pattern.frequency, 'weekly');

    // Recency factor
    const recency = pattern.last_occurrence ? 
      this.calculateRecencyFactor(pattern.last_occurrence, 'weekly') : 0.5;

    // Consistency factor: varies by pattern type
    const consistency = this.calculatePatternConsistency(pattern, relatedTasks);

    // User feedback factor
    const userFeedback = feedbackData ? 
      this.calculateDirectFeedbackFactor(feedbackData) :
      await this.calculateUserFeedbackFactor(this.extractCategoryFromPattern(pattern));

    // Data quality factor
    const dataQuality = this.calculateGeneralDataQuality(pattern, relatedTasks);

    // Context relevance (default to neutral for general patterns)
    const contextRelevance = 0.5;

    return {
      frequency,
      recency,
      consistency,
      userFeedback,
      dataQuality,
      contextRelevance
    };
  }

  /**
   * Calculate frequency factor based on occurrence count and period
   */
  private calculateFrequencyFactor(frequency: number, periodType: string): number {
    // Define expected frequencies for different periods
    const expectedFrequencies = {
      daily: 30,    // 30 times per month
      weekly: 8,    // 8 times per month (twice weekly)
      monthly: 3    // 3 times per quarter
    };

    const expected = expectedFrequencies[periodType as keyof typeof expectedFrequencies] || 5;
    
    // Use sigmoid function to normalize frequency
    const normalizedFreq = frequency / expected;
    return Math.min(1, 2 / (1 + Math.exp(-normalizedFreq)) - 1);
  }

  /**
   * Calculate recency factor based on last occurrence
   */
  private calculateRecencyFactor(lastOccurrence: string, periodType: string): number {
    const lastDate = new Date(lastOccurrence);
    const now = new Date();
    const daysSince = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24);

    // Define decay periods for different pattern types
    const decayPeriods = {
      daily: 7,     // 7 days
      weekly: 21,   // 3 weeks
      monthly: 90   // 3 months
    };

    const decayPeriod = decayPeriods[periodType as keyof typeof decayPeriods] || 30;
    
    // Exponential decay function
    return Math.exp(-daysSince / decayPeriod);
  }

  /**
   * Calculate temporal consistency based on task timing variance
   */
  private calculateTemporalConsistency(tasks: Task[], pattern: TemporalPattern): number {
    if (tasks.length < 2) return 0.5; // Neutral for insufficient data

    const hours: number[] = [];
    const days: number[] = [];

    for (const task of tasks) {
      if (task.completed_at) {
        const completedAt = new Date(task.completed_at);
        hours.push(completedAt.getHours());
        days.push(completedAt.getDay());
      }
    }

    if (hours.length === 0) return 0.5;

    // Calculate variance for hours and days
    const hourVariance = this.calculateVariance(hours);
    const dayVariance = this.calculateVariance(days);

    // Lower variance = higher consistency
    const hourConsistency = Math.max(0, 1 - (hourVariance / 144)); // Max variance for 24 hours
    const dayConsistency = Math.max(0, 1 - (dayVariance / 9));     // Max variance for 7 days

    return (hourConsistency + dayConsistency) / 2;
  }

  /**
   * Calculate pattern consistency for general patterns
   */
  private calculatePatternConsistency(pattern: UserPattern, tasks: Task[]): number {
    switch (pattern.pattern_type) {
      case 'sequential':
        return this.calculateSequentialConsistency(pattern, tasks);
      case 'contextual':
        return this.calculateContextualConsistency(pattern, tasks);
      case 'frequency':
        return this.calculateFrequencyConsistency(pattern, tasks);
      default:
        return 0.5; // Neutral for unknown types
    }
  }

  /**
   * Calculate user feedback factor based on historical feedback
   */
  private async calculateUserFeedbackFactor(category: string): Promise<number> {
    try {
      // This would typically query the feedback database
      // For now, return a neutral score
      return 0.5;
    } catch (error) {
      console.error('Error calculating user feedback factor:', error);
      return 0.5;
    }
  }

  /**
   * Calculate feedback factor from direct feedback data
   */
  private calculateDirectFeedbackFactor(feedbackData: Feedback[]): number {
    if (feedbackData.length === 0) return 0.5;

    const positiveCount = feedbackData.filter(f => f.feedback_type === 'positive').length;
    const totalCount = feedbackData.length;

    return positiveCount / totalCount;
  }

  /**
   * Calculate data quality factor
   */
  private calculateDataQualityFactor(tasks: Task[], pattern: TemporalPattern): number {
    let qualityScore = 0;
    let factors = 0;

    // Factor 1: Sufficient data points
    if (tasks.length >= 5) {
      qualityScore += 0.3;
    } else if (tasks.length >= 3) {
      qualityScore += 0.2;
    } else {
      qualityScore += 0.1;
    }
    factors++;

    // Factor 2: Data completeness (all tasks have completion times)
    const completeTasks = tasks.filter(t => t.completed_at).length;
    qualityScore += (completeTasks / tasks.length) * 0.3;
    factors++;

    // Factor 3: Data recency (recent data is more reliable)
    const recentTasks = tasks.filter(t => {
      if (!t.completed_at) return false;
      const taskDate = new Date(t.completed_at);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 60); // Last 60 days
      return taskDate > cutoff;
    }).length;
    
    qualityScore += (recentTasks / tasks.length) * 0.2;
    factors++;

    // Factor 4: Pattern data completeness
    const patternCompleteness = this.assessPatternDataCompleteness(pattern);
    qualityScore += patternCompleteness * 0.2;
    factors++;

    return qualityScore;
  }

  /**
   * Calculate general data quality for user patterns
   */
  private calculateGeneralDataQuality(pattern: UserPattern, tasks: Task[]): number {
    let qualityScore = 0;

    // Data points sufficiency
    qualityScore += Math.min(1, tasks.length / 5) * 0.4;

    // Pattern data completeness
    const patternData = pattern.pattern_data;
    const requiredFields = this.getRequiredFieldsForPatternType(pattern.pattern_type);
    const presentFields = requiredFields.filter(field => patternData[field] !== undefined).length;
    qualityScore += (presentFields / requiredFields.length) * 0.3;

    // Confidence in stored pattern
    qualityScore += pattern.confidence * 0.3;

    return Math.min(1, qualityScore);
  }

  /**
   * Calculate context relevance
   */
  private calculateContextRelevance(
    pattern: TemporalPattern, 
    currentContext?: { time: Date; dayOfWeek: number }
  ): number {
    if (!currentContext) return 0.5; // Neutral if no context

    let relevanceScore = 0;

    // Time of day relevance
    const currentHour = currentContext.time.getHours();
    const hourDiff = Math.abs(currentHour - pattern.time_of_day);
    const hourRelevance = Math.max(0, 1 - (hourDiff / 12)); // 12-hour max difference
    relevanceScore += hourRelevance * 0.6;

    // Day of week relevance
    const dayMatch = currentContext.dayOfWeek === pattern.day_of_week ? 1 : 0;
    relevanceScore += dayMatch * 0.4;

    return relevanceScore;
  }

  /**
   * Calculate weighted overall score
   */
  private calculateWeightedScore(factors: ConfidenceFactors): number {
    return (
      factors.frequency * this.weights.frequency +
      factors.recency * this.weights.recency +
      factors.consistency * this.weights.consistency +
      factors.userFeedback * this.weights.userFeedback +
      factors.dataQuality * this.weights.dataQuality +
      factors.contextRelevance * this.weights.contextRelevance
    );
  }

  /**
   * Generate explanation for temporal patterns
   */
  private generateTemporalExplanation(factors: ConfidenceFactors, pattern: TemporalPattern): string[] {
    const explanation: string[] = [];

    if (factors.frequency > 0.7) {
      explanation.push(`High frequency: occurs ${pattern.frequency} times per ${pattern.period_type}`);
    } else if (factors.frequency < 0.3) {
      explanation.push(`Low frequency: only ${pattern.frequency} occurrences`);
    }

    if (factors.recency > 0.7) {
      explanation.push('Recent activity supports this pattern');
    } else if (factors.recency < 0.3) {
      explanation.push('Pattern hasn\'t occurred recently');
    }

    if (factors.consistency > 0.7) {
      explanation.push('Highly consistent timing pattern');
    } else if (factors.consistency < 0.3) {
      explanation.push('Inconsistent timing reduces confidence');
    }

    if (factors.userFeedback > 0.7) {
      explanation.push('Positive user feedback on similar suggestions');
    } else if (factors.userFeedback < 0.3) {
      explanation.push('Limited or negative user feedback');
    }

    if (factors.contextRelevance > 0.7) {
      explanation.push('Highly relevant to current context');
    }

    return explanation;
  }

  /**
   * Generate explanation for general patterns
   */
  private generateGeneralExplanation(factors: ConfidenceFactors, pattern: UserPattern): string[] {
    const explanation: string[] = [];

    explanation.push(`Pattern type: ${pattern.pattern_type}`);
    
    if (factors.frequency > 0.7) {
      explanation.push(`Strong pattern with ${pattern.frequency} occurrences`);
    }

    if (factors.consistency > 0.7) {
      explanation.push('Consistent pattern behavior');
    } else if (factors.consistency < 0.3) {
      explanation.push('Inconsistent pattern reduces reliability');
    }

    if (factors.dataQuality > 0.7) {
      explanation.push('High quality supporting data');
    } else if (factors.dataQuality < 0.3) {
      explanation.push('Limited data quality affects confidence');
    }

    return explanation;
  }

  /**
   * Determine reliability level
   */
  private determineReliability(score: number, dataPoints: number): 'high' | 'medium' | 'low' {
    if (score > 0.7 && dataPoints >= 5) return 'high';
    if (score > 0.5 && dataPoints >= 3) return 'medium';
    return 'low';
  }

  // Helper methods
  private calculateVariance(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    
    const mean = numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
    const squaredDiffs = numbers.map(num => Math.pow(num - mean, 2));
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / numbers.length;
  }

  private calculateSequentialConsistency(pattern: UserPattern, tasks: Task[]): number {
    // Implementation for sequential pattern consistency
    return 0.6; // Placeholder
  }

  private calculateContextualConsistency(pattern: UserPattern, tasks: Task[]): number {
    // Implementation for contextual pattern consistency
    return 0.6; // Placeholder
  }

  private calculateFrequencyConsistency(pattern: UserPattern, tasks: Task[]): number {
    // Implementation for frequency pattern consistency
    return 0.6; // Placeholder
  }

  private assessPatternDataCompleteness(pattern: TemporalPattern): number {
    let completeness = 0;
    let totalFields = 0;

    // Check required fields
    if (pattern.time_of_day !== undefined) completeness++;
    totalFields++;

    if (pattern.day_of_week !== undefined) completeness++;
    totalFields++;

    if (pattern.frequency > 0) completeness++;
    totalFields++;

    if (pattern.last_occurrence) completeness++;
    totalFields++;

    return totalFields > 0 ? completeness / totalFields : 0;
  }

  private getRequiredFieldsForPatternType(patternType: string): string[] {
    switch (patternType) {
      case 'temporal':
        return ['timeOfDay', 'dayOfWeek', 'frequency'];
      case 'sequential':
        return ['sequence', 'category'];
      case 'contextual':
        return ['context', 'triggers'];
      case 'frequency':
        return ['intervalDays', 'occurrences'];
      default:
        return [];
    }
  }

  private extractCategoryFromPattern(pattern: UserPattern): string {
    const patternData = pattern.pattern_data;
    return patternData.category || patternData.taskCategory || 'General';
  }

  /**
   * Batch calculate confidence scores for multiple patterns
   */
  async batchCalculateConfidence(
    patterns: (TemporalPattern | UserPattern)[],
    tasksByPattern: Record<string, Task[]>
  ): Promise<Record<string, ConfidenceScore>> {
    const results: Record<string, ConfidenceScore> = {};

    for (const pattern of patterns) {
      const relatedTasks = tasksByPattern[pattern.id] || [];
      
      try {
        let confidenceScore: ConfidenceScore;
        
        if ('time_of_day' in pattern) {
          // Temporal pattern
          confidenceScore = await this.calculateTemporalPatternConfidence(
            pattern as TemporalPattern,
            relatedTasks
          );
        } else {
          // General user pattern
          confidenceScore = await this.calculateUserPatternConfidence(
            pattern as UserPattern,
            relatedTasks
          );
        }
        
        results[pattern.id] = confidenceScore;
      } catch (error) {
        console.error(`Error calculating confidence for pattern ${pattern.id}:`, error);
        // Provide fallback confidence score
        results[pattern.id] = {
          overall: 0.3,
          factors: {
            frequency: 0.3,
            recency: 0.3,
            consistency: 0.3,
            userFeedback: 0.3,
            dataQuality: 0.3,
            contextRelevance: 0.3
          },
          explanation: ['Error calculating confidence'],
          reliability: 'low'
        };
      }
    }

    return results;
  }

  /**
   * Update confidence weights based on feedback performance
   */
  updateWeights(performanceMetrics: {
    frequencyAccuracy: number;
    recencyAccuracy: number;
    consistencyAccuracy: number;
    feedbackAccuracy: number;
  }): void {
    // Adjust weights based on which factors are most predictive
    const totalAccuracy = Object.values(performanceMetrics).reduce((sum, acc) => sum + acc, 0);
    
    if (totalAccuracy > 0) {
      this.weights.frequency *= (performanceMetrics.frequencyAccuracy / totalAccuracy) * 4;
      this.weights.recency *= (performanceMetrics.recencyAccuracy / totalAccuracy) * 4;
      this.weights.consistency *= (performanceMetrics.consistencyAccuracy / totalAccuracy) * 4;
      this.weights.userFeedback *= (performanceMetrics.feedbackAccuracy / totalAccuracy) * 4;
      
      // Normalize weights to sum to 1
      const weightSum = Object.values(this.weights).reduce((sum, weight) => sum + weight, 0);
      for (const key in this.weights) {
        this.weights[key as keyof ConfidenceWeights] /= weightSum;
      }
    }
  }
}