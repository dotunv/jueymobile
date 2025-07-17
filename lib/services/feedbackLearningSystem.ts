import { getDatabase, DatabaseUtils } from '../database';
import { PatternDatabaseUtils, UserPattern } from '../patternDatabase';
import { Feedback, FeedbackCreateInput, Suggestion } from '../types';

/**
 * Feedback learning system that adapts suggestions based on user behavior
 */

export interface FeedbackAnalytics {
  totalFeedback: number;
  positiveRate: number;
  negativeRate: number;
  categoryBreakdown: Record<string, {
    positive: number;
    negative: number;
    rate: number;
  }>;
  patternTypeBreakdown: Record<string, {
    positive: number;
    negative: number;
    rate: number;
  }>;
  averageConfidenceAccepted: number;
  averageConfidenceRejected: number;
}

export interface LearningInsight {
  type: 'pattern_adjustment' | 'confidence_calibration' | 'category_preference' | 'timing_optimization';
  description: string;
  impact: 'high' | 'medium' | 'low';
  recommendation: string;
  data: Record<string, any>;
}

export interface AdaptiveLearningResult {
  patternsUpdated: number;
  confidenceAdjustments: number;
  newInsights: LearningInsight[];
  overallImprovement: number;
}

export class FeedbackLearningSystem {
  private userId: string;
  private learningRate: number;
  private confidenceThreshold: number;

  constructor(userId: string, learningRate: number = 0.1, confidenceThreshold: number = 0.3) {
    this.userId = userId;
    this.learningRate = learningRate;
    this.confidenceThreshold = confidenceThreshold;
  }

  /**
   * Process user feedback and update patterns
   */
  async processFeedback(feedbackInput: FeedbackCreateInput): Promise<void> {
    try {
      // Create feedback record
      const feedback = await this.createFeedbackRecord(feedbackInput);
      
      // Get the suggestion that was rated
      const suggestion = await this.getSuggestion(feedbackInput.suggestion_id);
      if (!suggestion) {
        throw new Error('Suggestion not found');
      }
      
      // Update pattern weights based on feedback
      await this.updatePatternWeights(suggestion, feedback);
      
      // Update confidence scores
      await this.updateConfidenceScores(suggestion, feedback);
      
      // Learn from feedback patterns
      await this.learnFromFeedbackPatterns(feedback);
      
    } catch (error) {
      console.error('Error processing feedback:', error);
      throw error;
    }
  }

  /**
   * Create feedback record in database
   */
  private async createFeedbackRecord(feedbackInput: FeedbackCreateInput): Promise<Feedback> {
    const db = await getDatabase();
    const feedbackId = DatabaseUtils.generateId();
    const now = DatabaseUtils.formatDate(new Date());
    
    await db.runAsync(`
      INSERT INTO feedback (id, user_id, suggestion_id, feedback_type, reason, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      feedbackId, this.userId, feedbackInput.suggestion_id,
      feedbackInput.feedback_type, feedbackInput.reason, now
    ]);
    
    return {
      id: feedbackId,
      user_id: this.userId,
      suggestion_id: feedbackInput.suggestion_id,
      feedback_type: feedbackInput.feedback_type,
      reason: feedbackInput.reason,
      created_at: now
    };
  }

  /**
   * Get suggestion by ID
   */
  private async getSuggestion(suggestionId: string): Promise<Suggestion | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<any>(
      'SELECT * FROM suggestions WHERE id = ?',
      [suggestionId]
    );
    
    if (!row) return null;
    
    return {
      ...row,
      based_on: DatabaseUtils.deserializeJSON(row.based_on)
    };
  }

  /**
   * Update pattern weights based on feedback
   */
  private async updatePatternWeights(suggestion: Suggestion, feedback: Feedback): Promise<void> {
    const patternTypes = suggestion.based_on;
    const weightAdjustment = feedback.feedback_type === 'positive' ? 
      this.learningRate : -this.learningRate;
    
    for (const patternType of patternTypes) {
      await this.adjustPatternWeight(patternType, suggestion.category, weightAdjustment);
    }
  }

  /**
   * Adjust pattern weight for specific pattern type and category
   */
  private async adjustPatternWeight(
    patternType: string, 
    category: string, 
    adjustment: number
  ): Promise<void> {
    const patterns = await PatternDatabaseUtils.getUserPatterns(this.userId, patternType);
    
    for (const pattern of patterns) {
      const patternData = pattern.pattern_data;
      
      // Check if pattern is relevant to the category
      if (patternData.category === category || 
          patternData.taskCategory === category ||
          this.isPatternRelevantToCategory(pattern, category)) {
        
        // Adjust confidence with bounds checking
        const newConfidence = Math.max(0, Math.min(1, pattern.confidence + adjustment));
        
        // Update pattern in database
        await PatternDatabaseUtils.upsertUserPattern({
          ...pattern,
          confidence: newConfidence,
          updated_at: DatabaseUtils.formatDate(new Date())
        });
      }
    }
  }

  /**
   * Check if pattern is relevant to category
   */
  private isPatternRelevantToCategory(pattern: UserPattern, category: string): boolean {
    const patternData = pattern.pattern_data;
    
    // Check various fields that might contain category information
    const categoryFields = [
      patternData.category,
      patternData.taskCategory,
      patternData.primaryCategory,
      patternData.relatedCategories
    ];
    
    return categoryFields.some(field => {
      if (typeof field === 'string') {
        return field.toLowerCase() === category.toLowerCase();
      }
      if (Array.isArray(field)) {
        return field.some(cat => cat.toLowerCase() === category.toLowerCase());
      }
      return false;
    });
  }

  /**
   * Update confidence scores based on feedback accuracy
   */
  private async updateConfidenceScores(suggestion: Suggestion, feedback: Feedback): Promise<void> {
    const db = await getDatabase();
    
    // Calculate confidence adjustment based on feedback
    const originalConfidence = suggestion.confidence / 100; // Convert to 0-1 scale
    const feedbackScore = feedback.feedback_type === 'positive' ? 1 : 0;
    
    // Use learning rate to adjust confidence calibration
    const confidenceError = feedbackScore - originalConfidence;
    const adjustment = confidenceError * this.learningRate;
    
    // Store confidence calibration data for future use
    await this.storeConfidenceCalibration(suggestion, feedback, adjustment);
  }

  /**
   * Store confidence calibration data
   */
  private async storeConfidenceCalibration(
    suggestion: Suggestion, 
    feedback: Feedback, 
    adjustment: number
  ): Promise<void> {
    const db = await getDatabase();
    
    // Create or update confidence calibration record
    await db.runAsync(`
      INSERT OR REPLACE INTO confidence_calibration (
        id, user_id, pattern_types, category, original_confidence,
        feedback_type, adjustment, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      DatabaseUtils.generateId(),
      this.userId,
      DatabaseUtils.serializeJSON(suggestion.based_on),
      suggestion.category,
      suggestion.confidence,
      feedback.feedback_type,
      adjustment,
      DatabaseUtils.formatDate(new Date())
    ]);
  }

  /**
   * Learn from feedback patterns to identify insights
   */
  private async learnFromFeedbackPatterns(feedback: Feedback): Promise<void> {
    // Analyze recent feedback patterns
    const recentFeedback = await this.getRecentFeedback(30); // Last 30 days
    
    // Identify learning opportunities
    const insights = await this.identifyLearningInsights(recentFeedback);
    
    // Apply insights to improve future suggestions
    for (const insight of insights) {
      await this.applyLearningInsight(insight);
    }
  }

  /**
   * Get recent feedback for analysis
   */
  private async getRecentFeedback(days: number): Promise<Array<Feedback & { suggestion: Suggestion }>> {
    const db = await getDatabase();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffString = DatabaseUtils.formatDate(cutoffDate);
    
    const rows = await db.getAllAsync<any>(`
      SELECT f.*, s.title, s.category, s.confidence, s.based_on, s.reasoning
      FROM feedback f
      JOIN suggestions s ON f.suggestion_id = s.id
      WHERE f.user_id = ? AND f.created_at > ?
      ORDER BY f.created_at DESC
    `, [this.userId, cutoffString]);
    
    return rows.map(row => ({
      id: row.id,
      user_id: row.user_id,
      suggestion_id: row.suggestion_id,
      feedback_type: row.feedback_type,
      reason: row.reason,
      created_at: row.created_at,
      suggestion: {
        id: row.suggestion_id,
        user_id: row.user_id,
        title: row.title,
        category: row.category,
        confidence: row.confidence,
        based_on: DatabaseUtils.deserializeJSON(row.based_on),
        reasoning: row.reasoning,
        // Add other required fields with defaults
        description: '',
        priority: 'medium' as const,
        status: 'pending' as const,
        created_at: row.created_at
      }
    }));
  }

  /**
   * Identify learning insights from feedback patterns
   */
  private async identifyLearningInsights(
    feedbackData: Array<Feedback & { suggestion: Suggestion }>
  ): Promise<LearningInsight[]> {
    const insights: LearningInsight[] = [];
    
    // Analyze category preferences
    const categoryInsights = this.analyzeCategoryPreferences(feedbackData);
    insights.push(...categoryInsights);
    
    // Analyze confidence calibration
    const confidenceInsights = this.analyzeConfidenceCalibration(feedbackData);
    insights.push(...confidenceInsights);
    
    // Analyze pattern type effectiveness
    const patternInsights = this.analyzePatternTypeEffectiveness(feedbackData);
    insights.push(...patternInsights);
    
    // Analyze timing patterns
    const timingInsights = this.analyzeTimingPatterns(feedbackData);
    insights.push(...timingInsights);
    
    return insights;
  }

  /**
   * Analyze category preferences from feedback
   */
  private analyzeCategoryPreferences(
    feedbackData: Array<Feedback & { suggestion: Suggestion }>
  ): LearningInsight[] {
    const insights: LearningInsight[] = [];
    const categoryStats: Record<string, { positive: number; negative: number; total: number }> = {};
    
    // Collect category statistics
    for (const feedback of feedbackData) {
      const category = feedback.suggestion.category;
      if (!categoryStats[category]) {
        categoryStats[category] = { positive: 0, negative: 0, total: 0 };
      }
      
      categoryStats[category].total++;
      if (feedback.feedback_type === 'positive') {
        categoryStats[category].positive++;
      } else {
        categoryStats[category].negative++;
      }
    }
    
    // Identify categories with strong preferences
    for (const [category, stats] of Object.entries(categoryStats)) {
      if (stats.total >= 5) { // Minimum sample size
        const positiveRate = stats.positive / stats.total;
        
        if (positiveRate >= 0.8) {
          insights.push({
            type: 'category_preference',
            description: `High acceptance rate for ${category} suggestions`,
            impact: 'high',
            recommendation: `Increase confidence and frequency for ${category} suggestions`,
            data: { category, positiveRate, sampleSize: stats.total }
          });
        } else if (positiveRate <= 0.3) {
          insights.push({
            type: 'category_preference',
            description: `Low acceptance rate for ${category} suggestions`,
            impact: 'high',
            recommendation: `Reduce confidence or improve ${category} suggestion quality`,
            data: { category, positiveRate, sampleSize: stats.total }
          });
        }
      }
    }
    
    return insights;
  }

  /**
   * Analyze confidence calibration accuracy
   */
  private analyzeConfidenceCalibration(
    feedbackData: Array<Feedback & { suggestion: Suggestion }>
  ): LearningInsight[] {
    const insights: LearningInsight[] = [];
    
    // Group by confidence ranges
    const confidenceRanges = [
      { min: 0, max: 30, label: 'Low' },
      { min: 30, max: 70, label: 'Medium' },
      { min: 70, max: 100, label: 'High' }
    ];
    
    for (const range of confidenceRanges) {
      const rangeData = feedbackData.filter(f => 
        f.suggestion.confidence >= range.min && f.suggestion.confidence < range.max
      );
      
      if (rangeData.length >= 3) {
        const positiveRate = rangeData.filter(f => f.feedback_type === 'positive').length / rangeData.length;
        const expectedRate = (range.min + range.max) / 200; // Convert to 0-1 scale
        const calibrationError = Math.abs(positiveRate - expectedRate);
        
        if (calibrationError > 0.2) {
          insights.push({
            type: 'confidence_calibration',
            description: `${range.label} confidence suggestions are ${positiveRate > expectedRate ? 'under' : 'over'}confident`,
            impact: calibrationError > 0.3 ? 'high' : 'medium',
            recommendation: `Adjust confidence calibration for ${range.label.toLowerCase()} confidence suggestions`,
            data: { 
              range: range.label, 
              actualRate: positiveRate, 
              expectedRate, 
              error: calibrationError,
              sampleSize: rangeData.length
            }
          });
        }
      }
    }
    
    return insights;
  }

  /**
   * Analyze pattern type effectiveness
   */
  private analyzePatternTypeEffectiveness(
    feedbackData: Array<Feedback & { suggestion: Suggestion }>
  ): LearningInsight[] {
    const insights: LearningInsight[] = [];
    const patternStats: Record<string, { positive: number; negative: number; total: number }> = {};
    
    // Collect pattern type statistics
    for (const feedback of feedbackData) {
      for (const patternType of feedback.suggestion.based_on) {
        if (!patternStats[patternType]) {
          patternStats[patternType] = { positive: 0, negative: 0, total: 0 };
        }
        
        patternStats[patternType].total++;
        if (feedback.feedback_type === 'positive') {
          patternStats[patternType].positive++;
        } else {
          patternStats[patternType].negative++;
        }
      }
    }
    
    // Identify effective and ineffective pattern types
    for (const [patternType, stats] of Object.entries(patternStats)) {
      if (stats.total >= 5) {
        const positiveRate = stats.positive / stats.total;
        
        if (positiveRate >= 0.8) {
          insights.push({
            type: 'pattern_adjustment',
            description: `${patternType} patterns are highly effective`,
            impact: 'medium',
            recommendation: `Increase weight and confidence for ${patternType} patterns`,
            data: { patternType, positiveRate, sampleSize: stats.total }
          });
        } else if (positiveRate <= 0.3) {
          insights.push({
            type: 'pattern_adjustment',
            description: `${patternType} patterns are less effective`,
            impact: 'medium',
            recommendation: `Review and improve ${patternType} pattern detection`,
            data: { patternType, positiveRate, sampleSize: stats.total }
          });
        }
      }
    }
    
    return insights;
  }

  /**
   * Analyze timing patterns in feedback
   */
  private analyzeTimingPatterns(
    feedbackData: Array<Feedback & { suggestion: Suggestion }>
  ): LearningInsight[] {
    const insights: LearningInsight[] = [];
    
    // Analyze feedback by hour of day
    const hourlyStats: Record<number, { positive: number; negative: number; total: number }> = {};
    
    for (const feedback of feedbackData) {
      const hour = new Date(feedback.created_at).getHours();
      if (!hourlyStats[hour]) {
        hourlyStats[hour] = { positive: 0, negative: 0, total: 0 };
      }
      
      hourlyStats[hour].total++;
      if (feedback.feedback_type === 'positive') {
        hourlyStats[hour].positive++;
      } else {
        hourlyStats[hour].negative++;
      }
    }
    
    // Find optimal and suboptimal hours
    const hourlyRates = Object.entries(hourlyStats)
      .filter(([_, stats]) => stats.total >= 3)
      .map(([hour, stats]) => ({
        hour: parseInt(hour),
        rate: stats.positive / stats.total,
        total: stats.total
      }))
      .sort((a, b) => b.rate - a.rate);
    
    if (hourlyRates.length > 0) {
      const bestHours = hourlyRates.filter(h => h.rate >= 0.8).map(h => h.hour);
      const worstHours = hourlyRates.filter(h => h.rate <= 0.3).map(h => h.hour);
      
      if (bestHours.length > 0) {
        insights.push({
          type: 'timing_optimization',
          description: `Suggestions are most effective during hours: ${bestHours.join(', ')}`,
          impact: 'medium',
          recommendation: 'Prioritize suggestions during high-acceptance hours',
          data: { bestHours, averageRate: bestHours.reduce((sum, h) => sum + hourlyRates.find(hr => hr.hour === h)!.rate, 0) / bestHours.length }
        });
      }
      
      if (worstHours.length > 0) {
        insights.push({
          type: 'timing_optimization',
          description: `Suggestions are least effective during hours: ${worstHours.join(', ')}`,
          impact: 'low',
          recommendation: 'Reduce suggestion frequency during low-acceptance hours',
          data: { worstHours, averageRate: worstHours.reduce((sum, h) => sum + hourlyRates.find(hr => hr.hour === h)!.rate, 0) / worstHours.length }
        });
      }
    }
    
    return insights;
  }

  /**
   * Apply learning insight to improve future suggestions
   */
  private async applyLearningInsight(insight: LearningInsight): Promise<void> {
    switch (insight.type) {
      case 'category_preference':
        await this.applyCategoryPreferenceInsight(insight);
        break;
      case 'confidence_calibration':
        await this.applyConfidenceCalibrationInsight(insight);
        break;
      case 'pattern_adjustment':
        await this.applyPatternAdjustmentInsight(insight);
        break;
      case 'timing_optimization':
        await this.applyTimingOptimizationInsight(insight);
        break;
    }
  }

  /**
   * Apply category preference insights
   */
  private async applyCategoryPreferenceInsight(insight: LearningInsight): Promise<void> {
    const { category, positiveRate } = insight.data;
    const adjustment = (positiveRate - 0.5) * this.learningRate; // Adjust based on deviation from neutral
    
    // Update patterns related to this category
    const patterns = await PatternDatabaseUtils.getUserPatterns(this.userId);
    
    for (const pattern of patterns) {
      if (this.isPatternRelevantToCategory(pattern, category)) {
        const newConfidence = Math.max(0, Math.min(1, pattern.confidence + adjustment));
        
        await PatternDatabaseUtils.upsertUserPattern({
          ...pattern,
          confidence: newConfidence,
          updated_at: DatabaseUtils.formatDate(new Date())
        });
      }
    }
  }

  /**
   * Apply confidence calibration insights
   */
  private async applyConfidenceCalibrationInsight(insight: LearningInsight): Promise<void> {
    // Store calibration adjustment for future use
    const db = await getDatabase();
    
    await db.runAsync(`
      INSERT OR REPLACE INTO confidence_adjustments (
        id, user_id, confidence_range, adjustment_factor, 
        reason, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [
      DatabaseUtils.generateId(),
      this.userId,
      insight.data.range,
      insight.data.error,
      insight.description,
      DatabaseUtils.formatDate(new Date())
    ]);
  }

  /**
   * Apply pattern adjustment insights
   */
  private async applyPatternAdjustmentInsight(insight: LearningInsight): Promise<void> {
    const { patternType, positiveRate } = insight.data;
    const adjustment = (positiveRate - 0.5) * this.learningRate;
    
    // Update all patterns of this type
    const patterns = await PatternDatabaseUtils.getUserPatterns(this.userId, patternType);
    
    for (const pattern of patterns) {
      const newConfidence = Math.max(0, Math.min(1, pattern.confidence + adjustment));
      
      await PatternDatabaseUtils.upsertUserPattern({
        ...pattern,
        confidence: newConfidence,
        updated_at: DatabaseUtils.formatDate(new Date())
      });
    }
  }

  /**
   * Apply timing optimization insights
   */
  private async applyTimingOptimizationInsight(insight: LearningInsight): Promise<void> {
    // Store timing preferences for future suggestion scheduling
    const db = await getDatabase();
    
    const timingData = {
      bestHours: insight.data.bestHours || [],
      worstHours: insight.data.worstHours || [],
      averageRate: insight.data.averageRate || 0.5
    };
    
    await db.runAsync(`
      INSERT OR REPLACE INTO timing_preferences (
        id, user_id, preference_type, timing_data, 
        confidence, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [
      DatabaseUtils.generateId(),
      this.userId,
      'hourly_effectiveness',
      DatabaseUtils.serializeJSON(timingData),
      timingData.averageRate,
      DatabaseUtils.formatDate(new Date())
    ]);
  }

  /**
   * Run adaptive learning algorithm
   */
  async runAdaptiveLearning(): Promise<AdaptiveLearningResult> {
    try {
      // Get recent feedback for analysis
      const recentFeedback = await this.getRecentFeedback(30);
      
      if (recentFeedback.length < 5) {
        return {
          patternsUpdated: 0,
          confidenceAdjustments: 0,
          newInsights: [],
          overallImprovement: 0
        };
      }
      
      // Identify insights
      const insights = await this.identifyLearningInsights(recentFeedback);
      
      // Apply insights
      let patternsUpdated = 0;
      let confidenceAdjustments = 0;
      
      for (const insight of insights) {
        await this.applyLearningInsight(insight);
        
        if (insight.type === 'pattern_adjustment') {
          patternsUpdated++;
        } else if (insight.type === 'confidence_calibration') {
          confidenceAdjustments++;
        }
      }
      
      // Calculate overall improvement
      const overallImprovement = this.calculateOverallImprovement(recentFeedback);
      
      return {
        patternsUpdated,
        confidenceAdjustments,
        newInsights: insights,
        overallImprovement
      };
    } catch (error) {
      console.error('Error running adaptive learning:', error);
      return {
        patternsUpdated: 0,
        confidenceAdjustments: 0,
        newInsights: [],
        overallImprovement: 0
      };
    }
  }

  /**
   * Calculate overall improvement metric
   */
  private calculateOverallImprovement(
    feedbackData: Array<Feedback & { suggestion: Suggestion }>
  ): number {
    if (feedbackData.length < 10) return 0;
    
    // Split feedback into two halves to compare improvement
    const midpoint = Math.floor(feedbackData.length / 2);
    const earlierFeedback = feedbackData.slice(midpoint);
    const recentFeedback = feedbackData.slice(0, midpoint);
    
    const earlierPositiveRate = earlierFeedback.filter(f => f.feedback_type === 'positive').length / earlierFeedback.length;
    const recentPositiveRate = recentFeedback.filter(f => f.feedback_type === 'positive').length / recentFeedback.length;
    
    return recentPositiveRate - earlierPositiveRate;
  }

  /**
   * Get feedback analytics
   */
  async getFeedbackAnalytics(): Promise<FeedbackAnalytics> {
    const db = await getDatabase();
    
    // Get all feedback with suggestion details
    const feedbackData = await db.getAllAsync<any>(`
      SELECT f.feedback_type, s.category, s.based_on, s.confidence
      FROM feedback f
      JOIN suggestions s ON f.suggestion_id = s.id
      WHERE f.user_id = ?
    `, [this.userId]);
    
    const totalFeedback = feedbackData.length;
    const positiveCount = feedbackData.filter(f => f.feedback_type === 'positive').length;
    const negativeCount = totalFeedback - positiveCount;
    
    // Category breakdown
    const categoryBreakdown: Record<string, { positive: number; negative: number; rate: number }> = {};
    
    for (const feedback of feedbackData) {
      const category = feedback.category;
      if (!categoryBreakdown[category]) {
        categoryBreakdown[category] = { positive: 0, negative: 0, rate: 0 };
      }
      
      if (feedback.feedback_type === 'positive') {
        categoryBreakdown[category].positive++;
      } else {
        categoryBreakdown[category].negative++;
      }
    }
    
    // Calculate rates
    for (const category in categoryBreakdown) {
      const stats = categoryBreakdown[category];
      const total = stats.positive + stats.negative;
      stats.rate = total > 0 ? stats.positive / total : 0;
    }
    
    // Pattern type breakdown
    const patternTypeBreakdown: Record<string, { positive: number; negative: number; rate: number }> = {};
    
    for (const feedback of feedbackData) {
      const basedOn = DatabaseUtils.deserializeJSON(feedback.based_on) || [];
      
      for (const patternType of basedOn) {
        if (!patternTypeBreakdown[patternType]) {
          patternTypeBreakdown[patternType] = { positive: 0, negative: 0, rate: 0 };
        }
        
        if (feedback.feedback_type === 'positive') {
          patternTypeBreakdown[patternType].positive++;
        } else {
          patternTypeBreakdown[patternType].negative++;
        }
      }
    }
    
    // Calculate pattern type rates
    for (const patternType in patternTypeBreakdown) {
      const stats = patternTypeBreakdown[patternType];
      const total = stats.positive + stats.negative;
      stats.rate = total > 0 ? stats.positive / total : 0;
    }
    
    // Average confidence for accepted vs rejected
    const acceptedConfidences = feedbackData
      .filter(f => f.feedback_type === 'positive')
      .map(f => f.confidence);
    const rejectedConfidences = feedbackData
      .filter(f => f.feedback_type === 'negative')
      .map(f => f.confidence);
    
    const averageConfidenceAccepted = acceptedConfidences.length > 0 ?
      acceptedConfidences.reduce((sum, conf) => sum + conf, 0) / acceptedConfidences.length : 0;
    const averageConfidenceRejected = rejectedConfidences.length > 0 ?
      rejectedConfidences.reduce((sum, conf) => sum + conf, 0) / rejectedConfidences.length : 0;
    
    return {
      totalFeedback,
      positiveRate: totalFeedback > 0 ? positiveCount / totalFeedback : 0,
      negativeRate: totalFeedback > 0 ? negativeCount / totalFeedback : 0,
      categoryBreakdown,
      patternTypeBreakdown,
      averageConfidenceAccepted,
      averageConfidenceRejected
    };
  }
}

/**
 * Initialize feedback learning system tables
 */
export async function initFeedbackLearningTables(): Promise<void> {
  const db = await getDatabase();
  
  // Confidence calibration table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS confidence_calibration (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      pattern_types TEXT NOT NULL, -- JSON array
      category TEXT NOT NULL,
      original_confidence REAL NOT NULL,
      feedback_type TEXT NOT NULL,
      adjustment REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  
  // Confidence adjustments table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS confidence_adjustments (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      confidence_range TEXT NOT NULL,
      adjustment_factor REAL NOT NULL,
      reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  
  // Timing preferences table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS timing_preferences (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      preference_type TEXT NOT NULL,
      timing_data TEXT NOT NULL, -- JSON object
      confidence REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  
  // Create indexes
  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_confidence_calibration_user_id ON confidence_calibration(user_id);
    CREATE INDEX IF NOT EXISTS idx_confidence_adjustments_user_id ON confidence_adjustments(user_id);
    CREATE INDEX IF NOT EXISTS idx_timing_preferences_user_id ON timing_preferences(user_id);
  `);
}