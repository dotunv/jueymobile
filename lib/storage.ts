import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Storage utilities for type-safe operations using AsyncStorage
 */
export class StorageUtils {
  /**
   * Set a value in storage
   */
  static async set<T>(key: string, value: T): Promise<void> {
    try {
      const toStore = typeof value === 'string' ? value : JSON.stringify(value);
      await AsyncStorage.setItem(key, toStore);
    } catch (error) {
      console.error('Failed to set storage value:', error);
    }
  }

  /**
   * Get a value from storage
   */
  static async get<T>(key: string, defaultValue?: T): Promise<T | null> {
    try {
      const value = await AsyncStorage.getItem(key);
      if (value === null || value === undefined) {
        return defaultValue || null;
      }
      try {
        return JSON.parse(value) as T;
      } catch {
        return value as T;
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
 */
export class TypedStorage {
  static userPreferences = {
    get: async () => await StorageUtils.get(STORAGE_KEYS.USER_PREFERENCES),
    set: async (preferences: any) => await StorageUtils.set(STORAGE_KEYS.USER_PREFERENCES, preferences),
    update: async (updates: Partial<any>) => {
      const current = (await TypedStorage.userPreferences.get()) || {};
      await TypedStorage.userPreferences.set({ ...current, ...updates });
    },
  };

  static cachedTasks = {
    get: async () => await StorageUtils.get(STORAGE_KEYS.CACHED_TASKS),
    set: async (tasks: any) => await StorageUtils.set(STORAGE_KEYS.CACHED_TASKS, tasks),
    clear: async () => await StorageUtils.delete(STORAGE_KEYS.CACHED_TASKS),
  };

  static cachedSuggestions = {
    get: async () => await StorageUtils.get(STORAGE_KEYS.CACHED_SUGGESTIONS),
    set: async (suggestions: any) => await StorageUtils.set(STORAGE_KEYS.CACHED_SUGGESTIONS, suggestions),
    clear: async () => await StorageUtils.delete(STORAGE_KEYS.CACHED_SUGGESTIONS),
  };

  static cachedAnalytics = {
    get: async () => await StorageUtils.get(STORAGE_KEYS.CACHED_ANALYTICS),
    set: async (analytics: any) => await StorageUtils.set(STORAGE_KEYS.CACHED_ANALYTICS, analytics),
    clear: async () => await StorageUtils.delete(STORAGE_KEYS.CACHED_ANALYTICS),
  };

  static offlineQueue = {
    get: async (): Promise<OfflineQueueItem[]> => (await StorageUtils.get(STORAGE_KEYS.OFFLINE_QUEUE, [])) || [],
    set: async (queue: OfflineQueueItem[]) => await StorageUtils.set(STORAGE_KEYS.OFFLINE_QUEUE, queue),
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
        queue[idx].status = 'conflict' as OfflineQueueStatus;
        queue[idx].conflict = { local, remote, fields };
        await TypedStorage.offlineQueue.set(queue);
      }
    },
    autoResolve: (local: any, remote: any): { merged: any, conflicts: string[] } => {
      const merged = { ...remote, ...local };
      const conflicts: string[] = [];
      for (const key of Object.keys(local)) {
        if (remote[key] !== undefined && remote[key] !== local[key]) {
          conflicts.push(key);
        }
      }
      return { merged, conflicts };
    },
    diffFields: (local: any, remote: any): string[] => {
      const fields = new Set([...Object.keys(local), ...Object.keys(remote)]);
      return Array.from(fields).filter(key => local[key] !== remote[key]);
    },
    /**
     * Scan the queue and reset any items stuck in 'syncing' state to 'pending'.
     * Use on startup or reconnect for partial sync recovery.
     */
    recoverPartialSync: async () => {
      const queue = (await TypedStorage.offlineQueue.get()) || [];
      let changed = false;
      for (const item of queue) {
        if (item.status === 'syncing') {
          item.status = 'pending' as OfflineQueueStatus;
          changed = true;
        }
      }
      if (changed) await TypedStorage.offlineQueue.set(queue);
    },
    /**
     * Verify integrity of a synced item by checking its presence/status on the server.
     * Returns true if verified, false otherwise.
     * (Stub: implement actual server check in the UI logic)
     */
    verifySyncIntegrity: async (item: OfflineQueueItem, serverCheckFn: (item: OfflineQueueItem) => Promise<boolean>) => {
      try {
        return await serverCheckFn(item);
      } catch {
        return false;
      }
    },
  };

  static session = {
    get: async () => await StorageUtils.get(STORAGE_KEYS.SESSION_ID),
    set: async (sessionId: string) => await StorageUtils.set(STORAGE_KEYS.SESSION_ID, sessionId),
    clear: async () => await StorageUtils.delete(STORAGE_KEYS.SESSION_ID),
  };

  static featureFlags = {
    get: async () => await StorageUtils.get(STORAGE_KEYS.FEATURE_FLAGS, {}),
    set: async (flags: any) => await StorageUtils.set(STORAGE_KEYS.FEATURE_FLAGS, flags),
    clear: async () => await StorageUtils.delete(STORAGE_KEYS.FEATURE_FLAGS),
  };
}

/**
 * Migration utilities for storage
 */
export class StorageMigration {
  /**
   * Migrate storage data when app version changes
   */
  static async migrate(version: string): Promise<void> {
    const currentVersion = await StorageUtils.get<string>('app_version');
    
    if (currentVersion !== version) {
      // Perform migrations based on version
      await this.performMigrations(currentVersion, version);
      
      // Update version
      await StorageUtils.set('app_version', version);
    }
  }

  /**
   * Perform specific migrations
   */
  private static async performMigrations(fromVersion: string | null, toVersion: string): Promise<void> {
    // Add migration logic here when needed
    console.log(`Migrating storage from ${fromVersion} to ${toVersion}`);
  }
}

/**
 * Storage performance utilities
 */
export class StoragePerformance {
  /**
   * Batch multiple storage operations
   */
  static batch(operations: Array<() => void>): void {
    // AsyncStorage is already optimized for batch operations
    operations.forEach(op => op());
  }

  /**
   * Preload frequently accessed data
   */
  static preload(keys: string[]): void {
    keys.forEach(key => {
      AsyncStorage.getItem(key);
    });
  }
} 