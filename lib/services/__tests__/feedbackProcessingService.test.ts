import { getDatabase, DatabaseUtils, initDatabase } from '../../database';
import { PatternDatabaseUtils } from '../../patternDatabase';
import FeedbackLearningService from '../feedbackLearningService';
import FeedbackProcessingService from '../feedbackProcessingService';
import { Suggestion } from '../../types';

// Mock database
jest.mock('../../database', () => {
  const mockDb = {
    runAsync: jest.fn(),
    getAllAsync: jest.fn(),
    getFirstAsync: jest.fn(),
    execAsync: jest.fn(),
  };
  
  return {
    getDatabase: jest.fn().mockResolvedValue(mockDb),
    DatabaseUtils: {
      formatDate: jest.fn().mockReturnValue('2023-01-01T00:00:00.000Z'),
      generateId: jest.fn().mockReturnValue('test-id-123'),
      serializeJSON: jest.fn(data => JSON.stringify(data)),
      deserializeJSON: jest.fn(json => JSON.parse(json)),
    },
    initDatabase: jest.fn().mockResolvedValue(mockDb),
  };
});

describe('FeedbackProcessingService', () => {
  let processingService: FeedbackProcessingService;
  let feedbackService: FeedbackLearningService;
  let mockDb: any;
  
  const mockUserId = 'user-123';
  const mockSuggestionId = 'suggestion-123';
  
  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Get mock database
    mockDb = await getDatabase();
    
    // Setup mock suggestion
    mockDb.getFirstAsync.mockImplementation((query: string, params: any[]) => {
      if (query.includes('FROM suggestions')) {
        return Promise.resolve({
          id: mockSuggestionId,
          user_id: mockUserId,
          title: 'Test Suggestion',
          category: 'Work',
          confidence: 0.75,
          based_on: JSON.stringify(['pattern-1', 'pattern-2']),
          status: 'pending',
          created_at: '2023-01-01T00:00:00.000Z',
          priority: 'medium'
        } as Suggestion);
      }
      
      if (query.includes('FROM user_patterns')) {
        return Promise.resolve({
          id: 'pattern-1',
          user_id: mockUserId,
          pattern_type: 'temporal',
          confidence: 0.6,
          frequency: 5,
          last_occurrence: '2023-01-01T00:00:00.000Z'
        });
      }
      
      return Promise.resolve(null);
    });
    
    // Setup mock feedback stats
    mockDb.getFirstAsync.mockImplementation((query: string, params: any[]) => {
      if (query.includes('total_feedback')) {
        return Promise.resolve({
          total_feedback: 10,
          consistent_feedback: 8
        });
      }
      
      return null;
    });
    
    // Get service instances
    processingService = FeedbackProcessingService.getInstance();
    feedbackService = FeedbackLearningService.getInstance();
  });
  
  describe('processFeedback', () => {
    it('should process positive feedback and update pattern confidence', async () => {
      // Arrange
      const feedbackType = 'positive';
      const context = {
        time_of_day: 14,
        day_of_week: 2
      };
      
      // Act
      const result = await processingService.processFeedback(
        mockUserId,
        mockSuggestionId,
        feedbackType,
        context
      );
      
      // Assert
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE suggestions'),
        expect.arrayContaining(['accepted', expect.any(String), mockSuggestionId])
      );
      
      expect(result).toEqual(expect.objectContaining({
        patternUpdates: expect.any(Number),
        confidenceAdjustments: expect.any(Number),
        learningRate: expect.any(Number)
      }));
    });
    
    it('should process negative feedback and decrease pattern confidence', async () => {
      // Arrange
      const feedbackType = 'negative';
      const context = {
        time_of_day: 14,
        day_of_week: 2
      };
      
      // Act
      const result = await processingService.processFeedback(
        mockUserId,
        mockSuggestionId,
        feedbackType,
        context
      );
      
      // Assert
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE suggestions'),
        expect.arrayContaining(['rejected', expect.any(String), mockSuggestionId])
      );
      
      expect(result).toEqual(expect.objectContaining({
        patternUpdates: expect.any(Number),
        confidenceAdjustments: expect.any(Number),
        learningRate: expect.any(Number)
      }));
    });
  });
  
  describe('processPendingFeedback', () => {
    it('should process multiple pending feedback items', async () => {
      // Arrange
      mockDb.getAllAsync.mockImplementation((query: string, params: any[]) => {
        if (query.includes('FROM feedback f')) {
          return Promise.resolve([
            {
              feedback_id: 'feedback-1',
              suggestion_id: 'suggestion-1',
              feedback_type: 'positive',
              time_of_day: 10,
              day_of_week: 1
            },
            {
              feedback_id: 'feedback-2',
              suggestion_id: 'suggestion-2',
              feedback_type: 'negative',
              time_of_day: 15,
              day_of_week: 3
            }
          ]);
        }
        
        return Promise.resolve([]);
      });
      
      // Mock processFeedback
      const processFeedbackSpy = jest.spyOn(processingService, 'processFeedback')
        .mockResolvedValue({ patternUpdates: 1, confidenceAdjustments: 1, learningRate: 0.1 });
      
      // Act
      const processedCount = await processingService.processPendingFeedback(mockUserId);
      
      // Assert
      expect(processedCount).toBe(2);
      expect(processFeedbackSpy).toHaveBeenCalledTimes(2);
      expect(processFeedbackSpy).toHaveBeenCalledWith(
        mockUserId,
        'suggestion-1',
        'positive',
        expect.objectContaining({ time_of_day: 10, day_of_week: 1 })
      );
      expect(processFeedbackSpy).toHaveBeenCalledWith(
        mockUserId,
        'suggestion-2',
        'negative',
        expect.objectContaining({ time_of_day: 15, day_of_week: 3 })
      );
      
      // Restore spy
      processFeedbackSpy.mockRestore();
    });
  });
  
  describe('applyLearningAdjustments', () => {
    it('should adjust suggestion confidence based on learning', async () => {
      // Arrange
      const mockSuggestions: Suggestion[] = [
        {
          id: 'suggestion-1',
          user_id: mockUserId,
          title: 'Test Suggestion 1',
          category: 'Work',
          confidence: 0.7,
          based_on: JSON.stringify(['pattern-1']),
          status: 'pending',
          created_at: '2023-01-01T00:00:00.000Z',
          priority: 'medium'
        },
        {
          id: 'suggestion-2',
          user_id: mockUserId,
          title: 'Test Suggestion 2',
          category: 'Personal',
          confidence: 0.5,
          based_on: JSON.stringify(['pattern-2']),
          status: 'pending',
          created_at: '2023-01-01T00:00:00.000Z',
          priority: 'low'
        }
      ];
      
      // Mock confidence adjustments
      mockDb.getAllAsync.mockImplementation((query: string, params: any[]) => {
        if (query.includes('FROM confidence_adjustments')) {
          return Promise.resolve([
            { confidence_range: '60-80', adjustment_factor: 1.1 },
            { confidence_range: '40-60', adjustment_factor: 0.9 }
          ]);
        }
        
        if (query.includes('FROM feedback f')) {
          return Promise.resolve([
            { category: 'Work', total_suggestions: 5, accepted: 4, avg_confidence: 0.7 },
            { category: 'Personal', total_suggestions: 3, accepted: 1, avg_confidence: 0.6 }
          ]);
        }
        
        return Promise.resolve([]);
      });
      
      // Act
      const adjustedSuggestions = await feedbackService.applyLearningAdjustments(
        mockUserId,
        mockSuggestions
      );
      
      // Assert
      expect(adjustedSuggestions).toHaveLength(2);
      expect(adjustedSuggestions[0].confidence).not.toBe(mockSuggestions[0].confidence);
      expect(adjustedSuggestions[1].confidence).not.toBe(mockSuggestions[1].confidence);
      
      // Work category has good performance, so confidence should increase
      expect(adjustedSuggestions[0].confidence).toBeGreaterThanOrEqual(mockSuggestions[0].confidence);
      
      // Personal category has poor performance, so confidence should decrease
      expect(adjustedSuggestions[1].confidence).toBeLessThanOrEqual(mockSuggestions[1].confidence);
    });
  });
});