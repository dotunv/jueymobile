import { supabase, isAuthError } from '../supabase';
import { Task, TaskCreateInput, TaskUpdateInput } from '../types';

export class SupabaseTaskService {
  /**
   * Fetch all tasks for a user
   */
  static async getTasks(userId: string): Promise<Task[]> {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (error) {
        // Handle refresh token errors
        if (isAuthError(error)) {
          console.error('Authentication error:', error);
          throw new Error('Authentication failed. Please sign in again.');
        }
        throw error;
      }
      return data as Task[];
    } catch (error: any) {
      console.error('Error fetching tasks:', error);
      throw error;
    }
  }

  /**
   * Create a new task
   */
  static async createTask(userId: string, input: TaskCreateInput): Promise<Task> {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert([{ ...input, user_id: userId }])
        .select()
        .single();
      
      if (error) {
        // Handle refresh token errors
        if (isAuthError(error)) {
          console.error('Authentication error:', error);
          throw new Error('Authentication failed. Please sign in again.');
        }
        throw error;
      }
      return data as Task;
    } catch (error: any) {
      console.error('Error creating task:', error);
      throw error;
    }
  }

  /**
   * Update a task
   */
  static async updateTask(taskId: string, updates: TaskUpdateInput): Promise<Task> {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', taskId)
        .select()
        .single();
      
      if (error) {
        // Handle refresh token errors
        if (isAuthError(error)) {
          console.error('Authentication error:', error);
          throw new Error('Authentication failed. Please sign in again.');
        }
        throw error;
      }
      return data as Task;
    } catch (error: any) {
      console.error('Error updating task:', error);
      throw error;
    }
  }

  /**
   * Delete a task
   */
  static async deleteTask(taskId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);
      
      if (error) {
        // Handle refresh token errors
        if (isAuthError(error)) {
          console.error('Authentication error:', error);
          throw new Error('Authentication failed. Please sign in again.');
        }
        throw error;
      }
    } catch (error: any) {
      console.error('Error deleting task:', error);
      throw error;
    }
  }
} 