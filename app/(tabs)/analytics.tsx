import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ChartBar as BarChart3, Calendar, TrendingUp, Target, Clock, Zap, CircleCheck as CheckCircle2, Award, Activity, Filter, Download } from 'lucide-react-native';
import Animated, {
  FadeIn,
  SlideInRight,
  SlideInUp,
} from 'react-native-reanimated';
import { useTheme } from '@/context/ThemeContext';

const { width } = Dimensions.get('window');

interface DayData {
  date: string;
  tasks: number;
  completed: number;
}

interface CategoryStats {
  name: string;
  total: number;
  completed: number;
  color: string;
}

const mockWeekData: DayData[] = [
  { date: 'Mon', tasks: 8, completed: 6 },
  { date: 'Tue', tasks: 12, completed: 10 },
  { date: 'Wed', tasks: 6, completed: 6 },
  { date: 'Thu', tasks: 15, completed: 12 },
  { date: 'Fri', tasks: 10, completed: 8 },
  { date: 'Sat', tasks: 4, completed: 3 },
  { date: 'Sun', tasks: 7, completed: 5 },
];

const mockCategoryStats: CategoryStats[] = [
  { name: 'Work', total: 24, completed: 20, color: '#6366F1' },
  { name: 'Personal', total: 18, completed: 15, color: '#8B5CF6' },
  { name: 'Health', total: 12, completed: 11, color: '#10B981' },
  { name: 'Learning', total: 8, completed: 6, color: '#F59E0B' },
];

const timeframes = [
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'quarter', label: 'Quarter' },
  { key: 'year', label: 'Year' },
];

export default function AnalyticsScreen() {
  const { theme } = useTheme();
  const [selectedTimeframe, setSelectedTimeframe] = useState('week');

  const totalTasks = mockWeekData.reduce((sum, day) => sum + day.tasks, 0);
  const totalCompleted = mockWeekData.reduce((sum, day) => sum + day.completed, 0);
  const completionRate = totalTasks > 0 ? (totalCompleted / totalTasks) * 100 : 0;
  const averagePerDay = totalTasks / 7;

  const maxTasks = Math.max(...mockWeekData.map(day => day.tasks));

  const getBarHeight = (tasks: number) => {
    return (tasks / maxTasks) * 120;
  };

  const getCompletionHeight = (day: DayData) => {
    const completionRatio = day.tasks > 0 ? day.completed / day.tasks : 0;
    return getBarHeight(day.tasks) * completionRatio;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Animated.View 
          entering={FadeIn.duration(600)}
          style={styles.header}
        >
          <LinearGradient
            colors={[theme.colors.primary, theme.colors.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerGradient}
          >
            <View style={styles.headerContent}>
              <View style={styles.headerLeft}>
                <BarChart3 size={32} color="white" strokeWidth={2} />
                <View style={styles.headerText}>
                  <Text style={styles.headerTitle}>Analytics</Text>
                  <Text style={styles.headerSubtitle}>
                    Track your productivity
                  </Text>
                </View>
              </View>
              <TouchableOpacity style={styles.exportButton}>
                <Download size={20} color="white" strokeWidth={2} />
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Timeframe Selector */}
        <Animated.View
          entering={SlideInUp.delay(200).duration(600)}
          style={styles.timeframeContainer}
        >
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {timeframes.map((timeframe) => (
              <TouchableOpacity
                key={timeframe.key}
                onPress={() => setSelectedTimeframe(timeframe.key)}
                style={[
                  styles.timeframeChip,
                  {
                    backgroundColor: selectedTimeframe === timeframe.key 
                      ? theme.colors.primary 
                      : theme.colors.surface,
                    borderColor: theme.colors.border,
                  }
                ]}
              >
                <Text
                  style={[
                    styles.timeframeText,
                    {
                      color: selectedTimeframe === timeframe.key 
                        ? 'white' 
                        : theme.colors.text,
                    }
                  ]}
                >
                  {timeframe.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Animated.View>

        {/* Key Metrics */}
        <Animated.View
          entering={SlideInRight.delay(300).duration(600)}
          style={styles.metricsContainer}
        >
          <View style={[styles.metricCard, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.metricHeader}>
              <CheckCircle2 size={24} color={theme.colors.success} strokeWidth={2} />
              <Text style={[styles.metricTitle, { color: theme.colors.text }]}>
                Completion Rate
              </Text>
            </View>
            <Text style={[styles.metricValue, { color: theme.colors.success }]}>
              {Math.round(completionRate)}%
            </Text>
            <Text style={[styles.metricSubtitle, { color: theme.colors.textSecondary }]}>
              {totalCompleted} of {totalTasks} tasks completed
            </Text>
          </View>

          <View style={[styles.metricCard, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.metricHeader}>
              <Target size={24} color={theme.colors.primary} strokeWidth={2} />
              <Text style={[styles.metricTitle, { color: theme.colors.text }]}>
                Daily Average
              </Text>
            </View>
            <Text style={[styles.metricValue, { color: theme.colors.primary }]}>
              {averagePerDay.toFixed(1)}
            </Text>
            <Text style={[styles.metricSubtitle, { color: theme.colors.textSecondary }]}>
              tasks per day
            </Text>
          </View>
        </Animated.View>

        {/* Weekly Chart */}
        <Animated.View
          entering={SlideInUp.delay(400).duration(600)}
          style={[styles.chartContainer, { backgroundColor: theme.colors.surface }]}
        >
          <View style={styles.chartHeader}>
            <Text style={[styles.chartTitle, { color: theme.colors.text }]}>
              Weekly Overview
            </Text>
            <View style={styles.chartLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: theme.colors.primary }]} />
                <Text style={[styles.legendText, { color: theme.colors.textSecondary }]}>
                  Total
                </Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: theme.colors.success }]} />
                <Text style={[styles.legendText, { color: theme.colors.textSecondary }]}>
                  Completed
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.chart}>
            {mockWeekData.map((day, index) => (
              <Animated.View
                key={day.date}
                entering={SlideInUp.delay(500 + index * 50).duration(400)}
                style={styles.barContainer}
              >
                <View style={styles.barWrapper}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: getBarHeight(day.tasks),
                        backgroundColor: theme.colors.primary + '30',
                      }
                    ]}
                  >
                    <View
                      style={[
                        styles.completedBar,
                        {
                          height: getCompletionHeight(day),
                          backgroundColor: theme.colors.success,
                        }
                      ]}
                    />
                  </View>
                  <Text style={[styles.barValue, { color: theme.colors.text }]}>
                    {day.completed}/{day.tasks}
                  </Text>
                </View>
                <Text style={[styles.barLabel, { color: theme.colors.textSecondary }]}>
                  {day.date}
                </Text>
              </Animated.View>
            ))}
          </View>
        </Animated.View>

        {/* Category Breakdown */}
        <Animated.View
          entering={SlideInUp.delay(600).duration(600)}
          style={[styles.categoryContainer, { backgroundColor: theme.colors.surface }]}
        >
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Category Breakdown
            </Text>
            <TouchableOpacity>
              <Filter size={20} color={theme.colors.primary} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          {mockCategoryStats.map((category, index) => {
            const completionRate = category.total > 0 ? (category.completed / category.total) * 100 : 0;
            
            return (
              <Animated.View
                key={category.name}
                entering={SlideInRight.delay(700 + index * 100).duration(400)}
                style={styles.categoryItem}
              >
                <View style={styles.categoryLeft}>
                  <View style={[styles.categoryColor, { backgroundColor: category.color }]} />
                  <View style={styles.categoryInfo}>
                    <Text style={[styles.categoryName, { color: theme.colors.text }]}>
                      {category.name}
                    </Text>
                    <Text style={[styles.categoryStats, { color: theme.colors.textSecondary }]}>
                      {category.completed} of {category.total} completed
                    </Text>
                  </View>
                </View>
                
                <View style={styles.categoryRight}>
                  <Text style={[styles.categoryPercentage, { color: category.color }]}>
                    {Math.round(completionRate)}%
                  </Text>
                  <View style={[styles.progressTrack, { backgroundColor: theme.colors.surfaceVariant }]}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${completionRate}%`,
                          backgroundColor: category.color,
                        }
                      ]}
                    />
                  </View>
                </View>
              </Animated.View>
            );
          })}
        </Animated.View>

        {/* Productivity Insights */}
        <Animated.View
          entering={SlideInUp.delay(800).duration(600)}
          style={[styles.insightsContainer, { backgroundColor: theme.colors.surface }]}
        >
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Productivity Insights
            </Text>
            <Activity size={20} color={theme.colors.primary} strokeWidth={2} />
          </View>

          <View style={styles.insightsList}>
            <View style={styles.insightItem}>
              <View style={[styles.insightIcon, { backgroundColor: theme.colors.success + '20' }]}>
                <Award size={16} color={theme.colors.success} strokeWidth={2} />
              </View>
              <View style={styles.insightContent}>
                <Text style={[styles.insightTitle, { color: theme.colors.text }]}>
                  Great week!
                </Text>
                <Text style={[styles.insightDescription, { color: theme.colors.textSecondary }]}>
                  You completed 83% of your tasks this week
                </Text>
              </View>
            </View>

            <View style={styles.insightItem}>
              <View style={[styles.insightIcon, { backgroundColor: theme.colors.warning + '20' }]}>
                <TrendingUp size={16} color={theme.colors.warning} strokeWidth={2} />
              </View>
              <View style={styles.insightContent}>
                <Text style={[styles.insightTitle, { color: theme.colors.text }]}>
                  Peak productivity
                </Text>
                <Text style={[styles.insightDescription, { color: theme.colors.textSecondary }]}>
                  Thursday was your most productive day
                </Text>
              </View>
            </View>

            <View style={styles.insightItem}>
              <View style={[styles.insightIcon, { backgroundColor: theme.colors.primary + '20' }]}>
                <Zap size={16} color={theme.colors.primary} strokeWidth={2} />
              </View>
              <View style={styles.insightContent}>
                <Text style={[styles.insightTitle, { color: theme.colors.text }]}>
                  Consistent effort
                </Text>
                <Text style={[styles.insightDescription, { color: theme.colors.textSecondary }]}>
                  You've been active every day this week
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    marginBottom: 20,
    overflow: 'hidden',
  },
  headerGradient: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerText: {
    marginLeft: 16,
  },
  headerTitle: {
    color: 'white',
    fontSize: 24,
    fontFamily: 'Inter-Bold',
  },
  headerSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    marginTop: 2,
  },
  exportButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeframeContainer: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  timeframeChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
  },
  timeframeText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
  },
  metricsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 24,
    gap: 12,
  },
  metricCard: {
    flex: 1,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  metricTitle: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
  },
  metricValue: {
    fontSize: 28,
    fontFamily: 'Inter-Bold',
    marginBottom: 4,
  },
  metricSubtitle: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
  },
  chartContainer: {
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  chartTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
  },
  chartLegend: {
    flexDirection: 'row',
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
  },
  chart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 160,
  },
  barContainer: {
    alignItems: 'center',
    flex: 1,
  },
  barWrapper: {
    alignItems: 'center',
    marginBottom: 8,
  },
  bar: {
    width: 24,
    borderRadius: 4,
    marginBottom: 4,
    justifyContent: 'flex-end',
  },
  completedBar: {
    width: '100%',
    borderRadius: 4,
  },
  barValue: {
    fontSize: 10,
    fontFamily: 'Inter-Medium',
    marginTop: 4,
  },
  barLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
  },
  categoryContainer: {
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    marginBottom: 2,
  },
  categoryStats: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
  },
  categoryRight: {
    alignItems: 'flex-end',
    minWidth: 60,
  },
  categoryPercentage: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    marginBottom: 4,
  },
  progressTrack: {
    width: 50,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  insightsContainer: {
    marginHorizontal: 20,
    marginBottom: 100,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  insightsList: {
    gap: 16,
  },
  insightItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  insightIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  insightContent: {
    flex: 1,
  },
  insightTitle: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    marginBottom: 2,
  },
  insightDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    lineHeight: 18,
  },
});