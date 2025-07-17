import { useState, useEffect, useCallback } from 'react';
import { Suggestion } from '../lib/types';
import FeedbackLearningService, { FeedbackAnalytics } from '../lib/services/feedbackLearningService';
import FeedbackProcessingService, { ProcessingResult } from '../lib/services/feedbackProcessingService';

interface UseFeedbackLearningProps {
  userId: string;
}

interface UseFeedbackLearningReturn {
  // Feedback collection
  submitFeedback: (
    suggestionId: string,
    feedbackType: 'positive' | 'negative',
    reason?: string
  ) => Promise<ProcessingResult>;
  
  // Learning adjustments
  applyLearningToSuggestions: (suggestions: Suggestion[]) => Promise<Suggestion[]>;
  
  // Analytics
  analytics: FeedbackAnalytics | null;
  insights: string[];
  loadAnalytics: (timeframe?: { start: Date; end: Date }) => Promise<void>;
  
  // Processing
  processPendingFeedback: () => Promise<number>;
  
  // State
  isLoading: boolean;
  error: string | null;
}

export const useFeedbackLearning = ({ userId }: UseFeedbackLearningProps): UseFeedbackLearningReturn => {
  const [analytics, setAnalytics] = useState<FeedbackAnalytics | null>(null);
  const [insights, setInsights] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const feedbackService = FeedbackLearningService.getInstance();
  const processingService = FeedbackProcessingService.getInstance();

  /**
   * Submit feedback for a suggestion
   */
  const submitFeedback = useCallback(async (
    suggestionId: string,
    feedbackType: 'positive' | 'negative',
    reason?: string
  ): Promise<ProcessingResult> => {
    try {
      setError(null);
      
      // Capture current context
      const now = new Date();
      const context = {
        time_of_day: now.getHours(),
        day_of_week: now.getDay(),
        device_context: 'mobile',
        user_activity: 'reviewing_suggestions'
      };

      // Store feedback in database
      await feedbackService.collectFeedback(
        userId,
        suggestionId,
        feedbackType,
        reason,
        context
      );

      // Process feedback to update patterns and confidence scores
      const result = await processingService.processFeedback(
        userId,
        suggestionId,
        feedbackType,
        context
      );

      // Refresh analytics after feedback submission
      await loadAnalytics();
      
      return result;
    } catch (err) {
      console.error('Error submitting feedback:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit feedback');
      throw err;
    }
  }, [userId]);

  /**
   * Apply learning adjustments to suggestions
   */
  const applyLearningToSuggestions = useCallback(async (suggestions: Suggestion[]): Promise<Suggestion[]> => {
    try {
      setError(null);
      return await feedbackService.applyLearningAdjustments(userId, suggestions);
    } catch (err) {
      console.error('Error applying learning adjustments:', err);
      setError(err instanceof Error ? err.message : 'Failed to apply learning adjustments');
      return suggestions; // Return original suggestions if adjustment fails
    }
  }, [userId]);

  /**
   * Process any pending feedback
   */
  const processPendingFeedback = useCallback(async (): Promise<number> => {
    try {
      setError(null);
      return await processingService.processPendingFeedback(userId);
    } catch (err) {
      console.error('Error processing pending feedback:', err);
      setError(err instanceof Error ? err.message : 'Failed to process pending feedback');
      return 0;
    }
  }, [userId]);

  /**
   * Load analytics and insights
   */
  const loadAnalytics = useCallback(async (timeframe?: { start: Date; end: Date }) => {
    try {
      setIsLoading(true);
      setError(null);

      const [analyticsData, insightsData] = await Promise.all([
        feedbackService.generateFeedbackAnalytics(userId, timeframe),
        feedbackService.getLearningInsights(userId)
      ]);

      setAnalytics(analyticsData);
      setInsights(insightsData);
    } catch (err) {
      console.error('Error loading analytics:', err);
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  /**
   * Load initial analytics on mount and process any pending feedback
   */
  useEffect(() => {
    if (userId) {
      // Load analytics
      loadAnalytics();
      
      // Process any pending feedback
      processPendingFeedback().then(count => {
        if (count > 0) {
          console.log(`Processed ${count} pending feedback items`);
          // Refresh analytics if we processed feedback
          loadAnalytics();
        }
      });
    }
  }, [userId, loadAnalytics, processPendingFeedback]);

  return {
    submitFeedback,
    applyLearningToSuggestions,
    analytics,
    insights,
    loadAnalytics,
    processPendingFeedback,
    isLoading,
    error
  };
};

export default useFeedbackLearning;