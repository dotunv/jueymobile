import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

// Database configuration
export const DATABASE_NAME = 'juey.db';
export const DATABASE_VERSION = 1;

// Database instance
let database: SQLite.SQLiteDatabase | null = null;

/**
 * Initialize and open the database
 */
export async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (database) {
    return database;
  }

  try {
    database = await SQLite.openDatabaseAsync(DATABASE_NAME);
    await migrateDatabase();
    return database;
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

/**
 * Get the database instance
 */
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!database) {
    return await initDatabase();
  }
  return database;
}

/**
 * Database migration system
 */
async function migrateDatabase(): Promise<void> {
  const db = await getDatabase();
  
  // Enable WAL mode for better performance
  await db.execAsync('PRAGMA journal_mode = WAL;');
  
  // Create tables if they don't exist
  await createTables(db);
  
  // Run migrations based on version
  await runMigrations(db);
}

/**
 * Create all database tables
 */
async function createTables(db: SQLite.SQLiteDatabase): Promise<void> {
  // Tasks table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      completed BOOLEAN NOT NULL DEFAULT 0,
      completed_at TEXT,
      logged_after_completion BOOLEAN NOT NULL DEFAULT 0,
      priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
      category TEXT NOT NULL DEFAULT 'Personal',
      tags TEXT, -- JSON array of tags
      ai_suggested BOOLEAN NOT NULL DEFAULT 0,
      reminder_enabled BOOLEAN NOT NULL DEFAULT 0,
      reminder_time TEXT,
      due_date TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Suggestions table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS suggestions (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL,
      confidence REAL NOT NULL DEFAULT 0,
      reasoning TEXT,
      time_estimate TEXT,
      priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
      based_on TEXT, -- JSON array of factors
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'dismissed')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT
    );
  `);

  // Feedback table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS feedback (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      suggestion_id TEXT NOT NULL,
      feedback_type TEXT NOT NULL CHECK (feedback_type IN ('positive', 'negative')),
      reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (suggestion_id) REFERENCES suggestions (id) ON DELETE CASCADE
    );
  `);

  // User preferences table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS user_preferences (
      user_id TEXT PRIMARY KEY NOT NULL,
      theme TEXT NOT NULL DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
      notifications_enabled BOOLEAN NOT NULL DEFAULT 1,
      ai_suggestions_enabled BOOLEAN NOT NULL DEFAULT 1,
      smart_reminders_enabled BOOLEAN NOT NULL DEFAULT 0,
      reminder_frequency TEXT NOT NULL DEFAULT 'daily' CHECK (reminder_frequency IN ('hourly', 'daily', 'weekly')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Task patterns table for AI learning
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS task_patterns (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      pattern_type TEXT NOT NULL CHECK (pattern_type IN ('frequency', 'time', 'category', 'sequence')),
      pattern_data TEXT NOT NULL, -- JSON object with pattern details
      confidence REAL NOT NULL DEFAULT 0,
      last_updated TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Create indexes for better performance
  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(completed);
    CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
    CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks(category);
    CREATE INDEX IF NOT EXISTS idx_suggestions_user_id ON suggestions(user_id);
    CREATE INDEX IF NOT EXISTS idx_suggestions_status ON suggestions(status);
    CREATE INDEX IF NOT EXISTS idx_feedback_suggestion_id ON feedback(suggestion_id);
    CREATE INDEX IF NOT EXISTS idx_task_patterns_user_id ON task_patterns(user_id);
  `);
}

/**
 * Run database migrations
 */
async function runMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
  // Get current version
  const versionResult = await db.getFirstAsync<{ version: number }>(
    'PRAGMA user_version;'
  );
  const currentVersion = versionResult?.version || 0;

  // Run migrations if needed
  if (currentVersion < 1) {
    // Migration 1: Add any new fields or modifications
    // This is where future migrations will go
    await db.execAsync('PRAGMA user_version = 1;');
  }
}

/**
 * Close the database connection
 */
export async function closeDatabase(): Promise<void> {
  if (database) {
    await database.closeAsync();
    database = null;
  }
}

/**
 * Delete the database (for testing or reset)
 */
export async function deleteDatabase(): Promise<void> {
  await closeDatabase();
  await SQLite.deleteDatabaseAsync(DATABASE_NAME);
}

/**
 * Backup database
 */
export async function backupDatabase(): Promise<Uint8Array> {
  const db = await getDatabase();
  return await db.backupAsync();
}

/**
 * Restore database from backup
 */
export async function restoreDatabase(backup: Uint8Array): Promise<void> {
  await closeDatabase();
  await SQLite.deserializeDatabaseAsync(DATABASE_NAME, backup);
  database = await SQLite.openDatabaseAsync(DATABASE_NAME);
}

/**
 * Database utilities
 */
export const DatabaseUtils = {
  /**
   * Format date for SQLite
   */
  formatDate: (date: Date): string => {
    return date.toISOString();
  },

  /**
   * Parse date from SQLite
   */
  parseDate: (dateString: string): Date => {
    return new Date(dateString);
  },

  /**
   * Serialize JSON for storage
   */
  serializeJSON: (obj: any): string => {
    return JSON.stringify(obj);
  },

  /**
   * Deserialize JSON from storage
   */
  deserializeJSON: (jsonString: string): any => {
    try {
      return JSON.parse(jsonString);
    } catch {
      return null;
    }
  },

  /**
   * Generate unique ID
   */
  generateId: (): string => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  },

  /**
   * Get database file path
   */
  getDatabasePath: (): string => {
    if (Platform.OS === 'web') {
      return 'web-database';
    }
    return DATABASE_NAME;
  }
}; 