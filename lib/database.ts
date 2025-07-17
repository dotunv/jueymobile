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

  // Initialize pattern recognition tables
  await initPatternRecognitionTables(db);

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
 * Initialize pattern recognition tables
 */
async function initPatternRecognitionTables(db: SQLite.SQLiteDatabase): Promise<void> {
  // Enhanced user_patterns table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS user_patterns (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      pattern_type TEXT NOT NULL CHECK (pattern_type IN ('temporal', 'sequential', 'contextual', 'frequency')),
      pattern_data TEXT NOT NULL, -- JSON object with pattern details
      confidence REAL NOT NULL DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 1),
      frequency INTEGER NOT NULL DEFAULT 0,
      last_occurrence TEXT,
      next_predicted TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Pattern triggers table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS pattern_triggers (
      id TEXT PRIMARY KEY NOT NULL,
      pattern_id TEXT NOT NULL,
      trigger_type TEXT NOT NULL CHECK (trigger_type IN ('time', 'location', 'context', 'task_completion')),
      trigger_data TEXT NOT NULL, -- JSON object with trigger details
      confidence REAL NOT NULL DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 1),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (pattern_id) REFERENCES user_patterns (id) ON DELETE CASCADE
    );
  `);

  // Pattern outcomes table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS pattern_outcomes (
      id TEXT PRIMARY KEY NOT NULL,
      pattern_id TEXT NOT NULL,
      outcome_type TEXT NOT NULL CHECK (outcome_type IN ('task_suggestion', 'reminder', 'priority_adjustment')),
      outcome_data TEXT NOT NULL, -- JSON object with outcome details
      success_rate REAL NOT NULL DEFAULT 0 CHECK (success_rate >= 0 AND success_rate <= 1),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (pattern_id) REFERENCES user_patterns (id) ON DELETE CASCADE
    );
  `);

  // Temporal patterns table for detailed time-based analysis
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS temporal_patterns (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      task_title TEXT NOT NULL,
      task_category TEXT NOT NULL,
      time_of_day INTEGER NOT NULL CHECK (time_of_day >= 0 AND time_of_day <= 23),
      day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
      day_of_month INTEGER CHECK (day_of_month >= 1 AND day_of_month <= 31),
      month INTEGER CHECK (month >= 1 AND month <= 12),
      frequency INTEGER NOT NULL DEFAULT 1,
      period_type TEXT NOT NULL DEFAULT 'weekly' CHECK (period_type IN ('daily', 'weekly', 'monthly')),
      confidence REAL NOT NULL DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 1),
      last_occurrence TEXT NOT NULL,
      next_predicted TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Feedback learning tables
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS confidence_calibration (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      pattern_types TEXT NOT NULL, -- JSON array
      category TEXT NOT NULL,
      original_confidence REAL NOT NULL,
      feedback_type TEXT NOT NULL,
      adjustment REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS confidence_adjustments (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      confidence_range TEXT NOT NULL,
      adjustment_factor REAL NOT NULL,
      reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS timing_preferences (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      preference_type TEXT NOT NULL,
      timing_data TEXT NOT NULL, -- JSON object
      confidence REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Feedback context table for enhanced feedback collection
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS feedback_context (
      id TEXT PRIMARY KEY NOT NULL,
      feedback_id TEXT NOT NULL,
      time_of_day INTEGER NOT NULL CHECK (time_of_day >= 0 AND time_of_day <= 23),
      day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
      location TEXT,
      device_context TEXT,
      user_activity TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (feedback_id) REFERENCES feedback (id) ON DELETE CASCADE
    );
  `);

  // Create indexes for pattern recognition tables
  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_user_patterns_user_id ON user_patterns(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_patterns_type ON user_patterns(pattern_type);
    CREATE INDEX IF NOT EXISTS idx_user_patterns_confidence ON user_patterns(confidence);
    CREATE INDEX IF NOT EXISTS idx_pattern_triggers_pattern_id ON pattern_triggers(pattern_id);
    CREATE INDEX IF NOT EXISTS idx_pattern_outcomes_pattern_id ON pattern_outcomes(pattern_id);
    CREATE INDEX IF NOT EXISTS idx_temporal_patterns_user_id ON temporal_patterns(user_id);
    CREATE INDEX IF NOT EXISTS idx_temporal_patterns_time ON temporal_patterns(time_of_day, day_of_week);
    CREATE INDEX IF NOT EXISTS idx_temporal_patterns_category ON temporal_patterns(task_category);
    CREATE INDEX IF NOT EXISTS idx_confidence_calibration_user_id ON confidence_calibration(user_id);
    CREATE INDEX IF NOT EXISTS idx_confidence_adjustments_user_id ON confidence_adjustments(user_id);
    CREATE INDEX IF NOT EXISTS idx_timing_preferences_user_id ON timing_preferences(user_id);
    CREATE INDEX IF NOT EXISTS idx_feedback_context_feedback_id ON feedback_context(feedback_id);
    CREATE INDEX IF NOT EXISTS idx_feedback_context_time ON feedback_context(time_of_day, day_of_week);
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