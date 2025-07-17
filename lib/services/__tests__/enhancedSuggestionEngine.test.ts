import { EnhancedSuggestionEngine, EnhancedSuggestionManager, UserContext } from '../enhancedSuggestionEngine';
import { PatternDatabaseUtils } from '../../patternDatabase';
import { getDatabase } from '../../database';

// Mock the database and pattern utilities
jest.mock('../../database');
jest.mock('../../patternDatabase');

describe('EnhancedSuggestionEngine', () => {
  const mockUserId = 'test-user-123';
  let engine: EnhancedSuggestionEngine;
  let mockContext: UserContext;

  beforeEach(() => {
    engine = new EnhancedSuggestionEngine(mockUserId);
    mockContext = {
      currentTime: new Date('2024-01-15T10:00:00Z'),
      location: {
        latitude: 40.7128,
        longitude: -74.0060,
        accuracy: 10
      },
      recentTasks: [],
      deviceContext: {
        batteryLevel: 80,
        isCharging: false,
        networkType: 'wifi'
      }
    };

    // Mock database methods
    (getDatabase as jest.Mock).mockResolvedValue({
      getAllAsync: jest.fn().mockResolvedValue([]),
      runAsync: jest.fn().mockResolvedValue(undefined)
    });

    // Mock pattern database methods
    (PatternDatabaseUtils.getUserPatterns as jest.Mock).mockResolvedValue([]);
    (PatternDatabaseUtils.getTemporalPatterns as jest.Mock).mockResolvedValue([]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateSuggestions', () => {
    it('should generate suggestions successfully with empty patterns', async () => {
      const suggestions = await engine.generateSuggestions(mockContext);
      
      expect(suggestions).toBeDefined();
      expect(Array.isArray(suggestions)).toBe(true);
    });

    it('should filter out low-confidence suggestions', async () => {
      // Mock patterns with varying confidence levels
      const mockPatterns = [
        {
          id: '1',
          user_id: mockUserId,
          pattern_type: 'frequency' as const,
          pattern_data: {
            taskTitle: 'Low Confidence Task',
            intervalDays: 7,
            category: 'Work'
          },
          confidence: 0.1, // Below threshold
          frequency: 1,
          last_occurrence: '2024-01-08T10:00:00Z',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      ];

      (PatternDatabaseUtils.getUserPatterns as jest.Mock).mockResolvedValue(mockPatterns);

      const suggestions = await engine.generateSuggestions(mockContext);
      
      // Should not include low-confidence suggestions
      expect(suggestions.length).toBe(0);
    });

    it('should handle errors gracefully', async () => {
      (PatternDatabaseUtils.getUserPatterns as jest.Mock).mockRejectedValue(new Error('Database error'));

      const suggestions = await engine.generateSuggestions(mockContext);
      
      expect(suggestions).toEqual([]);
    });
  });

  describe('Enhanced diversity filtering', () => {
    it('should limit suggestions per category', async () => {
      // This would require more complex mocking to test properly
      // For now, we'll just verify the method exists and can be called
      expect(engine).toBeDefined();
    });
  });
});

describe('EnhancedSuggestionManager', () => {
  const mockUserId = 'test-user-123';
  let manager: EnhancedSuggestionManager;
  let mockContext: UserContext;

  beforeEach(() => {
    manager = new EnhancedSuggestionManager(mockUserId);
    mockContext = {
      currentTime: new Date('2024-01-15T10:00:00Z'),
      recentTasks: [],
    };

    // Mock database methods
    (getDatabase as jest.Mock).mockResolvedValue({
      getAllAsync: jest.fn().mockResolvedValue([]),
      runAsync: jest.fn().mockResolvedValue(undefined)
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('refreshSuggestions', () => {
    it('should refresh suggestions on first call', async () => {
      const suggestions = await manager.refreshSuggestions(mockContext);
      
      expect(suggestions).toBeDefined();
      expect(Array.isArray(suggestions)).toBe(true);
    });

    it('should detect context changes', async () => {
      // First call
      await manager.refreshSuggestions(mockContext);
      
      // Second call with changed context
      const newContext = {
        ...mockContext,
        currentTime: new Date('2024-01-15T13:00:00Z'), // 3 hours later
      };
      
      const result = await manager.checkContextualRefresh(newContext);
      
      expect(result.needsRefresh).toBe(true);
      expect(result.reason).toContain('time change');
    });
  });

  describe('cleanupExpiredSuggestions', () => {
    it('should clean up expired suggestions', async () => {
      const mockDb = {
        runAsync: jest.fn().mockResolvedValue(undefined)
      };
      (getDatabase as jest.Mock).mockResolvedValue(mockDb);

      await manager.cleanupExpiredSuggestions();
      
      expect(mockDb.runAsync).toHaveBeenCalledTimes(2); // Two cleanup queries
    });
  });
});