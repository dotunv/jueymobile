import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';
import { getDatabase } from '../lib/database';
import FeedbackLearningService from '../lib/services/feedbackLearningService';

interface FeedbackAccuracyTrackerProps {
  userId: string;
  timeframe?: 'week' | 'month' | 'all';
}

interface AccuracyTrend {
  date: string;
  accuracy: number;
  total: number;
}

/**
 * Component that tracks and visualizes suggestion accuracy over time
 */
export const FeedbackAccuracyTracker: React.FC<FeedbackAccuracyTrackerProps> = ({ 
  userId, 
  timeframe = 'month' 
}) => {
  const [accuracyTrends, setAccuracyTrends] = useState<AccuracyTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overallAccuracy, setOverallAccuracy] = useState(0);
  const [totalFeedback, setTotalFeedback] = useState(0);
  const [improvementRate, setImprovementRate] = useState(0);

  useEffect(() => {
    loadAccuracyData();
  }, [userId, timeframe]);

  const loadAccuracyData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const db = await getDatabase();
      
      // Calculate date range based on timeframe
      const endDate = new Date();
      let startDate = new Date();
      let groupBy = '%Y-%m-%d'; // Daily grouping
      
      if (timeframe === 'week') {
        startDate.setDate(startDate.getDate() - 7);
      } else if (timeframe === 'month') {
        startDate.setMonth(startDate.getMonth() - 1);
        groupBy = '%Y-%m-%d'; // Daily grouping for month view
      } else {
        startDate.setFullYear(startDate.getFullYear() - 1);
        groupBy = '%Y-%m'; // Monthly grouping for all-time view
      }
      
      // Get accuracy trends over time
      const trends = await db.getAllAsync<any>(`
        SELECT 
          strftime('${groupBy}', f.created_at) as date_group,
          COUNT(*) as total_feedback,
          SUM(CASE WHEN f.feedback_type = 'positive' THEN 1 ELSE 0 END) as positive_feedback,
          (SUM(CASE WHEN f.feedback_type = 'positive' THEN 1 ELSE 0 END) * 100.0 / COUNT(*)) as accuracy
        FROM feedback f
        JOIN suggestions s ON f.suggestion_id = s.id
        WHERE f.user_id = ? AND f.created_at BETWEEN ? AND ?
        GROUP BY date_group
        ORDER BY date_group ASC
      `, [userId, startDate.toISOString(), endDate.toISOString()]);
      
      // Format trends for display
      const formattedTrends = trends.map(t => ({
        date: timeframe === 'all' ? t.date_group : t.date_group.split('-').slice(1).join('/'),
        accuracy: parseFloat(t.accuracy.toFixed(1)),
        total: t.total_feedback
      }));
      
      setAccuracyTrends(formattedTrends);
      
      // Calculate overall metrics
      if (formattedTrends.length > 0) {
        const totalPositive = trends.reduce((sum, t) => sum + t.positive_feedback, 0);
        const totalAll = trends.reduce((sum, t) => sum + t.total_feedback, 0);
        setOverallAccuracy(totalAll > 0 ? (totalPositive / totalAll) * 100 : 0);
        setTotalFeedback(totalAll);
        
        // Calculate improvement rate (comparing first half to second half)
        if (formattedTrends.length >= 4) {
          const midpoint = Math.floor(formattedTrends.length / 2);
          const firstHalf = formattedTrends.slice(0, midpoint);
          const secondHalf = formattedTrends.slice(midpoint);
          
          const firstHalfAccuracy = firstHalf.reduce((sum, t) => sum + (t.accuracy * t.total), 0) / 
                                   firstHalf.reduce((sum, t) => sum + t.total, 0);
          
          const secondHalfAccuracy = secondHalf.reduce((sum, t) => sum + (t.accuracy * t.total), 0) / 
                                    secondHalf.reduce((sum, t) => sum + t.total, 0);
          
          setImprovementRate(secondHalfAccuracy - firstHalfAccuracy);
        }
      }
    } catch (err) {
      console.error('Error loading accuracy data:', err);
      setError('Failed to load accuracy data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading accuracy data...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Error: {error}</Text>
      </View>
    );
  }

  if (accuracyTrends.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No feedback data available for this timeframe.</Text>
      </View>
    );
  }

  const chartData = {
    labels: accuracyTrends.map(t => t.date),
    datasets: [
      {
        data: accuracyTrends.map(t => t.accuracy),
        color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`,
        strokeWidth: 2
      }
    ],
    legend: ['Suggestion Accuracy (%)']
  };

  const chartConfig = {
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    style: {
      borderRadius: 16
    },
    propsForDots: {
      r: '6',
      strokeWidth: '2',
      stroke: '#007AFF'
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Suggestion Accuracy Tracking</Text>
        <Text style={styles.subtitle}>
          Monitoring how well the system learns from your feedback
        </Text>
      </View>

      <View style={styles.metricsContainer}>
        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>{overallAccuracy.toFixed(1)}%</Text>
          <Text style={styles.metricLabel}>Overall Accuracy</Text>
        </View>
        
        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>{totalFeedback}</Text>
          <Text style={styles.metricLabel}>Total Feedback</Text>
        </View>
        
        <View style={styles.metricCard}>
          <Text style={[
            styles.metricValue, 
            improvementRate > 0 ? styles.positiveChange : 
            improvementRate < 0 ? styles.negativeChange : {}
          ]}>
            {improvementRate > 0 ? '+' : ''}{improvementRate.toFixed(1)}%
          </Text>
          <Text style={styles.metricLabel}>Improvement</Text>
        </View>
      </View>

      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Accuracy Trend</Text>
        <LineChart
          data={chartData}
          width={Dimensions.get('window').width - 40}
          height={220}
          chartConfig={chartConfig}
          bezier
          style={styles.chart}
          fromZero
          yAxisSuffix="%"
        />
      </View>

      <View style={styles.insightsContainer}>
        <Text style={styles.insightsTitle}>Accuracy Insights</Text>
        
        {improvementRate > 5 && (
          <View style={[styles.insightCard, styles.positiveInsight]}>
            <Text style={styles.insightText}>
              Great progress! Suggestion accuracy has improved by {improvementRate.toFixed(1)}% over this period.
            </Text>
          </View>
        )}
        
        {improvementRate < -5 && (
          <View style={[styles.insightCard, styles.negativeInsight]}>
            <Text style={styles.insightText}>
              Accuracy has decreased by {Math.abs(improvementRate).toFixed(1)}%. This might be due to changes in your preferences or new suggestion types.
            </Text>
          </View>
        )}
        
        {overallAccuracy > 80 && (
          <View style={[styles.insightCard, styles.positiveInsight]}>
            <Text style={styles.insightText}>
              High accuracy rate of {overallAccuracy.toFixed(1)}% indicates the system is well-tuned to your preferences.
            </Text>
          </View>
        )}
        
        {overallAccuracy < 50 && totalFeedback > 10 && (
          <View style={[styles.insightCard, styles.negativeInsight]}>
            <Text style={styles.insightText}>
              Low accuracy rate suggests the system needs more feedback to better understand your preferences.
            </Text>
          </View>
        )}
        
        {totalFeedback < 10 && (
          <View style={[styles.insightCard, styles.neutralInsight]}>
            <Text style={styles.insightText}>
              Limited feedback data available. Provide more feedback to improve suggestion accuracy.
            </Text>
          </View>
        )}
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
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#f44336',
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  header: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    lineHeight: 22,
  },
  metricsContainer: {
    flexDirection: 'row',
    padding: 20,
    paddingTop: 0,
    justifyContent: 'space-between',
  },
  metricCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 4,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  positiveChange: {
    color: '#4CAF50',
  },
  negativeChange: {
    color: '#f44336',
  },
  chartContainer: {
    padding: 20,
    backgroundColor: 'white',
    margin: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  chart: {
    borderRadius: 12,
    marginVertical: 8,
  },
  insightsContainer: {
    padding: 20,
    paddingTop: 0,
  },
  insightsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  insightCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
  },
  positiveInsight: {
    backgroundColor: '#e8f5e9',
    borderLeftColor: '#4CAF50',
  },
  negativeInsight: {
    backgroundColor: '#ffebee',
    borderLeftColor: '#f44336',
  },
  neutralInsight: {
    backgroundColor: '#e3f2fd',
    borderLeftColor: '#1976d2',
  },
  insightText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
});

export default FeedbackAccuracyTracker;