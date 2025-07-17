import { getDatabase, DatabaseUtils } from '../database';
import { PatternDatabaseUtils } from '../patternDatabase';
import { Feedback, Suggestion, UserPattern } from '../types';

/**
 * Feedback Learning Service
 * Implements adaptive learning algorithm that adjusts suggestions based on user behavior
 */

// Enhanced feedback interfaces
export interface FeedbackData {
  id: string;
  user_id: string;
  suggestion_id: string;
  feedback_type: 'positive' | 'negative';
  reason?: string;
  context?: FeedbackContext;
  created_at: string;
}

export interface FeedbackContext {
  time_of_day: number;
  day_of_week: number;
  location?: string;
  device_context?: string;
  user_activity?: string;
}

export interface FeedbackAnalytics {
  total_feedback: number;
  positive_feedback: number;
  negative_feedback: number;
  acceptance_rate: number;
  category_performance: CategoryPerformance[];
  confidence_accuracy: ConfidenceAccuracy[];
  temporal_patterns: TemporalFeedbackPattern[];
}

export interface CategoryPerformance {
  category: string;
  total_suggestions: number;
  accepted: number;
  rejected: number;
  acceptance_rate: number;
  avg_confidence: number;
  confidence_accuracy: number;
}

export interface ConfidenceAccuracy {
  confidence_range: string;
  total_suggestions: number;
  accepted: number;
  actual_accuracy: number;
  calibration_error: number;
}

export interface TemporalFeedbackPattern {
  time_period: string;
  acceptance_rate: number;
  total_feedback: number;
  pattern_strength: number;
}

export interface LearningAdjustment {
  pattern_id: string;
  old_confidence: number;
  new_confidence: number;
  adjustment_reason: string;
  adjustment_magnitude: number;
}

export class FeedbackLearningService {
  private static instance: FeedbackLearningService;
  
  public static getInstance(): FeedbackLearningService {
    if (!FeedbackLearningService.instance) {
      FeedbackLearningService.instance = new FeedbackLearningService();
    }
    return FeedbackLearningService.instance;
  }

  /**
   * Collect feedback for a suggestion
   */
  async collectFeedback(
    userId: string,
    suggestionId: string,
    feedbackType: 'positive' | 'negative',
    reason?: string,
    context?: FeedbackContext
  ): Promise<void> {
    const db = await getDatabase();
    const feedbackId = DatabaseUtils.generateId();
    const now = DatabaseUtils.formatDate(new Date());

    // Store feedback with enhanced context
    await db.runAsync(`
      INSERT INTO feedback (
        id, user_id, suggestion_id, feedback_type, reason, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [feedbackId, userId, suggestionId, feedbackType, reason || null, now]);

    // Store feedback context if provided
    if (context) {
      await db.runAsync(`
        INSERT INTO feedback_context (
          id, feedback_id, time_of_day, day_of_week, location, 
          device_context, user_activity, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        DatabaseUtils.generateId(),
        feedbackId,
        context.time_of_day,
        context.day_of_week,
        context.location || null,
        context.device_context || null,
        context.user_activity || null,
        now
      ]);
    }

    // Process feedback to update patterns
    await this.processFeedback(userId, suggestionId, feedbackType, context);
  }

  /**
   * Process feedback to update pattern weights and confidence scores
   */
  private async processFeedback(
    userId: string,
    suggestionId: string,
    feedbackType: 'positive' | 'negative',
    context?: FeedbackContext
  ): Promise<void> {
    const db = await getDatabase();

    // Get the suggestion details
    const suggestion = await db.getFirstAsync<Suggestion>(`
      SELECT * FROM suggestions WHERE id = ? AND user_id = ?
    `, [suggestionId, userId]);

    if (!suggestion) {
      throw new Error('Suggestion not found');
    }

    // Update suggestion status
    await db.runAsync(`
      UPDATE suggestions 
      SET status = ?, updated_at = ?
      WHERE id = ?
    `, [
      feedbackType === 'positive' ? 'accepted' : 'rejected',
      DatabaseUtils.formatDate(new Date()),
      suggestionId
    ]);

    // Get related patterns that contributed to this suggestion
    const basedOn = DatabaseUtils.deserializeJSON(suggestion.based_on) || [];
    
    // Update pattern confidence based on feedback
    for (const patternId of basedOn) {
      await this.updatePatternConfidence(patternId, feedbackType, suggestion.confidence);
    }

    // Update confidence calibration data
    await this.updateConfidenceCalibration(userId, suggestion, feedbackType);

    // Learn from temporal patterns if context is available
    if (context) {
      await this.updateTemporalLearning(userId, suggestion, feedbackType, context);
    }

    // Update category-specific learning
    await this.updateCategoryLearning(userId, suggestion.category, feedbackType, suggestion.confidence);
  }

  /**
   * Update pattern confidence based on feedback
   */
  private async updatePatternConfidence(
    patternId: string,
    feedbackType: 'positive' | 'negative',
    suggestionConfidence: number
  ): Promise<void> {
    const db = await getDatabase();

    // Get current pattern
    const pattern = await db.getFirstAsync<UserPattern>(`
      SELECT * FROM user_patterns WHERE id = ?
    `, [patternId]);

    if (!pattern) return;

    // Calculate confidence adjustment
    const adjustmentFactor = this.calculateConfidenceAdjustment(
      feedbackType,
      pattern.confidence,
      suggestionConfidence
    );

    const newConfidence = Math.max(0, Math.min(1, pattern.confidence + adjustmentFactor));

    // Update pattern confidence
    await db.runAsync(`
      UPDATE user_patterns 
      SET confidence = ?, updated_at = ?
      WHERE id = ?
    `, [newConfidence, DatabaseUtils.formatDate(new Date()), patternId]);

    // Log the adjustment for analytics
    await db.runAsync(`
      INSERT INTO confidence_calibration (
        id, user_id, pattern_types, category, original_confidence, 
        feedback_type, adjustment, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      DatabaseUtils.generateId(),
      pattern.user_id,
      DatabaseUtils.serializeJSON([pattern.pattern_type]),
      'pattern_adjustment',
      pattern.confidence,
      feedbackType,
      adjustmentFactor,
      DatabaseUtils.formatDate(new Date())
    ]);
  }

  /**
   * Calculate confidence adjustment based on feedback
   */
  private calculateConfidenceAdjustment(
    feedbackType: 'positive' | 'negative',
    currentConfidence: number,
    suggestionConfidence: number
  ): number {
    const baseLearningRate = 0.1;
    const confidenceWeight = 1 - Math.abs(currentConfidence - suggestionConfidence);
    
    if (feedbackType === 'positive') {
      // Positive feedback increases confidence, but with diminishing returns
      return baseLearningRate * confidenceWeight * (1 - currentConfidence);
    } else {
      // Negative feedback decreases confidence more aggressively
      return -baseLearningRate * confidenceWeight * (1 + currentConfidence);
    }
  }

  /**
   * Update confidence calibration data
   */
  private async updateConfidenceCalibration(
    userId: string,
    suggestion: Suggestion,
    feedbackType: 'positive' | 'negative'
  ): Promise<void> {
    const db = await getDatabase();
    
    // Determine confidence range
    const confidenceRange = this.getConfidenceRange(suggestion.confidence);
    
    // Check if adjustment exists for this range
    const existingAdjustment = await db.getFirstAsync<any>(`
      SELECT * FROM confidence_adjustments 
      WHERE user_id = ? AND confidence_range = ?
    `, [userId, confidenceRange]);

    const isAccurate = feedbackType === 'positive';
    const adjustmentFactor = isAccurate ? 1.05 : 0.95; // 5% adjustment

    if (existingAdjustment) {
      // Update existing adjustment
      const newFactor = (existingAdjustment.adjustment_factor + adjustmentFactor) / 2;
      await db.runAsync(`
        UPDATE confidence_adjustments 
        SET adjustment_factor = ?, created_at = ?
        WHERE id = ?
      `, [newFactor, DatabaseUtils.formatDate(new Date()), existingAdjustment.id]);
    } else {
      // Create new adjustment
      await db.runAsync(`
        INSERT INTO confidence_adjustments (
          id, user_id, confidence_range, adjustment_factor, reason, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `, [
        DatabaseUtils.generateId(),
        userId,
        confidenceRange,
        adjustmentFactor,
        `Calibration based on ${feedbackType} feedback`,
        DatabaseUtils.formatDate(new Date())
      ]);
    }
  }

  /**
   * Update temporal learning patterns
   */
  private async updateTemporalLearning(
    userId: string,
    suggestion: Suggestion,
    feedbackType: 'positive' | 'negative',
    context: FeedbackContext
  ): Promise<void> {
    const db = await getDatabase();
    
    // Store timing preference based on feedback
    const timingData = {
      time_of_day: context.time_of_day,
      day_of_week: context.day_of_week,
      category: suggestion.category,
      feedback_type: feedbackType,
      suggestion_confidence: suggestion.confidence
    };

    await db.runAsync(`
      INSERT INTO timing_preferences (
        id, user_id, preference_type, timing_data, confidence, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [
      DatabaseUtils.generateId(),
      userId,
      'suggestion_timing',
      DatabaseUtils.serializeJSON(timingData),
      feedbackType === 'positive' ? 0.8 : 0.2,
      DatabaseUtils.formatDate(new Date())
    ]);
  }

  /**
   * Update category-specific learning
   */
  private async updateCategoryLearning(
    userId: string,
    category: string,
    feedbackType: 'positive' | 'negative',
    confidence: number
  ): Promise<void> {
    // This could be expanded to maintain category-specific confidence adjustments
    // For now, we'll use the general confidence calibration system
    await this.updateConfidenceCalibration(userId, { 
      category, 
      confidence,
      id: '',
      user_id: userId,
      title: '',
      based_on: '[]',
      status: 'pending',
      created_at: '',
      priority: 'medium'
    } as Suggestion, feedbackType);
  }

  /**
   * Get confidence range for calibration
   */
  private getConfidenceRange(confidence: number): string {
    if (confidence < 0.2) return '0-20';
    if (confidence < 0.4) return '20-40';
    if (confidence < 0.6) return '40-60';
    if (confidence < 0.8) return '60-80';
    return '80-100';
  }

  /**
   * Apply learned adjustments to new suggestions
   */
  async applyLearningAdjustments(userId: string, suggestions: Suggestion[]): Promise<Suggestion[]> {
    const db = await getDatabase();
    
    // Get confidence adjustments for this user
    const adjustments = await db.getAllAsync<any>(`
      SELECT * FROM confidence_adjustments WHERE user_id = ?
    `, [userId]);

    const adjustmentMap = new Map<string, number>();
    adjustments.forEach(adj => {
      adjustmentMap.set(adj.confidence_range, adj.adjustment_factor);
    });

    // Get category-specific performance data
    const categoryPerformance = await db.getAllAsync<any>(`
      SELECT 
        s.category,
        COUNT(*) as total_suggestions,
        SUM(CASE WHEN f.feedback_type = 'positive' THEN 1 ELSE 0 END) as accepted,
        AVG(s.confidence) as avg_confidence
      FROM feedback f
      JOIN suggestions s ON f.suggestion_id = s.id
      WHERE f.user_id = ?
      GROUP BY s.category
      HAVING total_suggestions >= 3
    `, [userId]);

    const categoryAdjustmentMap = new Map<string, number>();
    categoryPerformance.forEach(cp => {
      const acceptanceRate = cp.accepted / cp.total_suggestions;
      const expectedRate = cp.avg_confidence;
      // Calculate adjustment factor based on difference between expected and actual acceptance
      const adjustmentFactor = acceptanceRate > 0 ? 
        (acceptanceRate / Math.max(0.1, expectedRate)) : 0.8;
      categoryAdjustmentMap.set(cp.category, adjustmentFactor);
    });

    // Get timing preferences
    const timingPreferences = await db.getAllAsync<any>(`
      SELECT 
        timing_data,
        confidence
      FROM timing_preferences
      WHERE user_id = ? AND preference_type = 'suggestion_timing'
      ORDER BY created_at DESC
      LIMIT 50
    `, [userId]);

    // Parse timing data for time-of-day patterns
    const timeOfDayPreferences = new Map<number, { positive: number, negative: number }>();
    const dayOfWeekPreferences = new Map<number, { positive: number, negative: number }>();
    
    timingPreferences.forEach(pref => {
      try {
        const data = DatabaseUtils.deserializeJSON(pref.timing_data);
        const isPositive = data.feedback_type === 'positive';
        
        // Track time of day preferences
        if (data.time_of_day !== undefined) {
          const hour = data.time_of_day;
          const current = timeOfDayPreferences.get(hour) || { positive: 0, negative: 0 };
          if (isPositive) {
            current.positive += 1;
          } else {
            current.negative += 1;
          }
          timeOfDayPreferences.set(hour, current);
        }
        
        // Track day of week preferences
        if (data.day_of_week !== undefined) {
          const day = data.day_of_week;
          const current = dayOfWeekPreferences.get(day) || { positive: 0, negative: 0 };
          if (isPositive) {
            current.positive += 1;
          } else {
            current.negative += 1;
          }
          dayOfWeekPreferences.set(day, current);
        }
      } catch (err) {
        console.error('Error parsing timing data:', err);
      }
    });

    // Current time context
    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.getDay();

    // Apply adjustments to suggestions
    return suggestions.map(suggestion => {
      // Base confidence adjustment from calibration
      const confidenceRange = this.getConfidenceRange(suggestion.confidence);
      let adjustmentFactor = adjustmentMap.get(confidenceRange) || 1.0;
      
      // Category-specific adjustment
      if (categoryAdjustmentMap.has(suggestion.category)) {
        const categoryFactor = categoryAdjustmentMap.get(suggestion.category)!;
        adjustmentFactor *= categoryFactor;
      }
      
      // Time-of-day adjustment
      const hourPreference = timeOfDayPreferences.get(currentHour);
      if (hourPreference) {
        const total = hourPreference.positive + hourPreference.negative;
        if (total >= 3) {
          const timePreferenceFactor = (hourPreference.positive / total) * 0.4 + 0.8;
          adjustmentFactor *= timePreferenceFactor;
        }
      }
      
      // Day-of-week adjustment
      const dayPreference = dayOfWeekPreferences.get(currentDay);
      if (dayPreference) {
        const total = dayPreference.positive + dayPreference.negative;
        if (total >= 3) {
          const dayPreferenceFactor = (dayPreference.positive / total) * 0.4 + 0.8;
          adjustmentFactor *= dayPreferenceFactor;
        }
      }
      
      // Apply combined adjustment factor
      const newConfidence = Math.max(0.1, Math.min(0.95, suggestion.confidence * adjustmentFactor));
      
      // Add explanation of adjustment for transparency
      const basedOn = DatabaseUtils.deserializeJSON(suggestion.based_on) || [];
      if (adjustmentFactor !== 1.0) {
        basedOn.push('learning_adjusted');
      }
      
      return {
        ...suggestion,
        confidence: newConfidence,
        based_on: DatabaseUtils.serializeJSON(basedOn)
      };
    });
  }

  /**
   * Generate feedback analytics
   */
  async generateFeedbackAnalytics(userId: string, timeframe?: { start: Date; end: Date }): Promise<FeedbackAnalytics> {
    const db = await getDatabase();
    
    let timeFilter = '';
    const params: any[] = [userId];
    
    if (timeframe) {
      timeFilter = ' AND f.created_at BETWEEN ? AND ?';
      params.push(DatabaseUtils.formatDate(timeframe.start));
      params.push(DatabaseUtils.formatDate(timeframe.end));
    }

    // Get overall feedback stats
    const overallStats = await db.getFirstAsync<any>(`
      SELECT 
        COUNT(*) as total_feedback,
        SUM(CASE WHEN feedback_type = 'positive' THEN 1 ELSE 0 END) as positive_feedback,
        SUM(CASE WHEN feedback_type = 'negative' THEN 1 ELSE 0 END) as negative_feedback
      FROM feedback f
      WHERE f.user_id = ?${timeFilter}
    `, params);

    const acceptanceRate = overallStats.total_feedback > 0 
      ? (overallStats.positive_feedback / overallStats.total_feedback) * 100 
      : 0;

    // Get category performance
    const categoryPerformance = await db.getAllAsync<any>(`
      SELECT 
        s.category,
        COUNT(*) as total_suggestions,
        SUM(CASE WHEN f.feedback_type = 'positive' THEN 1 ELSE 0 END) as accepted,
        SUM(CASE WHEN f.feedback_type = 'negative' THEN 1 ELSE 0 END) as rejected,
        AVG(s.confidence) as avg_confidence
      FROM feedback f
      JOIN suggestions s ON f.suggestion_id = s.id
      WHERE f.user_id = ?${timeFilter}
      GROUP BY s.category
    `, params);

    const categoryPerformanceFormatted: CategoryPerformance[] = categoryPerformance.map(cp => ({
      category: cp.category,
      total_suggestions: cp.total_suggestions,
      accepted: cp.accepted,
      rejected: cp.rejected,
      acceptance_rate: (cp.accepted / cp.total_suggestions) * 100,
      avg_confidence: cp.avg_confidence,
      confidence_accuracy: cp.accepted / cp.total_suggestions // Simplified accuracy measure
    }));

    // Get confidence accuracy
    const confidenceAccuracy = await this.calculateConfidenceAccuracy(userId, timeframe);

    // Get temporal patterns
    const temporalPatterns = await this.calculateTemporalFeedbackPatterns(userId, timeframe);

    return {
      total_feedback: overallStats.total_feedback,
      positive_feedback: overallStats.positive_feedback,
      negative_feedback: overallStats.negative_feedback,
      acceptance_rate: acceptanceRate,
      category_performance: categoryPerformanceFormatted,
      confidence_accuracy: confidenceAccuracy,
      temporal_patterns: temporalPatterns
    };
  }

  /**
   * Calculate confidence accuracy metrics
   */
  private async calculateConfidenceAccuracy(userId: string, timeframe?: { start: Date; end: Date }): Promise<ConfidenceAccuracy[]> {
    const db = await getDatabase();
    
    let timeFilter = '';
    const params: any[] = [userId];
    
    if (timeframe) {
      timeFilter = ' AND f.created_at BETWEEN ? AND ?';
      params.push(DatabaseUtils.formatDate(timeframe.start));
      params.push(DatabaseUtils.formatDate(timeframe.end));
    }

    const confidenceRanges = ['0-20', '20-40', '40-60', '60-80', '80-100'];
    const accuracyData: ConfidenceAccuracy[] = [];

    for (const range of confidenceRanges) {
      const [min, max] = range.split('-').map(Number);
      const minConfidence = min / 100;
      const maxConfidence = max / 100;

      const rangeStats = await db.getFirstAsync<any>(`
        SELECT 
          COUNT(*) as total_suggestions,
          SUM(CASE WHEN f.feedback_type = 'positive' THEN 1 ELSE 0 END) as accepted,
          AVG(s.confidence) as avg_confidence
        FROM feedback f
        JOIN suggestions s ON f.suggestion_id = s.id
        WHERE f.user_id = ? 
          AND s.confidence >= ? 
          AND s.confidence < ?${timeFilter}
      `, [userId, minConfidence, maxConfidence, ...params.slice(1)]);

      if (rangeStats.total_suggestions > 0) {
        const actualAccuracy = (rangeStats.accepted / rangeStats.total_suggestions) * 100;
        const expectedAccuracy = (min + max) / 2;
        const calibrationError = Math.abs(actualAccuracy - expectedAccuracy);

        accuracyData.push({
          confidence_range: range,
          total_suggestions: rangeStats.total_suggestions,
          accepted: rangeStats.accepted,
          actual_accuracy: actualAccuracy,
          calibration_error: calibrationError
        });
      }
    }

    return accuracyData;
  }

  /**
   * Calculate temporal feedback patterns
   */
  private async calculateTemporalFeedbackPatterns(userId: string, timeframe?: { start: Date; end: Date }): Promise<TemporalFeedbackPattern[]> {
    const db = await getDatabase();
    
    let timeFilter = '';
    const params: any[] = [userId];
    
    if (timeframe) {
      timeFilter = ' AND fc.created_at BETWEEN ? AND ?';
      params.push(DatabaseUtils.formatDate(timeframe.start));
      params.push(DatabaseUtils.formatDate(timeframe.end));
    }

    // Get feedback patterns by time of day
    const timePatterns = await db.getAllAsync<any>(`
      SELECT 
        CASE 
          WHEN fc.time_of_day BETWEEN 6 AND 11 THEN 'Morning'
          WHEN fc.time_of_day BETWEEN 12 AND 17 THEN 'Afternoon'
          WHEN fc.time_of_day BETWEEN 18 AND 22 THEN 'Evening'
          ELSE 'Night'
        END as time_period,
        COUNT(*) as total_feedback,
        SUM(CASE WHEN f.feedback_type = 'positive' THEN 1 ELSE 0 END) as positive_feedback
      FROM feedback f
      JOIN feedback_context fc ON f.id = fc.feedback_id
      WHERE f.user_id = ?${timeFilter}
      GROUP BY time_period
    `, params);

    return timePatterns.map(tp => ({
      time_period: tp.time_period,
      acceptance_rate: (tp.positive_feedback / tp.total_feedback) * 100,
      total_feedback: tp.total_feedback,
      pattern_strength: tp.total_feedback >= 5 ? 0.8 : 0.4 // Simple pattern strength calculation
    }));
  }

  /**
   * Get learning insights for user
   */
  async getLearningInsights(userId: string): Promise<string[]> {
    const analytics = await this.generateFeedbackAnalytics(userId);
    const insights: string[] = [];

    // Overall performance insights
    if (analytics.acceptance_rate > 80) {
      insights.push("Your AI suggestions are highly accurate! The system is learning your preferences well.");
    } else if (analytics.acceptance_rate < 50) {
      insights.push("The AI is still learning your preferences. Your feedback helps improve future suggestions.");
    }

    // Category insights
    const bestCategory = analytics.category_performance
      .sort((a, b) => b.acceptance_rate - a.acceptance_rate)[0];
    if (bestCategory && bestCategory.acceptance_rate > 70) {
      insights.push(`AI suggestions work best for ${bestCategory.category} tasks (${bestCategory.acceptance_rate.toFixed(1)}% accuracy).`);
    }

    // Temporal insights
    const bestTime = analytics.temporal_patterns
      .sort((a, b) => b.acceptance_rate - a.acceptance_rate)[0];
    if (bestTime && bestTime.acceptance_rate > 70) {
      insights.push(`You tend to accept more suggestions during ${bestTime.time_period.toLowerCase()} hours.`);
    }

    // Confidence calibration insights
    const overconfidentRanges = analytics.confidence_accuracy
      .filter(ca => ca.calibration_error > 20);
    if (overconfidentRanges.length > 0) {
      insights.push("The AI is learning to better calibrate its confidence in suggestions.");
    }

    return insights;
  }
}

export default FeedbackLearningService;