import { MMKV } from 'react-native-mmkv';
import { Platform } from 'react-native';

// Storage configuration
const STORAGE_ID = 'juey-storage';

// Fallback storage for development (when MMKV is not available)
class FallbackStorage {
  private data: Map<string, string> = new Map();

  set(key: string, value: string): void {
    this.data.set(key, value);
  }

  getString(key: string): string | undefined {
    return this.data.get(key);
  }

  contains(key: string): boolean {
    return this.data.has(key);
  }

  delete(key: string): void {
    this.data.delete(key);
  }

  getAllKeys(): string[] {
    return Array.from(this.data.keys());
  }

  clearAll(): void {
    this.data.clear();
  }

  get size(): number {
    return this.data.size;
  }
}

// Create MMKV instance with fallback
let storage: MMKV | FallbackStorage;

try {
  storage = new MMKV({
    id: STORAGE_ID,
    encryptionKey: 'juey-encryption-key', // In production, use a secure key
  });
} catch (error) {
  console.warn('MMKV not available, using fallback storage:', error);
  storage = new FallbackStorage();
}

/**
 * Storage utilities for type-safe operations
 */
export class StorageUtils {
  /**
   * Set a value in storage
   */
  static set<T>(key: string, value: T): void {
    try {
      if (typeof value === 'string') {
        storage.set(key, value);
      } else {
        storage.set(key, JSON.stringify(value));
      }
    } catch (error) {
      console.error('Failed to set storage value:', error);
    }
  }

  /**
   * Get a value from storage
   */
  static get<T>(key: string, defaultValue?: T): T | null {
    try {
      if (!storage.contains(key)) {
        return defaultValue || null;
      }

      const value = storage.getString(key);
      if (value === undefined) {
        return defaultValue || null;
      }

      // Try to parse as JSON, fallback to string
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
  static delete(key: string): void {
    try {
      storage.delete(key);
    } catch (error) {
      console.error('Failed to delete storage value:', error);
    }
  }

  /**
   * Check if a key exists in storage
   */
  static has(key: string): boolean {
    return storage.contains(key);
  }

  /**
   * Get all keys in storage
   */
  static getAllKeys(): string[] {
    return storage.getAllKeys();
  }

  /**
   * Clear all storage
   */
  static clear(): void {
    storage.clearAll();
  }

  /**
   * Get storage size
   */
  static getSize(): number {
    return storage.size;
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
 * Type-safe storage operations for specific data types
 */
export class TypedStorage {
  /**
   * User preferences storage
   */
  static userPreferences = {
    get: () => StorageUtils.get<{
      theme: 'light' | 'dark' | 'system';
      language: string;
      notifications: boolean;
      aiSuggestions: boolean;
      smartReminders: boolean;
    }>(STORAGE_KEYS.USER_PREFERENCES),
    
    set: (preferences: any) => StorageUtils.set(STORAGE_KEYS.USER_PREFERENCES, preferences),
    
    update: (updates: Partial<any>) => {
      const current = TypedStorage.userPreferences.get() || {};
      TypedStorage.userPreferences.set({ ...current, ...updates });
    }
  };

  /**
   * Cached tasks storage
   */
  static cachedTasks = {
    get: () => StorageUtils.get<any[]>(STORAGE_KEYS.CACHED_TASKS, []),
    
    set: (tasks: any[]) => StorageUtils.set(STORAGE_KEYS.CACHED_TASKS, tasks),
    
    add: (task: any) => {
      const tasks = TypedStorage.cachedTasks.get();
      tasks.push(task);
      TypedStorage.cachedTasks.set(tasks);
    },
    
    update: (taskId: string, updates: any) => {
      const tasks = TypedStorage.cachedTasks.get();
      const index = tasks.findIndex(t => t.id === taskId);
      if (index !== -1) {
        tasks[index] = { ...tasks[index], ...updates };
        TypedStorage.cachedTasks.set(tasks);
      }
    },
    
    remove: (taskId: string) => {
      const tasks = TypedStorage.cachedTasks.get();
      const filtered = tasks.filter(t => t.id !== taskId);
      TypedStorage.cachedTasks.set(filtered);
    }
  };

  /**
   * Offline queue storage
   */
  static offlineQueue = {
    get: () => StorageUtils.get<Array<{
      id: string;
      action: 'create' | 'update' | 'delete';
      entity: 'task' | 'suggestion' | 'feedback';
      data: any;
      timestamp: number;
    }>>(STORAGE_KEYS.OFFLINE_QUEUE, []),
    
    set: (queue: any[]) => StorageUtils.set(STORAGE_KEYS.OFFLINE_QUEUE, queue),
    
    add: (item: any) => {
      const queue = TypedStorage.offlineQueue.get();
      queue.push(item);
      TypedStorage.offlineQueue.set(queue);
    },
    
    remove: (itemId: string) => {
      const queue = TypedStorage.offlineQueue.get();
      const filtered = queue.filter(item => item.id !== itemId);
      TypedStorage.offlineQueue.set(filtered);
    },
    
    clear: () => TypedStorage.offlineQueue.set([])
  };

  /**
   * Session storage
   */
  static session = {
    getSessionId: () => StorageUtils.get<string>(STORAGE_KEYS.SESSION_ID),
    
    setSessionId: (sessionId: string) => StorageUtils.set(STORAGE_KEYS.SESSION_ID, sessionId),
    
    getLastActivity: () => StorageUtils.get<number>(STORAGE_KEYS.LAST_ACTIVITY),
    
    setLastActivity: (timestamp: number) => StorageUtils.set(STORAGE_KEYS.LAST_ACTIVITY, timestamp),
    
    updateActivity: () => TypedStorage.session.setLastActivity(Date.now())
  };

  /**
   * Feature flags storage
   */
  static featureFlags = {
    get: () => StorageUtils.get<Record<string, boolean>>(STORAGE_KEYS.FEATURE_FLAGS, {}),
    
    set: (flags: Record<string, boolean>) => StorageUtils.set(STORAGE_KEYS.FEATURE_FLAGS, flags),
    
    isEnabled: (flag: string) => {
      const flags = TypedStorage.featureFlags.get();
      return flags[flag] || false;
    },
    
    setFlag: (flag: string, enabled: boolean) => {
      const flags = TypedStorage.featureFlags.get();
      flags[flag] = enabled;
      TypedStorage.featureFlags.set(flags);
    }
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
    const currentVersion = StorageUtils.get<string>('app_version');
    
    if (currentVersion !== version) {
      // Perform migrations based on version
      await this.performMigrations(currentVersion, version);
      
      // Update version
      StorageUtils.set('app_version', version);
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
    // MMKV is already optimized for batch operations
    operations.forEach(op => op());
  }

  /**
   * Preload frequently accessed data
   */
  static preload(keys: string[]): void {
    keys.forEach(key => {
      if (storage.contains(key)) {
        storage.getString(key);
      }
    });
  }
} 