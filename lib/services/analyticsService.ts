import { Task, TaskAnalytics, CategoryAnalytics, TimeAnalytics } from '../types';

export interface AnalyticsPeriod {
  startDate: Date;
  endDate: Date;
  label: string;
}

export interface ProductivityInsights {
  mostProductiveDay: string;
  mostProductiveTime: string;
  averageTasksPerDay: number;
  completionRate: number;
  streakDays: number;
  improvementTrend: 'up' | 'down' | 'stable';
}

export interface CategoryInsights {
  mostActiveCategory: string;
  mostCompletedCategory: string;
  leastActiveCategory: string;
  categoryBalance: number; // 0-100, higher is more balanced
}

export interface PriorityInsights {
  priorityDistribution: {
    high: number;
    medium: number;
    low: number;
  };
  completionByPriority: {
    high: number;
    medium: number;
    low: number;
  };
  overdueTasks: number;
}

export interface TimeInsights {
  averageCompletionTime: number; // in minutes
  fastestCategory: string;
  slowestCategory: string;
  timeOfDayPreference: string;
}

export interface AnalyticsData {
  period: AnalyticsPeriod;
  overview: TaskAnalytics;
  categories: CategoryAnalytics[];
  timeData: TimeAnalytics[];
  insights: {
    productivity: ProductivityInsights;
    categories: CategoryInsights;
    priorities: PriorityInsights;
    time: TimeInsights;
  };
}

export interface AdvancedProductivityMetrics {
  taskVelocity: number; // tasks completed per day
  focusScore: number; // 0-100, based on completion patterns
  efficiencyTrend: 'improving' | 'declining' | 'stable';
  burnoutRisk: 'low' | 'medium' | 'high';
  peakProductivityHours: string[];
  optimalTaskLoad: number; // recommended daily task count
}

export interface PredictiveInsights {
  estimatedCompletionTime: number; // minutes
  completionProbability: number; // 0-100
  optimalSchedulingTime: string; // time of day
  recommendedTaskOrder: string[]; // task IDs in optimal order
  expectedProductivity: number; // 0-100
}

export interface TaskPrediction {
  taskId: string;
  estimatedTime: number; // minutes
  completionProbability: number; // 0-100
  optimalTime: string; // time of day
  confidence: number; // 0-100
}

export interface ProductivityRecommendation {
  id: string;
  type: 'workload' | 'focus' | 'time' | 'priority' | 'schedule';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  impact: number; // 0-100, expected improvement
  actionable: boolean;
  actionText?: string;
  actionUrl?: string;
}

export interface PersonalizedInsights {
  recommendations: ProductivityRecommendation[];
  topInsights: string[];
  improvementAreas: string[];
  strengths: string[];
}

export interface PriorityContext {
  now?: Date;
  location?: string;
  focusMode?: boolean;
  deviceState?: string;
  customTags?: string[];
}

export class AnalyticsService {
  /**
   * Get analytics for a specific period
   */
  static async getAnalytics(
    tasks: Task[], 
    period: 'week' | 'month' | 'year' = 'week'
  ): Promise<AnalyticsData> {
    const periodData = this.getPeriodData(period);
    const filteredTasks = this.filterTasksByPeriod(tasks, periodData);
    
    const overview = this.calculateOverview(filteredTasks);
    const categories = this.calculateCategoryAnalytics(filteredTasks);
    const timeData = this.calculateTimeAnalytics(filteredTasks, periodData);
    const insights = this.generateInsights(filteredTasks, periodData);

    return {
      period: periodData,
      overview,
      categories,
      timeData,
      insights,
    };
  }

  /**
   * Get period data for analytics
   */
  private static getPeriodData(period: 'week' | 'month' | 'year'): AnalyticsPeriod {
    const now = new Date();
    let startDate: Date;
    let label: string;

    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        label = 'Last 7 days';
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        label = 'Last 30 days';
        break;
      case 'year':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        label = 'Last 12 months';
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        label = 'Last 7 days';
    }

    return {
      startDate,
      endDate: now,
      label,
    };
  }

  /**
   * Filter tasks by period
   */
  private static filterTasksByPeriod(tasks: Task[], period: AnalyticsPeriod): Task[] {
    return tasks.filter(task => {
      const taskDate = new Date(task.created_at);
      return taskDate >= period.startDate && taskDate <= period.endDate;
    });
  }

  /**
   * Calculate overview analytics
   */
  private static calculateOverview(tasks: Task[]): TaskAnalytics {
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(task => task.completed).length;
    const pendingTasks = totalTasks - completedTasks;
    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    // Calculate average tasks per day
    const daysInPeriod = Math.max(1, Math.ceil((new Date().getTime() - new Date(tasks[0]?.created_at || Date.now()).getTime()) / (1000 * 60 * 60 * 24)));
    const averageTasksPerDay = totalTasks / daysInPeriod;

    // Find most productive day
    const dayStats: Record<string, number> = {};
    tasks.forEach(task => {
      const day = new Date(task.created_at).toLocaleDateString('en-US', { weekday: 'long' });
      dayStats[day] = (dayStats[day] || 0) + 1;
    });
    const mostProductiveDay = Object.entries(dayStats)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || 'Monday';

    // Find most common category
    const categoryStats: Record<string, number> = {};
    tasks.forEach(task => {
      categoryStats[task.category] = (categoryStats[task.category] || 0) + 1;
    });
    const mostCommonCategory = Object.entries(categoryStats)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || 'Personal';

    // Calculate average completion time (simplified)
    const completedTasksWithTime = tasks.filter(task => task.completed && task.completed_at);
    const averageCompletionTime = completedTasksWithTime.length > 0 ? 45 : 0; // Default 45 minutes

    return {
      totalTasks,
      completedTasks,
      pendingTasks,
      completionRate: Math.round(completionRate),
      averageTasksPerDay: Math.round(averageTasksPerDay * 10) / 10,
      mostProductiveDay,
      mostCommonCategory,
      averageCompletionTime,
    };
  }

  /**
   * Calculate category analytics
   */
  private static calculateCategoryAnalytics(tasks: Task[]): CategoryAnalytics[] {
    const categoryStats: Record<string, { total: number; completed: number; priorities: number[] }> = {};

    // Group tasks by category
    tasks.forEach(task => {
      if (!categoryStats[task.category]) {
        categoryStats[task.category] = { total: 0, completed: 0, priorities: [] };
      }
      categoryStats[task.category].total++;
      if (task.completed) {
        categoryStats[task.category].completed++;
      }
      categoryStats[task.category].priorities.push(this.priorityToNumber(task.priority));
    });

    // Convert to CategoryAnalytics format
    return Object.entries(categoryStats).map(([category, stats]) => ({
      category,
      totalTasks: stats.total,
      completedTasks: stats.completed,
      completionRate: Math.round((stats.completed / stats.total) * 100),
      averagePriority: Math.round(stats.priorities.reduce((a, b) => a + b, 0) / stats.priorities.length * 10) / 10,
    }));
  }

  /**
   * Calculate time analytics
   */
  private static calculateTimeAnalytics(tasks: Task[], period: AnalyticsPeriod): TimeAnalytics[] {
    const timeStats: Record<string, { tasks: number; completed: number }> = {};

    // Group tasks by date
    tasks.forEach(task => {
      const date = new Date(task.created_at).toLocaleDateString();
      if (!timeStats[date]) {
        timeStats[date] = { tasks: 0, completed: 0 };
      }
      timeStats[date].tasks++;
      if (task.completed) {
        timeStats[date].completed++;
      }
    });

    // Convert to TimeAnalytics format
    return Object.entries(timeStats).map(([date, stats]) => ({
      date,
      tasks: stats.tasks,
      completed: stats.completed,
      completionRate: Math.round((stats.completed / stats.tasks) * 100),
    }));
  }

  /**
   * Generate insights from analytics data
   */
  private static generateInsights(tasks: Task[], period: AnalyticsPeriod) {
    return {
      productivity: this.generateProductivityInsights(tasks),
      categories: this.generateCategoryInsights(tasks),
      priorities: this.generatePriorityInsights(tasks),
      time: this.generateTimeInsights(tasks),
    };
  }

  /**
   * Generate productivity insights
   */
  private static generateProductivityInsights(tasks: Task[]): ProductivityInsights {
    // Most productive day
    const dayStats: Record<string, number> = {};
    tasks.forEach(task => {
      const day = new Date(task.created_at).toLocaleDateString('en-US', { weekday: 'long' });
      dayStats[day] = (dayStats[day] || 0) + 1;
    });
    const mostProductiveDay = Object.entries(dayStats)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || 'Monday';

    // Most productive time
    const timeStats: Record<string, number> = {};
    tasks.forEach(task => {
      const hour = new Date(task.created_at).getHours();
      const timeSlot = this.getTimeSlot(hour);
      timeStats[timeSlot] = (timeStats[timeSlot] || 0) + 1;
    });
    const mostProductiveTime = Object.entries(timeStats)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || 'Morning';

    // Average tasks per day
    const daysInPeriod = Math.max(1, Math.ceil((new Date().getTime() - new Date(tasks[0]?.created_at || Date.now()).getTime()) / (1000 * 60 * 60 * 24)));
    const averageTasksPerDay = tasks.length / daysInPeriod;

    // Completion rate
    const completionRate = tasks.length > 0 ? (tasks.filter(t => t.completed).length / tasks.length) * 100 : 0;

    // Streak days (simplified)
    const streakDays = Math.min(7, Math.floor(completionRate / 10));

    // Improvement trend (simplified)
    const improvementTrend: 'up' | 'down' | 'stable' = completionRate > 70 ? 'up' : completionRate < 50 ? 'down' : 'stable';

    return {
      mostProductiveDay,
      mostProductiveTime,
      averageTasksPerDay: Math.round(averageTasksPerDay * 10) / 10,
      completionRate: Math.round(completionRate),
      streakDays,
      improvementTrend,
    };
  }

  /**
   * Generate category insights
   */
  private static generateCategoryInsights(tasks: Task[]): CategoryInsights {
    const categoryStats: Record<string, { total: number; completed: number }> = {};

    tasks.forEach(task => {
      if (!categoryStats[task.category]) {
        categoryStats[task.category] = { total: 0, completed: 0 };
      }
      categoryStats[task.category].total++;
      if (task.completed) {
        categoryStats[task.category].completed++;
      }
    });

    const mostActiveCategory = Object.entries(categoryStats)
      .sort(([, a], [, b]) => b.total - a.total)[0]?.[0] || 'Personal';

    const mostCompletedCategory = Object.entries(categoryStats)
      .sort(([, a], [, b]) => (b.completed / b.total) - (a.completed / a.total))[0]?.[0] || 'Personal';

    const leastActiveCategory = Object.entries(categoryStats)
      .sort(([, a], [, b]) => a.total - b.total)[0]?.[0] || 'Learning';

    // Calculate category balance (0-100, higher is more balanced)
    const categories = Object.keys(categoryStats);
    const totalTasks = tasks.length;
    const idealPerCategory = totalTasks / categories.length;
    const variance = categories.reduce((acc, category) => {
      const actual = categoryStats[category].total;
      return acc + Math.pow(actual - idealPerCategory, 2);
    }, 0) / categories.length;
    const categoryBalance = Math.max(0, 100 - (variance / totalTasks * 100));

    return {
      mostActiveCategory,
      mostCompletedCategory,
      leastActiveCategory,
      categoryBalance: Math.round(categoryBalance),
    };
  }

  /**
   * Generate priority insights
   */
  private static generatePriorityInsights(tasks: Task[]): PriorityInsights {
    const priorityStats: Record<string, { total: number; completed: number }> = {
      high: { total: 0, completed: 0 },
      medium: { total: 0, completed: 0 },
      low: { total: 0, completed: 0 },
    };

    tasks.forEach(task => {
      priorityStats[task.priority].total++;
      if (task.completed) {
        priorityStats[task.priority].completed++;
      }
    });

    const overdueTasks = tasks.filter(task => 
      !task.completed && task.due_date && new Date(task.due_date) < new Date()
    ).length;

    return {
      priorityDistribution: {
        high: priorityStats.high.total,
        medium: priorityStats.medium.total,
        low: priorityStats.low.total,
      },
      completionByPriority: {
        high: priorityStats.high.completed,
        medium: priorityStats.medium.completed,
        low: priorityStats.low.completed,
      },
      overdueTasks,
    };
  }

  /**
   * Generate time insights
   */
  private static generateTimeInsights(tasks: Task[]): TimeInsights {
    // Average completion time (simplified)
    const completedTasks = tasks.filter(task => task.completed);
    const averageCompletionTime = completedTasks.length > 0 ? 45 : 0; // Default 45 minutes

    // Fastest and slowest categories
    const categoryTimes: Record<string, number[]> = {};
    completedTasks.forEach(task => {
      if (!categoryTimes[task.category]) {
        categoryTimes[task.category] = [];
      }
      categoryTimes[task.category].push(45); // Default time
    });

    const fastestCategory = Object.entries(categoryTimes)
      .sort(([, a], [, b]) => (a.reduce((x, y) => x + y, 0) / a.length) - (b.reduce((x, y) => x + y, 0) / b.length))[0]?.[0] || 'Personal';

    const slowestCategory = Object.entries(categoryTimes)
      .sort(([, a], [, b]) => (b.reduce((x, y) => x + y, 0) / b.length) - (a.reduce((x, y) => x + y, 0) / a.length))[0]?.[0] || 'Work';

    // Time of day preference
    const timeStats: Record<string, number> = {};
    tasks.forEach(task => {
      const hour = new Date(task.created_at).getHours();
      const timeSlot = this.getTimeSlot(hour);
      timeStats[timeSlot] = (timeStats[timeSlot] || 0) + 1;
    });
    const timeOfDayPreference = Object.entries(timeStats)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || 'Morning';

    return {
      averageCompletionTime,
      fastestCategory,
      slowestCategory,
      timeOfDayPreference,
    };
  }

  /**
   * Get advanced productivity analytics
   */
  static getAdvancedProductivityMetrics(tasks: Task[]): AdvancedProductivityMetrics {
    const taskVelocity = this.calculateTaskVelocity(tasks);
    const focusScore = this.calculateFocusScore(tasks);
    const efficiencyTrend = this.calculateEfficiencyTrend(tasks);
    const burnoutRisk = this.calculateBurnoutRisk(tasks);
    const peakProductivityHours = this.calculatePeakProductivityHours(tasks);
    const optimalTaskLoad = this.calculateOptimalTaskLoad(tasks);

    return {
      taskVelocity,
      focusScore,
      efficiencyTrend,
      burnoutRisk,
      peakProductivityHours,
      optimalTaskLoad,
    };
  }

  /**
   * Get predictive insights for a specific task
   */
  static getTaskPrediction(task: Task, allTasks: Task[]): TaskPrediction {
    const estimatedTime = this.predictTaskCompletionTime(task, allTasks);
    const completionProbability = this.predictCompletionProbability(task, allTasks);
    const optimalTime = this.predictOptimalScheduling(task, allTasks);
    const confidence = this.calculatePredictionConfidence(task, allTasks);

    return {
      taskId: task.id,
      estimatedTime,
      completionProbability,
      optimalTime,
      confidence,
    };
  }

  /**
   * Get overall predictive insights
   */
  static getPredictiveInsights(tasks: Task[]): PredictiveInsights {
    const pendingTasks = tasks.filter(t => !t.completed);
    const predictions = pendingTasks.map(task => this.getTaskPrediction(task, tasks));

    const totalEstimatedTime = predictions.reduce((sum, p) => sum + p.estimatedTime, 0);
    const avgCompletionProbability = predictions.reduce((sum, p) => sum + p.completionProbability, 0) / predictions.length;
    const recommendedOrder = this.getRecommendedTaskOrder(pendingTasks, tasks);
    const expectedProductivity = this.calculateExpectedProductivity(tasks);

    // Find most common optimal time
    const timeStats: Record<string, number> = {};
    predictions.forEach(p => {
      timeStats[p.optimalTime] = (timeStats[p.optimalTime] || 0) + 1;
    });
    const optimalSchedulingTime = Object.entries(timeStats)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || '9 AM';

    return {
      estimatedCompletionTime: Math.round(totalEstimatedTime),
      completionProbability: Math.round(avgCompletionProbability),
      optimalSchedulingTime,
      recommendedTaskOrder: recommendedOrder,
      expectedProductivity: Math.round(expectedProductivity),
    };
  }

  /**
   * Predict task completion time based on historical patterns
   */
  private static predictTaskCompletionTime(task: Task, allTasks: Task[]): number {
    const similarTasks = this.findSimilarTasks(task, allTasks);
    if (similarTasks.length === 0) return 45; // Default 45 minutes

    // Calculate average completion time for similar tasks
    const completionTimes: number[] = [];
    similarTasks.forEach(similarTask => {
      if (similarTask.completed && similarTask.completed_at) {
        const created = new Date(similarTask.created_at);
        const completed = new Date(similarTask.completed_at);
        const hoursToComplete = (completed.getTime() - created.getTime()) / (1000 * 60 * 60);
        completionTimes.push(hoursToComplete * 60); // Convert to minutes
      }
    });

    if (completionTimes.length === 0) return 45;

    const avgTime = completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length;
    
    // Adjust based on priority and category
    let adjustedTime = avgTime;
    if (task.priority === 'high') adjustedTime *= 0.8; // High priority tasks often completed faster
    if (task.priority === 'low') adjustedTime *= 1.2; // Low priority tasks take longer

    return Math.round(adjustedTime);
  }

  /**
   * Predict completion probability
   */
  private static predictCompletionProbability(task: Task, allTasks: Task[]): number {
    const similarTasks = this.findSimilarTasks(task, allTasks);
    if (similarTasks.length === 0) return 70; // Default 70%

    const completedSimilar = similarTasks.filter(t => t.completed).length;
    const completionRate = (completedSimilar / similarTasks.length) * 100;

    // Adjust based on current workload and due date
    let adjustedProbability = completionRate;
    
    const overdueTasks = allTasks.filter(t => 
      !t.completed && t.due_date && new Date(t.due_date) < new Date()
    ).length;
    if (overdueTasks > 2) adjustedProbability *= 0.9; // High backlog reduces probability

    if (task.due_date) {
      const daysUntilDue = (new Date(task.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      if (daysUntilDue < 1) adjustedProbability *= 0.8; // Due soon
      if (daysUntilDue > 7) adjustedProbability *= 1.1; // Plenty of time
    }

    return Math.round(Math.max(0, Math.min(100, adjustedProbability)));
  }

  /**
   * Predict optimal scheduling time
   */
  private static predictOptimalScheduling(task: Task, allTasks: Task[]): string {
    const similarTasks = this.findSimilarTasks(task, allTasks);
    if (similarTasks.length === 0) return '9 AM'; // Default

    // Find when similar tasks are most often completed
    const hourStats: Record<number, number> = {};
    similarTasks.forEach(similarTask => {
      if (similarTask.completed) {
        const hour = new Date(similarTask.completed_at || similarTask.created_at).getHours();
        hourStats[hour] = (hourStats[hour] || 0) + 1;
      }
    });

    if (Object.keys(hourStats).length === 0) return '9 AM';

    const optimalHour = Object.entries(hourStats)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || '9';

    const hourNum = parseInt(optimalHour);
    if (hourNum < 12) return `${hourNum} AM`;
    if (hourNum === 12) return '12 PM';
    return `${hourNum - 12} PM`;
  }

  /**
   * Find similar tasks for prediction
   */
  private static findSimilarTasks(task: Task, allTasks: Task[]): Task[] {
    return allTasks.filter(t => 
      t.id !== task.id && // Not the same task
      t.category === task.category && // Same category
      t.priority === task.priority // Same priority
    );
  }

  /**
   * Calculate prediction confidence
   */
  private static calculatePredictionConfidence(task: Task, allTasks: Task[]): number {
    const similarTasks = this.findSimilarTasks(task, allTasks);
    if (similarTasks.length === 0) return 30; // Low confidence with no similar tasks

    // More similar tasks = higher confidence
    const baseConfidence = Math.min(90, similarTasks.length * 10);
    
    // Adjust based on task complexity (title length as proxy)
    const complexityFactor = Math.min(1, task.title.length / 50);
    const adjustedConfidence = baseConfidence * (1 - complexityFactor * 0.3);

    return Math.round(adjustedConfidence);
  }

  /**
   * Get recommended task order
   */
  private static getRecommendedTaskOrder(pendingTasks: Task[], allTasks: Task[]): string[] {
    const taskScores = pendingTasks.map(task => {
      const prediction = this.getTaskPrediction(task, allTasks);
      const priorityScore = task.priority === 'high' ? 3 : task.priority === 'medium' ? 2 : 1;
      const dueDateScore = task.due_date ? 
        Math.max(0, 10 - Math.floor((new Date(task.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0;
      
      const totalScore = (prediction.completionProbability * 0.4) + (priorityScore * 20) + dueDateScore;
      return { taskId: task.id, score: totalScore };
    });

    return taskScores
      .sort((a, b) => b.score - a.score)
      .map(t => t.taskId);
  }

  /**
   * Calculate expected productivity
   */
  private static calculateExpectedProductivity(tasks: Task[]): number {
    const pendingTasks = tasks.filter(t => !t.completed);
    if (pendingTasks.length === 0) return 100;

    const predictions = pendingTasks.map(task => this.getTaskPrediction(task, tasks));
    const avgCompletionProbability = predictions.reduce((sum, p) => sum + p.completionProbability, 0) / predictions.length;
    
    // Factor in current productivity trends
    const currentProductivity = this.calculateProductivityScore(tasks);
    const trendFactor = this.calculateEfficiencyTrend(tasks) === 'improving' ? 1.1 : 
                       this.calculateEfficiencyTrend(tasks) === 'declining' ? 0.9 : 1.0;

    const expectedProductivity = (avgCompletionProbability * 0.7) + (currentProductivity * 0.3) * trendFactor;
    return Math.round(Math.max(0, Math.min(100, expectedProductivity)));
  }

  /**
   * Calculate task velocity (tasks completed per day)
   */
  private static calculateTaskVelocity(tasks: Task[]): number {
    const completedTasks = tasks.filter(t => t.completed);
    if (completedTasks.length === 0) return 0;

    const firstTask = new Date(Math.min(...completedTasks.map(t => new Date(t.created_at).getTime())));
    const lastTask = new Date(Math.max(...completedTasks.map(t => new Date(t.completed_at || t.created_at).getTime())));
    const daysDiff = Math.max(1, (lastTask.getTime() - firstTask.getTime()) / (1000 * 60 * 60 * 24));

    return Math.round((completedTasks.length / daysDiff) * 10) / 10;
  }

  /**
   * Calculate focus score based on completion patterns
   */
  private static calculateFocusScore(tasks: Task[]): number {
    const completedTasks = tasks.filter(t => t.completed);
    if (completedTasks.length === 0) return 0;

    // Analyze completion patterns
    const completionTimes: number[] = [];
    completedTasks.forEach(task => {
      if (task.completed_at) {
        const created = new Date(task.created_at);
        const completed = new Date(task.completed_at);
        const hoursToComplete = (completed.getTime() - created.getTime()) / (1000 * 60 * 60);
        completionTimes.push(hoursToComplete);
      }
    });

    if (completionTimes.length === 0) return 50; // Default score

    // Calculate focus score based on:
    // 1. Consistency in completion times (lower variance = higher focus)
    // 2. Completion rate
    // 3. Priority adherence (high priority tasks completed first)

    const avgCompletionTime = completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length;
    const variance = completionTimes.reduce((acc, time) => acc + Math.pow(time - avgCompletionTime, 2), 0) / completionTimes.length;
    const consistencyScore = Math.max(0, 100 - (variance * 2)); // Lower variance = higher score

    const completionRate = (completedTasks.length / tasks.length) * 100;
    const priorityAdherence = this.calculatePriorityAdherence(tasks);

    const focusScore = (consistencyScore * 0.4) + (completionRate * 0.4) + (priorityAdherence * 0.2);
    return Math.round(Math.max(0, Math.min(100, focusScore)));
  }

  /**
   * Calculate efficiency trend
   */
  private static calculateEfficiencyTrend(tasks: Task[]): 'improving' | 'declining' | 'stable' {
    const completedTasks = tasks.filter(t => t.completed);
    if (completedTasks.length < 4) return 'stable';

    // Split tasks into two time periods and compare completion rates
    const sortedTasks = completedTasks.sort((a, b) => 
      new Date(a.completed_at || a.created_at).getTime() - new Date(b.completed_at || b.created_at).getTime()
    );

    const midPoint = Math.floor(sortedTasks.length / 2);
    const recentTasks = sortedTasks.slice(midPoint);
    const olderTasks = sortedTasks.slice(0, midPoint);

    const recentRate = recentTasks.length / tasks.filter(t => 
      new Date(t.created_at) >= new Date(recentTasks[0]?.created_at || Date.now())
    ).length;
    const olderRate = olderTasks.length / tasks.filter(t => 
      new Date(t.created_at) < new Date(recentTasks[0]?.created_at || Date.now())
    ).length;

    const improvement = recentRate - olderRate;
    if (improvement > 0.1) return 'improving';
    if (improvement < -0.1) return 'declining';
    return 'stable';
  }

  /**
   * Calculate burnout risk
   */
  private static calculateBurnoutRisk(tasks: Task[]): 'low' | 'medium' | 'high' {
    const recentTasks = tasks.filter(t => 
      new Date(t.created_at) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
    );

    const dailyTaskCount = recentTasks.length / 7;
    const overdueTasks = tasks.filter(t => 
      !t.completed && t.due_date && new Date(t.due_date) < new Date()
    ).length;
    const highPriorityPending = tasks.filter(t => 
      !t.completed && t.priority === 'high'
    ).length;

    let riskScore = 0;
    if (dailyTaskCount > 8) riskScore += 40; // High daily load
    if (overdueTasks > 3) riskScore += 30; // Many overdue tasks
    if (highPriorityPending > 2) riskScore += 30; // High priority backlog

    if (riskScore >= 70) return 'high';
    if (riskScore >= 40) return 'medium';
    return 'low';
  }

  /**
   * Calculate peak productivity hours
   */
  private static calculatePeakProductivityHours(tasks: Task[]): string[] {
    const completedTasks = tasks.filter(t => t.completed);
    const hourStats: Record<number, number> = {};

    completedTasks.forEach(task => {
      const hour = new Date(task.created_at).getHours();
      hourStats[hour] = (hourStats[hour] || 0) + 1;
    });

    const sortedHours = Object.entries(hourStats)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([hour]) => {
        const hourNum = parseInt(hour);
        if (hourNum < 12) return `${hourNum} AM`;
        if (hourNum === 12) return '12 PM';
        return `${hourNum - 12} PM`;
      });

    return sortedHours;
  }

  /**
   * Calculate optimal daily task load
   */
  private static calculateOptimalTaskLoad(tasks: Task[]): number {
    const completedTasks = tasks.filter(t => t.completed);
    if (completedTasks.length === 0) return 5; // Default

    // Analyze days with highest completion rates
    const dailyStats: Record<string, number> = {};
    completedTasks.forEach(task => {
      const date = new Date(task.completed_at || task.created_at).toDateString();
      dailyStats[date] = (dailyStats[date] || 0) + 1;
    });

    const completionCounts = Object.values(dailyStats);
    const optimalLoad = Math.round(
      completionCounts.reduce((a, b) => a + b, 0) / completionCounts.length
    );

    return Math.max(3, Math.min(10, optimalLoad)); // Between 3-10 tasks
  }

  /**
   * Calculate priority adherence score
   */
  private static calculatePriorityAdherence(tasks: Task[]): number {
    const completedTasks = tasks.filter(t => t.completed);
    if (completedTasks.length === 0) return 0;

    // Check if high priority tasks are completed before low priority ones
    let adherenceScore = 0;
    const highPriorityCompleted = completedTasks.filter(t => t.priority === 'high').length;
    const totalHighPriority = tasks.filter(t => t.priority === 'high').length;

    if (totalHighPriority > 0) {
      adherenceScore = (highPriorityCompleted / totalHighPriority) * 100;
    }

    return Math.round(adherenceScore);
  }

  /**
   * Convert priority to number
   */
  private static priorityToNumber(priority: string): number {
    switch (priority) {
      case 'high': return 3;
      case 'medium': return 2;
      case 'low': return 1;
      default: return 2;
    }
  }

  /**
   * Get time slot from hour
   */
  private static getTimeSlot(hour: number): string {
    if (hour >= 6 && hour < 12) return 'Morning';
    if (hour >= 12 && hour < 17) return 'Afternoon';
    if (hour >= 17 && hour < 21) return 'Evening';
    return 'Night';
  }

  /**
   * Export analytics data
   */
  static async exportAnalytics(analyticsData: AnalyticsData): Promise<string> {
    const exportData = {
      exportDate: new Date().toISOString(),
      period: analyticsData.period,
      overview: analyticsData.overview,
      categories: analyticsData.categories,
      insights: analyticsData.insights,
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Get productivity score (0-100)
   */
  static calculateProductivityScore(tasks: Task[]): number {
    if (tasks.length === 0) return 0;

    const completionRate = (tasks.filter(t => t.completed).length / tasks.length) * 100;
    const highPriorityCompletion = tasks.filter(t => t.priority === 'high' && t.completed).length;
    const totalHighPriority = tasks.filter(t => t.priority === 'high').length;
    const highPriorityRate = totalHighPriority > 0 ? (highPriorityCompletion / totalHighPriority) * 100 : 100;

    const overdueTasks = tasks.filter(t => 
      !t.completed && t.due_date && new Date(t.due_date) < new Date()
    ).length;
    const overduePenalty = Math.min(20, overdueTasks * 5);

    const score = (completionRate * 0.6) + (highPriorityRate * 0.4) - overduePenalty;
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Get personalized productivity insights and recommendations
   */
  static getPersonalizedInsights(tasks: Task[]): PersonalizedInsights {
    const recommendations = this.generateProductivityRecommendations(tasks);
    const topInsights = this.generateTopInsights(tasks);
    const improvementAreas = this.identifyImprovementAreas(tasks);
    const strengths = this.identifyStrengths(tasks);

    return {
      recommendations,
      topInsights,
      improvementAreas,
      strengths,
    };
  }

  /**
   * Generate AI-driven productivity recommendations
   */
  private static generateProductivityRecommendations(tasks: Task[]): ProductivityRecommendation[] {
    const recommendations: ProductivityRecommendation[] = [];
    const advancedMetrics = this.getAdvancedProductivityMetrics(tasks);
    const predictiveInsights = this.getPredictiveInsights(tasks);

    // Workload optimization recommendations
    if (advancedMetrics.burnoutRisk === 'high') {
      recommendations.push({
        id: 'workload-reduce',
        type: 'workload',
        title: 'Reduce Daily Task Load',
        description: `You're currently at high risk of burnout. Consider reducing your daily task load from ${advancedMetrics.optimalTaskLoad} to ${Math.max(3, advancedMetrics.optimalTaskLoad - 2)} tasks per day.`,
        priority: 'high',
        impact: 85,
        actionable: true,
        actionText: 'Review and prioritize tasks',
      });
    }

    if (advancedMetrics.focusScore < 60) {
      recommendations.push({
        id: 'focus-improve',
        type: 'focus',
        title: 'Improve Task Focus',
        description: 'Your focus score is below average. Try completing similar tasks in batches and minimize interruptions during work sessions.',
        priority: 'medium',
        impact: 70,
        actionable: true,
        actionText: 'Enable focus mode',
      });
    }

    if (predictiveInsights.completionProbability < 70) {
      recommendations.push({
        id: 'time-estimation',
        type: 'time',
        title: 'Improve Time Estimation',
        description: `Your tasks have a ${predictiveInsights.completionProbability}% completion probability. Consider adding buffer time to your estimates.`,
        priority: 'medium',
        impact: 60,
        actionable: true,
        actionText: 'Review time estimates',
      });
    }

    // Priority management recommendations
    const priorityInsights = this.generatePriorityInsights(tasks);
    if (priorityInsights.overdueTasks > 2) {
      recommendations.push({
        id: 'priority-review',
        type: 'priority',
        title: 'Review Task Priorities',
        description: `You have ${priorityInsights.overdueTasks} overdue tasks. Consider reprioritizing or rescheduling them.`,
        priority: 'high',
        impact: 80,
        actionable: true,
        actionText: 'Review overdue tasks',
      });
    }

    // Scheduling recommendations
    if (advancedMetrics.peakProductivityHours.length > 0) {
      recommendations.push({
        id: 'schedule-optimize',
        type: 'schedule',
        title: 'Optimize Your Schedule',
        description: `Your peak productivity hours are ${advancedMetrics.peakProductivityHours.join(', ')}. Schedule important tasks during these times.`,
        priority: 'medium',
        impact: 65,
        actionable: true,
        actionText: 'Schedule important tasks',
      });
    }

    // Efficiency trend recommendations
    if (advancedMetrics.efficiencyTrend === 'declining') {
      recommendations.push({
        id: 'efficiency-review',
        type: 'workload',
        title: 'Review Work Patterns',
        description: 'Your efficiency has been declining. Consider taking breaks between tasks and reviewing your work environment.',
        priority: 'medium',
        impact: 55,
        actionable: true,
        actionText: 'Take a break',
      });
    }

    return recommendations.sort((a, b) => b.impact - a.impact).slice(0, 5);
  }

  /**
   * Generate top insights about user's productivity
   */
  private static generateTopInsights(tasks: Task[]): string[] {
    const insights: string[] = [];
    const advancedMetrics = this.getAdvancedProductivityMetrics(tasks);
    const predictiveInsights = this.getPredictiveInsights(tasks);

    if (advancedMetrics.taskVelocity > 0) {
      insights.push(`You complete an average of ${advancedMetrics.taskVelocity} tasks per day`);
    }

    if (advancedMetrics.focusScore > 70) {
      insights.push(`Your focus score of ${advancedMetrics.focusScore}% is excellent`);
    } else if (advancedMetrics.focusScore < 50) {
      insights.push(`Your focus score of ${advancedMetrics.focusScore}% has room for improvement`);
    }

    if (advancedMetrics.peakProductivityHours.length > 0) {
      insights.push(`You're most productive during ${advancedMetrics.peakProductivityHours[0]}`);
    }

    if (predictiveInsights.completionProbability > 80) {
      insights.push(`You have a ${predictiveInsights.completionProbability}% chance of completing your pending tasks`);
    }

    if (advancedMetrics.efficiencyTrend === 'improving') {
      insights.push('Your productivity is trending upward - great work!');
    }

    return insights.slice(0, 3);
  }

  /**
   * Identify areas for improvement
   */
  private static identifyImprovementAreas(tasks: Task[]): string[] {
    const areas: string[] = [];
    const advancedMetrics = this.getAdvancedProductivityMetrics(tasks);
    const priorityInsights = this.generatePriorityInsights(tasks);

    if (advancedMetrics.focusScore < 60) {
      areas.push('Task focus and concentration');
    }

    if (priorityInsights.overdueTasks > 2) {
      areas.push('Meeting deadlines and due dates');
    }

    if (advancedMetrics.burnoutRisk === 'high') {
      areas.push('Workload management and stress');
    }

    if (advancedMetrics.efficiencyTrend === 'declining') {
      areas.push('Maintaining consistent productivity');
    }

    const categoryInsights = this.generateCategoryInsights(tasks);
    if (categoryInsights.categoryBalance < 50) {
      areas.push('Balancing work across different categories');
    }

    return areas.slice(0, 3);
  }

  /**
   * Identify user strengths
   */
  private static identifyStrengths(tasks: Task[]): string[] {
    const strengths: string[] = [];
    const advancedMetrics = this.getAdvancedProductivityMetrics(tasks);
    const priorityInsights = this.generatePriorityInsights(tasks);

    if (advancedMetrics.focusScore > 80) {
      strengths.push('Excellent task focus and concentration');
    }

    if (priorityInsights.completionByPriority.high > 0) {
      strengths.push('Strong completion of high-priority tasks');
    }

    if (advancedMetrics.efficiencyTrend === 'improving') {
      strengths.push('Consistent productivity improvement');
    }

    if (advancedMetrics.burnoutRisk === 'low') {
      strengths.push('Good workload management');
    }

    const categoryInsights = this.generateCategoryInsights(tasks);
    if (categoryInsights.categoryBalance > 70) {
      strengths.push('Well-balanced work across categories');
    }

    return strengths.slice(0, 3);
  }

  /**
   * Get workload optimization tips
   */
  static getWorkloadOptimizationTips(tasks: Task[]): string[] {
    const tips: string[] = [];
    const advancedMetrics = this.getAdvancedProductivityMetrics(tasks);

    if (advancedMetrics.burnoutRisk === 'high') {
      tips.push('Consider reducing your daily task load by 20%');
      tips.push('Schedule breaks between task clusters');
      tips.push('Delegate or postpone non-urgent tasks');
    }

    if (advancedMetrics.optimalTaskLoad > 8) {
      tips.push(`Your optimal daily task load is ${advancedMetrics.optimalTaskLoad} tasks`);
      tips.push('Break large tasks into smaller, manageable pieces');
    }

    return tips;
  }

  /**
   * Get focus improvement tips
   */
  static getFocusImprovementTips(tasks: Task[]): string[] {
    const tips: string[] = [];
    const advancedMetrics = this.getAdvancedProductivityMetrics(tasks);

    if (advancedMetrics.focusScore < 70) {
      tips.push('Complete similar tasks in batches to maintain focus');
      tips.push('Minimize interruptions during work sessions');
      tips.push('Use the Pomodoro technique (25-minute focused work periods)');
      tips.push('Schedule important tasks during your peak hours');
    }

    if (advancedMetrics.peakProductivityHours.length > 0) {
      tips.push(`Schedule complex tasks during ${advancedMetrics.peakProductivityHours[0]}`);
    }

    return tips;
  }

  /**
   * Get time management advice
   */
  static getTimeManagementAdvice(tasks: Task[]): string[] {
    const advice: string[] = [];
    const predictiveInsights = this.getPredictiveInsights(tasks);
    const advancedMetrics = this.getAdvancedProductivityMetrics(tasks);

    if (predictiveInsights.completionProbability < 80) {
      advice.push('Add 20% buffer time to your task estimates');
      advice.push('Review and adjust due dates for realistic timelines');
    }

    if (predictiveInsights.estimatedCompletionTime > 480) { // More than 8 hours
      advice.push('Consider spreading tasks across multiple days');
      advice.push('Prioritize tasks that can be completed quickly');
    }

    if (advancedMetrics.optimalTaskLoad > 6) {
      advice.push('Limit daily tasks to maintain quality and focus');
    }

    return advice;
  }

  /**
   * Calculate an intelligent priority score for a task, context-aware.
   * Context can include: now (Date), location, focusMode, deviceState, customTags.
   */
  static getIntelligentPriorityScore(task: Task, allTasks: Task[], context: PriorityContext = {}): number {
    // 1. Due date urgency (closer = higher score)
    let dueScore = 0;
    const now = context.now ? context.now.getTime() : Date.now();
    if (task.due_date) {
      const due = new Date(task.due_date).getTime();
      const daysUntilDue = (due - now) / (1000 * 60 * 60 * 24);
      if (daysUntilDue <= 0) dueScore = 40;
      else if (daysUntilDue < 1) dueScore = 35;
      else if (daysUntilDue < 3) dueScore = 25;
      else if (daysUntilDue < 7) dueScore = 15;
      else dueScore = 5;
    }

    // 2. Priority field (high/medium/low)
    let priorityScore = 0;
    switch (task.priority) {
      case 'high': priorityScore = 40; break;
      case 'medium': priorityScore = 25; break;
      case 'low': priorityScore = 10; break;
      default: priorityScore = 20;
    }

    // 3. Effort (if available, lower effort = higher score)
    let effortScore = 0;
    if ('effort' in task && typeof task.effort === 'number') {
      if (task.effort <= 1) effortScore = 10;
      else if (task.effort <= 2) effortScore = 7;
      else if (task.effort <= 4) effortScore = 4;
      else effortScore = 1;
    } else {
      effortScore = 5;
    }

    // 4. User patterns/context
    let patternScore = 0;
    const advanced = this.getAdvancedProductivityMetrics(allTasks);
    if (advanced.peakProductivityHours && task.reminder_time) {
      const taskHour = new Date(task.reminder_time).getHours();
      const peak = advanced.peakProductivityHours.map(h => parseInt(h)).includes(taskHour);
      if (peak) patternScore += 5;
    }
    if (advanced.mostProductiveDay && task.due_date) {
      const dueDay = new Date(task.due_date).toLocaleDateString('en-US', { weekday: 'long' });
      if (dueDay === advanced.mostProductiveDay) patternScore += 5;
    }

    // 5. AI suggestions
    let aiScore = task.ai_suggested ? 5 : 0;

    // 6. Context-aware boosts
    let contextScore = 0;
    // Focus mode: boost tasks due soon and high priority
    if (context.focusMode) {
      if (dueScore >= 25) contextScore += 5;
      if (priorityScore >= 25) contextScore += 5;
    }
    // Location: boost tasks tagged with current location
    if (context.location && task.tags && Array.isArray(task.tags)) {
      if (task.tags.includes(context.location)) contextScore += 5;
    }
    // Device state: e.g., if on mobile, boost quick tasks
    if (context.deviceState === 'mobile' && 'effort' in task && typeof task.effort === 'number') {
      if (task.effort <= 1) contextScore += 3;
    }
    // Custom tags: boost tasks matching any custom context tags
    if (context.customTags && task.tags && Array.isArray(task.tags)) {
      if (context.customTags.some(tag => task.tags.includes(tag))) contextScore += 3;
    }

    // Total score (max 100)
    const total = Math.min(100, dueScore + priorityScore + effortScore + patternScore + aiScore + contextScore);
    return total;
  }

  /**
   * Get tasks ranked by intelligent priority score (highest first), context-aware.
   */
  static getRankedTasksByPriority(tasks: Task[], context: PriorityContext = {}): Task[] {
    return [...tasks].sort((a, b) =>
      this.getIntelligentPriorityScore(b, tasks, context) - this.getIntelligentPriorityScore(a, tasks, context)
    );
  }
} 