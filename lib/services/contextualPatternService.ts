import { Task } from '../types';
import { UserPattern, PatternDatabaseUtils } from '../patternDatabase';
import { DatabaseUtils } from '../database';

/**
 * Contextual Pattern Analysis Service
 * Analyzes task completion patterns based on location, time, and environmental context
 */

export interface LocationContext {
  latitude?: number;
  longitude?: number;
  address?: string;
  placeName?: string;
  placeType?: 'home' | 'work' | 'gym' | 'store' | 'restaurant' | 'other';
  accuracy?: number;
}

export interface EnvironmentalContext {
  weather?: {
    condition: string;
    temperature: number;
    humidity: number;
  };
  calendarEvents?: {
    title: string;
    startTime: string;
    endTime: string;
    type: 'meeting' | 'appointment' | 'event' | 'reminder';
  }[];
  deviceContext?: {
    batteryLevel: number;
    isCharging: boolean;
    networkType: 'wifi' | 'cellular' | 'offline';
    screenBrightness: number;
  };
}

export interface ContextualPattern {
  id: string;
  userId: string;
  contextType: 'location' | 'weather' | 'calendar' | 'time_of_day' | 'device';
  contextData: Record<string, any>;
  associatedTasks: string[]; // Task categories or titles
  frequency: number;
  confidence: number;
  lastOccurrence: Date;
  effectiveness: number; // How often tasks are completed in this context
}

export interface ContextAwareSuggestion {
  taskTitle: string;
  category: string;
  confidence: number;
  reasoning: string;
  contextMatch: string;
  priority: 'low' | 'medium' | 'high';
  estimatedDuration?: number;
}

export class ContextualPatternService {
  private readonly MIN_CONFIDENCE = 0.25;
  private readonly MIN_FREQUENCY = 3;
  private readonly LOCATION_RADIUS_METERS = 100; // Consider locations within 100m as same
  private readonly TIME_WINDOW_MINUTES = 30; // Group contexts within 30 minutes

  /**
   * Analyze contextual patterns for a user's tasks
   */
  async analyzeContextualPatterns(
    userId: string,
    tasks: Task[],
    contexts: Map<string, { location?: LocationContext; environment?: EnvironmentalContext }>
  ): Promise<ContextualPattern[]> {
    const completedTasks = tasks.filter(task => task.completed && task.completed_at);
    
    if (completedTasks.length < this.MIN_FREQUENCY) {
      return [];
    }

    const patterns: ContextualPattern[] = [];

    // Analyze location-based patterns
    const locationPatterns = await this.analyzeLocationPatterns(userId, completedTasks, contexts);
    patterns.push(...locationPatterns);

    // Analyze time-of-day patterns
    const timePatterns = await this.analyzeTimeOfDayPatterns(userId, completedTasks);
    patterns.push(...timePatterns);

    // Analyze weather correlation patterns
    const weatherPatterns = await this.analyzeWeatherPatterns(userId, completedTasks, contexts);
    patterns.push(...weatherPatterns);

    // Analyze calendar event patterns
    const calendarPatterns = await this.analyzeCalendarPatterns(userId, completedTasks, contexts);
    patterns.push(...calendarPatterns);

    // Store patterns in database
    await this.storeContextualPatterns(userId, patterns);

    return patterns.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Analyze location-based task completion patterns
   */
  private async analyzeLocationPatterns(
    userId: string,
    tasks: Task[],
    contexts: Map<string, { location?: LocationContext; environment?: EnvironmentalContext }>
  ): Promise<ContextualPattern[]> {
    const locationGroups = new Map<string, Task[]>();

    // Group tasks by location
    for (const task of tasks) {
      const context = contexts.get(task.id);
      if (!context?.location) continue;

      const locationKey = this.getLocationKey(context.location);
      if (!locationGroups.has(locationKey)) {
        locationGroups.set(locationKey, []);
      }
      locationGroups.get(locationKey)!.push(task);
    }

    const patterns: ContextualPattern[] = [];

    for (const [locationKey, locationTasks] of locationGroups.entries()) {
      if (locationTasks.length < this.MIN_FREQUENCY) continue;

      const categoryFrequency = this.calculateCategoryFrequency(locationTasks);
      const confidence = this.calculateLocationConfidence(locationTasks, tasks.length);
      
      if (confidence >= this.MIN_CONFIDENCE) {
        const location = contexts.get(locationTasks[0].id)?.location!;
        const lastOccurrence = new Date(Math.max(...locationTasks.map(t => 
          new Date(t.completed_at!).getTime())));

        patterns.push({
          id: DatabaseUtils.generateId(),
          userId,
          contextType: 'location',
          contextData: {
            location: location,
            placeType: location.placeType || 'other',
            categoryFrequency
          },
          associatedTasks: Object.keys(categoryFrequency),
          frequency: locationTasks.length,
          confidence,
          lastOccurrence,
          effectiveness: this.calculateEffectiveness(locationTasks)
        });
      }
    }

    return patterns;
  }

  /**
   * Analyze time-of-day patterns for different task categories
   */
  private async analyzeTimeOfDayPatterns(userId: string, tasks: Task[]): Promise<ContextualPattern[]> {
    const timeGroups = new Map<string, Task[]>();

    // Group tasks by time of day and category
    for (const task of tasks) {
      if (!task.completed_at) continue;

      const completedDate = new Date(task.completed_at);
      const hour = completedDate.getHours();
      const timeSlot = this.getTimeSlot(hour);
      const category = task.category || 'Uncategorized';
      const key = `${timeSlot}-${category}`;

      if (!timeGroups.has(key)) {
        timeGroups.set(key, []);
      }
      timeGroups.get(key)!.push(task);
    }

    const patterns: ContextualPattern[] = [];

    for (const [key, timeTasks] of timeGroups.entries()) {
      if (timeTasks.length < this.MIN_FREQUENCY) continue;

      const [timeSlot, category] = key.split('-');
      const confidence = this.calculateTimeConfidence(timeTasks, tasks.filter(t => t.category === category));
      
      if (confidence >= this.MIN_CONFIDENCE) {
        const lastOccurrence = new Date(Math.max(...timeTasks.map(t => 
          new Date(t.completed_at!).getTime())));

        patterns.push({
          id: DatabaseUtils.generateId(),
          userId,
          contextType: 'time_of_day',
          contextData: {
            timeSlot,
            category,
            averageHour: this.calculateAverageHour(timeTasks)
          },
          associatedTasks: [category],
          frequency: timeTasks.length,
          confidence,
          lastOccurrence,
          effectiveness: this.calculateEffectiveness(timeTasks)
        });
      }
    }

    return patterns;
  }

  /**
   * Analyze weather correlation patterns
   */
  private async analyzeWeatherPatterns(
    userId: string,
    tasks: Task[],
    contexts: Map<string, { location?: LocationContext; environment?: EnvironmentalContext }>
  ): Promise<ContextualPattern[]> {
    const weatherGroups = new Map<string, Task[]>();

    // Group tasks by weather conditions
    for (const task of tasks) {
      const context = contexts.get(task.id);
      if (!context?.environment?.weather) continue;

      const weather = context.environment.weather;
      const weatherKey = `${weather.condition}-${this.getTemperatureRange(weather.temperature)}`;
      
      if (!weatherGroups.has(weatherKey)) {
        weatherGroups.set(weatherKey, []);
      }
      weatherGroups.get(weatherKey)!.push(task);
    }

    const patterns: ContextualPattern[] = [];

    for (const [weatherKey, weatherTasks] of weatherGroups.entries()) {
      if (weatherTasks.length < this.MIN_FREQUENCY) continue;

      const categoryFrequency = this.calculateCategoryFrequency(weatherTasks);
      const confidence = this.calculateWeatherConfidence(weatherTasks, tasks.length);
      
      if (confidence >= this.MIN_CONFIDENCE) {
        const [condition, tempRange] = weatherKey.split('-');
        const lastOccurrence = new Date(Math.max(...weatherTasks.map(t => 
          new Date(t.completed_at!).getTime())));

        patterns.push({
          id: DatabaseUtils.generateId(),
          userId,
          contextType: 'weather',
          contextData: {
            condition,
            temperatureRange: tempRange,
            categoryFrequency
          },
          associatedTasks: Object.keys(categoryFrequency),
          frequency: weatherTasks.length,
          confidence,
          lastOccurrence,
          effectiveness: this.calculateEffectiveness(weatherTasks)
        });
      }
    }

    return patterns;
  }

  /**
   * Analyze calendar event correlation patterns
   */
  private async analyzeCalendarPatterns(
    userId: string,
    tasks: Task[],
    contexts: Map<string, { location?: LocationContext; environment?: EnvironmentalContext }>
  ): Promise<ContextualPattern[]> {
    const calendarGroups = new Map<string, Task[]>();

    // Group tasks by calendar event types
    for (const task of tasks) {
      const context = contexts.get(task.id);
      if (!context?.environment?.calendarEvents) continue;

      for (const event of context.environment.calendarEvents) {
        const eventKey = `${event.type}-${task.category || 'Uncategorized'}`;
        
        if (!calendarGroups.has(eventKey)) {
          calendarGroups.set(eventKey, []);
        }
        calendarGroups.get(eventKey)!.push(task);
      }
    }

    const patterns: ContextualPattern[] = [];

    for (const [eventKey, calendarTasks] of calendarGroups.entries()) {
      if (calendarTasks.length < this.MIN_FREQUENCY) continue;

      const [eventType, category] = eventKey.split('-');
      const confidence = this.calculateCalendarConfidence(calendarTasks, tasks.length);
      
      if (confidence >= this.MIN_CONFIDENCE) {
        const lastOccurrence = new Date(Math.max(...calendarTasks.map(t => 
          new Date(t.completed_at!).getTime())));

        patterns.push({
          id: DatabaseUtils.generateId(),
          userId,
          contextType: 'calendar',
          contextData: {
            eventType,
            category,
            correlation: 'before_during_after' // Could be refined
          },
          associatedTasks: [category],
          frequency: calendarTasks.length,
          confidence,
          lastOccurrence,
          effectiveness: this.calculateEffectiveness(calendarTasks)
        });
      }
    }

    return patterns;
  }

  /**
   * Generate context-aware task suggestions
   */
  async generateContextAwareSuggestions(
    userId: string,
    currentContext: {
      location?: LocationContext;
      environment?: EnvironmentalContext;
      timeOfDay: number;
    },
    limit: number = 5
  ): Promise<ContextAwareSuggestion[]> {
    const patterns = await PatternDatabaseUtils.getUserPatterns(userId, 'contextual');
    const suggestions: ContextAwareSuggestion[] = [];

    for (const pattern of patterns) {
      const contextMatch = this.calculateContextMatch(pattern, currentContext);
      
      if (contextMatch > 0.5) { // 50% context match threshold
        const contextData = pattern.pattern_data;
        
        for (const taskCategory of pattern.associatedTasks) {
          const confidence = pattern.confidence * contextMatch * pattern.effectiveness;
          
          suggestions.push({
            taskTitle: this.generateTaskTitle(taskCategory, contextData),
            category: taskCategory,
            confidence,
            reasoning: this.generateReasoning(pattern, contextMatch),
            contextMatch: `${Math.round(contextMatch * 100)}%`,
            priority: this.determinePriority(confidence),
            estimatedDuration: this.estimateDuration(taskCategory, contextData)
          });
        }
      }
    }

    return suggestions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, limit);
  }

  /**
   * Calculate how well current context matches a pattern
   */
  private calculateContextMatch(
    pattern: UserPattern,
    currentContext: {
      location?: LocationContext;
      environment?: EnvironmentalContext;
      timeOfDay: number;
    }
  ): number {
    const contextData = pattern.pattern_data;
    let matchScore = 0;
    let totalFactors = 0;

    // Location match
    if (pattern.contextType === 'location' && currentContext.location && contextData.location) {
      totalFactors++;
      const distance = this.calculateDistance(currentContext.location, contextData.location);
      if (distance <= this.LOCATION_RADIUS_METERS) {
        matchScore += 1;
      } else {
        matchScore += Math.max(0, 1 - distance / 1000); // Decay over 1km
      }
    }

    // Time of day match
    if (pattern.contextType === 'time_of_day') {
      totalFactors++;
      const currentTimeSlot = this.getTimeSlot(currentContext.timeOfDay);
      if (currentTimeSlot === contextData.timeSlot) {
        matchScore += 1;
      } else {
        // Partial match for adjacent time slots
        matchScore += this.getTimeSlotSimilarity(currentTimeSlot, contextData.timeSlot);
      }
    }

    // Weather match
    if (pattern.contextType === 'weather' && currentContext.environment?.weather) {
      totalFactors++;
      const currentWeather = currentContext.environment.weather;
      if (currentWeather.condition === contextData.condition) {
        matchScore += 0.7;
      }
      const currentTempRange = this.getTemperatureRange(currentWeather.temperature);
      if (currentTempRange === contextData.temperatureRange) {
        matchScore += 0.3;
      }
    }

    // Calendar match
    if (pattern.contextType === 'calendar' && currentContext.environment?.calendarEvents) {
      totalFactors++;
      const hasMatchingEventType = currentContext.environment.calendarEvents.some(
        event => event.type === contextData.eventType
      );
      if (hasMatchingEventType) {
        matchScore += 1;
      }
    }

    return totalFactors > 0 ? matchScore / totalFactors : 0;
  }

  /**
   * Helper methods
   */
  private getLocationKey(location: LocationContext): string {
    if (location.placeName) {
      return location.placeName;
    }
    if (location.latitude && location.longitude) {
      // Round to ~100m precision
      const lat = Math.round(location.latitude * 1000) / 1000;
      const lng = Math.round(location.longitude * 1000) / 1000;
      return `${lat},${lng}`;
    }
    return location.address || 'unknown';
  }

  private getTimeSlot(hour: number): string {
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 21) return 'evening';
    return 'night';
  }

  private getTemperatureRange(temp: number): string {
    if (temp < 0) return 'freezing';
    if (temp < 10) return 'cold';
    if (temp < 20) return 'cool';
    if (temp < 30) return 'warm';
    return 'hot';
  }

  private calculateCategoryFrequency(tasks: Task[]): Record<string, number> {
    const frequency: Record<string, number> = {};
    for (const task of tasks) {
      const category = task.category || 'Uncategorized';
      frequency[category] = (frequency[category] || 0) + 1;
    }
    return frequency;
  }

  private calculateLocationConfidence(locationTasks: Task[], totalTasks: number): number {
    const frequency = locationTasks.length / totalTasks;
    const consistency = this.calculateConsistency(locationTasks);
    const recency = this.calculateRecency(locationTasks);
    
    return (frequency * 0.4 + consistency * 0.4 + recency * 0.2);
  }

  private calculateTimeConfidence(timeTasks: Task[], categoryTasks: Task[]): number {
    if (categoryTasks.length === 0) return 0;
    
    const frequency = timeTasks.length / categoryTasks.length;
    const consistency = this.calculateConsistency(timeTasks);
    const recency = this.calculateRecency(timeTasks);
    
    return (frequency * 0.4 + consistency * 0.4 + recency * 0.2);
  }

  private calculateWeatherConfidence(weatherTasks: Task[], totalTasks: number): number {
    const frequency = weatherTasks.length / totalTasks;
    const consistency = this.calculateConsistency(weatherTasks);
    
    return (frequency * 0.6 + consistency * 0.4);
  }

  private calculateCalendarConfidence(calendarTasks: Task[], totalTasks: number): number {
    const frequency = calendarTasks.length / totalTasks;
    const consistency = this.calculateConsistency(calendarTasks);
    
    return (frequency * 0.6 + consistency * 0.4);
  }

  private calculateConsistency(tasks: Task[]): number {
    if (tasks.length < 2) return 1;
    
    // Calculate time variance between task completions
    const times = tasks.map(t => new Date(t.completed_at!).getTime());
    times.sort((a, b) => a - b);
    
    const intervals: number[] = [];
    for (let i = 1; i < times.length; i++) {
      intervals.push(times[i] - times[i - 1]);
    }
    
    const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    const variance = intervals.reduce((sum, interval) => 
      sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length;
    
    // Normalize variance (lower variance = higher consistency)
    const maxVariance = avgInterval * avgInterval; // Assume max variance is avg^2
    return Math.max(0, 1 - Math.sqrt(variance) / Math.sqrt(maxVariance));
  }

  private calculateRecency(tasks: Task[]): number {
    if (tasks.length === 0) return 0;
    
    const now = Date.now();
    const mostRecent = Math.max(...tasks.map(t => new Date(t.completed_at!).getTime()));
    const daysAgo = (now - mostRecent) / (1000 * 60 * 60 * 24);
    
    // Exponential decay with 30-day half-life
    return Math.exp(-daysAgo / 30);
  }

  private calculateEffectiveness(tasks: Task[]): number {
    // For now, assume all completed tasks are effective
    // This could be enhanced with user feedback
    return 1.0;
  }

  private calculateAverageHour(tasks: Task[]): number {
    const hours = tasks
      .filter(t => t.completed_at)
      .map(t => new Date(t.completed_at!).getHours());
    
    return hours.reduce((sum, hour) => sum + hour, 0) / hours.length;
  }

  private calculateDistance(loc1: LocationContext, loc2: LocationContext): number {
    if (!loc1.latitude || !loc1.longitude || !loc2.latitude || !loc2.longitude) {
      return Infinity;
    }
    
    const R = 6371e3; // Earth's radius in meters
    const φ1 = loc1.latitude * Math.PI / 180;
    const φ2 = loc2.latitude * Math.PI / 180;
    const Δφ = (loc2.latitude - loc1.latitude) * Math.PI / 180;
    const Δλ = (loc2.longitude - loc1.longitude) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }

  private getTimeSlotSimilarity(slot1: string, slot2: string): number {
    const slots = ['night', 'morning', 'afternoon', 'evening'];
    const index1 = slots.indexOf(slot1);
    const index2 = slots.indexOf(slot2);
    
    if (index1 === -1 || index2 === -1) return 0;
    
    const distance = Math.min(
      Math.abs(index1 - index2),
      4 - Math.abs(index1 - index2) // Circular distance
    );
    
    return Math.max(0, 1 - distance / 2);
  }

  private generateTaskTitle(category: string, contextData: any): string {
    // Generate contextually relevant task titles
    const templates = {
      'Work': ['Review emails', 'Prepare for meeting', 'Update project status'],
      'Personal': ['Call family', 'Plan weekend', 'Organize photos'],
      'Health': ['Take vitamins', 'Drink water', 'Stretch'],
      'Shopping': ['Buy groceries', 'Pick up prescription', 'Get gas']
    };
    
    const categoryTemplates = templates[category as keyof typeof templates] || ['Complete task'];
    return categoryTemplates[Math.floor(Math.random() * categoryTemplates.length)];
  }

  private generateReasoning(pattern: UserPattern, contextMatch: number): string {
    const contextType = pattern.contextType;
    const matchPercent = Math.round(contextMatch * 100);
    
    switch (contextType) {
      case 'location':
        return `You often complete ${pattern.associatedTasks.join(', ')} tasks at this location (${matchPercent}% match)`;
      case 'time_of_day':
        return `Based on your ${pattern.pattern_data.timeSlot} routine (${matchPercent}% match)`;
      case 'weather':
        return `You tend to do these tasks in ${pattern.pattern_data.condition} weather (${matchPercent}% match)`;
      case 'calendar':
        return `Often done around ${pattern.pattern_data.eventType} events (${matchPercent}% match)`;
      default:
        return `Based on your patterns (${matchPercent}% match)`;
    }
  }

  private determinePriority(confidence: number): 'low' | 'medium' | 'high' {
    if (confidence > 0.7) return 'high';
    if (confidence > 0.4) return 'medium';
    return 'low';
  }

  private estimateDuration(category: string, contextData: any): number {
    // Rough estimates in minutes
    const durations = {
      'Work': 30,
      'Personal': 15,
      'Health': 10,
      'Shopping': 45,
      'Exercise': 60
    };
    
    return durations[category as keyof typeof durations] || 20;
  }

  /**
   * Store contextual patterns in database
   */
  private async storeContextualPatterns(userId: string, patterns: ContextualPattern[]): Promise<void> {
    for (const pattern of patterns) {
      const userPattern: Omit<UserPattern, 'created_at' | 'updated_at'> = {
        id: pattern.id,
        user_id: userId,
        pattern_type: 'contextual',
        pattern_data: {
          contextType: pattern.contextType,
          contextData: pattern.contextData,
          effectiveness: pattern.effectiveness
        },
        confidence: pattern.confidence,
        frequency: pattern.frequency,
        last_occurrence: DatabaseUtils.formatDate(pattern.lastOccurrence),
        next_predicted: undefined
      };
      
      await PatternDatabaseUtils.upsertUserPattern(userPattern);
    }
  }
}

// Export singleton instance
export const contextualPatternService = new ContextualPatternService();