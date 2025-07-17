import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { BarChart, LineChart } from 'lucide-react-native';
import { SpeechRecognitionService } from '@/lib/services/voice/SpeechRecognitionService';
import { AccuracyMetrics, ErrorPattern } from '@/lib/services/voice/AccuracyMonitor';

export default function FeedbackAccuracyTracker() {
  const { theme } = useTheme();
  const [metrics, setMetrics] = useState<AccuracyMetrics | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'week' | 'month' | 'all'>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Load metrics on mount and when period changes
  useEffect(() => {
    loadMetrics();
  }, [selectedPeriod]);
  
  // Load accuracy metrics
  const loadMetrics = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const speechService = new SpeechRecognitionService();
      const metrics = await speechService.getAccuracyMetrics(selectedPeriod);
      
      setMetrics(metrics);
      setIsLoading(false);
    } catch (err) {
      console.error('Failed to load metrics:', err);
      setError('Failed to load accuracy metrics');
      setIsLoading(false);
    }
  };
  
  // Format percentage
  const formatPercentage = (value: number) => {
    return `${Math.round(value * 100)}%`;
  };
  
  // Get color based on value
  const getValueColor = (value: number) => {
    if (value >= 0.9) return theme.colors.success;
    if (value >= 0.7) return theme.colors.warning;
    return theme.colors.error;
  };
  
  // Get improvement rate text and color
  const getImprovementText = () => {
    if (!metrics) return { text: 'N/A', color: theme.colors.textSecondary };
    
    const rate = metrics.improvementRate;
    if (rate > 0.05) {
      return { text: `+${formatPercentage(rate)} Improving`, color: theme.colors.success };
    } else if (rate < -0.05) {
      return { text: `${formatPercentage(rate)} Declining`, color: theme.colors.error };
    } else {
      return { text: 'Stable', color: theme.colors.textSecondary };
    }
  };
  
  // Render period selector
  const renderPeriodSelector = () => {
    const periods: { label: string; value: 'day' | 'week' | 'month' | 'all' }[] = [
      { label: 'Today', value: 'day' },
      { label: 'Week', value: 'week' },
      { label: 'Month', value: 'month' },
      { label: 'All', value: 'all' },
    ];
    
    return (
      <View style={styles.periodSelector}>
        {periods.map((period) => (
          <TouchableOpacity
            key={period.value}
            style={[
              styles.periodButton,
              selectedPeriod === period.value && { 
                backgroundColor: theme.colors.primary + '20',
                borderColor: theme.colors.primary,
              }
            ]}
            onPress={() => setSelectedPeriod(period.value)}
          >
            <Text
              style={[
                styles.periodButtonText,
                { color: selectedPeriod === period.value ? theme.colors.primary : theme.colors.textSecondary }
              ]}
            >
              {period.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };
  
  // Render metrics card
  const renderMetricsCard = () => {
    if (!metrics) {
      return (
        <View style={[styles.noDataContainer, { backgroundColor: theme.colors.surfaceVariant }]}>
          <Text style={[styles.noDataText, { color: theme.colors.textSecondary }]}>
            No transcription data available yet. Try using voice input to generate metrics.
          </Text>
        </View>
      );
    }
    
    const improvementInfo = getImprovementText();
    
    return (
      <View style={[styles.metricsCard, { backgroundColor: theme.colors.surfaceVariant }]}>
        <View style={styles.metricRow}>
          <View style={styles.metric}>
            <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>
              Transcriptions
            </Text>
            <Text style={[styles.metricValue, { color: theme.colors.text }]}>
              {metrics.totalTranscriptions}
            </Text>
          </View>
          
          <View style={styles.metric}>
            <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>
              Avg. Confidence
            </Text>
            <Text style={[
              styles.metricValue, 
              { color: getValueColor(metrics.averageConfidence) }
            ]}>
              {formatPercentage(metrics.averageConfidence)}
            </Text>
          </View>
        </View>
        
        <View style={styles.metricRow}>
          <View style={styles.metric}>
            <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>
              User Corrections
            </Text>
            <Text style={[styles.metricValue, { color: theme.colors.text }]}>
              {metrics.totalCorrected}
            </Text>
          </View>
          
          <View style={styles.metric}>
            <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>
              Avg. Rating
            </Text>
            <Text style={[
              styles.metricValue, 
              { color: metrics.averageRating >= 4 ? theme.colors.success : theme.colors.warning }
            ]}>
              {metrics.averageRating.toFixed(1)}/5
            </Text>
          </View>
        </View>
        
        <View style={[styles.trendContainer, { borderTopColor: theme.colors.border }]}>
          <View style={styles.trendIconContainer}>
            <LineChart size={20} color={improvementInfo.color} />
          </View>
          <Text style={[styles.trendText, { color: improvementInfo.color }]}>
            {improvementInfo.text}
          </Text>
        </View>
      </View>
    );
  };
  
  // Render error patterns
  const renderErrorPatterns = () => {
    if (!metrics || !metrics.commonErrorPatterns || metrics.commonErrorPatterns.length === 0) {
      return null;
    }
    
    return (
      <View style={styles.patternsContainer}>
        <View style={styles.sectionHeader}>
          <BarChart size={20} color={theme.colors.text} />
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Common Error Patterns
          </Text>
        </View>
        
        {metrics.commonErrorPatterns.map((pattern, index) => (
          <View 
            key={index}
            style={[
              styles.patternCard, 
              { backgroundColor: theme.colors.surfaceVariant }
            ]}
          >
            <Text style={[styles.patternText, { color: theme.colors.text }]}>
              {pattern.pattern}
            </Text>
            <Text style={[styles.patternCount, { color: theme.colors.textSecondary }]}>
              {pattern.count} occurrences
            </Text>
            
            {pattern.examples.length > 0 && (
              <View style={[styles.examplesContainer, { borderTopColor: theme.colors.border }]}>
                <Text style={[styles.examplesTitle, { color: theme.colors.textSecondary }]}>
                  Examples:
                </Text>
                {pattern.examples.map((example, i) => (
                  <Text key={i} style={[styles.exampleText, { color: theme.colors.text }]}>
                    {example}
                  </Text>
                ))}
              </View>
            )}
          </View>
        ))}
      </View>
    );
  };
  
  return (
    <ScrollView style={styles.container}>
      <Text style={[styles.title, { color: theme.colors.text }]}>
        Transcription Accuracy Tracker
      </Text>
      
      {error && (
        <View style={[styles.errorContainer, { backgroundColor: theme.colors.errorLight }]}>
          <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text>
        </View>
      )}
      
      {renderPeriodSelector()}
      
      {isLoading ? (
        <View style={[styles.loadingContainer, { backgroundColor: theme.colors.surfaceVariant }]}>
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
            Loading metrics...
          </Text>
        </View>
      ) : (
        <>
          {renderMetricsCard()}
          {renderErrorPatterns()}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    marginBottom: 16,
  },
  errorContainer: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
  },
  periodSelector: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  periodButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 8,
  },
  periodButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
  },
  loadingContainer: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  noDataContainer: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
  },
  noDataText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
  },
  metricsCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  metric: {
    flex: 1,
  },
  metricLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
  },
  trendIconContainer: {
    marginRight: 8,
  },
  trendText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
  },
  patternsContainer: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    marginLeft: 8,
  },
  patternCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  patternText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    marginBottom: 4,
  },
  patternCount: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  examplesContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  examplesTitle: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    marginBottom: 8,
  },
  exampleText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    marginBottom: 4,
  },
});