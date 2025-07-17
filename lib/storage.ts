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
    return await AsyncStorage.getAllKeys();
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
    get: async () => await StorageUtils.get(STORAGE_KEYS.OFFLINE_QUEUE, []),
    set: async (queue: any[]) => await StorageUtils.set(STORAGE_KEYS.OFFLINE_QUEUE, queue),
    add: async (item: any) => {
      const queue = (await TypedStorage.offlineQueue.get()) || [];
      queue.push(item);
      await TypedStorage.offlineQueue.set(queue);
    },
    clear: async () => await StorageUtils.delete(STORAGE_KEYS.OFFLINE_QUEUE),
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