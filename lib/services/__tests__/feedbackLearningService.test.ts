import FeedbackLearningService from '../feedbackLearningService';
import { initDatabase, deleteDatabase, DatabaseUtils } from '../../database';
import { Suggestion } from '../../types';

describe('FeedbackLearningService', () => {
  let feedbackService: FeedbackLearningService;
  const testUserId = 'test-user-123';

  beforeAll(async () => {
    await initDatabase();
    feedbackService = FeedbackLearningService.getInstance();
  });

  afterAll(async () => {
    await deleteDatabase();
  });

  beforeEach(async () => {
    // Clean up test data before each test
    const db = await require('../../database').getDatabase();
    await db.execAsync('DELETE FROM feedback WHERE user_id = ?', [testUserId]);
    await db.execAsync('DELETE FROM suggestions WHERE user_id = ?', [testUserId]);
    await db.execAsync('DELETE FROM confidence_calibration WHERE user_id = ?', [testUserId]);
    await db.execAsync('DELETE FROM confidence_adjustments WHERE user_id = ?', [testUserId]);
  });

  describe('collectFeedback', () => {
    it('should collect positive feedback successfully', async () => {
      // Create a test suggestion
      const db = await require('../../database').getDatabase();
      const suggestionId = DatabaseUtils.generateId();
      const now = DatabaseUtils.formatDate(new Date());

      await db.runAsync(`
        INSERT INTO suggestions (
          id, user_id, title, category, confidence, based_on, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        suggestionId,
        testUserId,
        'Test Suggestion',
        'Work',
        0.8,
        JSON.stringify(['pattern-1']),
        'pending',
        now
      ]);

      // Collect feedback
      await feedbackService.collectFeedback(
        testUserId,
        suggestionId,
        'positive',
        'Perfect timing',
        {
          time_of_day: 9,
          day_of_week: 1,
          device_context: 'mobile',
          user_activity: 'reviewing_suggestions'
        }
      );

      // Verify feedback was stored
      const feedback = await db.getFirstAsync(
        'SELECT * FROM feedback WHERE user_id = ? AND suggestion_id = ?',
        [testUserId, suggestionId]
      );

      expect(feedback).toBeTruthy();
      expect(feedback.feedback_type).toBe('positive');
      expect(feedback.reason).toBe('Perfect timing');

      // Verify suggestion status was updated
      const suggestion = await db.getFirstAsync(
        'SELECT * FROM suggestions WHERE id = ?',
        [suggestionId]
      );

      expect(suggestion.status).toBe('accepted');
    });

    it('should collect negative feedback successfully', async () => {
      // Create a test suggestion
      const db = await require('../../database').getDatabase();
      const suggestionId = DatabaseUtils.generateId();
      const now = DatabaseUtils.formatDate(new Date());

      await db.runAsync(`
        INSERT INTO suggestions (
          id, user_id, title, category, confidence, based_on, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        suggestionId,
        testUserId,
        'Test Suggestion',
        'Work',
        0.6,
        JSON.stringify(['pattern-1']),
        'pending',
        now
      ]);

      // Collect feedback
      await feedbackService.collectFeedback(
        testUserId,
        suggestionId,
        'negative',
        'Not relevant'
      );

      // Verify feedback was stored
      const feedback = await db.getFirstAsync(
        'SELECT * FROM feedback WHERE user_id = ? AND suggestion_id = ?',
        [testUserId, suggestionId]
      );

      expect(feedback).toBeTruthy();
      expect(feedback.feedback_type).toBe('negative');
      expect(feedback.reason).toBe('Not relevant');

      // Verify suggestion status was updated
      const suggestion = await db.getFirstAsync(
        'SELECT * FROM suggestions WHERE id = ?',
        [suggestionId]
      );

      expect(suggestion.status).toBe('rejected');
    });
  });

  describe('applyLearningAdjustments', () => {
    it('should apply confidence adjustments to suggestions', async () => {
      // Create confidence adjustment data
      const db = await require('../../database').getDatabase();
      await db.runAsync(`
        INSERT INTO confidence_adjustments (
          id, user_id, confidence_range, adjustment_factor, created_at
        ) VALUES (?, ?, ?, ?, ?)
      `, [
        DatabaseUtils.generateId(),
        testUserId,
        '60-80',
        1.1, // 10% increase
        DatabaseUtils.formatDate(new Date())
      ]);

      // Test suggestions
      const suggestions: Suggestion[] = [
        {
          id: 'test-1',
          user_id: testUserId,
          title: 'Test Suggestion 1',
          category: 'Work',
          confidence: 0.7, // Falls in 60-80 range
          based_on: [],
          status: 'pending',
          created_at: '',
          priority: 'medium'
        },
        {
          id: 'test-2',
          user_id: testUserId,
          title: 'Test Suggestion 2',
          category: 'Personal',
          confidence: 0.3, // Falls outside adjustment range
          based_on: [],
          status: 'pending',
          created_at: '',
          priority: 'medium'
        }
      ];

      // Apply learning adjustments
      const adjustedSuggestions = await feedbackService.applyLearningAdjustments(testUserId, suggestions);

      // Verify adjustments
      expect(adjustedSuggestions[0].confidence).toBeCloseTo(0.77, 2); // 0.7 * 1.1
      expect(adjustedSuggestions[1].confidence).toBe(0.3); // No adjustment
    });
  });

  describe('generateFeedbackAnalytics', () => {
    it('should generate analytics with no feedback', async () => {
      const analytics = await feedbackService.generateFeedbackAnalytics(testUserId);

      expect(analytics.total_feedback).toBe(0);
      expect(analytics.positive_feedback).toBe(0);
      expect(analytics.negative_feedback).toBe(0);
      expect(analytics.acceptance_rate).toBe(0);
      expect(analytics.category_performance).toHaveLength(0);
    });

    it('should generate analytics with feedback data', async () => {
      // Create test data
      const db = await require('../../database').getDatabase();
      const now = DatabaseUtils.formatDate(new Date());

      // Create suggestions
      const suggestion1Id = DatabaseUtils.generateId();
      const suggestion2Id = DatabaseUtils.generateId();

      await db.runAsync(`
        INSERT INTO suggestions (
          id, user_id, title, category, confidence, based_on, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [suggestion1Id, testUserId, 'Suggestion 1', 'Work', 0.8, '[]', 'pending', now]);

      await db.runAsync(`
        INSERT INTO suggestions (
          id, user_id, title, category, confidence, based_on, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [suggestion2Id, testUserId, 'Suggestion 2', 'Work', 0.6, '[]', 'pending', now]);

      // Create feedback
      await db.runAsync(`
        INSERT INTO feedback (
          id, user_id, suggestion_id, feedback_type, created_at
        ) VALUES (?, ?, ?, ?, ?)
      `, [DatabaseUtils.generateId(), testUserId, suggestion1Id, 'positive', now]);

      await db.runAsync(`
        INSERT INTO feedback (
          id, user_id, suggestion_id, feedback_type, created_at
        ) VALUES (?, ?, ?, ?, ?)
      `, [DatabaseUtils.generateId(), testUserId, suggestion2Id, 'negative', now]);

      // Generate analytics
      const analytics = await feedbackService.generateFeedbackAnalytics(testUserId);

      expect(analytics.total_feedback).toBe(2);
      expect(analytics.positive_feedback).toBe(1);
      expect(analytics.negative_feedback).toBe(1);
      expect(analytics.acceptance_rate).toBe(50);
      expect(analytics.category_performance).toHaveLength(1);
      expect(analytics.category_performance[0].category).toBe('Work');
      expect(analytics.category_performance[0].acceptance_rate).toBe(50);
    });
  });

  describe('getLearningInsights', () => {
    it('should generate insights based on feedback data', async () => {
      // Create test feedback data for insights
      const db = await require('../../database').getDatabase();
      const now = DatabaseUtils.formatDate(new Date());

      // Create high-acceptance suggestion
      const suggestionId = DatabaseUtils.generateId();
      await db.runAsync(`
        INSERT INTO suggestions (
          id, user_id, title, category, confidence, based_on, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [suggestionId, testUserId, 'Great Suggestion', 'Work', 0.9, '[]', 'pending', now]);

      await db.runAsync(`
        INSERT INTO feedback (
          id, user_id, suggestion_id, feedback_type, created_at
        ) VALUES (?, ?, ?, ?, ?)
      `, [DatabaseUtils.generateId(), testUserId, suggestionId, 'positive', now]);

      // Generate insights
      const insights = await feedbackService.getLearningInsights(testUserId);

      expect(insights).toBeInstanceOf(Array);
      // With limited test data, we may not get specific insights, but the function should work
    });
  });
});