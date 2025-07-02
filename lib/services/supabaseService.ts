import { supabase } from '../supabase';
import { Task, TaskCreateInput, TaskUpdateInput } from '../types';

export class SupabaseTaskService {
  /**
   * Fetch all tasks for a user
   */
  static async getTasks(userId: string): Promise<Task[]> {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data as Task[];
  }

  /**
   * Create a new task
   */
  static async createTask(userId: string, input: TaskCreateInput): Promise<Task> {
    const { data, error } = await supabase
      .from('tasks')
      .insert([{ ...input, user_id: userId }])
      .select()
      .single();
    if (error) throw error;
    return data as Task;
  }

  /**
   * Update a task
   */
  static async updateTask(taskId: string, updates: TaskUpdateInput): Promise<Task> {
    const { data, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', taskId)
      .select()
      .single();
    if (error) throw error;
    return data as Task;
  }

  /**
   * Delete a task
   */
  static async deleteTask(taskId: string): Promise<void> {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId);
    if (error) throw error;
  }
} 