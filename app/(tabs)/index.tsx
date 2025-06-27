import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Search, Filter, CircleCheck as CheckCircle2, Circle, Clock, Star, TrendingUp, Calendar, Target, LogOut } from 'lucide-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  FadeIn,
  SlideInRight,
} from 'react-native-reanimated';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { router } from 'expo-router';

const { width } = Dimensions.get('window');

interface Task {
  id: string;
  title: string;
  category: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  time: string;
  aiSuggested?: boolean;
}

const mockTasks: Task[] = [
  {
    id: '1',
    title: 'Review quarterly reports',
    category: 'Work',
    completed: false,
    priority: 'high',
    time: '2 hours ago',
    aiSuggested: true,
  },
  {
    id: '2',
    title: 'Call dentist for appointment',
    category: 'Personal',
    completed: true,
    priority: 'medium',
    time: '3 hours ago',
  },
  {
    id: '3',
    title: 'Grocery shopping',
    category: 'Personal',
    completed: false,
    priority: 'low',
    time: '5 hours ago',
  },
  {
    id: '4',
    title: 'Team standup meeting',
    category: 'Work',
    completed: true,
    priority: 'medium',
    time: '1 day ago',
  },
];

export default function HomeScreen() {
  const { theme } = useTheme();
  const { user, profile, signOut } = useAuth();
  const [tasks, setTasks] = useState<Task[]>(mockTasks);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');

  const completedToday = tasks.filter(t => t.completed).length;
  const totalTasks = tasks.length;
  const progressPercentage = totalTasks > 0 ? (completedToday / totalTasks) * 100 : 0;

  const progressAnimation = useSharedValue(0);

  useEffect(() => {
    progressAnimation.value = withTiming(progressPercentage, { duration: 1000 });
  }, [progressPercentage]);

  const animatedProgressStyle = useAnimatedStyle(() => {
    return {
      width: `${progressAnimation.value}%`,
    };
  });

  const toggleTask = (taskId: string) => {
    setTasks(tasks.map(task => 
      task.id === taskId ? { ...task, completed: !task.completed } : task
    ));
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace('/(auth)/sign-in');
  };

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = selectedFilter === 'all' || 
      (selectedFilter === 'completed' && task.completed) ||
      (selectedFilter === 'pending' && !task.completed) ||
      (selectedFilter === 'ai-suggested' && task.aiSuggested);
    return matchesSearch && matchesFilter;
  });

  const filters = [
    { key: 'all', label: 'All', count: tasks.length },
    { key: 'pending', label: 'Pending', count: tasks.filter(t => !t.completed).length },
    { key: 'completed', label: 'Completed', count: tasks.filter(t => t.completed).length },
    { key: 'ai-suggested', label: 'AI Suggested', count: tasks.filter(t => t.aiSuggested).length },
  ];

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Animated.View 
          entering={FadeIn.duration(600)}
          style={[styles.header, { backgroundColor: theme.colors.background }]}
        >
          <View style={styles.headerContent}>
            <View>
              <Text style={[styles.greeting, { color: theme.colors.textSecondary }]}>
                Good morning!
              </Text>
              <Text style={[styles.userName, { color: theme.colors.text }]}>
                {profile?.full_name || user?.email || 'Welcome back'}
              </Text>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity 
                style={[styles.avatarContainer, { backgroundColor: theme.colors.primary }]}
                onPress={handleSignOut}
              >
                <Text style={styles.avatarText}>
                  {profile?.full_name ? getInitials(profile.full_name) : 'U'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={handleSignOut}
                style={[styles.signOutButton, { backgroundColor: theme.colors.surface }]}
              >
                <LogOut size={16} color={theme.colors.textSecondary} strokeWidth={2} />
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>

        {/* Progress Card */}
        <Animated.View
          entering={SlideInRight.delay(200).duration(600)}
          style={[styles.progressCard, { backgroundColor: theme.colors.surface }]}
        >
          <LinearGradient
            colors={[theme.colors.primary, theme.colors.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.progressGradient}
          >
            <View style={styles.progressContent}>
              <View style={styles.progressInfo}>
                <Text style={styles.progressTitle}>Today's Progress</Text>
                <Text style={styles.progressSubtitle}>
                  {completedToday} of {totalTasks} tasks completed
                </Text>
              </View>
              <View style={styles.progressStats}>
                <Text style={styles.progressPercentage}>
                  {Math.round(progressPercentage)}%
                </Text>
                <Target size={24} color="white" strokeWidth={2} />
              </View>
            </View>
            <View style={styles.progressBarContainer}>
              <View style={styles.progressBarTrack}>
                <Animated.View 
                  style={[styles.progressBarFill, animatedProgressStyle]}
                />
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* AI Suggestions Preview */}
        <Animated.View
          entering={SlideInRight.delay(300).duration(600)}
          style={styles.aiSuggestionsPreview}
        >
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleContainer}>
              <Star size={20} color={theme.colors.primary} strokeWidth={2} />
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                AI Suggestions
              </Text>
            </View>
            <TouchableOpacity>
              <Text style={[styles.seeAllText, { color: theme.colors.primary }]}>
                See All
              </Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.suggestionsScroll}>
            {tasks.filter(t => t.aiSuggested).map((task, index) => (
              <Animated.View
                key={task.id}
                entering={SlideInRight.delay(400 + index * 100).duration(600)}
                style={[styles.suggestionCard, { backgroundColor: theme.colors.surface }]}
              >
                <View style={styles.suggestionHeader}>
                  <View style={[styles.priorityBadge, { 
                    backgroundColor: task.priority === 'high' ? theme.colors.error : 
                                   task.priority === 'medium' ? theme.colors.warning : theme.colors.success 
                  }]} />
                  <Text style={[styles.suggestionCategory, { color: theme.colors.textSecondary }]}>
                    {task.category}
                  </Text>
                </View>
                <Text style={[styles.suggestionTitle, { color: theme.colors.text }]}>
                  {task.title}
                </Text>
                <View style={styles.suggestionFooter}>
                  <Clock size={14} color={theme.colors.textTertiary} strokeWidth={2} />
                  <Text style={[styles.suggestionTime, { color: theme.colors.textTertiary }]}>
                    {task.time}
                  </Text>
                </View>
              </Animated.View>
            ))}
          </ScrollView>
        </Animated.View>

        {/* Search and Filter */}
        <Animated.View
          entering={FadeIn.delay(500).duration(600)}
          style={styles.searchSection}
        >
          <View style={[styles.searchContainer, { backgroundColor: theme.colors.surface }]}>
            <Search size={20} color={theme.colors.textSecondary} strokeWidth={2} />
            <TextInput
              style={[styles.searchInput, { color: theme.colors.text }]}
              placeholder="Search tasks..."
              placeholderTextColor={theme.colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersContainer}>
            {filters.map((filter) => (
              <TouchableOpacity
                key={filter.key}
                onPress={() => setSelectedFilter(filter.key)}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: selectedFilter === filter.key 
                      ? theme.colors.primary 
                      : theme.colors.surface,
                    borderColor: theme.colors.border,
                  }
                ]}
              >
                <Text
                  style={[
                    styles.filterText,
                    {
                      color: selectedFilter === filter.key 
                        ? 'white' 
                        : theme.colors.text,
                    }
                  ]}
                >
                  {filter.label} ({filter.count})
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Animated.View>

        {/* Tasks List */}
        <Animated.View
          entering={FadeIn.delay(600).duration(600)}
          style={styles.tasksSection}
        >
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Recent Activity
            </Text>
            <Text style={[styles.taskCount, { color: theme.colors.textSecondary }]}>
              {filteredTasks.length} tasks
            </Text>
          </View>

          {filteredTasks.map((task, index) => (
            <Animated.View
              key={task.id}
              entering={SlideInRight.delay(700 + index * 50).duration(400)}
              style={[styles.taskCard, { backgroundColor: theme.colors.surface }]}
            >
              <TouchableOpacity
                onPress={() => toggleTask(task.id)}
                style={styles.taskContent}
              >
                <View style={styles.taskLeft}>
                  <TouchableOpacity
                    onPress={() => toggleTask(task.id)}
                    style={styles.checkboxContainer}
                  >
                    {task.completed ? (
                      <CheckCircle2 size={24} color={theme.colors.success} strokeWidth={2} />
                    ) : (
                      <Circle size={24} color={theme.colors.textTertiary} strokeWidth={2} />
                    )}
                  </TouchableOpacity>
                  
                  <View style={styles.taskInfo}>
                    <View style={styles.taskTitleRow}>
                      <Text
                        style={[
                          styles.taskTitle,
                          {
                            color: task.completed ? theme.colors.textTertiary : theme.colors.text,
                            textDecorationLine: task.completed ? 'line-through' : 'none',
                          }
                        ]}
                      >
                        {task.title}
                      </Text>
                      {task.aiSuggested && (
                        <View style={[styles.aiChip, { backgroundColor: theme.colors.primary + '20' }]}>
                          <Star size={12} color={theme.colors.primary} strokeWidth={2} />
                        </View>
                      )}
                    </View>
                    
                    <View style={styles.taskMeta}>
                      <Text style={[styles.taskCategory, { color: theme.colors.textSecondary }]}>
                        {task.category}
                      </Text>
                      <View style={styles.taskMetaSeparator} />
                      <Text style={[styles.taskTime, { color: theme.colors.textTertiary }]}>
                        {task.time}
                      </Text>
                    </View>
                  </View>
                </View>
                
                <View style={[
                  styles.priorityIndicator,
                  {
                    backgroundColor: task.priority === 'high' ? theme.colors.error :
                                   task.priority === 'medium' ? theme.colors.warning : theme.colors.success
                  }
                ]} />
              </TouchableOpacity>
            </Animated.View>
          ))}
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
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  userName: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    marginTop: 4,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: 'white',
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
  },
  signOutButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressCard: {
    marginHorizontal: 20,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
    shadowColor: '#6366F1',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  progressGradient: {
    padding: 20,
  },
  progressContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  progressInfo: {
    flex: 1,
  },
  progressTitle: {
    color: 'white',
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
  },
  progressSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    marginTop: 4,
  },
  progressStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressPercentage: {
    color: 'white',
    fontSize: 28,
    fontFamily: 'Inter-Bold',
  },
  progressBarContainer: {
    marginTop: 8,
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: 'white',
    borderRadius: 4,
  },
  aiSuggestionsPreview: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: 'Inter-SemiBold',
  },
  seeAllText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
  },
  suggestionsScroll: {
    paddingLeft: 20,
  },
  suggestionCard: {
    width: 200,
    padding: 16,
    borderRadius: 12,
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  suggestionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  priorityBadge: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  suggestionCategory: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    textTransform: 'uppercase',
  },
  suggestionTitle: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    marginBottom: 12,
    lineHeight: 22,
  },
  suggestionFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  suggestionTime: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
  },
  searchSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  filtersContainer: {
    flexDirection: 'row',
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
  },
  filterText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
  },
  tasksSection: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  taskCount: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  taskCard: {
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  taskContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  taskLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxContainer: {
    marginRight: 12,
  },
  taskInfo: {
    flex: 1,
  },
  taskTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  taskTitle: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    flex: 1,
  },
  aiChip: {
    padding: 4,
    borderRadius: 8,
    marginLeft: 8,
  },
  taskMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  taskCategory: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    textTransform: 'uppercase',
  },
  taskMetaSeparator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    marginHorizontal: 8,
  },
  taskTime: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
  },
  priorityIndicator: {
    width: 4,
    height: 32,
    borderRadius: 2,
    marginLeft: 12,
  },
});