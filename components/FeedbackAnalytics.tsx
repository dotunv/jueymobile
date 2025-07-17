import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import FeedbackLearningService, { FeedbackAnalytics as FeedbackAnalyticsData } from '../lib/services/feedbackLearningService';

interface FeedbackAnalyticsProps {
  userId: string;
}

export const FeedbackAnalytics: React.FC<FeedbackAnalyticsProps> = ({ userId }) => {
  const [analytics, setAnalytics] = useState<FeedbackAnalyticsData | null>(null);
  const [insights, setInsights] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<'week' | 'month' | 'all'>('month');

  const feedbackService = FeedbackLearningService.getInstance();

  useEffect(() => {
    loadAnalytics();
  }, [userId, timeframe]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      let timeframeFilter;
      if (timeframe === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        timeframeFilter = { start: weekAgo, end: new Date() };
      } else if (timeframe === 'month') {
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        timeframeFilter = { start: monthAgo, end: new Date() };
      }

      const [analyticsData, insightsData] = await Promise.all([
        feedbackService.generateFeedbackAnalytics(userId, timeframeFilter),
        feedbackService.getLearningInsights(userId)
      ]);

      setAnalytics(analyticsData);
      setInsights(insightsData);
    } catch (error) {
      console.error('Error loading feedback analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const TimeframeButton: React.FC<{ value: 'week' | 'month' | 'all'; label: string }> = ({ value, label }) => (
    <TouchableOpacity
      style={[styles.timeframeButton, timeframe === value && styles.activeTimeframeButton]}
      onPress={() => setTimeframe(value)}
    >
      <Text style={[styles.timeframeButtonText, timeframe === value && styles.activeTimeframeButtonText]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const MetricCard: React.FC<{ title: string; value: string | number; subtitle?: string; color?: string }> = ({ 
    title, 
    value, 
    subtitle, 
    color = '#007AFF' 
  }) => (
    <View style={styles.metricCard}>
      <Text style={styles.metricTitle}>{title}</Text>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      {subtitle && <Text style={styles.metricSubtitle}>{subtitle}</Text>}
    </View>
  );

  const ProgressBar: React.FC<{ percentage: number; color?: string }> = ({ percentage, color = '#4CAF50' }) => (
    <View style={styles.progressBarContainer}>
      <View style={[styles.progressBar, { width: `${Math.min(100, Math.max(0, percentage))}%`, backgroundColor: color }]} />
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading analytics...</Text>
      </View>
    );
  }

  if (!analytics || analytics.total_feedback === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No feedback data yet</Text>
        <Text style={styles.emptySubtitle}>
          Start rating AI suggestions to see learning analytics and insights.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>AI Learning Analytics</Text>

      {/* Timeframe Selector */}
      <View style={styles.timeframeSelector}>
        <TimeframeButton value="week" label="Week" />
        <TimeframeButton value="month" label="Month" />
        <TimeframeButton value="all" label="All Time" />
      </View>

      {/* Overall Metrics */}
      <View style={styles.metricsGrid}>
        <MetricCard
          title="Acceptance Rate"
          value={`${analytics.acceptance_rate.toFixed(1)}%`}
          subtitle={`${analytics.positive_feedback}/${analytics.total_feedback} accepted`}
          color={analytics.acceptance_rate >= 70 ? '#4CAF50' : analytics.acceptance_rate >= 50 ? '#FF9800' : '#f44336'}
        />
        <MetricCard
          title="Total Feedback"
          value={analytics.total_feedback}
          subtitle="suggestions rated"
        />
      </View>

      {/* Learning Insights */}
      {insights.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🧠 Learning Insights</Text>
          {insights.map((insight, index) => (
            <View key={index} style={styles.insightCard}>
              <Text style={styles.insightText}>{insight}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Category Performance */}
      {analytics.category_performance.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📊 Category Performance</Text>
          {analytics.category_performance.map((category, index) => (
            <View key={index} style={styles.categoryCard}>
              <View style={styles.categoryHeader}>
                <Text style={styles.categoryName}>{category.category}</Text>
                <Text style={styles.categoryRate}>{category.acceptance_rate.toFixed(1)}%</Text>
              </View>
              <ProgressBar percentage={category.acceptance_rate} />
              <Text style={styles.categoryStats}>
                {category.accepted}/{category.total_suggestions} accepted • 
                Avg confidence: {(category.avg_confidence * 100).toFixed(0)}%
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Confidence Calibration */}
      {analytics.confidence_accuracy.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🎯 Confidence Calibration</Text>
          <Text style={styles.sectionSubtitle}>
            How well AI confidence matches actual acceptance rates
          </Text>
          {analytics.confidence_accuracy.map((range, index) => (
            <View key={index} style={styles.calibrationCard}>
              <View style={styles.calibrationHeader}>
                <Text style={styles.calibrationRange}>{range.confidence_range}%</Text>
                <Text style={styles.calibrationAccuracy}>
                  {range.actual_accuracy.toFixed(1)}% actual
                </Text>
              </View>
              <ProgressBar 
                percentage={range.actual_accuracy} 
                color={range.calibration_error < 10 ? '#4CAF50' : range.calibration_error < 20 ? '#FF9800' : '#f44336'}
              />
              <Text style={styles.calibrationStats}>
                {range.accepted}/{range.total_suggestions} suggestions • 
                Error: {range.calibration_error.toFixed(1)}%
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Temporal Patterns */}
      {analytics.temporal_patterns.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⏰ Time-based Patterns</Text>
          {analytics.temporal_patterns.map((pattern, index) => (
            <View key={index} style={styles.temporalCard}>
              <View style={styles.temporalHeader}>
                <Text style={styles.temporalPeriod}>{pattern.time_period}</Text>
                <Text style={styles.temporalRate}>{pattern.acceptance_rate.toFixed(1)}%</Text>
              </View>
              <ProgressBar percentage={pattern.acceptance_rate} />
              <Text style={styles.temporalStats}>
                {pattern.total_feedback} feedback • 
                Pattern strength: {pattern.pattern_strength > 0.7 ? 'Strong' : 'Moderate'}
              </Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Your feedback helps the AI learn and improve suggestions over time.
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#f8f9fa',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    padding: 20,
    paddingBottom: 10,
  },
  timeframeSelector: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 10,
  },
  timeframeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#e3f2fd',
    alignItems: 'center',
  },
  activeTimeframeButton: {
    backgroundColor: '#007AFF',
  },
  timeframeButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1976d2',
  },
  activeTimeframeButtonText: {
    color: 'white',
  },
  metricsGrid: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 20,
  },
  metricCard: {
    flex: 1,
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  metricTitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    textAlign: 'center',
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  metricSubtitle: {
    fontSize: 10,
    color: '#888',
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  insightCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  insightText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  categoryCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  categoryRate: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  categoryStats: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: '#e0e0e0',
    borderRadius: 3,
    marginVertical: 8,
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  calibrationCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  calibrationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  calibrationRange: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  calibrationAccuracy: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  calibrationStats: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  temporalCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  temporalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  temporalPeriod: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  temporalRate: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  temporalStats: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  footer: {
    padding: 20,
    paddingTop: 0,
  },
  footerText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default FeedbackAnalytics;