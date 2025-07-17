// Adaptive Reminder Service for Smart Task Logger
// Implements context-aware, learning reminders per design.md, requirements.md, tasks.md

import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { Task } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { differenceInMinutes, isSameDay } from 'date-fns';
// Import or define these types as needed in your codebase
// import { UserContext, ReminderPreferences, ScheduledReminder, ReminderFeedback, ReminderType, ReminderContext, AdaptiveFactor, EffectivenessPrediction, ReminderPattern, UserBehavior, OptimalTiming, AvailabilityPrediction, TimeWindow } from '../types';

// --- Type Stubs (replace with your actual types as needed) ---
export type ReminderType = 'time_based' | 'location_based' | 'context_based' | 'adaptive';
export interface ReminderPreferences {
  type: ReminderType;
  time?: Date;
  location?: {
    latitude: number;
    longitude: number;
    radius: number;
    placeName?: string;
  };
  adaptive?: boolean;
}
export interface ScheduledReminder {
  id: string;
  taskId: string;
  userId: string;
  scheduledTime: Date;
  reminderType: ReminderType;
  context: ReminderContext;
  adaptiveFactors: AdaptiveFactor[];
}
export interface ReminderContext {
  location?: {
    latitude: number;
    longitude: number;
    radius: number;
    placeName?: string;
  };
  device?: string;
  activity?: string;
  [key: string]: any;
}
export interface AdaptiveFactor {
  type: string;
  value: any;
}
export interface ReminderFeedback {
  action: 'snooze' | 'dismiss' | 'done' | 'skip';
  timestamp: Date;
  userId: string;
  reminderId: string;
  additionalData?: any;
}
export interface EffectivenessPrediction {
  probability: number;
  reason?: string;
}
export interface ReminderPattern {
  patternType: string;
  confidence: number;
  metadata: any;
}
export interface UserBehavior {
  snoozeCount: number;
  dismissCount: number;
  completionCount: number;
  lastAction: string;
}
export interface OptimalTiming {
  time: Date;
  confidence: number;
}
export interface AvailabilityPrediction {
  available: boolean;
  reason?: string;
}
export interface TimeWindow {
  start: Date;
  end: Date;
}
export interface UserContext {
  currentTime: Date;
  location?: {
    latitude: number;
    longitude: number;
  };
  recentTasks: Task[];
  deviceContext?: any;
  calendarEvents?: any[];
}

// --- Reminder Engine ---
class ReminderEngine {
  // Schedule a reminder (time, location, or adaptive)
  async scheduleReminder(
    task: Task,
    preferences: ReminderPreferences,
    userId: string
  ): Promise<ScheduledReminder> {
    let scheduledTime = preferences.time || new Date();
    let reminderType: ReminderType = preferences.type;
    let context: ReminderContext = {};
    let adaptiveFactors: AdaptiveFactor[] = [];

    // Time-based reminder
    if (reminderType === 'time_based') {
      const st = scheduledTime;
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `Task Reminder: ${task.title}`,
          body: task.description || '',
          data: { taskId: task.id },
        },
        trigger: {
          year: st.getFullYear(),
          month: st.getMonth() + 1,
          day: st.getDate(),
          hour: st.getHours(),
          minute: st.getMinutes(),
          second: st.getSeconds(),
          repeats: false,
        } as any,
      });
      context = { ...context, scheduledTime };
    }

    // Location-based reminder
    if (reminderType === 'location_based' && preferences.location) {
      // Use Expo Location geofencing
      const region = {
        identifier: `reminder-${task.id}`,
        latitude: preferences.location.latitude,
        longitude: preferences.location.longitude,
        radius: preferences.location.radius,
        notifyOnEnter: true,
        notifyOnExit: false,
      };
      // Register geofence
      await Location.startGeofencingAsync(`reminder-${task.id}`, [region]);
      // Listen for geofence event elsewhere in the app and schedule notification when entering region
      context = { ...context, location: preferences.location };
    }

    // Adaptive reminder (uses learning)
    if (reminderType === 'adaptive' || preferences.adaptive) {
      // Use ReminderOptimizer to determine optimal time/context
      const userContext: UserContext = {
        currentTime: new Date(),
        recentTasks: [], // Could be filled from task store
      };
      const optimalTime = await reminderOptimizer.calculateOptimalTiming(task, userContext);
      scheduledTime = optimalTime;
      adaptiveFactors.push({ type: 'optimized', value: optimalTime });
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `Task Reminder: ${task.title}`,
          body: task.description || '',
          data: { taskId: task.id },
        },
        trigger: {
          year: optimalTime.getFullYear(),
          month: optimalTime.getMonth() + 1,
          day: optimalTime.getDate(),
          hour: optimalTime.getHours(),
          minute: optimalTime.getMinutes(),
          second: optimalTime.getSeconds(),
          repeats: false,
        } as any,
      });
      context = { ...context, scheduledTime: optimalTime };
    }

    // Generate a unique reminder ID (replace with your own ID logic)
    const reminderId = `${task.id}_${Date.now()}`;

    // Return the scheduled reminder object
    return {
      id: reminderId,
      taskId: task.id,
      userId,
      scheduledTime,
      reminderType,
      context,
      adaptiveFactors,
    };
  }

  // Optimize reminder timing based on user patterns
  async optimizeReminderTiming(userId: string, taskType: string): Promise<OptimalTiming> {
    // Analyze user patterns, completion history, and context
    // Use AsyncStorage to get completion times
    const completionsRaw = await AsyncStorage.getItem(`reminder_completions_${userId}`);
    const completions: number[] = completionsRaw ? JSON.parse(completionsRaw) : [];
    if (completions.length === 0) {
      // Default: next day at 9am
      const now = new Date();
      const next9am = new Date(now);
      next9am.setDate(now.getDate() + 1);
      next9am.setHours(9, 0, 0, 0);
      return { time: next9am, confidence: 0.5 };
    }
    // Find most common hour
    const hours = completions.map(ts => new Date(ts).getHours());
    const hourCounts: Record<number, number> = {};
    hours.forEach(h => { hourCounts[h] = (hourCounts[h] || 0) + 1; });
    const bestHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0][0];
    const now = new Date();
    const next = new Date(now);
    next.setDate(now.getDate() + 1);
    next.setHours(Number(bestHour), 0, 0, 0);
    return { time: next, confidence: 0.8 };
  }

  // Adapt to user feedback (learning loop)
  async adaptToUserFeedback(reminderId: string, feedback: ReminderFeedback): Promise<void> {
    // Store feedback in AsyncStorage
    const key = `reminder_feedback_${feedback.userId}`;
    const raw = await AsyncStorage.getItem(key);
    const feedbacks = raw ? JSON.parse(raw) : [];
    feedbacks.push(feedback);
    await AsyncStorage.setItem(key, JSON.stringify(feedbacks));
    // Optionally update in-memory model or trigger analytics
    // (Extension point for ML)
  }

  // Predict reminder effectiveness
  async predictReminderEffectiveness(reminder: ScheduledReminder): Promise<EffectivenessPrediction> {
    // Use heuristic: if user often completes reminders at this hour, increase probability
    const completionsRaw = await AsyncStorage.getItem(`reminder_completions_${reminder.userId}`);
    const completions: number[] = completionsRaw ? JSON.parse(completionsRaw) : [];
    if (completions.length === 0) return { probability: 0.5, reason: 'No data' };
    const hour = reminder.scheduledTime.getHours();
    const hourMatches = completions.filter(ts => new Date(ts).getHours() === hour).length;
    const prob = Math.min(1, 0.5 + hourMatches / (2 * completions.length));
    return { probability: prob, reason: `Based on ${hourMatches} completions at this hour` };
  }
}

// --- Reminder Optimizer ---
class ReminderOptimizer {
  // Analyze reminder patterns for a user
  async analyzeReminderPatterns(userId: string): Promise<ReminderPattern[]> {
    // Aggregate feedback and completion data
    const completionsRaw = await AsyncStorage.getItem(`reminder_completions_${userId}`);
    const completions: number[] = completionsRaw ? JSON.parse(completionsRaw) : [];
    const feedbackRaw = await AsyncStorage.getItem(`reminder_feedback_${userId}`);
    const feedbacks: ReminderFeedback[] = feedbackRaw ? JSON.parse(feedbackRaw) : [];
    // Find most common hour
    const hours = completions.map(ts => new Date(ts).getHours());
    const hourCounts: Record<number, number> = {};
    hours.forEach(h => { hourCounts[h] = (hourCounts[h] || 0) + 1; });
    const bestHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 9;
    // Snooze rate
    const snoozeCount = feedbacks.filter(f => f.action === 'snooze').length;
    const total = feedbacks.length;
    const snoozeRate = total ? snoozeCount / total : 0;
    return [
      { patternType: 'morning', confidence: 0.7, metadata: { typicalHour: bestHour, snoozeRate } },
    ];
  }

  // Calculate optimal timing for a task and context
  async calculateOptimalTiming(task: Task, userContext: UserContext): Promise<Date> {
    // Use userContext, task history, and completions to determine best time
    const completionsRaw = await AsyncStorage.getItem(`reminder_completions_${task.user_id}`);
    const completions: number[] = completionsRaw ? JSON.parse(completionsRaw) : [];
    if (completions.length === 0) {
      // Default: next day at 9am
      const now = new Date();
      const next9am = new Date(now);
      next9am.setDate(now.getDate() + 1);
      next9am.setHours(9, 0, 0, 0);
      return next9am;
    }
    // Find most common hour
    const hours = completions.map(ts => new Date(ts).getHours());
    const hourCounts: Record<number, number> = {};
    hours.forEach(h => { hourCounts[h] = (hourCounts[h] || 0) + 1; });
    const bestHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0][0];
    const now = new Date();
    const next = new Date(now);
    next.setDate(now.getDate() + 1);
    next.setHours(Number(bestHour), 0, 0, 0);
    return next;
  }

  // Adjust reminder for user behavior
  async adjustForUserBehavior(reminder: ScheduledReminder, behavior: UserBehavior): Promise<ScheduledReminder> {
    // If snoozed > 3 times, move to afternoon
    if (behavior.snoozeCount > 3) {
      const newTime = new Date(reminder.scheduledTime);
      newTime.setHours(15, 0, 0, 0); // 3pm
      return { ...reminder, scheduledTime: newTime };
    }
    // If dismissed > 3 times, move to morning
    if (behavior.dismissCount > 3) {
      const newTime = new Date(reminder.scheduledTime);
      newTime.setHours(9, 0, 0, 0); // 9am
      return { ...reminder, scheduledTime: newTime };
    }
    return reminder;
  }

  // Predict user availability in a time window
  async predictUserAvailability(userId: string, timeWindow: TimeWindow): Promise<AvailabilityPrediction> {
    // Check for busy times using stored calendar events (if available)
    const eventsRaw = await AsyncStorage.getItem(`calendar_events_${userId}`);
    const events: { start: string; end: string }[] = eventsRaw ? JSON.parse(eventsRaw) : [];
    const busy = events.some(ev => {
      const start = new Date(ev.start);
      const end = new Date(ev.end);
      return (
        (timeWindow.start >= start && timeWindow.start < end) ||
        (timeWindow.end > start && timeWindow.end <= end)
      );
    });
    return { available: !busy, reason: busy ? 'Busy in calendar' : undefined };
  }
}

// --- Exported Singleton Service ---
export const reminderEngine = new ReminderEngine();
export const reminderOptimizer = new ReminderOptimizer();

// --- Usage Example (remove in production) ---
// reminderEngine.scheduleReminder(task, preferences, userId);
// reminderEngine.adaptToUserFeedback(reminderId, feedback);
// reminderOptimizer.analyzeReminderPatterns(userId);

// --- UI Compatibility: scheduleAdaptiveReminder ---
/**
 * Schedules a time-based reminder for a task, as expected by the UI.
 * @param userId The user ID
 * @param task The task object (should have reminder_time and id/title/description)
 */
export async function scheduleAdaptiveReminder(userId: string, task: any): Promise<void> {
  try {
    if (!task.reminder_time) throw new Error('No reminder_time specified');
    await reminderEngine.scheduleReminder(
      task,
      {
        type: 'time_based',
        time: new Date(task.reminder_time),
      },
      userId
    );
  } catch (err) {
    console.error('Failed to schedule adaptive reminder:', err);
  }
}