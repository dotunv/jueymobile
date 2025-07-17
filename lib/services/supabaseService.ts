import { supabase, isAuthError } from '../supabase';
import { Task, TaskCreateInput, TaskUpdateInput } from '../types';
import { EncryptionUtils } from '../storage';

function isEncryptedField(value: any): boolean {
  // Heuristic: AES ciphertexts are base64 and often end with '='
  return typeof value === 'string' && /^[A-Za-z0-9+/=]+$/.test(value) && value.length > 24;
}

async function encryptTaskFields(input: any): Promise<any> {
  const encrypted: any = { ...input };
  if (input.title) encrypted.title = await EncryptionUtils.encrypt(input.title);
  if (input.description) encrypted.description = await EncryptionUtils.encrypt(input.description);
  // Add more fields as needed
  return encrypted;
}

async function decryptTaskFields(task: any): Promise<any> {
  const decrypted: any = { ...task };
  if (task.title && isEncryptedField(task.title)) {
    try {
      decrypted.title = await EncryptionUtils.decrypt(task.title);
    } catch {
      decrypted.title = '[Encrypted]';
    }
  }
  if (task.description && isEncryptedField(task.description)) {
    try {
      decrypted.description = await EncryptionUtils.decrypt(task.description);
    } catch {
      decrypted.description = '[Encrypted]';
    }
  }
  // Add more fields as needed
  return decrypted;
}

export class SupabaseTaskService {
  /**
   * Fetch all tasks for a user (decrypt fields)
   */
  static async getTasks(userId: string): Promise<Task[]> {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (error) {
        if (isAuthError(error)) {
          console.error('Authentication error:', error);
          throw new Error('Authentication failed. Please sign in again.');
        }
        throw error;
      }
      if (!data) return [];
      // Decrypt all tasks
      const decrypted = await Promise.all(data.map(decryptTaskFields));
      return decrypted as Task[];
    } catch (error: any) {
      console.error('Error fetching tasks:', error);
      throw error;
    }
  }

  /**
   * Fetch a single task by ID (decrypt fields)
   */
  static async getTask(taskId: string): Promise<Task | null> {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .single();
      
      if (error) {
        if (isAuthError(error)) {
          console.error('Authentication error:', error);
          throw new Error('Authentication failed. Please sign in again.');
        }
        throw error;
      }
      if (!data) return null;
      return await decryptTaskFields(data) as Task;
    } catch (error: any) {
      console.error('Error fetching task:', error);
      throw error;
    }
  }

  /**
   * Create a new task (encrypt fields)
   */
  static async createTask(userId: string, input: TaskCreateInput): Promise<Task> {
    try {
      const encryptedInput = await encryptTaskFields({ ...input, user_id: userId });
      const { data, error } = await supabase
        .from('tasks')
        .insert([encryptedInput])
        .select()
        .single();
      
      if (error) {
        if (isAuthError(error)) {
          console.error('Authentication error:', error);
          throw new Error('Authentication failed. Please sign in again.');
        }
        throw error;
      }
      return await decryptTaskFields(data) as Task;
    } catch (error: any) {
      console.error('Error creating task:', error);
      throw error;
    }
  }

  /**
   * Update a task (encrypt fields)
   */
  static async updateTask(taskId: string, updates: TaskUpdateInput): Promise<Task> {
    try {
      const encryptedUpdates = await encryptTaskFields(updates);
      const { data, error } = await supabase
        .from('tasks')
        .update(encryptedUpdates)
        .eq('id', taskId)
        .select()
        .single();
      
      if (error) {
        if (isAuthError(error)) {
          console.error('Authentication error:', error);
          throw new Error('Authentication failed. Please sign in again.');
        }
        throw error;
      }
      return await decryptTaskFields(data) as Task;
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

export { supabase };

/**
 * Uploads an image to Supabase Storage (avatars bucket) and returns the public URL.
 * @param userId The user's ID (used for file path)
 * @param uri The local file URI
 * @returns The public URL of the uploaded image
 */
export async function uploadAvatarToSupabase(userId: string, uri: string): Promise<string | null> {
  try {
    console.log('Starting avatar upload for user:', userId);
    console.log('Image URI:', uri);
    console.log('Supabase client initialized:', !!supabase);
    
    // Fetch the file as a blob
    console.log('Fetching image as blob...');
    const response = await fetch(uri);
    if (!response.ok) {
      console.error('Failed to fetch image:', response.status, response.statusText);
      throw new Error(`Failed to fetch image: ${response.status}`);
    }
    
    const blob = await response.blob();
    console.log('Blob created, size:', blob.size, 'type:', blob.type);
    
    const fileExt = uri.split('.').pop() || 'png';
    const filePath = `${userId}/avatar_${Date.now()}.${fileExt}`;
    console.log('File path:', filePath);

    // Check if avatars bucket exists and is accessible
    console.log('Checking storage bucket...');
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    console.log('Buckets response:', { data: buckets, error: bucketsError });
    
    if (bucketsError) {
      console.error('Error listing buckets:', bucketsError);
      throw new Error(`Storage access error: ${bucketsError.message}`);
    }
    
    console.log('Available buckets:', buckets?.map(b => ({ name: b.name, id: b.id, public: b.public })));
    
    const avatarsBucket = buckets?.find(bucket => bucket.name === 'avatars');
    if (!avatarsBucket) {
      console.error('Avatars bucket not found. Available buckets:', buckets?.map(b => b.name));
      throw new Error('Avatars storage bucket not found. Please create it in your Supabase dashboard.');
    }
    
    console.log('Found avatars bucket:', avatarsBucket);
    
    console.log('Avatars bucket found, uploading...');
    
    // Upload to Supabase Storage
    const { error } = await supabase.storage.from('avatars').upload(filePath, blob, {
      upsert: true,
      contentType: blob.type,
    });
    
    if (error) {
      console.error('Supabase upload error:', error);
      throw new Error(`Upload failed: ${error.message}`);
    }
    
    console.log('Upload successful, getting public URL...');
    
    // Get public URL
    const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
    const publicUrl = data?.publicUrl;
    
    if (!publicUrl) {
      console.error('Failed to get public URL');
      throw new Error('Failed to get public URL for uploaded image');
    }
    
    console.log('Public URL:', publicUrl);
    return publicUrl;
    
  } catch (err) {
    console.error('Avatar upload failed:', err);
    if (err instanceof Error) {
      throw new Error(`Avatar upload failed: ${err.message}`);
    }
    throw new Error('Avatar upload failed: Unknown error');
  }
} 