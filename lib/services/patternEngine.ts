import { getDatabase, DatabaseUtils } from '../database';
import { PatternDatabaseUtils, UserPattern, TemporalPattern } from '../patternDatabase';
import { SuggestionEngine, SuggestionManager, UserContext } from './suggestionEngine';
import { FeedbackLearningSystem, initFeedbackLearningTables } from './feedbackLearningSystem';
import { Task, Suggestion } from '../types';

/**
 * Main Pattern Engine that coordinates all AI pattern recognition components
 */

export interface PatternAnalysisResult {
  temporalPatterns: TemporalPattern[];
  sequentialPatterns: UserPattern[];
  contextualPatterns: UserPattern[];
  frequencyPatterns: UserPattern[];
  totalPatterns: number;
  confidence: number;
}

export interface OptimalTiming {
  suggestedTime: Date;
  confidence: number;
  reasoning: string[];
  alternativeTimes: Date[];
}

export interface PatternEngineConfig {
  minPatternConfidence: number;
  maxPatternsPerType: number;
  learningRate: number;
  analysisWindowDays: number;
}

export class PatternEngine {
  private userId: string;
  private config: PatternEngineConfig;
  private suggestionEngine: SuggestionEngine;
  private suggestionManager: SuggestionManager;
  private feedbackLearningSystem: FeedbackLearningSystem;

  constructor(userId: string, config?: Partial<PatternEngineConfig>) {
    this.userId = userId;
    this.config = {
      minPatternConfidence: 0.3,
      maxPatternsPerType: 50,
      learningRate: 0.1,
      analysisWindowDays: 90,
      ...config
    };
    
    this.suggestionEngine = new SuggestionEngine(userId);
    this.suggestionManager = new SuggestionManager(userId);
    this.feedbackLearningSystem = new FeedbackLearningSystem(userId, this.config.learningRate);
  }

  /**
   * Initialize the pattern engine and required database tables
   */
  static async initialize(): Promise<void> {
    try {
      // Initialize pattern tables
      await PatternDatabaseUtils.upsertUserPattern;
      
      // Initialize feedback learning tables
      await initFeedbackLearningTables();
      
      console.log('Pattern engine initialized successfully');
    } catch (error) {
      console.error('Error initializing pattern engine:', error);
      throw error;
    }
  }

  /**
   * Analyze all task patterns for the user
   */
  async analyzeTaskPatterns(timeframe?: { start: Date; end: Date }): Promise<PatternAnalysisResult> {
    try {
      const tasks = await this.getUserTasks(timeframe);
      
      if (tasks.length < 5) {
        return {
          temporalPatterns: [],
          sequentialPatterns: [],
          contextualPatterns: [],
          frequencyPatterns: [],
          totalPatterns: 0,
          confidence: 0
        };
      }

      // Analyze different pattern types
      const temporalPatterns = await this.analyzeTemporalPatterns(tasks);
      const sequentialPatterns = await this.analyzeSequentialPatterns(tasks);
      const contextualPatterns = await this.analyzeContextualPatterns(tasks);
      const frequencyPatterns = await this.analyzeFrequencyPatterns(tasks);

      // Calculate overall confidence
      const allPatterns = [
        ...temporalPatterns,
        ...sequentialPatterns,
        ...contextualPatterns,
        ...frequencyPatterns
      ];
      
      const averageConfidence = allPatterns.length > 0 ?
        allPatterns.reduce((sum, p) => sum + p.confidence, 0) / allPatterns.length : 0;

      return {
        temporalPatterns,
        sequentialPatterns,
        contextualPatterns,
        frequencyPatterns,
        totalPatterns: allPatterns.length,
        confidence: averageConfidence
      };
    } catch (error) {
      console.error('Error analyzing task patterns:', error);
      throw error;
    }
  }

  /**
   * Generate intelligent suggestions based on current context
   */
  async generateSuggestions(context: UserContext): Promise<Suggestion[]> {
    return await this.suggestionEngine.generateSuggestions(context);
  }

  /**
   * Predict optimal timing for a task type
   */
  async predictOptimalTiming(taskType: string): Promise<OptimalTiming> {
    try {
      // Get temporal patterns for this task type
      const temporalPatterns = await PatternDatabaseUtils.getTemporalPatterns(this.userId);
      const relevantPatterns = temporalPatterns.filter(p => 
        p.task_title.toLowerCase().includes(taskType.toLowerCase()) ||
        p.task_category.toLowerCase().includes(taskType.toLowerCase())
      );

      if (relevantPatterns.length === 0) {
        // Return default timing if no patterns found
        const defaultTime = new Date();
        defaultTime.setHours(9, 0, 0, 0); // 9 AM default
        
        return {
          suggestedTime: defaultTime,
          confidence: 0.1,
          reasoning: ['No historical patterns found', 'Using default morning time'],
          alternativeTimes: []
        };
      }

      // Find the pattern with highest confidence
      const bestPattern = relevantPatterns.reduce((best, current) => 
        current.confidence > best.confidence ? current : best
      );

      // Calculate suggested time based on pattern
      const suggestedTime = new Date();
      suggestedTime.setHours(bestPattern.time_of_day, 0, 0, 0);
      
      // Adjust for day of week if needed
      const currentDay = suggestedTime.getDay();
      const targetDay = bestPattern.day_of_week;
      
      if (currentDay !== targetDay) {
        const daysToAdd = (targetDay - currentDay + 7) % 7;
        suggestedTime.setDate(suggestedTime.getDate() + daysToAdd);
      }

      // Generate alternative times
      const alternativeTimes = relevantPatterns
        .filter(p => p.id !== bestPattern.id)
        .slice(0, 3)
        .map(p => {
          const altTime = new Date();
          altTime.setHours(p.time_of_day, 0, 0, 0);
          return altTime;
        });

      const reasoning = [
        `Based on ${bestPattern.frequency} previous occurrences`,
        `You typically do this on ${this.getDayName(bestPattern.day_of_week)} at ${this.formatHour(bestPattern.time_of_day)}`,
        `Pattern confidence: ${Math.round(bestPattern.confidence * 100)}%`
      ];

      return {
        suggestedTime,
        confidence: bestPattern.confidence,
        reasoning,
        alternativeTimes
      };
    } catch (error) {
      console.error('Error predicting optimal timing:', error);
      
      // Return fallback timing
      const fallbackTime = new Date();
      fallbackTime.setHours(9, 0, 0, 0);
      
      return {
        suggestedTime: fallbackTime,
        confidence: 0.1,
        reasoning: ['Error occurred during prediction', 'Using fallback time'],
        alternativeTimes: []
      };
    }
  }

  /**
   * Update patterns based on new task completion
   */
  async updatePatterns(completedTask: Task): Promise<void> {
    try {
      // Update temporal patterns
      await this.updateTemporalPatterns(completedTask);
      
      // Update sequential patterns
      await this.updateSequentialPatterns(completedTask);
      
      // Update contextual patterns
      await this.updateContextualPatterns(completedTask);
      
      // Update frequency patterns
      await this.updateFrequencyPatterns(completedTask);
      
      // Clean up low confidence patterns
      await this.cleanupPatterns();
      
    } catch (error) {
      console.error('Error updating patterns:', error);
    }
  }

  /**
   * Get user tasks within timeframe
   */
  private async getUserTasks(timeframe?: { start: Date; end: Date }): Promise<Task[]> {
    const db = await getDatabase();
    let query = 'SELECT * FROM tasks WHERE user_id = ? AND completed = 1';
    const params: any[] = [this.userId];
    
    if (timeframe) {
      query += ' AND completed_at BETWEEN ? AND ?';
      params.push(
        DatabaseUtils.formatDate(timeframe.start),
        DatabaseUtils.formatDate(timeframe.end)
      );
    } else {
      // Default to last 90 days
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.analysisWindowDays);
      query += ' AND completed_at > ?';
      params.push(DatabaseUtils.formatDate(cutoffDate));
    }
    
    query += ' ORDER BY completed_at DESC';
    
    const rows = await db.getAllAsync<any>(query, params);
    return rows.map(row => ({
      ...row,
      tags: DatabaseUtils.deserializeJSON(row.tags) || []
    }));
  }

  /**
   * Analyze temporal patterns in task completion
   */
  private async analyzeTemporalPatterns(tasks: Task[]): Promise<TemporalPattern[]> {
    const patterns: TemporalPattern[] = [];
    const taskGroups = this.groupTasksByTitleAndCategory(tasks);
    
    for (const [key, groupTasks] of Object.entries(taskGroups)) {
      if (groupTasks.length < 3) continue; // Need at least 3 occurrences
      
      const [title, category] = key.split('|');
      const timeAnalysis = this.analyzeTaskTiming(groupTasks);
      
      if (timeAnalysis.confidence >= this.config.minPatternConfidence) {
        const pattern: TemporalPattern = {
          id: DatabaseUtils.generateId(),
          user_id: this.userId,
          task_title: title,
          task_category: category,
          time_of_day: timeAnalysis.preferredHour,
          day_of_week: timeAnalysis.preferredDay,
          day_of_month: timeAnalysis.preferredDayOfMonth,
          month: timeAnalysis.preferredMonth,
          frequency: groupTasks.length,
          period_type: this.determinePeriodType(groupTasks),
          confidence: timeAnalysis.confidence,
          last_occurrence: groupTasks[0].completed_at!,
          next_predicted: this.predictNextOccurrence(groupTasks, timeAnalysis),
          created_at: DatabaseUtils.formatDate(new Date()),
          updated_at: DatabaseUtils.formatDate(new Date())
        };
        
        patterns.push(pattern);
        
        // Save to database
        await PatternDatabaseUtils.upsertTemporalPattern(pattern);
      }
    }
    
    return patterns;
  }

  /**
   * Analyze sequential patterns in task completion
   */
  private async analyzeSequentialPatterns(tasks: Task[]): Promise<UserPattern[]> {
    const patterns: UserPattern[] = [];
    const sequences = this.findTaskSequences(tasks);
    
    for (const sequence of sequences) {
      if (sequence.occurrences < 3) continue;
      
      const pattern: UserPattern = {
        id: DatabaseUtils.generateId(),
        user_id: this.userId,
        pattern_type: 'sequential',
        pattern_data: {
          sequence: sequence.tasks,
          category: sequence.category,
          averageInterval: sequence.averageInterval,
          occurrences: sequence.occurrences
        },
        confidence: this.calculateSequenceConfidence(sequence),
        frequency: sequence.occurrences,
        last_occurrence: sequence.lastOccurrence,
        next_predicted: sequence.nextPredicted,
        created_at: DatabaseUtils.formatDate(new Date()),
        updated_at: DatabaseUtils.formatDate(new Date())
      };
      
      patterns.push(pattern);
      
      // Save to database
      await PatternDatabaseUtils.upsertUserPattern(pattern);
    }
    
    return patterns;
  }

  /**
   * Analyze contextual patterns in task completion
   */
  private async analyzeContextualPatterns(tasks: Task[]): Promise<UserPattern[]> {
    const patterns: UserPattern[] = [];
    
    // Group tasks by context (time of day, day of week, etc.)
    const contextGroups = this.groupTasksByContext(tasks);
    
    for (const [contextKey, contextTasks] of Object.entries(contextGroups)) {
      if (contextTasks.length < 5) continue;
      
      const contextData = this.parseContextKey(contextKey);
      const confidence = this.calculateContextConfidence(contextTasks, tasks.length);
      
      if (confidence >= this.config.minPatternConfidence) {
        const pattern: UserPattern = {
          id: DatabaseUtils.generateId(),
          user_id: this.userId,
          pattern_type: 'contextual',
          pattern_data: {
            context: contextData,
            taskCount: contextTasks.length,
            categories: this.getUniqueCategories(contextTasks),
            averageCompletionTime: this.calculateAverageCompletionTime(contextTasks)
          },
          confidence,
          frequency: contextTasks.length,
          last_occurrence: contextTasks[0].completed_at!,
          created_at: DatabaseUtils.formatDate(new Date()),
          updated_at: DatabaseUtils.formatDate(new Date())
        };
        
        patterns.push(pattern);
        
        // Save to database
        await PatternDatabaseUtils.upsertUserPattern(pattern);
      }
    }
    
    return patterns;
  }

  /**
   * Analyze frequency patterns in task completion
   */
  private async analyzeFrequencyPatterns(tasks: Task[]): Promise<UserPattern[]> {
    const patterns: UserPattern[] = [];
    const taskGroups = this.groupTasksByTitleAndCategory(tasks);
    
    for (const [key, groupTasks] of Object.entries(taskGroups)) {
      if (groupTasks.length < 3) continue;
      
      const [title, category] = key.split('|');
      const frequencyAnalysis = this.analyzeTaskFrequency(groupTasks);
      
      if (frequencyAnalysis.confidence >= this.config.minPatternConfidence) {
        const pattern: UserPattern = {
          id: DatabaseUtils.generateId(),
          user_id: this.userId,
          pattern_type: 'frequency',
          pattern_data: {
            taskTitle: title,
            category,
            intervalDays: frequencyAnalysis.averageInterval,
            regularityScore: frequencyAnalysis.regularityScore,
            occurrences: groupTasks.length
          },
          confidence: frequencyAnalysis.confidence,
          frequency: groupTasks.length,
          last_occurrence: groupTasks[0].completed_at!,
          next_predicted: frequencyAnalysis.nextPredicted,
          created_at: DatabaseUtils.formatDate(new Date()),
          updated_at: DatabaseUtils.formatDate(new Date())
        };
        
        patterns.push(pattern);
        
        // Save to database
        await PatternDatabaseUtils.upsertUserPattern(pattern);
      }
    }
    
    return patterns;
  }

  // Helper methods for pattern analysis
  private groupTasksByTitleAndCategory(tasks: Task[]): Record<string, Task[]> {
    const groups: Record<string, Task[]> = {};
    
    for (const task of tasks) {
      const key = `${task.title}|${task.category}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(task);
    }
    
    return groups;
  }

  private analyzeTaskTiming(tasks: Task[]): {
    preferredHour: number;
    preferredDay: number;
    preferredDayOfMonth?: number;
    preferredMonth?: number;
    confidence: number;
  } {
    const hours: number[] = [];
    const days: number[] = [];
    const daysOfMonth: number[] = [];
    const months: number[] = [];
    
    for (const task of tasks) {
      const completedAt = new Date(task.completed_at!);
      hours.push(completedAt.getHours());
      days.push(completedAt.getDay());
      daysOfMonth.push(completedAt.getDate());
      months.push(completedAt.getMonth() + 1);
    }
    
    return {
      preferredHour: this.findMostCommon(hours),
      preferredDay: this.findMostCommon(days),
      preferredDayOfMonth: this.findMostCommon(daysOfMonth),
      preferredMonth: this.findMostCommon(months),
      confidence: this.calculateTimingConfidence(hours, days)
    };
  }

  private findMostCommon(numbers: number[]): number {
    const counts: Record<number, number> = {};
    
    for (const num of numbers) {
      counts[num] = (counts[num] || 0) + 1;
    }
    
    return Object.entries(counts)
      .reduce((a, b) => counts[parseInt(a[0])] > counts[parseInt(b[0])] ? a : b)[0]
      .toString()
      .split('')
      .map(Number)[0] || 0;
  }

  private calculateTimingConfidence(hours: number[], days: number[]): number {
    const hourVariance = this.calculateVariance(hours);
    const dayVariance = this.calculateVariance(days);
    
    // Lower variance = higher confidence
    const hourConfidence = Math.max(0, 1 - (hourVariance / 144)); // 12^2 max variance for hours
    const dayConfidence = Math.max(0, 1 - (dayVariance / 9)); // 3^2 max variance for days
    
    return (hourConfidence + dayConfidence) / 2;
  }

  private calculateVariance(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    
    const mean = numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
    const squaredDiffs = numbers.map(num => Math.pow(num - mean, 2));
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / numbers.length;
  }

  private determinePeriodType(tasks: Task[]): 'daily' | 'weekly' | 'monthly' {
    if (tasks.length < 2) return 'weekly';
    
    const intervals = [];
    for (let i = 1; i < tasks.length; i++) {
      const current = new Date(tasks[i].completed_at!);
      const previous = new Date(tasks[i - 1].completed_at!);
      const daysDiff = (previous.getTime() - current.getTime()) / (1000 * 60 * 60 * 24);
      intervals.push(daysDiff);
    }
    
    const averageInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    
    if (averageInterval <= 2) return 'daily';
    if (averageInterval <= 10) return 'weekly';
    return 'monthly';
  }

  private predictNextOccurrence(tasks: Task[], timeAnalysis: any): string {
    const lastTask = tasks[0];
    const lastDate = new Date(lastTask.completed_at!);
    const periodType = this.determinePeriodType(tasks);
    
    const nextDate = new Date(lastDate);
    
    switch (periodType) {
      case 'daily':
        nextDate.setDate(nextDate.getDate() + 1);
        break;
      case 'weekly':
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
    }
    
    nextDate.setHours(timeAnalysis.preferredHour, 0, 0, 0);
    return DatabaseUtils.formatDate(nextDate);
  }

  // Additional helper methods would continue here...
  private findTaskSequences(tasks: Task[]): any[] {
    // Implementation for finding task sequences
    return [];
  }

  private calculateSequenceConfidence(sequence: any): number {
    // Implementation for calculating sequence confidence
    return 0.5;
  }

  private groupTasksByContext(tasks: Task[]): Record<string, Task[]> {
    // Implementation for grouping tasks by context
    return {};
  }

  private parseContextKey(contextKey: string): any {
    // Implementation for parsing context key
    return {};
  }

  private calculateContextConfidence(contextTasks: Task[], totalTasks: number): number {
    // Implementation for calculating context confidence
    return contextTasks.length / totalTasks;
  }

  private getUniqueCategories(tasks: Task[]): string[] {
    return [...new Set(tasks.map(t => t.category))];
  }

  private calculateAverageCompletionTime(tasks: Task[]): number {
    // Implementation for calculating average completion time
    return 0;
  }

  private analyzeTaskFrequency(tasks: Task[]): any {
    // Implementation for analyzing task frequency
    return {
      averageInterval: 7,
      regularityScore: 0.8,
      confidence: 0.7,
      nextPredicted: DatabaseUtils.formatDate(new Date())
    };
  }

  private async updateTemporalPatterns(task: Task): Promise<void> {
    // Implementation for updating temporal patterns
  }

  private async updateSequentialPatterns(task: Task): Promise<void> {
    // Implementation for updating sequential patterns
  }

  private async updateContextualPatterns(task: Task): Promise<void> {
    // Implementation for updating contextual patterns
  }

  private async updateFrequencyPatterns(task: Task): Promise<void> {
    // Implementation for updating frequency patterns
  }

  private async cleanupPatterns(): Promise<void> {
    await PatternDatabaseUtils.cleanupLowConfidencePatterns(
      this.userId, 
      this.config.minPatternConfidence
    );
  }

  private getDayName(dayIndex: number): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayIndex] || 'Unknown';
  }

  private formatHour(hour: number): string {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:00 ${period}`;
  }
}