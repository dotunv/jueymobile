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
} 