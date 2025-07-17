import { getDatabase, DatabaseUtils } from '../database';
import { PatternDatabaseUtils } from '../patternDatabase';
import { Feedback, Suggestion } from '../types';
import FeedbackLearningService, { FeedbackContext } from './feedbackLearningService';

/**
 * Feedback Processing Service
 * Implements the feedback processing pipeline to update pattern weights and confidence scores
 */

export interface ProcessingResult {
  patternUpdates: number;
  confidenceAdjustments: number;
  learningRate: number;
}

export interface PatternUpdate {
  patternId: string;
  oldConfidence: number;
  newConfidence: number;
  adjustmentFactor: number;
}

export class FeedbackProcessingService {
  private static instance: FeedbackProcessingService;
  private feedbackLearningService: FeedbackLearningService;
  
  private constructor() {
    this.feedbackLearningService = FeedbackLearningService.getInstance();
  }
  
  public static getInstance(): FeedbackProcessingService {
    if (!FeedbackProcessingService.instance) {
      FeedbackProcessingService.instance = new FeedbackProcessingService();
    }
    return FeedbackProcessingService.instance;
  }

  /**
   * Process feedback and update pattern weights
   */
  async processFeedback(
    userId: string,
    suggestionId: string,
    feedbackType: 'positive' | 'negative',
    context?: FeedbackContext
  ): Promise<ProcessingResult> {
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
    
    // Calculate adaptive learning rate based on user feedback history
    const learningRate = await this.calculateAdaptiveLearningRate(userId);
    
    // Update pattern confidence based on feedback
    const patternUpdates: PatternUpdate[] = [];
    for (const patternId of basedOn) {
      const update = await this.updatePatternConfidence(
        patternId, 
        feedbackType, 
        suggestion.confidence,
        learningRate
      );
      if (update) {
        patternUpdates.push(update);
      }
    }

    // Update confidence calibration data
    const adjustments = await this.updateConfidenceCalibration(
      userId, 
      suggestion, 
      feedbackType,
      learningRate
    );

    // Learn from temporal patterns if context is available
    if (context) {
      await this.updateTemporalLearning(userId, suggestion, feedbackType, context);
    }

    // Update category-specific learning
    await this.updateCategoryLearning(
      userId, 
      suggestion.category, 
      feedbackType, 
      suggestion.confidence
    );

    return {
      patternUpdates: patternUpdates.length,
      confidenceAdjustments: adjustments,
      learningRate
    };
  }

  /**
   * Calculate adaptive learning rate based on user feedback history
   */
  private async calculateAdaptiveLearningRate(userId: string): Promise<number> {
    const db = await getDatabase();
    
    // Get feedback count and consistency
    const feedbackStats = await db.getFirstAsync<any>(`
      SELECT 
        COUNT(*) as total_feedback,
        (
          SELECT COUNT(*) FROM (
            SELECT suggestion_id, COUNT(DISTINCT feedback_type) as feedback_types
            FROM feedback
            WHERE user_id = ?
            GROUP BY suggestion_id
            HAVING feedback_types = 1
          )
        ) as consistent_feedback
      FROM feedback
      WHERE user_id = ?
    `, [userId, userId]);
    
    if (!feedbackStats || feedbackStats.total_feedback === 0) {
      return 0.1; // Default learning rate
    }
    
    // Calculate consistency ratio (higher consistency = higher learning rate)
    const consistencyRatio = feedbackStats.consistent_feedback / feedbackStats.total_feedback;
    
    // Calculate base learning rate based on feedback volume (more feedback = lower learning rate)
    let baseLearningRate = 0.1;
    if (feedbackStats.total_feedback < 10) {
      baseLearningRate = 0.15; // Higher learning rate for new users
    } else if (feedbackStats.total_feedback > 100) {
      baseLearningRate = 0.05; // Lower learning rate for established users
    }
    
    // Adjust learning rate based on consistency
    const learningRate = baseLearningRate * (0.5 + 0.5 * consistencyRatio);
    
    return Math.min(0.2, Math.max(0.02, learningRate));
  }

  /**
   * Update pattern confidence based on feedback
   */
  private async updatePatternConfidence(
    patternId: string,
    feedbackType: 'positive' | 'negative',
    suggestionConfidence: number,
    learningRate: number
  ): Promise<PatternUpdate | null> {
    const db = await getDatabase();

    // Get current pattern
    const pattern = await db.getFirstAsync<any>(`
      SELECT * FROM user_patterns WHERE id = ?
    `, [patternId]);

    if (!pattern) return null;

    // Calculate confidence adjustment
    const adjustmentFactor = this.calculateConfidenceAdjustment(
      feedbackType,
      pattern.confidence,
      suggestionConfidence,
      learningRate
    );

    const oldConfidence = pattern.confidence;
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

    return {
      patternId,
      oldConfidence,
      newConfidence,
      adjustmentFactor
    };
  }

  /**
   * Calculate confidence adjustment based on feedback
   */
  private calculateConfidenceAdjustment(
    feedbackType: 'positive' | 'negative',
    currentConfidence: number,
    suggestionConfidence: number,
    learningRate: number
  ): number {
    const confidenceWeight = 1 - Math.abs(currentConfidence - suggestionConfidence);
    
    if (feedbackType === 'positive') {
      // Positive feedback increases confidence, but with diminishing returns
      return learningRate * confidenceWeight * (1 - currentConfidence);
    } else {
      // Negative feedback decreases confidence more aggressively
      return -learningRate * confidenceWeight * (1 + currentConfidence);
    }
  }

  /**
   * Update confidence calibration data
   */
  private async updateConfidenceCalibration(
    userId: string,
    suggestion: Suggestion,
    feedbackType: 'positive' | 'negative',
    learningRate: number
  ): Promise<number> {
    const db = await getDatabase();
    let adjustmentsCount = 0;
    
    // Determine confidence range
    const confidenceRange = this.getConfidenceRange(suggestion.confidence);
    
    // Check if adjustment exists for this range
    const existingAdjustment = await db.getFirstAsync<any>(`
      SELECT * FROM confidence_adjustments 
      WHERE user_id = ? AND confidence_range = ?
    `, [userId, confidenceRange]);

    const isAccurate = feedbackType === 'positive';
    const adjustmentFactor = isAccurate ? 1 + (learningRate / 2) : 1 - (learningRate / 2);

    if (existingAdjustment) {
      // Update existing adjustment with weighted average
      const newFactor = (existingAdjustment.adjustment_factor * 0.8) + (adjustmentFactor * 0.2);
      await db.runAsync(`
        UPDATE confidence_adjustments 
        SET adjustment_factor = ?, created_at = ?
        WHERE id = ?
      `, [newFactor, DatabaseUtils.formatDate(new Date()), existingAdjustment.id]);
      adjustmentsCount++;
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
      adjustmentsCount++;
    }

    return adjustmentsCount;
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
    const db = await getDatabase();
    
    // Get existing category stats
    const categoryStats = await db.getFirstAsync<any>(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN f.feedback_type = 'positive' THEN 1 ELSE 0 END) as positive
      FROM feedback f
      JOIN suggestions s ON f.suggestion_id = s.id
      WHERE f.user_id = ? AND s.category = ?
    `, [userId, category]);
    
    if (!categoryStats || categoryStats.total === 0) return;
    
    // Calculate category acceptance rate
    const acceptanceRate = categoryStats.positive / categoryStats.total;
    
    // Store category preference
    await db.runAsync(`
      INSERT OR REPLACE INTO user_preferences (
        user_id, category_preferences, updated_at
      ) VALUES (
        ?,
        json_set(
          COALESCE(
            (SELECT category_preferences FROM user_preferences WHERE user_id = ?),
            '{}'
          ),
          '$.' || ?,
          ?
        ),
        ?
      )
    `, [
      userId,
      userId,
      category,
      acceptanceRate,
      DatabaseUtils.formatDate(new Date())
    ]);
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
   * Process pending feedback in batch
   */
  async processPendingFeedback(userId: string): Promise<number> {
    const db = await getDatabase();
    
    // Get pending feedback (suggestions with feedback but not processed)
    const pendingFeedback = await db.getAllAsync<any>(`
      SELECT 
        f.id as feedback_id,
        f.suggestion_id,
        f.feedback_type,
        fc.time_of_day,
        fc.day_of_week,
        fc.location,
        fc.device_context,
        fc.user_activity
      FROM feedback f
      LEFT JOIN feedback_context fc ON f.id = fc.feedback_id
      JOIN suggestions s ON f.suggestion_id = s.id
      WHERE f.user_id = ? AND s.status IN ('accepted', 'rejected')
      ORDER BY f.created_at ASC
      LIMIT 50
    `, [userId]);
    
    let processedCount = 0;
    
    for (const feedback of pendingFeedback) {
      try {
        const context = feedback.time_of_day ? {
          time_of_day: feedback.time_of_day,
          day_of_week: feedback.day_of_week,
          location: feedback.location,
          device_context: feedback.device_context,
          user_activity: feedback.user_activity
        } : undefined;
        
        await this.processFeedback(
          userId,
          feedback.suggestion_id,
          feedback.feedback_type,
          context
        );
        
        processedCount++;
      } catch (error) {
        console.error(`Error processing feedback ${feedback.feedback_id}:`, error);
      }
    }
    
    return processedCount;
  }
}

export default FeedbackProcessingService;