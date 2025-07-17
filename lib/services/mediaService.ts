import * as ImagePicker from 'expo-image-picker';
import { uploadAvatarToSupabase } from './supabaseService';
import { TaskAttachment } from '../types';

export class MediaService {
  /**
   * Launches camera or image picker and returns an array of TaskAttachments for the selected images.
   */
  static async pickOrCaptureImages(userId: string): Promise<TaskAttachment[]> {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') return [];
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsMultipleSelection: true, quality: 0.8 });
      if (result.cancelled) return [];
      const images = result.selected ? result.selected : [result];
      const attachments: TaskAttachment[] = [];
      for (const img of images) {
        const { uri, width, height } = img;
        const cloudUrl = await uploadAvatarToSupabase(userId, uri);
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
   */
  static getPreviewUrl(att: TaskAttachment): string {
    return att.localPath || att.cloudUrl || '';
  }

  /**
   * (Stub) Run OCR on an image and return extracted text.
   */
  static async runOCR(imageUri: string): Promise<string> {
    // TODO: Integrate Tesseract.js or similar for OCR
    return '';
  }

  /**
   * (Stub) Get gallery of attachments for a task.
   */
  static async getTaskGallery(taskId: string): Promise<TaskAttachment[]> {
    // TODO: Implement gallery retrieval from local storage or cloud
    return [];
  }
} 