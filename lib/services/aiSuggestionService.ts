import { DatabaseService } from './databaseService';
import { PatternAnalysisService, PatternAnalysis } from './patternAnalysisService';
import { Task, Suggestion, TaskPattern, UserPreferences } from '../types';

export interface SuggestionContext {
  userId: string;
  recentTasks: Task[];
  taskPatterns: TaskPattern[];
  userPreferences: UserPreferences | null;
  currentTime: Date;
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, etc.
  hourOfDay: number;
}

export interface SuggestionReasoning {
  reasoning: string;
  confidence: number;
  based_on: string[];
  time_estimate: string;
  priority: 'low' | 'medium' | 'high';
}

export class AISuggestionService {
  /**
   * Generate AI suggestions based on user patterns and context
   */
  static async generateSuggestions(userId: string): Promise<Suggestion[]> {
    try {
      // Get user context
      const context = await this.buildContext(userId);
      
      // Generate suggestions based on different patterns
      const suggestions: Suggestion[] = [];
      
      // 1. Time-based suggestions
      const timeBasedSuggestions = this.generateTimeBasedSuggestions(context);
      suggestions.push(...timeBasedSuggestions);
      
      // 2. Pattern-based suggestions
      const patternBasedSuggestions = this.generatePatternBasedSuggestions(context);
      suggestions.push(...patternBasedSuggestions);
      
      // 3. Category-based suggestions
      const categoryBasedSuggestions = this.generateCategoryBasedSuggestions(context);
      suggestions.push(...categoryBasedSuggestions);
      
      // 4. Priority-based suggestions
      const priorityBasedSuggestions = this.generatePriorityBasedSuggestions(context);
      suggestions.push(...priorityBasedSuggestions);
      
      // Filter and rank suggestions
      const filteredSuggestions = this.filterAndRankSuggestions(suggestions, context);
      
      // Save suggestions to database
      for (const suggestion of filteredSuggestions) {
        await DatabaseService.createSuggestion(userId, suggestion);
      }
      
      return filteredSuggestions;
    } catch (error) {
      console.error('Error generating suggestions:', error);
      return [];
    }
  }

  /**
   * Build context for suggestion generation
   */
  private static async buildContext(userId: string): Promise<SuggestionContext> {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const hourOfDay = now.getHours();
    
    // Get recent tasks (last 7 days)
    const recentTasks = await DatabaseService.getTasks(userId, { limit: 50 });
    
    // Get task patterns
    const taskPatterns = await DatabaseService.getTaskPatterns(userId);
    
    // Get user preferences
    const userPreferences = await DatabaseService.getUserPreferences(userId);
    
    return {
      userId,
      recentTasks,
      taskPatterns,
      userPreferences,
      currentTime: now,
      dayOfWeek,
      hourOfDay,
    };
  }

  /**
   * Generate time-based suggestions
   */
  private static generateTimeBasedSuggestions(context: SuggestionContext): Suggestion[] {
    const suggestions: Suggestion[] = [];
    const { dayOfWeek, hourOfDay, recentTasks } = context;
    
    // Morning routine suggestions
    if (hourOfDay >= 6 && hourOfDay <= 9) {
      const hasMorningTasks = recentTasks.some(task => 
        task.category === 'Personal' && 
        (task.title.toLowerCase().includes('breakfast') || 
         task.title.toLowerCase().includes('exercise') ||
         task.title.toLowerCase().includes('plan'))
      );
      
      if (!hasMorningTasks) {
        suggestions.push({
          id: this.generateId(),
          user_id: context.userId,
          title: 'Plan your day',
          description: 'Take a few minutes to review your schedule and set priorities for the day.',
          category: 'Personal',
          confidence: 85,
          reasoning: 'Based on your morning routine patterns and current time',
          time_estimate: '10 mins',
          priority: 'medium',
          based_on: ['Morning routine patterns', 'Time of day', 'Productivity habits'],
          status: 'pending',
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
        });
      }
    }
    
    // Evening wind-down suggestions
    if (hourOfDay >= 20 && hourOfDay <= 22) {
      const hasEveningTasks = recentTasks.some(task => 
        task.category === 'Personal' && 
        (task.title.toLowerCase().includes('review') || 
         task.title.toLowerCase().includes('prepare') ||
         task.title.toLowerCase().includes('plan'))
      );
      
      if (!hasEveningTasks) {
        suggestions.push({
          id: this.generateId(),
          user_id: context.userId,
          title: 'Review today\'s progress',
          description: 'Reflect on what you accomplished today and plan for tomorrow.',
          category: 'Personal',
          confidence: 80,
          reasoning: 'Based on evening routine patterns and current time',
          time_estimate: '15 mins',
          priority: 'low',
          based_on: ['Evening routine patterns', 'Time of day', 'Reflection habits'],
          status: 'pending',
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        });
      }
    }
    
    return suggestions;
  }

  /**
   * Generate pattern-based suggestions
   */
  private static generatePatternBasedSuggestions(context: SuggestionContext): Suggestion[] {
    const suggestions: Suggestion[] = [];
    const { recentTasks, taskPatterns } = context;
    
    // Analyze frequency patterns
    const frequencyPatterns = taskPatterns.filter(p => p.pattern_type === 'frequency');
    
    for (const pattern of frequencyPatterns) {
      const patternData = pattern.pattern_data as any;
      const taskTitle = patternData.taskTitle;
      const frequency = patternData.frequency;
      const lastCompleted = new Date(patternData.lastCompleted);
      const daysSinceLastCompleted = Math.floor((Date.now() - lastCompleted.getTime()) / (1000 * 60 * 60 * 24));
      
      // Check if it's time for this recurring task
      if (daysSinceLastCompleted >= frequency) {
        suggestions.push({
          id: this.generateId(),
          user_id: context.userId,
          title: taskTitle,
          description: `This task is due based on your regular ${frequency}-day pattern.`,
          category: this.getCategoryFromPattern(pattern),
          confidence: pattern.confidence,
          reasoning: `Based on your recurring pattern of completing this task every ${frequency} days`,
          time_estimate: patternData.timeEstimate || '30 mins',
          priority: patternData.priority || 'medium',
          based_on: ['Recurring patterns', 'Task frequency', 'Historical data'],
          status: 'pending',
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
        });
      }
    }
    
    return suggestions;
  }

  /**
   * Generate category-based suggestions
   */
  private static generateCategoryBasedSuggestions(context: SuggestionContext): Suggestion[] {
    const suggestions: Suggestion[] = [];
    const { recentTasks } = context;
    
    // Analyze category distribution
    const categoryCounts: Record<string, number> = {};
    const categoryCompletionRates: Record<string, { completed: number; total: number }> = {};
    
    recentTasks.forEach(task => {
      categoryCounts[task.category] = (categoryCounts[task.category] || 0) + 1;
      
      if (!categoryCompletionRates[task.category]) {
        categoryCompletionRates[task.category] = { completed: 0, total: 0 };
      }
      categoryCompletionRates[task.category].total++;
      if (task.completed) {
        categoryCompletionRates[task.category].completed++;
      }
    });
    
    // Suggest tasks for underrepresented categories
    const allCategories = ['Work', 'Personal', 'Health', 'Learning', 'Finance', 'Social'];
    const currentCategories = Object.keys(categoryCounts);
    
    for (const category of allCategories) {
      if (!currentCategories.includes(category) || categoryCounts[category] < 2) {
        const suggestion = this.generateCategorySuggestion(category, context);
        if (suggestion) {
          suggestions.push(suggestion);
        }
      }
    }
    
    return suggestions;
  }

  /**
   * Generate priority-based suggestions
   */
  private static generatePriorityBasedSuggestions(context: SuggestionContext): Suggestion[] {
    const suggestions: Suggestion[] = [];
    const { recentTasks } = context;
    
    // Check for overdue high-priority tasks
    const overdueHighPriority = recentTasks.filter(task => 
      task.priority === 'high' && 
      !task.completed && 
      task.due_date && 
      new Date(task.due_date) < new Date()
    );
    
    if (overdueHighPriority.length > 0) {
              suggestions.push({
          id: this.generateId(),
          user_id: context.userId,
          title: 'Review overdue high-priority tasks',
          description: `You have ${overdueHighPriority.length} high-priority tasks that are overdue. Consider reprioritizing or rescheduling them.`,
          category: 'Work',
          confidence: 95,
          reasoning: 'Based on overdue high-priority tasks in your list',
          time_estimate: '20 mins',
          priority: 'high',
          based_on: ['Overdue tasks', 'Priority analysis', 'Task management'],
          status: 'pending',
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        });
    }
    
    return suggestions;
  }

  /**
   * Generate a suggestion for a specific category
   */
  private static generateCategorySuggestion(category: string, context: SuggestionContext): Suggestion | null {
    const categorySuggestions: Record<string, { title: string; description: string; timeEstimate: string }> = {
      'Work': {
        title: 'Review and organize workspace',
        description: 'Take some time to organize your digital and physical workspace for better productivity.',
        timeEstimate: '30 mins',
      },
      'Personal': {
        title: 'Personal reflection time',
        description: 'Set aside time for personal reflection and self-care activities.',
        timeEstimate: '20 mins',
      },
      'Health': {
        title: 'Health check-in',
        description: 'Review your health goals and plan your next wellness activities.',
        timeEstimate: '15 mins',
      },
      'Learning': {
        title: 'Learning session',
        description: 'Dedicate time to learn something new or practice a skill you\'re developing.',
        timeEstimate: '45 mins',
      },
      'Finance': {
        title: 'Financial review',
        description: 'Review your recent expenses and update your budget or financial goals.',
        timeEstimate: '25 mins',
      },
      'Social': {
        title: 'Social connection',
        description: 'Reach out to friends or family members you haven\'t connected with recently.',
        timeEstimate: '20 mins',
      },
    };
    
    const suggestion = categorySuggestions[category];
    if (!suggestion) return null;
    
    return {
      id: this.generateId(),
      user_id: context.userId,
      title: suggestion.title,
      description: suggestion.description,
      category,
      confidence: 75,
      reasoning: `Based on your task category distribution and the need for balance in your routine`,
      time_estimate: suggestion.timeEstimate,
      priority: 'medium',
      based_on: ['Category balance', 'Task distribution', 'Wellness goals'],
      status: 'pending',
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  /**
   * Filter and rank suggestions
   */
  private static filterAndRankSuggestions(suggestions: Suggestion[], context: SuggestionContext): Suggestion[] {
    // Remove duplicates based on title similarity
    const uniqueSuggestions = suggestions.filter((suggestion, index, self) => 
      index === self.findIndex(s => 
        this.similarTitles(suggestion.title, s.title)
      )
    );
    
    // Sort by confidence and priority
    return uniqueSuggestions
      .sort((a, b) => {
        // Priority weights
        const priorityWeights = { high: 3, medium: 2, low: 1 };
        const aScore = a.confidence * priorityWeights[a.priority];
        const bScore = b.confidence * priorityWeights[b.priority];
        return bScore - aScore;
      })
      .slice(0, 10); // Limit to top 10 suggestions
  }

  /**
   * Check if two titles are similar
   */
  private static similarTitles(title1: string, title2: string): boolean {
    const words1 = title1.toLowerCase().split(' ');
    const words2 = title2.toLowerCase().split(' ');
    const commonWords = words1.filter(word => words2.includes(word));
    return commonWords.length >= Math.min(words1.length, words2.length) * 0.7;
  }

  /**
   * Get category from pattern
   */
  private static getCategoryFromPattern(pattern: TaskPattern): string {
    const patternData = pattern.pattern_data as any;
    return patternData.category || 'Personal';
  }

  /**
   * Generate unique ID
   */
  private static generateId(): string {
    return `suggestion_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Process user feedback to improve future suggestions
   */
  static async processFeedback(suggestionId: string, feedbackType: 'positive' | 'negative', reason?: string) {
    try {
      // Save feedback to database
      await DatabaseService.createFeedback('user-id', {
        suggestion_id: suggestionId,
        feedback_type: feedbackType,
        reason,
      });
      
      // Update suggestion status
      await DatabaseService.updateSuggestionStatus(suggestionId, feedbackType === 'positive' ? 'accepted' : 'rejected');
      
      // Update patterns based on feedback
      await this.updatePatternsFromFeedback(suggestionId, feedbackType);
    } catch (error) {
      console.error('Error processing feedback:', error);
    }
  }

  /**
   * Update patterns based on user feedback
   */
  private static async updatePatternsFromFeedback(suggestionId: string, feedbackType: 'positive' | 'negative') {
    // This would update the AI patterns based on user feedback
    // For now, we'll just log the feedback
    console.log(`Feedback received for suggestion ${suggestionId}: ${feedbackType}`);
  }

  /**
   * Convert suggestion to task
   */
  static async convertSuggestionToTask(suggestion: Suggestion, userId: string): Promise<Task | null> {
    try {
      const task = await DatabaseService.createTask(userId, {
        title: suggestion.title,
        description: suggestion.description,
        category: suggestion.category,
        priority: suggestion.priority,
        ai_suggested: true,
        reminder_enabled: true,
        reminder_time: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour from now
      });
      
      // Update suggestion status
      await DatabaseService.updateSuggestionStatus(suggestion.id, 'accepted');
      
      return task;
    } catch (error) {
      console.error('Error converting suggestion to task:', error);
      return null;
    }
  }
} 