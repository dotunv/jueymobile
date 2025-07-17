import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import CryptoJS from 'crypto-js';

/**
 * Encryption utilities for local data protection
 */
const ENCRYPTION_KEY_NAME = 'device_encryption_key';

export class EncryptionUtils {
  /**
   * Get or generate a device-specific encryption key
   */
  static async getKey(): Promise<string> {
    let key = await SecureStore.getItemAsync(ENCRYPTION_KEY_NAME);
    if (!key) {
      // Generate a 256-bit random key
      key = CryptoJS.lib.WordArray.random(32).toString(CryptoJS.enc.Hex);
      await SecureStore.setItemAsync(ENCRYPTION_KEY_NAME, key);
    }
    return key as string;
  }

  /**
   * Encrypt a string with the device key
   */
  static async encrypt(plain: string): Promise<string> {
    const key = await EncryptionUtils.getKey();
    const ciphertext = CryptoJS.AES.encrypt(plain, key as string).toString();
    return ciphertext;
  }

  /**
   * Decrypt a string with the device key
   */
  static async decrypt(cipher: string): Promise<string> {
    const key = await EncryptionUtils.getKey();
    const bytes = CryptoJS.AES.decrypt(cipher, key as string);
    return bytes.toString(CryptoJS.enc.Utf8);
  }
}

/**
 * Storage utilities for type-safe operations using AsyncStorage
 * Now supports optional encryption for sensitive keys
 */
export class StorageUtils {
  /**
   * Set a value in storage (optionally encrypted)
   */
  static async set<T>(key: string, value: T, encrypt: boolean = false): Promise<void> {
    try {
      let toStore = typeof value === 'string' ? value : JSON.stringify(value);
      if (encrypt) {
        toStore = await EncryptionUtils.encrypt(toStore);
      }
      await AsyncStorage.setItem(key, toStore);
    } catch (error) {
      console.error('Failed to set storage value:', error);
    }
  }

  /**
   * Get a value from storage (optionally decrypted)
   */
  static async get<T>(key: string, defaultValue?: T, encrypted: boolean = false): Promise<T | null> {
    try {
      const value = await AsyncStorage.getItem(key);
      if (value === null || value === undefined) {
        return defaultValue || null;
      }
      let plain = value;
      if (encrypted) {
        try {
          plain = await EncryptionUtils.decrypt(value);
        } catch (e) {
          // If decryption fails, fallback to original value
          console.warn('Decryption failed for key', key, e);
          return defaultValue || null;
        }
      }
      try {
        return JSON.parse(plain) as T;
      } catch {
        return plain as T;
      }
    } catch (error) {
      console.error('Failed to get storage value:', error);
      return defaultValue || null;
    }
  }

  /**
   * Delete a value from storage
   */
  static async delete(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('Failed to delete storage value:', error);
    }
  }

  /**
   * Check if a key exists in storage
   */
  static async has(key: string): Promise<boolean> {
    const value = await AsyncStorage.getItem(key);
    return value !== null && value !== undefined;
  }

  /**
   * Get all keys in storage
   */
  static async getAllKeys(): Promise<string[]> {
    return [...(await AsyncStorage.getAllKeys())];
  }

  /**
   * Clear all storage
   */
  static async clear(): Promise<void> {
    await AsyncStorage.clear();
  }
}

/**
 * Storage keys constants
 */
export const STORAGE_KEYS = {
  // User preferences
  USER_PREFERENCES: 'user_preferences',
  THEME: 'theme',
  LANGUAGE: 'language',
  // App state
  LAST_SYNC: 'last_sync',
  OFFLINE_QUEUE: 'offline_queue',
  // Cached data
  CACHED_TASKS: 'cached_tasks',
  CACHED_SUGGESTIONS: 'cached_suggestions',
  CACHED_ANALYTICS: 'cached_analytics',
  // Settings
  NOTIFICATIONS_ENABLED: 'notifications_enabled',
  AI_SUGGESTIONS_ENABLED: 'ai_suggestions_enabled',
  SMART_REMINDERS_ENABLED: 'smart_reminders_enabled',
  // Session data
  SESSION_ID: 'session_id',
  LAST_ACTIVITY: 'last_activity',
  // Feature flags
  FEATURE_FLAGS: 'feature_flags',
  // Debug/development
  DEBUG_MODE: 'debug_mode',
  LOG_LEVEL: 'log_level',
} as const;

export type OfflineQueueStatus = 'pending' | 'syncing' | 'failed' | 'completed';
export interface OfflineQueueItem {
  id: string;
  action: 'create' | 'update' | 'delete';
  entity: 'task' | 'suggestion' | 'feedback' | 'reminder';
  data: any;
  timestamp: number;
  retry_count: number;
  max_retries: number;
  priority?: number; // Higher = more urgent
  dependencies?: string[];
  status?: OfflineQueueStatus;
  last_error?: string;
  next_retry_at?: number;
  conflict?: {
    local: any;
    remote: any;
    fields?: string[]; // fields in conflict
  };
}

/**
 * Type-safe storage operations for specific data types (Async)
 * Now supports encryption for sensitive data
 */
export class TypedStorage {
  static userPreferences = {
    get: async () => await StorageUtils.get(STORAGE_KEYS.USER_PREFERENCES, undefined, true),
    set: async (preferences: any) => await StorageUtils.set(STORAGE_KEYS.USER_PREFERENCES, preferences, true),
    update: async (updates: Partial<any>) => {
      const current = (await TypedStorage.userPreferences.get()) || {};
      await TypedStorage.userPreferences.set({ ...current, ...updates });
    },
  };

  static cachedTasks = {
    get: async () => await StorageUtils.get(STORAGE_KEYS.CACHED_TASKS, undefined, true),
    set: async (tasks: any) => await StorageUtils.set(STORAGE_KEYS.CACHED_TASKS, tasks, true),
    clear: async () => await StorageUtils.delete(STORAGE_KEYS.CACHED_TASKS),
  };

  static cachedSuggestions = {
    get: async () => await StorageUtils.get(STORAGE_KEYS.CACHED_SUGGESTIONS, undefined, true),
    set: async (suggestions: any) => await StorageUtils.set(STORAGE_KEYS.CACHED_SUGGESTIONS, suggestions, true),
    clear: async () => await StorageUtils.delete(STORAGE_KEYS.CACHED_SUGGESTIONS),
  };

  static cachedAnalytics = {
    get: async () => await StorageUtils.get(STORAGE_KEYS.CACHED_ANALYTICS, undefined, true),
    set: async (analytics: any) => await StorageUtils.set(STORAGE_KEYS.CACHED_ANALYTICS, analytics, true),
    clear: async () => await StorageUtils.delete(STORAGE_KEYS.CACHED_ANALYTICS),
  };

  static offlineQueue = {
    get: async (): Promise<OfflineQueueItem[]> => (await StorageUtils.get(STORAGE_KEYS.OFFLINE_QUEUE, [], true)) || [],
    set: async (queue: OfflineQueueItem[]) => await StorageUtils.set(STORAGE_KEYS.OFFLINE_QUEUE, queue, true),
    add: async (item: OfflineQueueItem) => {
      const queue = (await TypedStorage.offlineQueue.get()) || [];
      queue.push(item);
      await TypedStorage.offlineQueue.set(queue);
    },
    clear: async () => await StorageUtils.delete(STORAGE_KEYS.OFFLINE_QUEUE),
    updateStatus: async (id: string, status: OfflineQueueStatus, last_error?: string) => {
      const queue = (await TypedStorage.offlineQueue.get()) || [];
      const idx = queue.findIndex(q => q.id === id);
      if (idx !== -1) {
        queue[idx].status = status;
        if (last_error) queue[idx].last_error = last_error;
        await TypedStorage.offlineQueue.set(queue);
      }
    },
    batch: async (filterFn: (item: OfflineQueueItem) => boolean, batchSize: number = 5): Promise<OfflineQueueItem[]> => {
      const queue = (await TypedStorage.offlineQueue.get()) || [];
      return queue.filter(filterFn).sort((a, b) => (b.priority || 0) - (a.priority || 0)).slice(0, batchSize);
    },
    remove: async (id: string) => {
      const queue = (await TypedStorage.offlineQueue.get()) || [];
      await TypedStorage.offlineQueue.set(Array.from(queue.filter(q => q.id !== id)));
    },
    setNextRetry: async (id: string, retry_count: number) => {
      // Exponential backoff: 2^retry_count * 5 seconds (max 10 min)
      const delay = Math.min(Math.pow(2, retry_count) * 5000, 10 * 60 * 1000);
      const next_retry_at = Date.now() + delay;
      const queue = (await TypedStorage.offlineQueue.get()) || [];
      const idx = queue.findIndex(q => q.id === id);
      if (idx !== -1) {
        queue[idx].next_retry_at = next_retry_at;
        queue[idx].retry_count = retry_count;
        await TypedStorage.offlineQueue.set(queue);
      }
    },
    getNextRetryable: async () => {
      const queue = (await TypedStorage.offlineQueue.get()) || [];
      const now = Date.now();
      return queue.find(q => q.status === 'pending' && (!q.next_retry_at || q.next_retry_at <= now));
    },
    markConflict: async (id: string, local: any, remote: any, fields?: string[]) => {
      const queue = (await TypedStorage.offlineQueue.get()) || [];
      const idx = queue.findIndex(q => q.id === id);
      if (idx !== -1) {
        queue[idx].conflict = { local, remote, fields };
        await TypedStorage.offlineQueue.set(queue);
      }
    },
    diffFields: (local: any, remote: any): string[] => {
      const fields: string[] = [];
      for (const key in local) {
        if (local.hasOwnProperty(key) && remote.hasOwnProperty(key)) {
          if (JSON.stringify(local[key]) !== JSON.stringify(remote[key])) {
            fields.push(key);
          }
        }
      }
      return fields;
    },
    verifySyncIntegrity: async (item: OfflineQueueItem, checkFn: (item: OfflineQueueItem) => Promise<boolean>): Promise<boolean> => {
      try {
        return await checkFn(item);
      } catch {
        return false;
      }
    },
    recoverPartialSync: async () => {
      const queue = (await TypedStorage.offlineQueue.get()) || [];
      let changed = false;
      for (const item of queue) {
        if (item.status === 'syncing') {
          item.status = 'pending';
          changed = true;
        }
      }
      if (changed) await TypedStorage.offlineQueue.set(queue);
    },
  };

  static session = {
    get: async () => await StorageUtils.get(STORAGE_KEYS.SESSION_ID),
    set: async (sessionId: string) => await StorageUtils.set(STORAGE_KEYS.SESSION_ID, sessionId),
    clear: async () => await StorageUtils.delete(STORAGE_KEYS.SESSION_ID),
  };

  static featureFlags = {
    get: async () => await StorageUtils.get(STORAGE_KEYS.FEATURE_FLAGS),
    set: async (flags: any) => await StorageUtils.set(STORAGE_KEYS.FEATURE_FLAGS, flags),
    clear: async () => await StorageUtils.delete(STORAGE_KEYS.FEATURE_FLAGS),
  };
}

export class StorageMigration {
  static async migrate(version: string): Promise<void> {
    // Implement migration logic if needed
  }
}

export class StoragePerformance {
  static batch(operations: Array<() => void>): void {
    operations.forEach(fn => fn());
  }
  static preload(keys: string[]): void {
    // Optionally preload keys
  }
} 