import { Task, TaskPattern } from '../types';

export interface PatternAnalysis {
  frequencyPatterns: FrequencyPattern[];
  timePatterns: TimePattern[];
  categoryPatterns: CategoryPattern[];
  productivityPatterns: ProductivityPattern[];
}

export interface FrequencyPattern {
  taskTitle: string;
  frequency: number; // times per week
  lastCompleted: string;
  nextExpected: string;
  confidence: number;
  category: string;
  timeEstimate: string;
  priority: 'low' | 'medium' | 'high';
}

export interface TimePattern {
  taskTitle: string;
  preferredTime: string; // HH:MM format
  preferredDay: string; // day of week
  confidence: number;
  category: string;
}

export interface CategoryPattern {
  category: string;
  frequency: number;
  preferredTime?: string;
  preferredDay?: string;
  confidence: number;
  averagePriority: number;
}

export interface ProductivityPattern {
  mostProductiveDay: string;
  mostProductiveTime: string;
  averageTasksPerDay: number;
  completionRate: number;
  preferredCategories: string[];
}

export class PatternAnalysisService {
  /**
   * Analyze user task patterns
   */
  static async analyzePatterns(tasks: Task[]): Promise<PatternAnalysis> {
    const frequencyPatterns = this.analyzeFrequencyPatterns(tasks);
    const timePatterns = this.analyzeTimePatterns(tasks);
    const categoryPatterns = this.analyzeCategoryPatterns(tasks);
    const productivityPatterns = this.analyzeProductivityPatterns(tasks);

    return {
      frequencyPatterns,
      timePatterns,
      categoryPatterns,
      productivityPatterns,
    };
  }

  /**
   * Analyze frequency patterns (recurring tasks)
   */
  private static analyzeFrequencyPatterns(tasks: Task[]): FrequencyPattern[] {
    const patterns: FrequencyPattern[] = [];
    const taskGroups: Record<string, Task[]> = {};

    // Group tasks by similar titles
    tasks.forEach(task => {
      const normalizedTitle = this.normalizeTitle(task.title);
      if (!taskGroups[normalizedTitle]) {
        taskGroups[normalizedTitle] = [];
      }
      taskGroups[normalizedTitle].push(task);
    });

    // Analyze each group for frequency patterns
    Object.entries(taskGroups).forEach(([title, taskList]) => {
      if (taskList.length >= 2) {
        const pattern = this.calculateFrequencyPattern(title, taskList);
        if (pattern) {
          patterns.push(pattern);
        }
      }
    });

    return patterns.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Analyze time patterns (when tasks are typically done)
   */
  private static analyzeTimePatterns(tasks: Task[]): TimePattern[] {
    const patterns: TimePattern[] = [];
    const taskGroups: Record<string, Task[]> = {};

    // Group tasks by similar titles
    tasks.forEach(task => {
      const normalizedTitle = this.normalizeTitle(task.title);
      if (!taskGroups[normalizedTitle]) {
        taskGroups[normalizedTitle] = [];
      }
      taskGroups[normalizedTitle].push(task);
    });

    // Analyze each group for time patterns
    Object.entries(taskGroups).forEach(([title, taskList]) => {
      if (taskList.length >= 2) {
        const pattern = this.calculateTimePattern(title, taskList);
        if (pattern) {
          patterns.push(pattern);
        }
      }
    });

    return patterns.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Analyze category patterns
   */
  private static analyzeCategoryPatterns(tasks: Task[]): CategoryPattern[] {
    const categoryStats: Record<string, { tasks: Task[]; total: number; completed: number }> = {};

    // Group tasks by category
    tasks.forEach(task => {
      if (!categoryStats[task.category]) {
        categoryStats[task.category] = { tasks: [], total: 0, completed: 0 };
      }
      categoryStats[task.category].tasks.push(task);
      categoryStats[task.category].total++;
      if (task.completed) {
        categoryStats[task.category].completed++;
      }
    });

    // Calculate patterns for each category
    const patterns: CategoryPattern[] = [];
    Object.entries(categoryStats).forEach(([category, stats]) => {
      if (stats.total >= 3) {
        const pattern = this.calculateCategoryPattern(category, stats);
        patterns.push(pattern);
      }
    });

    return patterns.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Analyze productivity patterns
   */
  private static analyzeProductivityPatterns(tasks: Task[]): ProductivityPattern {
    const dayStats: Record<string, { total: number; completed: number }> = {};
    const timeStats: Record<string, { total: number; completed: number }> = {};
    const categoryCounts: Record<string, number> = {};

    // Analyze tasks by day and time
    tasks.forEach(task => {
      const createdDate = new Date(task.created_at);
      const day = createdDate.toLocaleDateString('en-US', { weekday: 'long' });
      const hour = createdDate.getHours();
      const timeSlot = this.getTimeSlot(hour);

      // Day stats
      if (!dayStats[day]) {
        dayStats[day] = { total: 0, completed: 0 };
      }
      dayStats[day].total++;
      if (task.completed) {
        dayStats[day].completed++;
      }

      // Time stats
      if (!timeStats[timeSlot]) {
        timeStats[timeSlot] = { total: 0, completed: 0 };
      }
      timeStats[timeSlot].total++;
      if (task.completed) {
        timeStats[timeSlot].completed++;
      }

      // Category counts
      categoryCounts[task.category] = (categoryCounts[task.category] || 0) + 1;
    });

    // Find most productive day
    const mostProductiveDay = Object.entries(dayStats)
      .sort(([, a], [, b]) => (b.completed / b.total) - (a.completed / a.total))[0]?.[0] || 'Monday';

    // Find most productive time
    const mostProductiveTime = Object.entries(timeStats)
      .sort(([, a], [, b]) => (b.completed / b.total) - (a.completed / a.total))[0]?.[0] || 'Morning';

    // Calculate averages
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.completed).length;
    const averageTasksPerDay = totalTasks / 7; // Assuming 7 days
    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    // Find preferred categories
    const preferredCategories = Object.entries(categoryCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([category]) => category);

    return {
      mostProductiveDay,
      mostProductiveTime,
      averageTasksPerDay,
      completionRate,
      preferredCategories,
    };
  }

  /**
   * Calculate frequency pattern for a group of tasks
   */
  private static calculateFrequencyPattern(title: string, tasks: Task[]): FrequencyPattern | null {
    if (tasks.length < 2) return null;

    // Sort tasks by creation date
    const sortedTasks = tasks.sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    // Calculate average interval between tasks
    const intervals: number[] = [];
    for (let i = 1; i < sortedTasks.length; i++) {
      const prevDate = new Date(sortedTasks[i - 1].created_at);
      const currDate = new Date(sortedTasks[i].created_at);
      const interval = (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24); // days
      intervals.push(interval);
    }

    const averageInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const frequency = 7 / averageInterval; // times per week

    // Calculate confidence based on consistency
    const variance = intervals.reduce((acc, interval) => 
      acc + Math.pow(interval - averageInterval, 2), 0
    ) / intervals.length;
    const confidence = Math.max(0, 100 - (variance * 10));

    const lastTask = sortedTasks[sortedTasks.length - 1];
    const lastCompleted = lastTask.created_at;
    const nextExpected = new Date(new Date(lastCompleted).getTime() + averageInterval * 24 * 60 * 60 * 1000).toISOString();

    // Calculate average priority and time estimate
    const priorities = tasks.map(t => this.priorityToNumber(t.priority));
    const averagePriority = priorities.reduce((a, b) => a + b, 0) / priorities.length;
    const priority = this.numberToPriority(averagePriority);

    return {
      taskTitle: title,
      frequency: Math.round(frequency * 10) / 10,
      lastCompleted,
      nextExpected,
      confidence: Math.round(confidence),
      category: tasks[0].category,
      timeEstimate: '30 mins', // Default, could be calculated from actual data
      priority,
    };
  }

  /**
   * Calculate time pattern for a group of tasks
   */
  private static calculateTimePattern(title: string, tasks: Task[]): TimePattern | null {
    if (tasks.length < 2) return null;

    const timeSlots: Record<string, number> = {};
    const daySlots: Record<string, number> = {};

    tasks.forEach(task => {
      const date = new Date(task.created_at);
      const hour = date.getHours();
      const timeSlot = this.getTimeSlot(hour);
      const day = date.toLocaleDateString('en-US', { weekday: 'long' });

      timeSlots[timeSlot] = (timeSlots[timeSlot] || 0) + 1;
      daySlots[day] = (daySlots[day] || 0) + 1;
    });

    const preferredTime = Object.entries(timeSlots)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || 'Morning';
    const preferredDay = Object.entries(daySlots)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || 'Monday';

    const confidence = Math.max(...Object.values(timeSlots)) / tasks.length * 100;

    return {
      taskTitle: title,
      preferredTime,
      preferredDay,
      confidence: Math.round(confidence),
      category: tasks[0].category,
    };
  }

  /**
   * Calculate category pattern
   */
  private static calculateCategoryPattern(category: string, stats: { tasks: Task[]; total: number; completed: number }): CategoryPattern {
    const frequency = stats.total / 7; // tasks per week
    const completionRate = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0;
    
    // Calculate average priority
    const priorities = stats.tasks.map(t => this.priorityToNumber(t.priority));
    const averagePriority = priorities.reduce((a, b) => a + b, 0) / priorities.length;

    // Find preferred time and day
    const timeSlots: Record<string, number> = {};
    const daySlots: Record<string, number> = {};

    stats.tasks.forEach(task => {
      const date = new Date(task.created_at);
      const hour = date.getHours();
      const timeSlot = this.getTimeSlot(hour);
      const day = date.toLocaleDateString('en-US', { weekday: 'long' });

      timeSlots[timeSlot] = (timeSlots[timeSlot] || 0) + 1;
      daySlots[day] = (daySlots[day] || 0) + 1;
    });

    const preferredTime = Object.entries(timeSlots)
      .sort(([, a], [, b]) => b - a)[0]?.[0];
    const preferredDay = Object.entries(daySlots)
      .sort(([, a], [, b]) => b - a)[0]?.[0];

    return {
      category,
      frequency: Math.round(frequency * 10) / 10,
      preferredTime,
      preferredDay,
      confidence: Math.round(completionRate),
      averagePriority,
    };
  }

  /**
   * Normalize task title for grouping
   */
  private static normalizeTitle(title: string): string {
    return title.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
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
   * Convert number to priority
   */
  private static numberToPriority(num: number): 'low' | 'medium' | 'high' {
    if (num >= 2.5) return 'high';
    if (num >= 1.5) return 'medium';
    return 'low';
  }

  /**
   * Save patterns to database
   */
  static async savePatterns(userId: string, patterns: PatternAnalysis): Promise<void> {
    // This would save patterns to the database for future use
    // For now, we'll just log them
    console.log('Saving patterns for user:', userId, patterns);
  }
} 