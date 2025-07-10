import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BarChart3, TrendingUp, Target, Clock, Calendar, CheckCircle, XCircle } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { useTaskStore } from '../../lib/taskStore';
import PageHeader from '../../components/PageHeader';

export default function AnalyticsScreen() {
  const { theme } = useTheme();
  const tasks = useTaskStore((state) => state.tasks);
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'year'>('week');

  // Calculate analytics
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(task => task.completed).length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const pendingTasks = totalTasks - completedTasks;

  const getPriorityCount = (priority: 'low' | 'medium' | 'high') => {
    return tasks.filter(task => task.priority === priority).length;
  };

  const getCategoryCount = (category: string) => {
    return tasks.filter(task => task.category === category).length;
  };

  const handleExport = () => {
    // TODO: Implement export functionality
    console.log('Export analytics');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <PageHeader
          icon={BarChart3}
          title="Analytics"
          subtitle="Track your productivity"
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

        {/* Overview Card */}
        <View style={[styles.card, { backgroundColor: theme.colors.surface, shadowColor: theme.colors.shadow }]}>
          <View style={styles.overviewRow}>
            <View style={styles.overviewCol}>
              <View style={[styles.overviewIcon, { backgroundColor: theme.colors.primary + '15' }]}>
                <TrendingUp size={24} color={theme.colors.primary} strokeWidth={2} />
              </View>
              <Text style={[styles.overviewLabel, { color: theme.colors.textSecondary }]}>Completion Rate</Text>
              <Text style={[styles.overviewValue, { color: theme.colors.text }]}>{completionRate}%</Text>
              <Text style={[styles.overviewSubtext, { color: theme.colors.textTertiary }]}>{completedTasks} of {totalTasks} tasks</Text>
            </View>
            <View style={styles.overviewCol}>
              <View style={[styles.overviewIcon, { backgroundColor: theme.colors.success + '15' }]}>
                <Target size={24} color={theme.colors.success} strokeWidth={2} />
              </View>
              <Text style={[styles.overviewLabel, { color: theme.colors.textSecondary }]}>Pending Tasks</Text>
              <Text style={[styles.overviewValue, { color: theme.colors.text }]}>{pendingTasks}</Text>
              <Text style={[styles.overviewSubtext, { color: theme.colors.textTertiary }]}>Need attention</Text>
            </View>
          </View>
                  </View>

        {/* Priority Breakdown Card */}
        <View style={[styles.card, { backgroundColor: theme.colors.surface, shadowColor: theme.colors.shadow }]}>
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Priority Breakdown</Text>
          <View style={styles.gridRow}>
            {[
              { label: 'High', color: theme.colors.error, count: getPriorityCount('high') },
              { label: 'Medium', color: theme.colors.warning, count: getPriorityCount('medium') },
              { label: 'Low', color: theme.colors.success, count: getPriorityCount('low') },
            ].map((item) => (
              <View key={item.label} style={[styles.gridItem, { borderColor: item.color + '40' }]}>
                <View style={[styles.dot, { backgroundColor: item.color }]} />
                <Text style={[styles.gridLabel, { color: theme.colors.text }]}>{item.label}</Text>
                <Text style={[styles.gridValue, { color: theme.colors.text }]}>{item.count}</Text>
                </View>
            ))}
          </View>
        </View>

        {/* Category Breakdown Card */}
        <View style={[styles.card, { backgroundColor: theme.colors.surface, shadowColor: theme.colors.shadow }]}>
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Category Breakdown</Text>
          <View style={styles.gridRow}>
            {['Work', 'Personal', 'Health', 'Learning'].map((cat) => (
              <View key={cat} style={[styles.gridItem, { borderColor: theme.colors.primary + '20' }]}>
                <Text style={[styles.gridLabel, { color: theme.colors.text }]}>{cat}</Text>
                <Text style={[styles.gridValue, { color: theme.colors.text }]}>{getCategoryCount(cat)}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Recent Activity Card */}
        <View style={[styles.card, { backgroundColor: theme.colors.surface, shadowColor: theme.colors.shadow }]}>
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
                    <Text style={[styles.activityTime, { color: theme.colors.textSecondary }]}>{task.completed ? 'Completed' : 'Pending'}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
          </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    borderRadius: 20,
    marginHorizontal: 16,
    marginBottom: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  cardTitle: {
    fontSize: 17,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 16,
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
});