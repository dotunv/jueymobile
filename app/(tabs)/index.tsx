import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Dimensions,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Search, Filter, CircleCheck as CheckCircle2, Circle, Clock, Star, TrendingUp, Calendar, Target, LogOut, Plus } from 'lucide-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { router } from 'expo-router';
import { SupabaseTaskService } from '@/lib/services/supabaseService';
import { Task as SupabaseTask, TaskListItem } from '@/lib/types';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '@/lib/supabase';
import { TypedStorage } from '@/lib/storage';
import NetInfo from '@react-native-community/netinfo';
import { useTaskStore } from '@/lib/taskStore';
import { isAuthError } from '@/lib/supabase';

const { width } = Dimensions.get('window');

function mapSupabaseTaskToUITask(task: SupabaseTask): TaskListItem {
  // Compute a human-readable time (e.g., '2 hours ago')
  const createdAt = new Date(task.created_at);
  const now = new Date();
  const diffMs = now.getTime() - createdAt.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  let timeAgo = '';
  if (diffHours < 1) {
    const diffMins = Math.floor(diffMs / (1000 * 60));
    timeAgo = `${diffMins} min${diffMins === 1 ? '' : 's'} ago`;
  } else if (diffHours < 24) {
    timeAgo = `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  } else {
    const diffDays = Math.floor(diffHours / 24);
    timeAgo = `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  }
  
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    completed: task.completed,
    completed_at: task.completed_at,
    logged_after_completion: task.logged_after_completion,
    priority: task.priority,
    category: task.category,
    tags: task.tags,
    ai_suggested: task.ai_suggested,
    reminder_enabled: task.reminder_enabled,
    reminder_time: task.reminder_time,
    due_date: task.due_date,
    created_at: task.created_at,
    updated_at: task.updated_at,
    timeAgo,
    isOverdue: task.due_date ? new Date(task.due_date) < new Date() : false,
    isDueToday: task.due_date ? new Date(task.due_date).toDateString() === new Date().toDateString() : false,
  };
}

export default function HomeScreen() {
  const { theme } = useTheme();
  const { user, profile, signOut } = useAuth();
  const tasks = useTaskStore((state) => state.tasks);
  const setTasks = useTaskStore((state) => state.setTasks);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [toggleLoadingId, setToggleLoadingId] = useState<string | null>(null);

  // Dynamic greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning!';
    if (hour < 17) return 'Good afternoon!';
    if (hour < 21) return 'Good evening!';
    return 'Good night!';
  };

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

  // Navigate to settings/profile
  const handleProfilePress = () => {
    router.push('/(tabs)/settings');
  };

  // Fetch tasks from Supabase
  const fetchTasks = async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const supabaseTasks = await SupabaseTaskService.getTasks(user.id);
      const uiTasks = supabaseTasks.map(mapSupabaseTaskToUITask);
      setTasks(uiTasks);
      TypedStorage.cachedTasks.set(uiTasks);
    } catch (err: any) {
      console.error('Error fetching tasks:', err);
      
      // Handle authentication errors
      if (isAuthError(err)) {
        setError('Session expired. Please sign in again.');
        // Clear session and redirect to sign-in
        setTimeout(() => {
          signOut();
          router.replace('/(auth)/sign-in');
        }, 2000);
        return;
      }
      
      setError(err.message || 'Failed to load tasks');
      // Try to load from cache
      const cached = TypedStorage.cachedTasks.get();
      if (cached && cached.length > 0) {
        setTasks(cached);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
    if (!user?.id) return;
    // Subscribe to real-time changes
    const channel = supabase.channel('public:tasks')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          // Refetch tasks on any change
          fetchTasks();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useFocusEffect(
    React.useCallback(() => {
      fetchTasks();
    }, [user?.id])
  );

  const updateTask = useTaskStore((state) => state.updateTask);

  const toggleTask = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const updatedTask = { ...task, completed: !task.completed };
    // Optimistically update UI
    updateTask(updatedTask);
    setToggleLoadingId(taskId);
    setError(null);
    try {
      await SupabaseTaskService.updateTask(taskId, { completed: updatedTask.completed });
    } catch (err: any) {
      console.error('Error updating task:', err);
      
      // Handle authentication errors
      if (isAuthError(err)) {
        setError('Session expired. Please sign in again.');
        // Revert UI change
        updateTask(task);
        // Clear session and redirect to sign-in
        setTimeout(() => {
          signOut();
          router.replace('/(auth)/sign-in');
        }, 2000);
        return;
      }
      
      // Revert UI if error
      updateTask(task);
      setError(err.message || 'Failed to update task');
    } finally {
      setToggleLoadingId(null);
    }
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
      (selectedFilter === 'ai-suggested' && task.ai_suggested);
    return matchesSearch && matchesFilter;
  });

  const filters = [
    { key: 'all', label: 'All', count: tasks.length },
    { key: 'pending', label: 'Pending', count: tasks.filter(t => !t.completed).length },
    { key: 'completed', label: 'Completed', count: tasks.filter(t => t.completed).length },
    { key: 'ai-suggested', label: 'AI Suggested', count: tasks.filter(t => t.ai_suggested).length },
  ];

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Process offline queue on reconnect
  useEffect(() => {
    if (!user?.id) return;
    const processQueue = async () => {
      const queue = TypedStorage.offlineQueue.get();
      if (!queue || queue.length === 0) return;
      for (const item of queue) {
        try {
          if (item.action === 'create' && item.entity === 'task') {
            await SupabaseTaskService.createTask(item.data.userId, item.data);
          }
          // Add update/delete logic as needed
          TypedStorage.offlineQueue.remove(item.id);
        } catch (err) {
          // If still offline, break
          break;
        }
      }
    };
    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected) {
        processQueue();
      }
    });
    // Also try once on mount
    processQueue();
    return () => unsubscribe();
  }, [user?.id]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}> 
      {loading && (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={{ color: theme.colors.textSecondary, marginTop: 12 }}>Loading tasks...</Text>
        </View>
      )}
      {error && (
        <View style={{ padding: 20, backgroundColor: theme.colors.error + '22', borderRadius: 8, margin: 16 }}>
          <Text style={{ color: theme.colors.error }}>{error}</Text>
        </View>
      )}
      {!loading && !error && (
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View 
            style={[styles.header, { backgroundColor: theme.colors.background }]}
          >
            <View style={styles.headerContent}>
              <View>
                <Text style={[styles.greeting, { color: theme.colors.textSecondary }]}>
                  {getGreeting()}
                </Text>
                <Text style={[styles.userName, { color: theme.colors.text }]}>
                  {profile?.username || profile?.full_name || user?.email || 'Welcome back'}
                </Text>
              </View>
              <View style={styles.headerRight}>
                <TouchableOpacity 
                  onPress={handleProfilePress}
                >
                  {profile?.avatar_url ? (
                    <Image
                      source={{ uri: profile.avatar_url }}
                      style={styles.avatarContainer}
                    />
                  ) : (
                    <View style={[styles.avatarContainer, { backgroundColor: theme.colors.primary }]}>
                      <Text style={styles.avatarText}>
                        {profile?.username ? profile.username.charAt(0).toUpperCase() : 
                         profile?.full_name ? getInitials(profile.full_name) : 'U'}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={handleSignOut}
                  style={[styles.signOutButton, { backgroundColor: theme.colors.surface }]}
                >
                  <LogOut size={16} color={theme.colors.textSecondary} strokeWidth={2} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Progress Card */}
          <View
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
          </View>

          {/* AI Suggestions Preview */}
          <View
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
              {tasks.filter(t => t.ai_suggested).map((task, index) => (
                <View
                  key={task.id}
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
                      {task.timeAgo}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>

          {/* Search and Filter */}
          <View
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
          </View>

          {/* Tasks List */}
          <View
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
              <View
                key={task.id}
                style={[styles.taskCard, { backgroundColor: theme.colors.surface }]}
              >
                <TouchableOpacity
                  onPress={() => toggleLoadingId ? undefined : toggleTask(task.id)}
                  style={styles.taskContent}
                  disabled={!!toggleLoadingId}
                >
                  <View style={styles.taskLeft}>
                    {toggleLoadingId === task.id ? (
                      <ActivityIndicator size="small" color={theme.colors.primary} />
                    ) : (
                      <TouchableOpacity
                        onPress={() => toggleTask(task.id)}
                        style={styles.checkboxContainer}
                        disabled={!!toggleLoadingId}
                      >
                        {task.completed ? (
                          <CheckCircle2 size={24} color={theme.colors.success} strokeWidth={2} />
                        ) : (
                          <Circle size={24} color={theme.colors.textTertiary} strokeWidth={2} />
                        )}
                      </TouchableOpacity>
                    )}
                    
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
                        {task.ai_suggested && (
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
                          {task.timeAgo}
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
              </View>
            ))}
          </View>
        </ScrollView>
      )}
      <TouchableOpacity
        style={[
          styles.fabContainer,
          {
            backgroundColor: theme.colors.primary,
            position: 'absolute',
            bottom: 32,
            right: 24,
            zIndex: 100,
          },
        ]}
        onPress={() => router.push('/(tabs)/add-task')}
        activeOpacity={0.85}
      >
        <Plus size={28} color="white" strokeWidth={2.5} />
      </TouchableOpacity>
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
  fabContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
});