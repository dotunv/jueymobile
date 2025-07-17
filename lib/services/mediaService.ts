import * as ImagePicker from 'expo-image-picker';
import { uploadAvatarToSupabase, supabase } from './supabaseService';
import { TaskAttachment } from '../types';
import Tesseract from 'tesseract.js';
import AsyncStorage from '@react-native-async-storage/async-storage';

export class MediaService {
  /**
   * Launches camera or image picker and returns an array of TaskAttachments for the selected images.
   */
  static async pickOrCaptureImages(userId: string): Promise<TaskAttachment[]> {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') return [];
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsMultipleSelection: true, quality: 0.8 });
      if (result.canceled) return [];
      const images = result.assets ? result.assets : [result];
      const attachments: TaskAttachment[] = [];
      for (const img of images) {
        const { uri, width, height } = img;
        const cloudUrl = await uploadAvatarToSupabase(userId, uri) || undefined;
        attachments.push({
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          type: 'image',
          filename: uri.split('/').pop() || 'image.jpg',
          size: 0,
          localPath: uri,
          cloudUrl,
          metadata: { width, height },
        });
      }
      return attachments;
    } catch (e) {
      console.error('MediaService error:', e);
      return [];
    }
  }

  /**
   * Remove an attachment from a list by id.
   */
  static removeAttachment(attachments: TaskAttachment[], id: string): TaskAttachment[] {
    return attachments.filter(att => att.id !== id);
  }

  /**
   * Get the preview URL for an attachment (local or cloud).
   * If cloudUrl is present and bucket is private, generate a signed URL.
   */
  static async getPreviewUrl(att: TaskAttachment): Promise<string> {
    if (att.localPath) return att.localPath;
    if (att.cloudUrl) {
      // Extract the storage path from the cloudUrl
      // Example: https://<project>.supabase.co/storage/v1/object/public/attachments/path/to/file.jpg
      // For private, it will be .../object/attachments/path/to/file.jpg
      const match = att.cloudUrl.match(/\/object\/(?:public\/)?attachments\/(.+)$/);
      const path = match ? match[1] : undefined;
      if (!path) return att.cloudUrl;
      try {
        const { data, error } = await supabase.storage.from('attachments').createSignedUrl(path, 60 * 60); // 1 hour
        if (error) {
          console.error('Error creating signed URL:', error);
          return att.cloudUrl;
        }
        return data?.signedUrl || att.cloudUrl;
      } catch (e) {
        console.error('Signed URL error:', e);
        return att.cloudUrl;
      }
    }
    return '';
  }

  /**
   * Run OCR on an image and return extracted text.
   */
  static async runOCR(imageUri: string): Promise<string> {
    try {
      const result = await Tesseract.recognize(imageUri, 'eng');
      return result.data.text || '';
    } catch (e) {
      console.error('OCR error:', e);
      return '';
    }
  }

  /**
   * Get the gallery of attachments for a task.
   * Tries local storage first, then falls back to cloud (stub).
   */
  static async getTaskGallery(taskId: string): Promise<TaskAttachment[]> {
    // Try local storage first
    try {
      const local = await AsyncStorage.getItem(`task_attachments_${taskId}`);
      if (local) {
        return JSON.parse(local) as TaskAttachment[];
      }
    } catch (e) {
      console.error('Error reading local gallery:', e);
    }
    // Fallback: cloud (Supabase)
    try {
      const { data, error } = await supabase
        .from('task_attachments')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: true });
      if (error) {
        console.error('Supabase error fetching attachments:', error);
        return [];
      }
      if (!data) return [];
      // Map to TaskAttachment[]
      return data.map((row: any) => ({
        id: row.id,
        type: row.type,
        filename: row.filename,
        size: 0, // Not tracked in DB, set to 0
        localPath: undefined,
        cloudUrl: row.cloud_url,
        metadata: row.metadata,
      })) as TaskAttachment[];
    } catch (e) {
      console.error('Cloud gallery error:', e);
      return [];
    }
  }
} 