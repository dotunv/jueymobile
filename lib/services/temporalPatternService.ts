import { Task } from '../types';
import { TemporalPattern, PatternDatabaseUtils } from '../patternDatabase';
import { DatabaseUtils } from '../database';

/**
 * Temporal Pattern Detection Service
 * Analyzes task completion times to identify daily, weekly, and monthly patterns
 */

export interface TimeCluster {
  centerTime: number; // Hour of day (0-23)
  centerDay: number; // Day of week (0-6)
  tasks: Task[];
  frequency: number;
  confidence: number;
}

export interface TemporalAnalysis {
  dailyPatterns: TimeCluster[];
  weeklyPatterns: TimeCluster[];
  monthlyPatterns: TimeCluster[];
  overallConfidence: number;
}

export class TemporalPatternService {
  private readonly CONFIDENCE_THRESHOLD = 0.3;
  private readonly MIN_OCCURRENCES = 3;
  private readonly TIME_WINDOW_HOURS = 2; // Group tasks within 2-hour windows
  private readonly DAY_WINDOW = 1; // Group tasks within 1-day windows

  /**
   * Analyze temporal patterns for a user's tasks
   */
  async analyzeTemporalPatterns(userId: string, tasks: Task[]): Promise<TemporalAnalysis> {
    const completedTasks = tasks.filter(task => task.completed && task.completed_at);
    
    if (completedTasks.length < this.MIN_OCCURRENCES) {
      return {
        dailyPatterns: [],
        weeklyPatterns: [],
        monthlyPatterns: [],
        overallConfidence: 0
      };
    }

    // Group tasks by category for better pattern detection
    const tasksByCategory = this.groupTasksByCategory(completedTasks);
    
    const dailyPatterns: TimeCluster[] = [];
    const weeklyPatterns: TimeCluster[] = [];
    const monthlyPatterns: TimeCluster[] = [];

    // Analyze patterns for each category
    for (const [category, categoryTasks] of Object.entries(tasksByCategory)) {
      const categoryDailyPatterns = await this.detectDailyPatterns(categoryTasks, category);
      const categoryWeeklyPatterns = await this.detectWeeklyPatterns(categoryTasks, category);
      const categoryMonthlyPatterns = await this.detectMonthlyPatterns(categoryTasks, category);

      dailyPatterns.push(...categoryDailyPatterns);
      weeklyPatterns.push(...categoryWeeklyPatterns);
      monthlyPatterns.push(...categoryMonthlyPatterns);

      // Store patterns in database
      await this.storeTemporalPatterns(userId, category, categoryDailyPatterns, 'daily');
      await this.storeTemporalPatterns(userId, category, categoryWeeklyPatterns, 'weekly');
      await this.storeTemporalPatterns(userId, category, categoryMonthlyPatterns, 'monthly');
    }

    const overallConfidence = this.calculateOverallConfidence([
      ...dailyPatterns,
      ...weeklyPatterns,
      ...monthlyPatterns
    ]);

    return {
      dailyPatterns,
      weeklyPatterns,
      monthlyPatterns,
      overallConfidence
    };
  }

  /**
   * Detect daily patterns (same time each day)
   */
  private async detectDailyPatterns(tasks: Task[], category: string): Promise<TimeCluster[]> {
    const timeGroups = new Map<number, Task[]>();

    // Group tasks by hour of day
    for (const task of tasks) {
      if (!task.completed_at) continue;
      
      const completedDate = new Date(task.completed_at);
      const hour = completedDate.getHours();
      const timeKey = Math.floor(hour / this.TIME_WINDOW_HOURS) * this.TIME_WINDOW_HOURS;
      
      if (!timeGroups.has(timeKey)) {
        timeGroups.set(timeKey, []);
      }
      timeGroups.get(timeKey)!.push(task);
    }

    const patterns: TimeCluster[] = [];

    for (const [timeKey, groupTasks] of timeGroups.entries()) {
      if (groupTasks.length >= this.MIN_OCCURRENCES) {
        const confidence = this.calculateTimeBasedConfidence(groupTasks, 'daily');
        
        if (confidence >= this.CONFIDENCE_THRESHOLD) {
          patterns.push({
            centerTime: timeKey,
            centerDay: -1, // Not applicable for daily patterns
            tasks: groupTasks,
            frequency: groupTasks.length,
            confidence
          });
        }
      }
    }

    return patterns.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Detect weekly patterns (same day and time each week)
   */
  private async detectWeeklyPatterns(tasks: Task[], category: string): Promise<TimeCluster[]> {
    const timeGroups = new Map<string, Task[]>();

    // Group tasks by day of week and hour
    for (const task of tasks) {
      if (!task.completed_at) continue;
      
      const completedDate = new Date(task.completed_at);
      const dayOfWeek = completedDate.getDay();
      const hour = completedDate.getHours();
      const timeKey = Math.floor(hour / this.TIME_WINDOW_HOURS) * this.TIME_WINDOW_HOURS;
      const groupKey = `${dayOfWeek}-${timeKey}`;
      
      if (!timeGroups.has(groupKey)) {
        timeGroups.set(groupKey, []);
      }
      timeGroups.get(groupKey)!.push(task);
    }

    const patterns: TimeCluster[] = [];

    for (const [groupKey, groupTasks] of timeGroups.entries()) {
      if (groupTasks.length >= this.MIN_OCCURRENCES) {
        const [dayOfWeek, timeKey] = groupKey.split('-').map(Number);
        const confidence = this.calculateTimeBasedConfidence(groupTasks, 'weekly');
        
        if (confidence >= this.CONFIDENCE_THRESHOLD) {
          patterns.push({
            centerTime: timeKey,
            centerDay: dayOfWeek,
            tasks: groupTasks,
            frequency: groupTasks.length,
            confidence
          });
        }
      }
    }

    return patterns.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Detect monthly patterns (same day of month and time)
   */
  private async detectMonthlyPatterns(tasks: Task[], category: string): Promise<TimeCluster[]> {
    const timeGroups = new Map<string, Task[]>();

    // Group tasks by day of month and hour
    for (const task of tasks) {
      if (!task.completed_at) continue;
      
      const completedDate = new Date(task.completed_at);
      const dayOfMonth = completedDate.getDate();
      const hour = completedDate.getHours();
      const timeKey = Math.floor(hour / this.TIME_WINDOW_HOURS) * this.TIME_WINDOW_HOURS;
      
      // Group similar days of month (e.g., 1-3, 4-6, etc.)
      const dayGroup = Math.floor((dayOfMonth - 1) / 3) * 3 + 1;
      const groupKey = `${dayGroup}-${timeKey}`;
      
      if (!timeGroups.has(groupKey)) {
        timeGroups.set(groupKey, []);
      }
      timeGroups.get(groupKey)!.push(task);
    }

    const patterns: TimeCluster[] = [];

    for (const [groupKey, groupTasks] of timeGroups.entries()) {
      if (groupTasks.length >= this.MIN_OCCURRENCES) {
        const [dayGroup, timeKey] = groupKey.split('-').map(Number);
        const confidence = this.calculateTimeBasedConfidence(groupTasks, 'monthly');
        
        if (confidence >= this.CONFIDENCE_THRESHOLD) {
          patterns.push({
            centerTime: timeKey,
            centerDay: dayGroup,
            tasks: groupTasks,
            frequency: groupTasks.length,
            confidence
          });
        }
      }
    }

    return patterns.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Calculate confidence based on temporal consistency
   */
  private calculateTimeBasedConfidence(tasks: Task[], patternType: 'daily' | 'weekly' | 'monthly'): number {
    if (tasks.length < this.MIN_OCCURRENCES) return 0;

    const completionTimes = tasks
      .filter(task => task.completed_at)
      .map(task => new Date(task.completed_at!));

    if (completionTimes.length === 0) return 0;

    // Calculate time variance
    const timeVariance = this.calculateTimeVariance(completionTimes, patternType);
    
    // Calculate frequency score
    const frequencyScore = Math.min(tasks.length / 10, 1); // Max score at 10 occurrences
    
    // Calculate recency score (more recent patterns get higher scores)
    const recencyScore = this.calculateRecencyScore(completionTimes);
    
    // Combine scores with weights
    const confidence = (
      (1 - timeVariance) * 0.5 +  // 50% weight on consistency
      frequencyScore * 0.3 +      // 30% weight on frequency
      recencyScore * 0.2          // 20% weight on recency
    );

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Calculate time variance for pattern consistency
   */
  private calculateTimeVariance(dates: Date[], patternType: 'daily' | 'weekly' | 'monthly'): number {
    if (dates.length < 2) return 0;

    let values: number[] = [];

    switch (patternType) {
      case 'daily':
        values = dates.map(date => date.getHours() + date.getMinutes() / 60);
        break;
      case 'weekly':
        values = dates.map(date => date.getDay() * 24 + date.getHours() + date.getMinutes() / 60);
        break;
      case 'monthly':
        values = dates.map(date => date.getDate() * 24 + date.getHours() + date.getMinutes() / 60);
        break;
    }

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    
    // Normalize variance to 0-1 scale
    const maxVariance = patternType === 'daily' ? 144 : // 12 hours squared
                       patternType === 'weekly' ? 2304 : // 48 hours squared
                       9216; // 96 hours squared for monthly
    
    return Math.min(variance / maxVariance, 1);
  }

  /**
   * Calculate recency score (more recent patterns are more relevant)
   */
  private calculateRecencyScore(dates: Date[]): number {
    if (dates.length === 0) return 0;

    const now = new Date();
    const mostRecent = new Date(Math.max(...dates.map(d => d.getTime())));
    const daysSinceRecent = (now.getTime() - mostRecent.getTime()) / (1000 * 60 * 60 * 24);
    
    // Score decreases exponentially with time
    return Math.exp(-daysSinceRecent / 30); // Half-life of 30 days
  }

  /**
   * Group tasks by category
   */
  private groupTasksByCategory(tasks: Task[]): Record<string, Task[]> {
    const groups: Record<string, Task[]> = {};
    
    for (const task of tasks) {
      const category = task.category || 'Uncategorized';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(task);
    }
    
    return groups;
  }

  /**
   * Calculate overall confidence across all patterns
   */
  private calculateOverallConfidence(patterns: TimeCluster[]): number {
    if (patterns.length === 0) return 0;
    
    const weightedSum = patterns.reduce((sum, pattern) => 
      sum + pattern.confidence * pattern.frequency, 0);
    const totalFrequency = patterns.reduce((sum, pattern) => 
      sum + pattern.frequency, 0);
    
    return totalFrequency > 0 ? weightedSum / totalFrequency : 0;
  }

  /**
   * Store temporal patterns in database
   */
  private async storeTemporalPatterns(
    userId: string, 
    category: string, 
    patterns: TimeCluster[], 
    periodType: 'daily' | 'weekly' | 'monthly'
  ): Promise<void> {
    for (const pattern of patterns) {
      if (pattern.tasks.length === 0) continue;

      const representativeTask = pattern.tasks[0];
      const lastOccurrence = pattern.tasks
        .map(t => new Date(t.completed_at!))
        .sort((a, b) => b.getTime() - a.getTime())[0];

      // Predict next occurrence
      const nextPredicted = this.predictNextOccurrence(lastOccurrence, periodType);

      const temporalPattern: Omit<TemporalPattern, 'created_at' | 'updated_at'> = {
        id: DatabaseUtils.generateId(),
        user_id: userId,
        task_title: representativeTask.title,
        task_category: category,
        time_of_day: pattern.centerTime,
        day_of_week: pattern.centerDay >= 0 ? pattern.centerDay : 0,
        day_of_month: periodType === 'monthly' ? pattern.centerDay : undefined,
        month: undefined, // Could be extended for yearly patterns
        frequency: pattern.frequency,
        period_type: periodType,
        confidence: pattern.confidence,
        last_occurrence: DatabaseUtils.formatDate(lastOccurrence),
        next_predicted: DatabaseUtils.formatDate(nextPredicted)
      };

      await PatternDatabaseUtils.upsertTemporalPattern(temporalPattern);
    }
  }

  /**
   * Predict next occurrence based on pattern type
   */
  private predictNextOccurrence(lastOccurrence: Date, periodType: 'daily' | 'weekly' | 'monthly'): Date {
    const next = new Date(lastOccurrence);
    
    switch (periodType) {
      case 'daily':
        next.setDate(next.getDate() + 1);
        break;
      case 'weekly':
        next.setDate(next.getDate() + 7);
        break;
      case 'monthly':
        next.setMonth(next.getMonth() + 1);
        break;
    }
    
    return next;
  }

  /**
   * Get temporal patterns for visualization and debugging
   */
  async getTemporalPatternsForVisualization(userId: string): Promise<{
    hourlyDistribution: Record<number, number>;
    dailyDistribution: Record<number, number>;
    categoryTimeDistribution: Record<string, Record<number, number>>;
  }> {
    const patterns = await PatternDatabaseUtils.getTemporalPatterns(userId);
    
    const hourlyDistribution: Record<number, number> = {};
    const dailyDistribution: Record<number, number> = {};
    const categoryTimeDistribution: Record<string, Record<number, number>> = {};

    // Initialize distributions
    for (let i = 0; i < 24; i++) {
      hourlyDistribution[i] = 0;
    }
    for (let i = 0; i < 7; i++) {
      dailyDistribution[i] = 0;
    }

    // Populate distributions from patterns
    for (const pattern of patterns) {
      hourlyDistribution[pattern.time_of_day] += pattern.frequency * pattern.confidence;
      dailyDistribution[pattern.day_of_week] += pattern.frequency * pattern.confidence;
      
      if (!categoryTimeDistribution[pattern.task_category]) {
        categoryTimeDistribution[pattern.task_category] = {};
        for (let i = 0; i < 24; i++) {
          categoryTimeDistribution[pattern.task_category][i] = 0;
        }
      }
      categoryTimeDistribution[pattern.task_category][pattern.time_of_day] += 
        pattern.frequency * pattern.confidence;
    }

    return {
      hourlyDistribution,
      dailyDistribution,
      categoryTimeDistribution
    };
  }
}

// Export singleton instance
export const temporalPatternService = new TemporalPatternService();