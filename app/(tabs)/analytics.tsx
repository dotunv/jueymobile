import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  BarChart3, 
  TrendingUp, 
  Target, 
  Clock, 
  Calendar, 
  CheckCircle, 
  XCircle,
  Download,
  TrendingDown,
  Minus,
  Zap,
  Award,
  AlertTriangle,
  Lightbulb
} from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { useTaskStore } from '../../lib/taskStore';
import { useDatabaseOperations } from '../../context/DatabaseContext';
import { useAuth } from '../../context/AuthContext';
import { AnalyticsService, AnalyticsData, ProductivityInsights, AdvancedProductivityMetrics, PredictiveInsights, PersonalizedInsights } from '../../lib/services/analyticsService';
import PageHeader from '../../components/PageHeader';
import Card from '@/components/ui/Card'; // <-- Import new Card component

export default function AnalyticsScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { getTaskAnalytics } = useDatabaseOperations();
  
  const tasks = useTaskStore((state) => state.tasks);
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'year'>('week');
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [productivityScore, setProductivityScore] = useState(0);
  const [advancedMetrics, setAdvancedMetrics] = useState<AdvancedProductivityMetrics | null>(null);
  const [predictiveInsights, setPredictiveInsights] = useState<PredictiveInsights | null>(null);
  const [personalizedInsights, setPersonalizedInsights] = useState<PersonalizedInsights | null>(null);

  // Load analytics on mount and when period changes
  useEffect(() => {
    loadAnalytics();
  }, [tasks, selectedPeriod, user?.id]);

  const mapTaskListItemsToTasks = (taskList: any[], userId: string | undefined) => {
    if (!userId) return [];
    return taskList.map((t) => ({ ...t, user_id: t.user_id ?? userId }));
  };

  const loadAnalytics = async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      const tasksForAnalytics = mapTaskListItemsToTasks(tasks, user.id);
      const data = await AnalyticsService.getAnalytics(tasksForAnalytics, selectedPeriod);
      setAnalyticsData(data);
      
      // Calculate productivity score
      const score = AnalyticsService.calculateProductivityScore(tasksForAnalytics);
      setProductivityScore(score);

      // Load advanced analytics
      const advanced = AnalyticsService.getAdvancedProductivityMetrics(tasksForAnalytics);
      setAdvancedMetrics(advanced);

      const predictive = AnalyticsService.getPredictiveInsights(tasksForAnalytics);
      setPredictiveInsights(predictive);

      const personalized = AnalyticsService.getPersonalizedInsights(tasksForAnalytics);
      setPersonalizedInsights(personalized);
    } catch (error) {
      console.error('Error loading analytics:', error);
      Alert.alert('Error', 'Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAnalytics();
    setRefreshing(false);
  };

  const handleExport = async () => {
    if (!analyticsData) return;
    
    try {
      const exportData = await AnalyticsService.exportAnalytics(analyticsData);
      
      // In a real app, this would save to file or share
      Alert.alert(
        'Export Ready',
        'Analytics data has been prepared for export. In a real app, this would save to your device or share via email.',
        [
          { text: 'OK' },
          { 
            text: 'Copy Data', 
            onPress: () => {
              // This would copy to clipboard in a real app
              Alert.alert('Copied!', 'Analytics data copied to clipboard');
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error exporting analytics:', error);
      Alert.alert('Error', 'Failed to export analytics');
    }
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up': return <TrendingUp size={16} color={theme.colors.success} />;
      case 'down': return <TrendingDown size={16} color={theme.colors.error} />;
      case 'stable': return <Minus size={16} color={theme.colors.warning} />;
    }
  };

  const getProductivityColor = (score: number) => {
    if (score >= 80) return theme.colors.success;
    if (score >= 60) return theme.colors.warning;
    return theme.colors.error;
  };

  const getProductivityLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Needs Improvement';
  };

  const getBurnoutRiskColor = (risk: string) => {
    switch (risk) {
      case 'high': return theme.colors.error;
      case 'medium': return theme.colors.warning;
      case 'low': return theme.colors.success;
      default: return theme.colors.textTertiary;
    }
  };

  const getEfficiencyTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return <TrendingUp size={16} color={theme.colors.success} />;
      case 'declining': return <TrendingDown size={16} color={theme.colors.error} />;
      case 'stable': return <Minus size={16} color={theme.colors.warning} />;
      default: return <Minus size={16} color={theme.colors.textTertiary} />;
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
            Loading analytics...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!analyticsData) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.emptyContainer}>
          <BarChart3 size={48} color={theme.colors.textTertiary} />
          <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
            No Analytics Data
          </Text>
          <Text style={[styles.emptyDescription, { color: theme.colors.textSecondary }]}>
            Start creating tasks to see your productivity analytics.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const { overview, categories, insights } = analyticsData;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}> 
      <ScrollView 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
      >
        <PageHeader
          icon={BarChart3}
          title="Analytics"
          subtitle={`${analyticsData.period.label} • ${productivityScore}% productivity`}
          actionButton={{
            text: "Export",
            onPress: handleExport,
            variant: "secondary"
          }}
        />

        {/* Period Selector */}
        <View style={styles.periodSelectorWrapper}>
          <View style={styles.periodSelector}>
            {['week', 'month', 'year'].map((period) => (
              <TouchableOpacity
                key={period}
                style={[
                  styles.periodButton,
                  selectedPeriod === period && { backgroundColor: theme.colors.primary }
                ]}
                onPress={() => setSelectedPeriod(period as any)}
              >
                <Text style={[
                  styles.periodButtonText,
                  { color: selectedPeriod === period ? 'white' : theme.colors.textSecondary }
                ]}>
                  {period.charAt(0).toUpperCase() + period.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Productivity Score Card */}
        <Card style={styles.card}>
          <View style={styles.productivityHeader}>
            <View style={[styles.productivityIcon, { backgroundColor: getProductivityColor(productivityScore) + '20' }]}> 
              <Award size={24} color={getProductivityColor(productivityScore)} />
            </View>
            <View style={styles.productivityInfo}>
              <Text style={[styles.productivityScore, { color: getProductivityColor(productivityScore) }]}> 
                {productivityScore}%
              </Text>
              <Text style={[styles.productivityLabel, { color: theme.colors.textSecondary }]}> 
                Productivity Score
              </Text>
              <Text style={[styles.productivityStatus, { color: getProductivityColor(productivityScore) }]}> 
                {getProductivityLabel(productivityScore)}
              </Text>
            </View>
          </View>
        </Card>

        {/* Overview Card */}
        <Card style={styles.card}>
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Overview</Text>
          <View style={styles.overviewRow}>
            <View style={styles.overviewCol}>
              <View style={[styles.overviewIcon, { backgroundColor: theme.colors.primary + '15' }]}> 
                <TrendingUp size={24} color={theme.colors.primary} strokeWidth={2} />
              </View>
              <Text style={[styles.overviewLabel, { color: theme.colors.textSecondary }]}>Completion Rate</Text>
              <Text style={[styles.overviewValue, { color: theme.colors.text }]}>{overview.completionRate}%</Text>
              <Text style={[styles.overviewSubtext, { color: theme.colors.textTertiary }]}> 
                {overview.completedTasks} of {overview.totalTasks} tasks
              </Text>
            </View>
            <View style={styles.overviewCol}>
              <View style={[styles.overviewIcon, { backgroundColor: theme.colors.success + '15' }]}> 
                <Target size={24} color={theme.colors.success} strokeWidth={2} />
              </View>
              <Text style={[styles.overviewLabel, { color: theme.colors.textSecondary }]}>Avg Tasks/Day</Text>
              <Text style={[styles.overviewValue, { color: theme.colors.text }]}>{overview.averageTasksPerDay}</Text>
              <Text style={[styles.overviewSubtext, { color: theme.colors.textTertiary }]}> 
                {insights.productivity.mostProductiveDay} is best
              </Text>
            </View>
          </View>
        </Card>

        {/* Advanced Productivity Metrics */}
        {advancedMetrics && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Advanced Metrics
            </Text>
            <Card style={styles.metricsCard}>
              <View style={styles.metricsGrid}>
                <View style={styles.metricItem}>
                  <Text style={[styles.metricValue, { color: theme.colors.primary }]}>
                    {advancedMetrics.taskVelocity}
                  </Text>
                  <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>
                    Tasks/Day
                  </Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={[styles.metricValue, { color: theme.colors.primary }]}>
                    {advancedMetrics.focusScore}%
                  </Text>
                  <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>
                    Focus Score
                  </Text>
                </View>
                <View style={styles.metricItem}>
                  <View style={styles.trendContainer}>
                    {getEfficiencyTrendIcon(advancedMetrics.efficiencyTrend)}
                    <Text style={[styles.metricValue, { color: theme.colors.primary }]}>
                      {advancedMetrics.efficiencyTrend}
                    </Text>
                  </View>
                  <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>
                    Efficiency
                  </Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={[styles.metricValue, { color: getBurnoutRiskColor(advancedMetrics.burnoutRisk) }]}>
                    {advancedMetrics.burnoutRisk}
                  </Text>
                  <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>
                    Burnout Risk
                  </Text>
                </View>
              </View>
              {advancedMetrics.peakProductivityHours.length > 0 && (
                <View style={styles.peakHoursContainer}>
                  <Text style={[styles.peakHoursLabel, { color: theme.colors.textSecondary }]}>
                    Peak Hours: {advancedMetrics.peakProductivityHours.join(', ')}
                  </Text>
                </View>
              )}
            </Card>
          </View>
        )}

        {/* Predictive Insights */}
        {predictiveInsights && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Predictive Insights
            </Text>
            <Card style={styles.insightsCard}>
              <View style={styles.insightRow}>
                <Clock size={20} color={theme.colors.primary} />
                <View style={styles.insightContent}>
                  <Text style={[styles.insightTitle, { color: theme.colors.text }]}>
                    Estimated Completion Time
                  </Text>
                  <Text style={[styles.insightValue, { color: theme.colors.textSecondary }]}>
                    {Math.round(predictiveInsights.estimatedCompletionTime / 60)} hours
                  </Text>
                </View>
              </View>
              <View style={styles.insightRow}>
                <Target size={20} color={theme.colors.success} />
                <View style={styles.insightContent}>
                  <Text style={[styles.insightTitle, { color: theme.colors.text }]}>
                    Completion Probability
                  </Text>
                  <Text style={[styles.insightValue, { color: theme.colors.textSecondary }]}>
                    {predictiveInsights.completionProbability}%
                  </Text>
                </View>
              </View>
              <View style={styles.insightRow}>
                <Calendar size={20} color={theme.colors.warning} />
                <View style={styles.insightContent}>
                  <Text style={[styles.insightTitle, { color: theme.colors.text }]}>
                    Optimal Scheduling
                  </Text>
                  <Text style={[styles.insightValue, { color: theme.colors.textSecondary }]}>
                    {predictiveInsights.optimalSchedulingTime}
                  </Text>
                </View>
              </View>
            </Card>
          </View>
        )}

        {/* Personalized Recommendations */}
        {personalizedInsights && personalizedInsights.recommendations.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              AI Recommendations
            </Text>
            {personalizedInsights.recommendations.map((recommendation, index) => (
              <Card key={recommendation.id} style={styles.recommendationCard}>
                <View style={styles.recommendationHeader}>
                  <Lightbulb size={20} color={theme.colors.primary} />
                  <View style={styles.recommendationMeta}>
                    <Text style={[styles.recommendationTitle, { color: theme.colors.text }]}>
                      {recommendation.title}
                    </Text>
                    <Text style={[styles.recommendationImpact, { color: theme.colors.success }]}>
                      {recommendation.impact}% impact
                    </Text>
                  </View>
                </View>
                <Text style={[styles.recommendationDescription, { color: theme.colors.textSecondary }]}>
                  {recommendation.description}
                </Text>
                {recommendation.actionable && recommendation.actionText && (
                  <TouchableOpacity style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}>
                    <Text style={styles.actionButtonText}>{recommendation.actionText}</Text>
                  </TouchableOpacity>
                )}
              </Card>
            ))}
          </View>
        )}

        {/* Goal Tracking (Placeholder) */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Goal Tracking
          </Text>
          <Card style={styles.goalCard}>
            <View style={styles.goalPlaceholder}>
              <Award size={48} color={theme.colors.textTertiary} />
              <Text style={[styles.goalPlaceholderText, { color: theme.colors.textSecondary }]}>
                Goal tracking coming soon
              </Text>
              <Text style={[styles.goalPlaceholderSubtext, { color: theme.colors.textTertiary }]}>
                Set and track productivity goals
              </Text>
            </View>
          </Card>
        </View>

        {/* Insights Card */}
        <Card style={styles.card}>
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Key Insights</Text>
          <View style={styles.insightsGrid}>
            <View style={styles.insightItem}>
              <View style={[styles.insightIcon, { backgroundColor: theme.colors.primary + '15' }]}> 
                <Zap size={16} color={theme.colors.primary} />
              </View>
              <Text style={[styles.insightLabel, { color: theme.colors.textSecondary }]}>Most Productive</Text>
              <Text style={[styles.insightValue, { color: theme.colors.text }]}>{insights.productivity.mostProductiveDay}</Text>
            </View>
            <View style={styles.insightItem}>
              <View style={[styles.insightIcon, { backgroundColor: theme.colors.success + '15' }]}> 
                <Clock size={16} color={theme.colors.success} />
              </View>
              <Text style={[styles.insightLabel, { color: theme.colors.textSecondary }]}>Best Time</Text>
              <Text style={[styles.insightValue, { color: theme.colors.text }]}>{insights.productivity.mostProductiveTime}</Text>
            </View>
            <View style={styles.insightItem}>
              <View style={[styles.insightIcon, { backgroundColor: theme.colors.warning + '15' }]}> 
                <Lightbulb size={16} color={theme.colors.warning} />
              </View>
              <Text style={[styles.insightLabel, { color: theme.colors.textSecondary }]}>Top Category</Text>
              <Text style={[styles.insightValue, { color: theme.colors.text }]}>{insights.categories.mostActiveCategory}</Text>
            </View>
            <View style={styles.insightItem}>
              <View style={[styles.insightIcon, { backgroundColor: theme.colors.error + '15' }]}> 
                <AlertTriangle size={16} color={theme.colors.error} />
              </View>
              <Text style={[styles.insightLabel, { color: theme.colors.textSecondary }]}>Overdue</Text>
              <Text style={[styles.insightValue, { color: theme.colors.text }]}>{insights.priorities.overdueTasks}</Text>
            </View>
          </View>
        </Card>

        {/* Priority Breakdown Card */}
        <Card style={styles.card}>
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Priority Breakdown</Text>
          <View style={styles.gridRow}>
            {[
              { label: 'High', color: theme.colors.error, count: insights.priorities.priorityDistribution.high, completed: insights.priorities.completionByPriority.high },
              { label: 'Medium', color: theme.colors.warning, count: insights.priorities.priorityDistribution.medium, completed: insights.priorities.completionByPriority.medium },
              { label: 'Low', color: theme.colors.success, count: insights.priorities.priorityDistribution.low, completed: insights.priorities.completionByPriority.low },
            ].map((item) => (
              <View key={item.label} style={[styles.gridItem, { borderColor: item.color + '40' }]}> 
                <View style={[styles.dot, { backgroundColor: item.color }]} />
                <Text style={[styles.gridLabel, { color: theme.colors.text }]}>{item.label}</Text>
                <Text style={[styles.gridValue, { color: theme.colors.text }]}>{item.count}</Text>
                <Text style={[styles.gridSubtext, { color: theme.colors.textTertiary }]}> 
                  {item.count > 0 ? Math.round((item.completed / item.count) * 100) : 0}% done
                </Text>
              </View>
            ))}
          </View>
        </Card>

        {/* Category Breakdown Card */}
        <Card style={styles.card}>
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Category Performance</Text>
          <View style={styles.categoryList}>
            {categories.slice(0, 6).map((category) => (
              <View key={category.category} style={styles.categoryItem}>
                <View style={styles.categoryInfo}>
                  <Text style={[styles.categoryName, { color: theme.colors.text }]}>{category.category}</Text>
                  <Text style={[styles.categoryStats, { color: theme.colors.textSecondary }]}> 
                    {category.completedTasks}/{category.totalTasks} completed
                  </Text>
                </View>
                <View style={styles.categoryProgress}>
                  <View style={[styles.progressBar, { backgroundColor: theme.colors.border }]}> 
                    <View 
                      style={[
                        styles.progressFill, 
                        { 
                          backgroundColor: theme.colors.primary,
                          width: `${category.completionRate}%`
                        }
                      ]} 
                    />
                  </View>
                  <Text style={[styles.progressText, { color: theme.colors.textSecondary }]}> 
                    {category.completionRate}%
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </Card>

        {/* Recent Activity Card */}
        <Card style={styles.card}>
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Recent Activity</Text>
          {tasks.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.colors.textTertiary }]}>No recent activity</Text>
          ) : (
            <View style={styles.activityList}>
              {tasks.slice(0, 5).map((task) => (
                <View key={task.id} style={styles.activityItem}>
                  <View style={[styles.activityIcon, { backgroundColor: task.completed ? theme.colors.success + '20' : theme.colors.textTertiary + '20' }]}> 
                    {task.completed ? (
                      <CheckCircle size={16} color={theme.colors.success} strokeWidth={2} />
                    ) : (
                      <XCircle size={16} color={theme.colors.textTertiary} strokeWidth={2} />
                    )}
                  </View>
                  <View style={styles.activityContent}>
                    <Text style={[styles.activityTitle, { color: theme.colors.text }]} numberOfLines={1}>{task.title}</Text>
                    <Text style={[styles.activityTime, { color: theme.colors.textSecondary }]}> 
                      {task.completed ? 'Completed' : 'Pending'} • {task.category}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </Card>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0', // Fallback background
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f0f0f0', // Fallback background
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: 'Inter-SemiBold',
    marginTop: 15,
  },
  emptyDescription: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
    marginTop: 5,
  },
  periodSelectorWrapper: {
    marginTop: 8,
    marginBottom: 8,
  },
  periodSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  periodButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  periodButtonText: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
  },
  card: {
    marginHorizontal: 16,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 17,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 16,
  },
  productivityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  productivityIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  productivityInfo: {
    flex: 1,
  },
  productivityScore: {
    fontSize: 36,
    fontFamily: 'Inter-Bold',
    marginBottom: 4,
  },
  productivityLabel: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    marginBottom: 2,
  },
  productivityStatus: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
  },
  overviewRow: {
    flexDirection: 'row',
    gap: 16,
  },
  overviewCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  overviewIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  overviewLabel: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    marginBottom: 2,
  },
  overviewValue: {
    fontSize: 28,
    fontFamily: 'Inter-Bold',
    marginBottom: 2,
  },
  overviewSubtext: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
  },
  insightsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    gap: 12,
  },
  insightItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 15,
    borderRadius: 14,
    borderWidth: 1.5,
    backgroundColor: 'rgba(0,0,0,0.01)',
    marginBottom: 0,
  },
  insightIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  insightLabel: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    marginBottom: 2,
  },
  insightValue: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
  },
  gridRow: {
    flexDirection: 'row',
    gap: 12,
  },
  gridItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 14,
    borderWidth: 1.5,
    backgroundColor: 'rgba(0,0,0,0.01)',
    marginBottom: 0,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  gridLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    marginBottom: 2,
  },
  gridValue: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
  },
  gridSubtext: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    marginTop: 4,
  },
  categoryList: {
    gap: 12,
  },
  categoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.01)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    marginBottom: 2,
  },
  categoryStats: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
  },
  categoryProgress: {
    alignItems: 'flex-end',
  },
  progressBar: {
    width: 60,
    height: 8,
    borderRadius: 4,
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
  },
  activityList: {
    gap: 10,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 2,
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    marginBottom: 2,
  },
  activityTime: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
  },
  emptyText: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
    marginVertical: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    marginBottom: 12,
    marginHorizontal: 20,
  },
  metricsCard: {
    marginHorizontal: 20,
    padding: 16,
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricItem: {
    alignItems: 'center',
    flex: 1,
  },
  metricValue: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    textAlign: 'center',
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  peakHoursContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  peakHoursLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    textAlign: 'center',
  },
  insightsCard: {
    marginHorizontal: 20,
    padding: 16,
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  insightContent: {
    marginLeft: 12,
    flex: 1,
  },
  insightTitle: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    marginBottom: 2,
  },
  insightValue: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
  },
  recommendationCard: {
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 16,
  },
  recommendationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  recommendationMeta: {
    marginLeft: 12,
    flex: 1,
  },
  recommendationTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 2,
  },
  recommendationImpact: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
  },
  recommendationDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    lineHeight: 20,
    marginBottom: 12,
  },
  actionButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 14,
    fontFamily: 'Inter-Medium',
  },
  goalCard: {
    marginHorizontal: 20,
    padding: 24,
  },
  goalPlaceholder: {
    alignItems: 'center',
  },
  goalPlaceholderText: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    marginTop: 16,
    marginBottom: 4,
  },
  goalPlaceholderSubtext: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
});