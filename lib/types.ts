// Database Models
export interface Task {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  completed: boolean;
  completed_at?: string; // ISO date string
  logged_after_completion: boolean; // New field for PRD requirement
  priority: 'low' | 'medium' | 'high';
  category: string;
  tags: string[]; // JSON array of tags
  ai_suggested: boolean;
  reminder_enabled: boolean;
  reminder_time?: string; // ISO date string
  due_date?: string; // ISO date string
  created_at: string; // ISO date string
  updated_at: string; // ISO date string
}

export interface Suggestion {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  category: string;
  confidence: number; // 0-100
  reasoning?: string;
  time_estimate?: string; // e.g., "30 mins", "2 hours"
  priority: 'low' | 'medium' | 'high';
  based_on: string[]; // JSON array of factors
  status: 'pending' | 'accepted' | 'rejected' | 'dismissed';
  created_at: string; // ISO date string
  expires_at?: string; // ISO date string
}

export interface Feedback {
  id: string;
  user_id: string;
  suggestion_id: string;
  feedback_type: 'positive' | 'negative';
  reason?: string;
  created_at: string; // ISO date string
}

export interface UserPreferences {
  user_id: string;
  theme: 'light' | 'dark' | 'system';
  notifications_enabled: boolean;
  ai_suggestions_enabled: boolean;
  smart_reminders_enabled: boolean;
  reminder_frequency: 'hourly' | 'daily' | 'weekly';
  created_at: string; // ISO date string
  updated_at: string; // ISO date string
}

export interface TaskPattern {
  id: string;
  user_id: string;
  pattern_type: 'frequency' | 'time' | 'category' | 'sequence';
  pattern_data: Record<string, any>; // JSON object with pattern details
  confidence: number; // 0-100
  last_updated: string; // ISO date string
  created_at: string; // ISO date string
}

// API Models (for Supabase integration)
export interface TaskCreateInput {
  title: string;
  description?: string;
  completed?: boolean;
  completed_at?: string;
  logged_after_completion?: boolean;
  priority?: 'low' | 'medium' | 'high';
  category?: string;
  tags?: string[];
  ai_suggested?: boolean;
  reminder_enabled?: boolean;
  reminder_time?: string;
  due_date?: string;
}

export interface TaskUpdateInput {
  title?: string;
  description?: string;
  completed?: boolean;
  completed_at?: string;
  logged_after_completion?: boolean;
  priority?: 'low' | 'medium' | 'high';
  category?: string;
  tags?: string[];
  ai_suggested?: boolean;
  reminder_enabled?: boolean;
  reminder_time?: string;
  due_date?: string;
}

export interface SuggestionCreateInput {
  title: string;
  description?: string;
  category: string;
  confidence: number;
  reasoning?: string;
  time_estimate?: string;
  priority?: 'low' | 'medium' | 'high';
  based_on: string[];
  expires_at?: string;
}

export interface FeedbackCreateInput {
  suggestion_id: string;
  feedback_type: 'positive' | 'negative';
  reason?: string;
}

// UI Models (for React components)
export interface TaskListItem {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  completed_at?: string;
  logged_after_completion: boolean;
  priority: 'low' | 'medium' | 'high';
  category: string;
  tags: string[];
  ai_suggested: boolean;
  reminder_enabled: boolean;
  reminder_time?: string;
  due_date?: string;
  created_at: string;
  updated_at: string;
  // Computed fields for UI
  timeAgo?: string; // e.g., "2 hours ago"
  isOverdue?: boolean;
  isDueToday?: boolean;
}

export interface SuggestionListItem {
  id: string;
  title: string;
  description?: string;
  category: string;
  confidence: number;
  reasoning?: string;
  time_estimate?: string;
  priority: 'low' | 'medium' | 'high';
  based_on: string[];
  status: 'pending' | 'accepted' | 'rejected' | 'dismissed';
  created_at: string;
  expires_at?: string;
  // Computed fields for UI
  timeAgo?: string;
  isExpired?: boolean;
}

// Analytics Models
export interface TaskAnalytics {
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  completionRate: number; // 0-100
  averageTasksPerDay: number;
  mostProductiveDay: string;
  mostCommonCategory: string;
  averageCompletionTime: number; // in minutes
}

export interface CategoryAnalytics {
  category: string;
  totalTasks: number;
  completedTasks: number;
  completionRate: number;
  averagePriority: number; // 1-3 (low=1, medium=2, high=3)
}

export interface TimeAnalytics {
  date: string;
  tasks: number;
  completed: number;
  completionRate: number;
}

// Pattern Analysis Models
export interface FrequencyPattern {
  taskTitle: string;
  frequency: number; // times per week/month
  lastCompleted: string;
  nextExpected: string;
  confidence: number;
}

export interface TimePattern {
  taskTitle: string;
  preferredTime: string; // HH:MM format
  preferredDay: string; // day of week
  confidence: number;
}

export interface CategoryPattern {
  category: string;
  frequency: number;
  preferredTime?: string;
  preferredDay?: string;
  confidence: number;
}

// Reminder Models
export interface Reminder {
  id: string;
  task_id: string;
  user_id: string;
  title: string;
  scheduled_time: string; // ISO date string
  notification_id?: string;
  status: 'pending' | 'sent' | 'dismissed' | 'snoozed';
  created_at: string;
}

export interface ReminderCreateInput {
  task_id: string;
  title: string;
  scheduled_time: string;
}

// Offline Queue Models
export interface OfflineQueueItem {
  id: string;
  action: 'create' | 'update' | 'delete';
  entity: 'task' | 'suggestion' | 'feedback' | 'reminder';
  data: any;
  timestamp: number;
  retry_count: number;
  max_retries: number;
}

// Storage Models
export interface CachedData {
  tasks: TaskListItem[];
  suggestions: SuggestionListItem[];
  analytics: TaskAnalytics;
  lastSync: number; // timestamp
}

export interface UserSettings {
  theme: 'light' | 'dark' | 'system';
  language: string;
  notifications: boolean;
  aiSuggestions: boolean;
  smartReminders: boolean;
  reminderFrequency: 'hourly' | 'daily' | 'weekly';
}

// API Response Models
export interface ApiResponse<T> {
  data: T;
  error?: string;
  success: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Filter and Search Models
export interface TaskFilters {
  status?: 'all' | 'completed' | 'pending';
  priority?: 'all' | 'low' | 'medium' | 'high';
  category?: string;
  tags?: string[];
  dateRange?: {
    start: string;
    end: string;
  };
  aiSuggested?: boolean;
}

export interface SearchOptions {
  query: string;
  filters: TaskFilters;
  sortBy?: 'created_at' | 'updated_at' | 'priority' | 'due_date';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

// Error Models
export interface AppError {
  code: string;
  message: string;
  details?: any;
  timestamp: number;
}

// Navigation Models
export interface NavigationParams {
  taskId?: string;
  suggestionId?: string;
  category?: string;
  filter?: string;
  mode?: 'create' | 'edit' | 'view';
}

// Feature Flag Models
export interface FeatureFlags {
  aiSuggestions: boolean;
  smartReminders: boolean;
  advancedAnalytics: boolean;
  offlineMode: boolean;
  voiceInput: boolean;
  naturalLanguageParsing: boolean;
}

// Session Models
export interface UserSession {
  id: string;
  user_id: string;
  created_at: string;
  last_activity: string;
  device_info: {
    platform: string;
    version: string;
    model?: string;
  };
}

// Export all types
export type {
  Task,
  Suggestion,
  Feedback,
  UserPreferences,
  TaskPattern,
  TaskCreateInput,
  TaskUpdateInput,
  SuggestionCreateInput,
  FeedbackCreateInput,
  TaskListItem,
  SuggestionListItem,
  TaskAnalytics,
  CategoryAnalytics,
  TimeAnalytics,
  FrequencyPattern,
  TimePattern,
  CategoryPattern,
  Reminder,
  ReminderCreateInput,
  OfflineQueueItem,
  CachedData,
  UserSettings,
  ApiResponse,
  PaginatedResponse,
  TaskFilters,
  SearchOptions,
  AppError,
  NavigationParams,
  FeatureFlags,
  UserSession,
}; 