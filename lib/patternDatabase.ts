import * as SQLite from 'expo-sqlite';
import { getDatabase, DatabaseUtils } from './database';

/**
 * Enhanced database schema for AI pattern recognition
 */

// Pattern-related interfaces
export interface UserPattern {
  id: string;
  user_id: string;
  pattern_type: 'temporal' | 'sequential' | 'contextual' | 'frequency';
  pattern_data: Record<string, any>;
  confidence: number;
  frequency: number;
  last_occurrence: string;
  next_predicted?: string;
  created_at: string;
  updated_at: string;
}

export interface PatternTrigger {
  id: string;
  pattern_id: string;
  trigger_type: 'time' | 'location' | 'context' | 'task_completion';
  trigger_data: Record<string, any>;
  confidence: number;
  created_at: string;
}

export interface PatternOutcome {
  id: string;
  pattern_id: string;
  outcome_type: 'task_suggestion' | 'reminder' | 'priority_adjustment';
  outcome_data: Record<string, any>;
  success_rate: number;
  created_at: string;
  updated_at: string;
}

export interface TemporalPattern {
  id: string;
  user_id: string;
  task_title: string;
  task_category: string;
  time_of_day: number; // Hour of day (0-23)
  day_of_week: number; // Day of week (0-6, Sunday=0)
  day_of_month?: number; // Day of month (1-31)
  month?: number; // Month (1-12)
  frequency: number; // Times per period
  period_type: 'daily' | 'weekly' | 'monthly';
  confidence: number;
  last_occurrence: string;
  next_predicted: string;
  created_at: string;
  updated_at: string;
}

/**
 * Initialize pattern recognition database tables
 */
export async function initPatternTables(): Promise<void> {
  const db = await getDatabase();

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

  // Create indexes for better performance
  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_user_patterns_user_id ON user_patterns(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_patterns_type ON user_patterns(pattern_type);
    CREATE INDEX IF NOT EXISTS idx_user_patterns_confidence ON user_patterns(confidence);
    CREATE INDEX IF NOT EXISTS idx_pattern_triggers_pattern_id ON pattern_triggers(pattern_id);
    CREATE INDEX IF NOT EXISTS idx_pattern_outcomes_pattern_id ON pattern_outcomes(pattern_id);
    CREATE INDEX IF NOT EXISTS idx_temporal_patterns_user_id ON temporal_patterns(user_id);
    CREATE INDEX IF NOT EXISTS idx_temporal_patterns_time ON temporal_patterns(time_of_day, day_of_week);
    CREATE INDEX IF NOT EXISTS idx_temporal_patterns_category ON temporal_patterns(task_category);
  `);
}

/**
 * Pattern database utilities
 */
export const PatternDatabaseUtils = {
  /**
   * Insert or update a user pattern
   */
  async upsertUserPattern(pattern: Omit<UserPattern, 'created_at' | 'updated_at'>): Promise<void> {
    const db = await getDatabase();
    const now = DatabaseUtils.formatDate(new Date());
    
    await db.runAsync(`
      INSERT OR REPLACE INTO user_patterns (
        id, user_id, pattern_type, pattern_data, confidence, frequency,
        last_occurrence, next_predicted, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 
        COALESCE((SELECT created_at FROM user_patterns WHERE id = ?), ?), ?
      )
    `, [
      pattern.id, pattern.user_id, pattern.pattern_type,
      DatabaseUtils.serializeJSON(pattern.pattern_data),
      pattern.confidence, pattern.frequency, pattern.last_occurrence,
      pattern.next_predicted, pattern.id, now, now
    ]);
  },

  /**
   * Insert a pattern trigger
   */
  async insertPatternTrigger(trigger: Omit<PatternTrigger, 'created_at'>): Promise<void> {
    const db = await getDatabase();
    const now = DatabaseUtils.formatDate(new Date());
    
    await db.runAsync(`
      INSERT INTO pattern_triggers (
        id, pattern_id, trigger_type, trigger_data, confidence, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [
      trigger.id, trigger.pattern_id, trigger.trigger_type,
      DatabaseUtils.serializeJSON(trigger.trigger_data),
      trigger.confidence, now
    ]);
  },

  /**
   * Insert or update a pattern outcome
   */
  async upsertPatternOutcome(outcome: Omit<PatternOutcome, 'created_at' | 'updated_at'>): Promise<void> {
    const db = await getDatabase();
    const now = DatabaseUtils.formatDate(new Date());
    
    await db.runAsync(`
      INSERT OR REPLACE INTO pattern_outcomes (
        id, pattern_id, outcome_type, outcome_data, success_rate, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 
        COALESCE((SELECT created_at FROM pattern_outcomes WHERE id = ?), ?), ?
      )
    `, [
      outcome.id, outcome.pattern_id, outcome.outcome_type,
      DatabaseUtils.serializeJSON(outcome.outcome_data),
      outcome.success_rate, outcome.id, now, now
    ]);
  },

  /**
   * Insert or update a temporal pattern
   */
  async upsertTemporalPattern(pattern: Omit<TemporalPattern, 'created_at' | 'updated_at'>): Promise<void> {
    const db = await getDatabase();
    const now = DatabaseUtils.formatDate(new Date());
    
    await db.runAsync(`
      INSERT OR REPLACE INTO temporal_patterns (
        id, user_id, task_title, task_category, time_of_day, day_of_week,
        day_of_month, month, frequency, period_type, confidence,
        last_occurrence, next_predicted, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 
        COALESCE((SELECT created_at FROM temporal_patterns WHERE id = ?), ?), ?
      )
    `, [
      pattern.id, pattern.user_id, pattern.task_title, pattern.task_category,
      pattern.time_of_day, pattern.day_of_week, pattern.day_of_month,
      pattern.month, pattern.frequency, pattern.period_type, pattern.confidence,
      pattern.last_occurrence, pattern.next_predicted, pattern.id, now, now
    ]);
  },

  /**
   * Get user patterns by type
   */
  async getUserPatterns(userId: string, patternType?: string): Promise<UserPattern[]> {
    const db = await getDatabase();
    let query = 'SELECT * FROM user_patterns WHERE user_id = ?';
    const params: any[] = [userId];
    
    if (patternType) {
      query += ' AND pattern_type = ?';
      params.push(patternType);
    }
    
    query += ' ORDER BY confidence DESC, updated_at DESC';
    
    const rows = await db.getAllAsync<any>(query, params);
    return rows.map(row => ({
      ...row,
      pattern_data: DatabaseUtils.deserializeJSON(row.pattern_data)
    }));
  },

  /**
   * Get temporal patterns for a user
   */
  async getTemporalPatterns(userId: string, category?: string): Promise<TemporalPattern[]> {
    const db = await getDatabase();
    let query = 'SELECT * FROM temporal_patterns WHERE user_id = ?';
    const params: any[] = [userId];
    
    if (category) {
      query += ' AND task_category = ?';
      params.push(category);
    }
    
    query += ' ORDER BY confidence DESC, frequency DESC';
    
    return await db.getAllAsync<TemporalPattern>(query, params);
  },

  /**
   * Get pattern triggers for a pattern
   */
  async getPatternTriggers(patternId: string): Promise<PatternTrigger[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<any>(
      'SELECT * FROM pattern_triggers WHERE pattern_id = ? ORDER BY confidence DESC',
      [patternId]
    );
    return rows.map(row => ({
      ...row,
      trigger_data: DatabaseUtils.deserializeJSON(row.trigger_data)
    }));
  },

  /**
   * Get pattern outcomes for a pattern
   */
  async getPatternOutcomes(patternId: string): Promise<PatternOutcome[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<any>(
      'SELECT * FROM pattern_outcomes WHERE pattern_id = ? ORDER BY success_rate DESC',
      [patternId]
    );
    return rows.map(row => ({
      ...row,
      outcome_data: DatabaseUtils.deserializeJSON(row.outcome_data)
    }));
  },

  /**
   * Delete old patterns with low confidence
   */
  async cleanupLowConfidencePatterns(userId: string, minConfidence: number = 0.1): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      'DELETE FROM user_patterns WHERE user_id = ? AND confidence < ?',
      [userId, minConfidence]
    );
  }
};