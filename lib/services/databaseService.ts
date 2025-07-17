import { getDatabase, DatabaseUtils } from '../database';
import { 
  Task, 
  Suggestion, 
  Feedback, 
  UserPreferences, 
  TaskPattern,
  TaskCreateInput,
  TaskUpdateInput,
  SuggestionCreateInput,
  FeedbackCreateInput
} from '../types';
import { usePermissionsStore } from '@/lib/permissionsStore';
import PermissionPrompt from '@/components/PermissionPrompt';
import React, { useState } from 'react';

/**
 * Database service for handling all database operations
 */
export class DatabaseService {
  /**
   * Task Operations
   */
  static async createTask(userId: string, taskData: TaskCreateInput): Promise<Task> {
    const db = await getDatabase();
    const id = DatabaseUtils.generateId();
    const now = DatabaseUtils.formatDate(new Date());
    
    const task: Task = {
      id,
      user_id: userId,
      title: taskData.title,
      description: taskData.description,
      completed: taskData.completed || false,
      completed_at: taskData.completed_at,
      logged_after_completion: taskData.logged_after_completion || false,
      priority: taskData.priority || 'medium',
      category: taskData.category || 'Personal',
      tags: taskData.tags || [],
      ai_suggested: taskData.ai_suggested || false,
      reminder_enabled: taskData.reminder_enabled || false,
      reminder_time: taskData.reminder_time,
      due_date: taskData.due_date,
      created_at: now,
      updated_at: now,
    };

    await db.runAsync(`
      INSERT INTO tasks (
        id, user_id, title, description, completed, completed_at, 
        logged_after_completion, priority, category, tags, ai_suggested,
        reminder_enabled, reminder_time, due_date, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      task.id, task.user_id, task.title, task.description, task.completed,
      task.completed_at, task.logged_after_completion, task.priority,
      task.category, DatabaseUtils.serializeJSON(task.tags), task.ai_suggested,
      task.reminder_enabled, task.reminder_time, task.due_date,
      task.created_at, task.updated_at
    ]);

    return task;
  }

  static async getTask(taskId: string): Promise<Task | null> {
    const db = await getDatabase();
    const result = await db.getFirstAsync<Task>('SELECT * FROM tasks WHERE id = ?', [taskId]);
    
    if (!result) return null;
    
    return {
      ...result,
      tags: DatabaseUtils.deserializeJSON(result.tags) || [],
    };
  }

  static async getTasks(userId: string, filters?: {
    completed?: boolean;
    category?: string;
    priority?: string;
    aiSuggested?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<Task[]> {
    const db = await getDatabase();
    
    let query = 'SELECT * FROM tasks WHERE user_id = ?';
    const params: any[] = [userId];
    
    if (filters?.completed !== undefined) {
      query += ' AND completed = ?';
      params.push(filters.completed);
    }
    
    if (filters?.category) {
      query += ' AND category = ?';
      params.push(filters.category);
    }
    
    if (filters?.priority) {
      query += ' AND priority = ?';
      params.push(filters.priority);
    }
    
    if (filters?.aiSuggested !== undefined) {
      query += ' AND ai_suggested = ?';
      params.push(filters.aiSuggested);
    }
    
    query += ' ORDER BY created_at DESC';
    
    if (filters?.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }
    
    if (filters?.offset) {
      query += ' OFFSET ?';
      params.push(filters.offset);
    }
    
    const results = await db.getAllAsync<Task>(query, params);
    
    return results.map(task => ({
      ...task,
      tags: DatabaseUtils.deserializeJSON(task.tags) || [],
    }));
  }

  static async updateTask(taskId: string, updates: TaskUpdateInput): Promise<Task | null> {
    const db = await getDatabase();
    const now = DatabaseUtils.formatDate(new Date());
    
    const setClauses: string[] = [];
    const params: any[] = [];
    
    if (updates.title !== undefined) {
      setClauses.push('title = ?');
      params.push(updates.title);
    }
    
    if (updates.description !== undefined) {
      setClauses.push('description = ?');
      params.push(updates.description);
    }
    
    if (updates.completed !== undefined) {
      setClauses.push('completed = ?');
      params.push(updates.completed);
    }
    
    if (updates.completed_at !== undefined) {
      setClauses.push('completed_at = ?');
      params.push(updates.completed_at);
    }
    
    if (updates.logged_after_completion !== undefined) {
      setClauses.push('logged_after_completion = ?');
      params.push(updates.logged_after_completion);
    }
    
    if (updates.priority !== undefined) {
      setClauses.push('priority = ?');
      params.push(updates.priority);
    }
    
    if (updates.category !== undefined) {
      setClauses.push('category = ?');
      params.push(updates.category);
    }
    
    if (updates.tags !== undefined) {
      setClauses.push('tags = ?');
      params.push(DatabaseUtils.serializeJSON(updates.tags));
    }
    
    if (updates.ai_suggested !== undefined) {
      setClauses.push('ai_suggested = ?');
      params.push(updates.ai_suggested);
    }
    
    if (updates.reminder_enabled !== undefined) {
      setClauses.push('reminder_enabled = ?');
      params.push(updates.reminder_enabled);
    }
    
    if (updates.reminder_time !== undefined) {
      setClauses.push('reminder_time = ?');
      params.push(updates.reminder_time);
    }
    
    if (updates.due_date !== undefined) {
      setClauses.push('due_date = ?');
      params.push(updates.due_date);
    }
    
    setClauses.push('updated_at = ?');
    params.push(now);
    
    params.push(taskId);
    
    const result = await db.runAsync(
      `UPDATE tasks SET ${setClauses.join(', ')} WHERE id = ?`,
      params
    );
    
    if (result.changes === 0) {
      return null;
    }
    
    return await this.getTask(taskId);
  }

  static async deleteTask(taskId: string): Promise<boolean> {
    const db = await getDatabase();
    const result = await db.runAsync('DELETE FROM tasks WHERE id = ?', [taskId]);
    return result.changes > 0;
  }

  static async toggleTaskCompletion(taskId: string): Promise<Task | null> {
    const task = await this.getTask(taskId);
    if (!task) return null;
    
    const now = DatabaseUtils.formatDate(new Date());
    const completed = !task.completed;
    
    return await this.updateTask(taskId, {
      completed,
      completed_at: completed ? now : undefined,
    });
  }

  /**
   * Suggestion Operations
   */
  static async createSuggestion(userId: string, suggestionData: SuggestionCreateInput): Promise<Suggestion> {
    const db = await getDatabase();
    const id = DatabaseUtils.generateId();
    const now = DatabaseUtils.formatDate(new Date());
    
    const suggestion: Suggestion = {
      id,
      user_id: userId,
      title: suggestionData.title,
      description: suggestionData.description,
      category: suggestionData.category,
      confidence: suggestionData.confidence,
      reasoning: suggestionData.reasoning,
      time_estimate: suggestionData.time_estimate,
      priority: suggestionData.priority || 'medium',
      based_on: suggestionData.based_on,
      status: 'pending',
      created_at: now,
      expires_at: suggestionData.expires_at,
    };

    await db.runAsync(`
      INSERT INTO suggestions (
        id, user_id, title, description, category, confidence, reasoning,
        time_estimate, priority, based_on, status, created_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      suggestion.id, suggestion.user_id, suggestion.title, suggestion.description,
      suggestion.category, suggestion.confidence, suggestion.reasoning,
      suggestion.time_estimate, suggestion.priority, DatabaseUtils.serializeJSON(suggestion.based_on),
      suggestion.status, suggestion.created_at, suggestion.expires_at
    ]);

    return suggestion;
  }

  static async getSuggestions(userId: string, status?: string): Promise<Suggestion[]> {
    const db = await getDatabase();
    
    let query = 'SELECT * FROM suggestions WHERE user_id = ?';
    const params: any[] = [userId];
    
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY created_at DESC';
    
    const results = await db.getAllAsync<Suggestion>(query, params);
    
    return results.map(suggestion => ({
      ...suggestion,
      based_on: DatabaseUtils.deserializeJSON(suggestion.based_on) || [],
    }));
  }

  static async updateSuggestionStatus(suggestionId: string, status: string): Promise<Suggestion | null> {
    const db = await getDatabase();
    const result = await db.runAsync(
      'UPDATE suggestions SET status = ? WHERE id = ?',
      [status, suggestionId]
    );
    
    if (result.changes === 0) {
      return null;
    }
    
    const suggestion = await db.getFirstAsync<Suggestion>(
      'SELECT * FROM suggestions WHERE id = ?',
      [suggestionId]
    );
    
    if (!suggestion) return null;
    
    return {
      ...suggestion,
      based_on: DatabaseUtils.deserializeJSON(suggestion.based_on) || [],
    };
  }

  /**
   * Feedback Operations
   */
  static async createFeedback(userId: string, feedbackData: FeedbackCreateInput): Promise<Feedback> {
    const db = await getDatabase();
    const id = DatabaseUtils.generateId();
    const now = DatabaseUtils.formatDate(new Date());
    
    const feedback: Feedback = {
      id,
      user_id: userId,
      suggestion_id: feedbackData.suggestion_id,
      feedback_type: feedbackData.feedback_type,
      reason: feedbackData.reason,
      created_at: now,
    };

    await db.runAsync(`
      INSERT INTO feedback (id, user_id, suggestion_id, feedback_type, reason, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      feedback.id, feedback.user_id, feedback.suggestion_id,
      feedback.feedback_type, feedback.reason, feedback.created_at
    ]);

    return feedback;
  }

  static async getFeedbackForSuggestion(suggestionId: string): Promise<Feedback[]> {
    const db = await getDatabase();
    return await db.getAllAsync<Feedback>(
      'SELECT * FROM feedback WHERE suggestion_id = ? ORDER BY created_at DESC',
      [suggestionId]
    );
  }

  /**
   * User Preferences Operations
   */
  static async getUserPreferences(userId: string): Promise<UserPreferences | null> {
    const db = await getDatabase();
    return await db.getFirstAsync<UserPreferences>(
      'SELECT * FROM user_preferences WHERE user_id = ?',
      [userId]
    );
  }

  static async createUserPreferences(userId: string, preferences: Partial<UserPreferences>): Promise<UserPreferences> {
    const db = await getDatabase();
    const now = DatabaseUtils.formatDate(new Date());
    
    const userPrefs: UserPreferences = {
      user_id: userId,
      theme: preferences.theme || 'system',
      notifications_enabled: preferences.notifications_enabled ?? true,
      ai_suggestions_enabled: preferences.ai_suggestions_enabled ?? true,
      smart_reminders_enabled: preferences.smart_reminders_enabled ?? false,
      reminder_frequency: preferences.reminder_frequency || 'daily',
      created_at: now,
      updated_at: now,
    };

    await db.runAsync(`
      INSERT INTO user_preferences (
        user_id, theme, notifications_enabled, ai_suggestions_enabled,
        smart_reminders_enabled, reminder_frequency, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      userPrefs.user_id, userPrefs.theme, userPrefs.notifications_enabled,
      userPrefs.ai_suggestions_enabled, userPrefs.smart_reminders_enabled,
      userPrefs.reminder_frequency, userPrefs.created_at, userPrefs.updated_at
    ]);

    return userPrefs;
  }

  static async updateUserPreferences(userId: string, updates: Partial<UserPreferences>): Promise<UserPreferences | null> {
    const db = await getDatabase();
    const now = DatabaseUtils.formatDate(new Date());
    
    const setClauses: string[] = [];
    const params: any[] = [];
    
    if (updates.theme !== undefined) {
      setClauses.push('theme = ?');
      params.push(updates.theme);
    }
    
    if (updates.notifications_enabled !== undefined) {
      setClauses.push('notifications_enabled = ?');
      params.push(updates.notifications_enabled);
    }
    
    if (updates.ai_suggestions_enabled !== undefined) {
      setClauses.push('ai_suggestions_enabled = ?');
      params.push(updates.ai_suggestions_enabled);
    }
    
    if (updates.smart_reminders_enabled !== undefined) {
      setClauses.push('smart_reminders_enabled = ?');
      params.push(updates.smart_reminders_enabled);
    }
    
    if (updates.reminder_frequency !== undefined) {
      setClauses.push('reminder_frequency = ?');
      params.push(updates.reminder_frequency);
    }
    
    setClauses.push('updated_at = ?');
    params.push(now);
    
    params.push(userId);
    
    const result = await db.runAsync(
      `UPDATE user_preferences SET ${setClauses.join(', ')} WHERE user_id = ?`,
      params
    );
    
    if (result.changes === 0) {
      return null;
    }
    
    return await this.getUserPreferences(userId);
  }

  /**
   * Task Pattern Operations (for AI learning)
   */
  static async createTaskPattern(userId: string, pattern: Omit<TaskPattern, 'id' | 'user_id' | 'created_at'>): Promise<TaskPattern> {
    const db = await getDatabase();
    const id = DatabaseUtils.generateId();
    const now = DatabaseUtils.formatDate(new Date());
    
    const taskPattern: TaskPattern = {
      id,
      user_id: userId,
      pattern_type: pattern.pattern_type,
      pattern_data: pattern.pattern_data,
      confidence: pattern.confidence,
      last_updated: pattern.last_updated,
      created_at: now,
    };

    await db.runAsync(`
      INSERT INTO task_patterns (id, user_id, pattern_type, pattern_data, confidence, last_updated, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      taskPattern.id, taskPattern.user_id, taskPattern.pattern_type,
      DatabaseUtils.serializeJSON(taskPattern.pattern_data), taskPattern.confidence,
      taskPattern.last_updated, taskPattern.created_at
    ]);

    return taskPattern;
  }

  static async getTaskPatterns(userId: string, patternType?: string): Promise<TaskPattern[]> {
    const db = await getDatabase();
    
    let query = 'SELECT * FROM task_patterns WHERE user_id = ?';
    const params: any[] = [userId];
    
    if (patternType) {
      query += ' AND pattern_type = ?';
      params.push(patternType);
    }
    
    query += ' ORDER BY last_updated DESC';
    
    const results = await db.getAllAsync<TaskPattern>(query, params);
    
    return results.map(pattern => ({
      ...pattern,
      pattern_data: DatabaseUtils.deserializeJSON(pattern.pattern_data) || {},
    }));
  }

  /**
   * Analytics Operations
   */
  static async getTaskAnalytics(userId: string, startDate?: string, endDate?: string): Promise<{
    totalTasks: number;
    completedTasks: number;
    pendingTasks: number;
    completionRate: number;
    averageTasksPerDay: number;
    mostProductiveDay: string;
    mostCommonCategory: string;
  }> {
    const db = await getDatabase();
    
    let dateFilter = '';
    const params: any[] = [userId];
    
    if (startDate && endDate) {
      dateFilter = ' AND created_at BETWEEN ? AND ?';
      params.push(startDate, endDate);
    }
    
    // Get total tasks
    const totalResult = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM tasks WHERE user_id = ?${dateFilter}`,
      params
    );
    const totalTasks = totalResult?.count || 0;
    
    // Get completed tasks
    const completedResult = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM tasks WHERE user_id = ? AND completed = 1${dateFilter}`,
      params
    );
    const completedTasks = completedResult?.count || 0;
    
    // Get most common category
    const categoryResult = await db.getFirstAsync<{ category: string; count: number }>(
      `SELECT category, COUNT(*) as count FROM tasks WHERE user_id = ?${dateFilter} GROUP BY category ORDER BY count DESC LIMIT 1`,
      params
    );
    const mostCommonCategory = categoryResult?.category || 'Personal';
    
    // Calculate completion rate
    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
    
    // Calculate average tasks per day (simplified)
    const averageTasksPerDay = totalTasks > 0 ? totalTasks / 7 : 0; // Assuming 7 days for now
    
    // Get most productive day (simplified)
    const productiveDayResult = await db.getFirstAsync<{ day: string; count: number }>(
      `SELECT strftime('%w', created_at) as day, COUNT(*) as count 
       FROM tasks WHERE user_id = ? AND completed = 1${dateFilter} 
       GROUP BY day ORDER BY count DESC LIMIT 1`,
      params
    );
    const mostProductiveDay = productiveDayResult?.day || '1'; // 0=Sunday, 1=Monday, etc.
    
    return {
      totalTasks,
      completedTasks,
      pendingTasks: totalTasks - completedTasks,
      completionRate,
      averageTasksPerDay,
      mostProductiveDay,
      mostCommonCategory,
    };
  }

  /**
   * Utility Operations
   */
  static async clearUserData(userId: string): Promise<void> {
    const db = await getDatabase();
    
    await db.runAsync('DELETE FROM tasks WHERE user_id = ?', [userId]);
    await db.runAsync('DELETE FROM suggestions WHERE user_id = ?', [userId]);
    await db.runAsync('DELETE FROM feedback WHERE user_id = ?', [userId]);
    await db.runAsync('DELETE FROM user_preferences WHERE user_id = ?', [userId]);
    await db.runAsync('DELETE FROM task_patterns WHERE user_id = ?', [userId]);
  }

  /**
   * Soft delete all user data by marking as deleted (for recovery).
   * Assumes a 'deleted' boolean column exists on relevant tables.
   * If not, this is a stub and should be implemented after schema update.
   */
  static async softDeleteUserData(userId: string): Promise<void> {
    // Example for tasks table
    try {
      await getDatabase().then(db => db.runAsync('UPDATE tasks SET deleted = 1 WHERE user_id = ?', [userId]));
      await getDatabase().then(db => db.runAsync('UPDATE user_preferences SET deleted = 1 WHERE user_id = ?', [userId]));
      await getDatabase().then(db => db.runAsync('UPDATE suggestions SET deleted = 1 WHERE user_id = ?', [userId]));
      await getDatabase().then(db => db.runAsync('UPDATE feedback SET deleted = 1 WHERE user_id = ?', [userId]));
      // Add more tables as needed
    } catch (e) {
      // If schema does not support 'deleted', this is a stub
      console.warn('Soft delete not fully implemented: missing deleted flag in schema.', e);
    }
  }

  static async getDatabaseStats(): Promise<{
    totalTasks: number;
    totalSuggestions: number;
    totalFeedback: number;
    totalUsers: number;
  }> {
    const db = await getDatabase();
    
    const tasksResult = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM tasks');
    const suggestionsResult = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM suggestions');
    const feedbackResult = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM feedback');
    const usersResult = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM user_preferences');
    
    return {
      totalTasks: tasksResult?.count || 0,
      totalSuggestions: suggestionsResult?.count || 0,
      totalFeedback: feedbackResult?.count || 0,
      totalUsers: usersResult?.count || 0,
    };
  }

  /**
   * Checks export permission and shows PermissionPrompt if not granted.
   * Returns true if granted, false otherwise.
   * Usage: await DatabaseService.checkExportPermissionWithPrompt(setShowPrompt)
   */
  static async checkExportPermissionWithPrompt(showPrompt: (show: boolean) => void): Promise<boolean> {
    const perm = usePermissionsStore.getState().permissions.export;
    if (perm !== 'granted') {
      showPrompt(true);
      return false;
    }
    return true;
  }
} 