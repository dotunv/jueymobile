import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Image,
  Dimensions,
  Modal,
  Animated,
  Modal as RNModal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, CircleCheck as CheckCircle2, Circle, Clock, Star, Target, LogOut, Plus } from 'lucide-react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  withSpring,
  interpolate,
  Extrapolate
} from 'react-native-reanimated';

import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { SupabaseTaskService } from '@/lib/services/supabaseService';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useTaskStore } from '@/lib/taskStore';
import { isAuthError } from '@/lib/supabase';
import { TypedStorage, OfflineQueueItem } from '@/lib/storage';
import NetInfo from '@react-native-community/netinfo';
import { Task as SupabaseTask, TaskListItem } from '@/lib/types';
import SvgLogo from '../../assets/images/logo.svg';

const { width, height } = Dimensions.get('window');

function mapSupabaseTaskToUITask(task: SupabaseTask): TaskListItem {
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
    ...task,
    timeAgo,
    isOverdue: task.due_date ? new Date(task.due_date) < new Date() : false,
    isDueToday: task.due_date ? new Date(task.due_date).toDateString() === new Date().toDateString() : false,
  };
}

export default function HomeScreen() {
  const { theme } = useTheme();
  const { user, profile, signOut } = useAuth();
  const tasks = useTaskStore((s) => s.tasks);
  const setTasks = useTaskStore((s) => s.setTasks);
  const updateTask = useTaskStore((s) => s.updateTask);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [toggleLoadingId, setToggleLoadingId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<TaskListItem | null>(null);
  const [galleryVisible, setGalleryVisible] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [galleryAnim] = useState(new Animated.Value(0));
  const [syncStatus, setSyncStatus] = useState({ pending: 0, failed: 0, syncing: 0, lastError: '' });
  const [conflicts, setConflicts] = useState<OfflineQueueItem[]>([]);
  const [conflictModal, setConflictModal] = useState<{ item: OfflineQueueItem | null, visible: boolean }>({ item: null, visible: false });

  const completedToday = tasks.filter(t => t.completed).length;
  const totalTasks = tasks.length;
  const progressPct = totalTasks ? (completedToday / totalTasks) * 100 : 0;

  // Improved progress animation
  const progressAnim = useSharedValue(0);
  const scaleAnim = useSharedValue(0.8);
  const opacityAnim = useSharedValue(0);

  const progressStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scaleAnim.value },
    ],
    opacity: opacityAnim.value,
  }));

  const progressTextStyle = useAnimatedStyle(() => ({
    opacity: opacityAnim.value,
    transform: [{ scale: interpolate(opacityAnim.value, [0, 1], [0.8, 1]) }],
  }));

  const progressCircleStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(progressAnim.value, [0, 100], [0, 360], Extrapolate.CLAMP)}deg` }],
  }));

  useEffect(() => {
    progressAnim.value = withSpring(progressPct, { damping: 15, stiffness: 100 });
    scaleAnim.value = withSpring(1, { damping: 12, stiffness: 100 });
    opacityAnim.value = withTiming(1, { duration: 600 });
  }, [progressPct]);

  const getGreeting = () => {
    const hr = new Date().getHours();
    if (hr < 12) return 'Good morning';
    if (hr < 17) return 'Good afternoon';
    if (hr < 21) return 'Good evening';
    return 'Hello';
  };

  const initials = (name: string) =>
    name
      .split(' ')
      .map(w => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

  const filters = [
    { key: 'all', label: 'All', count: tasks.length },
    { key: 'pending', label: 'Pending', count: tasks.filter(t => !t.completed).length },
    { key: 'completed', label: 'Done', count: tasks.filter(t => t.completed).length },
    { key: 'ai-suggested', label: 'AI', count: tasks.filter(t => t.ai_suggested).length },
  ];

  const filtered = tasks.filter(t => {
    if (searchQuery && !t.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    switch (selectedFilter) {
      case 'completed': return t.completed;
      case 'pending': return !t.completed;
      case 'ai-suggested': return t.ai_suggested;
      default: return true;
    }
  });

  const fetchTasks = async () => {
    if (!user?.id) return;
    setLoading(true); setError(null);
    try {
      const supa = await SupabaseTaskService.getTasks(user.id);
      setTasks(supa.map(mapSupabaseTaskToUITask));
      TypedStorage.cachedTasks.set(supa);
    } catch (err: any) {
      if (isAuthError(err)) {
        setError('Session expired — please signin');
        setTimeout(async () => { await signOut(); router.replace('/(auth)/sign-in'); }, 1500);
      } else {
        setError(err.message);
        const cached = TypedStorage.cachedTasks.get();
        if (cached?.length) setTasks(cached);
      }
    } finally { setLoading(false); }
  };

  const toggle = async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    const updated = { ...task, completed: !task.completed };
    updateTask(updated);
    setToggleLoadingId(id);
    try {
      await SupabaseTaskService.updateTask(id, { completed: updated.completed });
    } catch {
      updateTask(task);
      setError('Update failed');
    } finally {
      setToggleLoadingId(null);
    }
  };

  // Handler to open gallery modal
  const handleOpenGallery = (task: TaskListItem) => {
    if (task.attachments && task.attachments.length > 0) {
      setSelectedTask(task);
      setGalleryIndex(0);
      setGalleryVisible(true);
    }
  };

  useEffect(() => {
    fetchTasks();
    const chan = supabase
      .channel('tasks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `user_id=eq.${user?.id}` }, fetchTasks)
      .subscribe();
    return () => supabase.removeChannel(chan);
  }, [user?.id]);

  useFocusEffect(
    React.useCallback(() => {
      fetchTasks();
    }, [user?.id])
  );

  useEffect(() => {
    const proc = async () => {
      const queue = TypedStorage.offlineQueue.get();
      if (queue?.length) {
        for (const item of queue) {
          try {
            if (item.action === 'create') {
              await SupabaseTaskService.createTask(item.data.userId, item.data);
            }
            TypedStorage.offlineQueue.remove(item.id);
          } catch {
            break;
          }
        }
      }
    };
    const sub = NetInfo.addEventListener(s => s.isConnected && proc());
    proc();
    return () => sub();
  }, [user?.id]);

  // Animate modal open/close
  useEffect(() => {
    if (galleryVisible) {
      Animated.timing(galleryAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    } else {
      Animated.timing(galleryAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    }
  }, [galleryVisible]);

  // Monitor offline queue status
  useEffect(() => {
    const checkQueue = async () => {
      const queue = await TypedStorage.offlineQueue.get();
      setSyncStatus({
        pending: queue.filter(q => q.status === 'pending').length,
        failed: queue.filter(q => q.status === 'failed').length,
        syncing: queue.filter(q => q.status === 'syncing').length,
        lastError: queue.find(q => q.status === 'failed')?.last_error || '',
      });
    };
    checkQueue();
    const interval = setInterval(checkQueue, 3000);
    return () => clearInterval(interval);
  }, []);

  // Monitor conflicts in offline queue
  useEffect(() => {
    const checkConflicts = async () => {
      const queue = await TypedStorage.offlineQueue.get();
      setConflicts(queue.filter(q => q.status === 'conflict'));
    };
    checkConflicts();
    const interval = setInterval(checkConflicts, 3000);
    return () => clearInterval(interval);
  }, []);

  // Retry failed syncs
  const handleRetryFailed = async () => {
    const queue = await TypedStorage.offlineQueue.get();
    for (const item of queue.filter(q => q.status === 'failed')) {
      await TypedStorage.offlineQueue.updateStatus(item.id, 'pending');
    }
    setSyncStatus(s => ({ ...s, failed: 0, lastError: '' }));
  };

  // Handle conflict resolution
  const handleResolveConflict = async (item: OfflineQueueItem, keep: 'local' | 'remote' | 'merge') => {
    // For simplicity, merge = prefer local, but could be more advanced
    const resolved = keep === 'local' ? item.conflict?.local : keep === 'remote' ? item.conflict?.remote : { ...item.conflict?.remote, ...item.conflict?.local };
    // Remove conflict and set to pending for retry
    await TypedStorage.offlineQueue.updateStatus(item.id, 'pending');
    const queue = await TypedStorage.offlineQueue.get();
    const idx = queue.findIndex(q => q.id === item.id);
    if (idx !== -1) {
      queue[idx].data = resolved;
      queue[idx].conflict = undefined;
      await TypedStorage.offlineQueue.set(queue);
    }
    setConflictModal({ item: null, visible: false });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Sync Status Banner */}
      {(syncStatus.pending > 0 || syncStatus.failed > 0 || syncStatus.syncing > 0) && (
        <View style={{ backgroundColor: syncStatus.failed > 0 ? theme.colors.error : theme.colors.warning, padding: 10, alignItems: 'center' }}>
          <Text style={{ color: 'white', fontWeight: 'bold' }}>
            {syncStatus.failed > 0
              ? `Sync failed for ${syncStatus.failed} item(s).`
              : syncStatus.pending > 0
                ? `Syncing ${syncStatus.pending} item(s)...`
                : 'Syncing...'}
          </Text>
          {syncStatus.lastError ? <Text style={{ color: 'white', fontSize: 12 }}>{syncStatus.lastError}</Text> : null}
          {syncStatus.failed > 0 && (
            <TouchableOpacity onPress={handleRetryFailed} style={{ marginTop: 6, padding: 6, backgroundColor: theme.colors.surface, borderRadius: 8 }}>
              <Text style={{ color: theme.colors.error, fontWeight: 'bold' }}>Retry Failed</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      {/* Conflict Banner */}
      {conflicts.length > 0 && (
        <View style={{ backgroundColor: theme.colors.error, padding: 10, alignItems: 'center' }}>
          <Text style={{ color: 'white', fontWeight: 'bold' }}>Sync conflict for {conflicts.length} item(s).</Text>
          {conflicts.map(item => (
            <TouchableOpacity key={item.id} onPress={() => setConflictModal({ item, visible: true })} style={{ marginTop: 6, padding: 6, backgroundColor: theme.colors.surface, borderRadius: 8 }}>
              <Text style={{ color: theme.colors.error, fontWeight: 'bold' }}>Resolve Conflict</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      {/* Conflict Resolution Modal */}
      <RNModal visible={conflictModal.visible} transparent animationType="slide" onRequestClose={() => setConflictModal({ item: null, visible: false })}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <View style={{ backgroundColor: theme.colors.surface, borderRadius: 16, padding: 24, width: '100%', maxWidth: 400 }}>
            <Text style={{ fontWeight: 'bold', fontSize: 18, color: theme.colors.error, marginBottom: 12 }}>Resolve Conflict</Text>
            {conflictModal.item && (
              <>
                <Text style={{ color: theme.colors.text, marginBottom: 8 }}>Choose which version to keep:</Text>
                <ScrollView style={{ maxHeight: 220 }}>
                  <Text style={{ color: theme.colors.textSecondary, fontWeight: 'bold', marginBottom: 4 }}>Local Version:</Text>
                  <Text style={{ color: theme.colors.text, marginBottom: 8 }}>{JSON.stringify(conflictModal.item.conflict?.local, null, 2)}</Text>
                  <Text style={{ color: theme.colors.textSecondary, fontWeight: 'bold', marginBottom: 4 }}>Remote Version:</Text>
                  <Text style={{ color: theme.colors.text, marginBottom: 8 }}>{JSON.stringify(conflictModal.item.conflict?.remote, null, 2)}</Text>
                  {conflictModal.item.conflict?.fields && (
                    <Text style={{ color: theme.colors.warning, marginBottom: 8 }}>Conflicting fields: {conflictModal.item.conflict.fields.join(', ')}</Text>
                  )}
                </ScrollView>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 }}>
                  <TouchableOpacity onPress={() => handleResolveConflict(conflictModal.item!, 'local')} style={{ backgroundColor: theme.colors.primary, padding: 10, borderRadius: 8, flex: 1, marginRight: 8 }}>
                    <Text style={{ color: 'white', textAlign: 'center' }}>Keep Local</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleResolveConflict(conflictModal.item!, 'remote')} style={{ backgroundColor: theme.colors.warning, padding: 10, borderRadius: 8, flex: 1, marginRight: 8 }}>
                    <Text style={{ color: 'white', textAlign: 'center' }}>Keep Remote</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleResolveConflict(conflictModal.item!, 'merge')} style={{ backgroundColor: theme.colors.success, padding: 10, borderRadius: 8, flex: 1 }}>
                    <Text style={{ color: 'white', textAlign: 'center' }}>Merge</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </RNModal>
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        bounces={true}
      >
        {/* Header */}
        <View style={styles.header}>
          <SvgLogo width={36} height={36} style={{ marginRight: 12 }} />
          <View>
            <Text style={[styles.greeting, { color: theme.colors.textSecondary }]}>{getGreeting()},</Text>
            <Text style={[styles.username, { color: theme.colors.text }]}>{profile?.username || profile?.full_name || user?.email}</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity onPress={() => router.push('/(tabs)/settings')}>
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, { backgroundColor: theme.colors.primary }]}>
                  <Text style={styles.initials}>{profile?.full_name ? initials(profile.full_name) : 'U'}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={async () => { await signOut(); router.replace('/(auth)/sign-in'); }} style={styles.logout}>
              <LogOut size={18} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Loading/Error */}
        {loading && (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={{ color: theme.colors.textSecondary, marginTop: 12 }}>Loading tasks...</Text>
          </View>
        )}
        {error && (
          <View style={[styles.errorBox, { backgroundColor: theme.colors.error + '20' }]}>
            <Text style={{ color: theme.colors.error }}>{error}</Text>
          </View>
        )}

        {!loading && !error && (
          <>
            {/* Progress Card */}
            <View style={[styles.progressCard, { backgroundColor: theme.colors.primary }]}>
              <View style={styles.progressContent}>
                <Animated.View style={progressTextStyle}>
                  <Text style={styles.progressTextLight}>Today's Progress</Text>
                  <Text style={styles.progressTextDim}>{completedToday} of {totalTasks} tasks done</Text>
                </Animated.View>
                <View style={styles.circleWrapper}>
                  <View style={[styles.progressCircle, { borderColor: theme.colors.primaryVariant + '55' }]}>
                    <Animated.View 
                      style={[
                        styles.progressFill, 
                        { borderColor: 'white' },
                        progressCircleStyle
                      ]} 
                    />
                  </View>
                  <Animated.View style={[styles.circleOverlay, progressStyle]}>
                    <Target size={18} color={theme.colors.primary} />
                    <Text style={[styles.circlePct, { color: theme.colors.primary }]}>{Math.round(progressPct)}%</Text>
                  </Animated.View>
                </View>
              </View>
            </View>

            {/* AI Suggestions */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Star size={20} color={theme.colors.primary} />
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>AI Suggestions</Text>
                <TouchableOpacity onPress={() => router.push('/suggestions')}>
                  <Text style={[styles.cta, { color: theme.colors.primary }]}>See All</Text>
                </TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 20 }}>
                {tasks.filter(t => t.ai_suggested).map(task => (
                  <View key={task.id} style={[styles.suggestionCard, { backgroundColor: theme.colors.surface }]}>
                    <View style={styles.suggTop}>
                      <View style={[styles.bullet, { backgroundColor: task.priority === 'high' ? theme.colors.error : task.priority === 'medium' ? theme.colors.warning : theme.colors.success }]} />
                      <Text style={[styles.suggCat, { color: theme.colors.textSecondary }]}>{task.category}</Text>
                    </View>
                    <Text style={[styles.suggText, { color: theme.colors.text }]} numberOfLines={2}>{task.title}</Text>
                    <View style={styles.suggBot}>
                      <Clock size={14} color={theme.colors.textTertiary} />
                      <Text style={[styles.suggTime, { color: theme.colors.textTertiary }]}>{task.timeAgo}</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>

            {/* Search & Filters */}
            <View style={styles.searchSection}>
              <View style={[styles.searchInputWrap, { backgroundColor: theme.colors.surface }]}>
                <Search size={20} color={theme.colors.textTertiary} />
                <TextInput
                  style={[styles.searchInput, { color: theme.colors.text }]}
                  placeholder="Search tasks..."
                  placeholderTextColor={theme.colors.textTertiary}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
                {filters.map(f => (
                  <TouchableOpacity
                    key={f.key}
                    style={[styles.filterBtn, {
                      backgroundColor: selectedFilter === f.key ? theme.colors.primary : theme.colors.surface,
                      borderColor: theme.colors.border,
                    }]}
                    onPress={() => setSelectedFilter(f.key)}
                  >
                    <Text style={[styles.filterText, { color: selectedFilter === f.key ? 'white' : theme.colors.text }]}>{f.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Task List */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Recent</Text>
                <Text style={[styles.cta, { color: theme.colors.textSecondary }]}>{filtered.length} items</Text>
              </View>
              {filtered.map(task => (
                <View key={task.id} style={[styles.taskCard, { backgroundColor: theme.colors.surface }]}>
                  <TouchableOpacity onPress={() => handleOpenGallery(task)} style={styles.taskRow}>
                    <View style={styles.taskLeft}>
                      {toggleLoadingId === task.id ? (
                        <ActivityIndicator size="small" color={theme.colors.primary} />
                      ) : (
                        <TouchableOpacity onPress={() => toggle(task.id)} style={styles.checkbox}>
                          {task.completed ? (
                            <CheckCircle2 size={24} color={theme.colors.success} />
                          ) : (
                            <Circle size={24} color={theme.colors.textTertiary} />
                          )}
                        </TouchableOpacity>
                      )}
                      <View style={styles.taskInfo}>
                        <Text style={[styles.taskTitle, {
                          color: task.completed ? theme.colors.textTertiary : theme.colors.text,
                          textDecorationLine: task.completed ? 'line-through' : 'none',
                        }]}>
                          {task.title}
                        </Text>
                        <Text style={[styles.taskMeta, { color: theme.colors.textSecondary }]}>
                          {task.category} • {task.timeAgo}
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.priorityLine, { backgroundColor: task.priority === 'high' ? theme.colors.error : task.priority === 'medium' ? theme.colors.warning : theme.colors.success }]} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
      {/* Task Gallery Modal */}
      <Modal visible={galleryVisible} transparent animationType="fade" onRequestClose={() => setGalleryVisible(false)}>
        <Animated.View style={{ flex: 1, backgroundColor: galleryAnim.interpolate({ inputRange: [0, 1], outputRange: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.95)'] }), justifyContent: 'center', alignItems: 'center', opacity: galleryAnim }}>
          <TouchableOpacity style={{ position: 'absolute', top: 40, right: 20, zIndex: 2 }} onPress={() => setGalleryVisible(false)}>
            <Text style={{ color: 'white', fontSize: 24 }}>✕</Text>
          </TouchableOpacity>
          {selectedTask && selectedTask.attachments && selectedTask.attachments.length > 0 && (
            <>
              {/* Image count indicator */}
              <Text style={{ color: 'white', position: 'absolute', top: 50, left: 0, right: 0, textAlign: 'center', fontSize: 16, zIndex: 2 }}>
                {galleryIndex + 1} / {selectedTask.attachments.length}
              </Text>
              {/* Left/right arrows */}
              {galleryIndex > 0 && (
                <TouchableOpacity style={{ position: 'absolute', left: 10, top: height / 2 - 24, zIndex: 2 }} onPress={() => setGalleryIndex(i => Math.max(0, i - 1))}>
                  <Text style={{ color: 'white', fontSize: 32 }}>{'‹'}</Text>
                </TouchableOpacity>
              )}
              {galleryIndex < selectedTask.attachments.length - 1 && (
                <TouchableOpacity style={{ position: 'absolute', right: 10, top: height / 2 - 24, zIndex: 2 }} onPress={() => setGalleryIndex(i => Math.min(selectedTask.attachments.length - 1, i + 1))}>
                  <Text style={{ color: 'white', fontSize: 32 }}>{'›'}</Text>
                </TouchableOpacity>
              )}
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                contentOffset={{ x: galleryIndex * width, y: 0 }}
                onMomentumScrollEnd={e => {
                  const idx = Math.round(e.nativeEvent.contentOffset.x / width);
                  setGalleryIndex(idx);
                }}
                style={{ width, height: height * 0.7 }}
              >
                {selectedTask.attachments.map((att, idx) => (
                  <ScrollView
                    key={att.id}
                    style={{ width, height: height * 0.7, justifyContent: 'center', alignItems: 'center' }}
                    maximumZoomScale={3}
                    minimumZoomScale={1}
                    centerContent
                    contentContainerStyle={{ justifyContent: 'center', alignItems: 'center' }}
                  >
                    <TouchableOpacity
                      activeOpacity={1}
                      onPress={() => setGalleryVisible(false)}
                      onLongPress={() => setGalleryIndex(idx)}
                      delayLongPress={200}
                    >
                      <Image
                        source={{ uri: att.localPath || att.cloudUrl }}
                        style={{ width: width * 0.85, height: height * 0.6, borderRadius: 16, borderWidth: 2, borderColor: 'white', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12 }}
                        resizeMode="contain"
                      />
                    </TouchableOpacity>
                    {/* Metadata */}
                    <Text style={{ color: 'white', marginTop: 12, fontSize: 15, fontWeight: '600' }}>{att.filename}</Text>
                    {att.size ? <Text style={{ color: 'white', fontSize: 13 }}>{(att.size / 1024).toFixed(1)} KB</Text> : null}
                  </ScrollView>
                ))}
              </ScrollView>
            </>
          )}
        </Animated.View>
      </Modal>
      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        onPress={() => router.push('/(tabs)/add-task')}
      >
        <Plus size={28} color="white" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
  },
  greeting: { fontSize: 18, fontFamily: 'Inter-Regular' },
  username: { fontSize: 24, fontFamily: 'Inter-Bold', marginTop: 4 },

  headerRight: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  initials: { color: 'white', fontFamily: 'Inter-SemiBold', fontSize: 18 },
  logout: { marginLeft: 12, padding: 8, borderRadius: 20 },

  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  errorBox: { margin: 16, padding: 16, borderRadius: 8 },

  progressCard: {
    margin: 20,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  progressContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressTextLight: { color: 'white', fontSize: 18, fontFamily: 'Inter-SemiBold' },
  progressTextDim: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontFamily: 'Inter-Regular', marginTop: 4 },
  circleWrapper: { position: 'relative', width: 64, height: 64 },
  circleOverlay: {
    position: 'absolute',
    top: 0, left: 0, width: '100%', height: '100%',
    justifyContent: 'center', alignItems: 'center',
  },
  circlePct: { fontSize: 18, fontFamily: 'Inter-Bold', marginTop: 4 },

  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 },
  sectionTitle: { fontSize: 20, fontFamily: 'Inter-SemiBold', flex: 1 },
  cta: { fontSize: 14, fontFamily: 'Inter-Medium' },

  suggestionCard: {
    width: width * 0.6,
    marginRight: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    justifyContent: 'space-between',
  },
  suggTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  bullet: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  suggCat: { fontSize: 12, fontFamily: 'Inter-Regular', textTransform: 'uppercase' },
  suggText: { fontSize: 16, fontFamily: 'Inter-Medium', marginBottom: 12 },
  suggBot: { flexDirection: 'row', alignItems: 'center' },
  suggTime: { fontSize: 12, fontFamily: 'Inter-Regular', marginLeft: 4 },

  searchSection: { paddingHorizontal: 20, marginBottom: 24 },
  searchInputWrap: {
    flexDirection: 'row', alignItems: 'center', padding: 12,
    borderRadius: 12, marginBottom: 12,
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 16, fontFamily: 'Inter-Regular' },
  filterScroll: { flexDirection: 'row', paddingLeft: 20 },
  filterBtn: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, marginRight: 8, borderWidth: 1,
  },
  filterText: { fontSize: 14, fontFamily: 'Inter-Medium' },

  taskCard: {
    marginHorizontal: 20,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  taskRow: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  taskLeft: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  checkbox: { marginRight: 12 },
  taskInfo: { flex: 1 },
  taskTitle: { fontSize: 16, fontFamily: 'Inter-Medium' },
  taskMeta: { fontSize: 12, fontFamily: 'Inter-Regular', marginTop: 4 },
  priorityLine: { width: 4, height: 32, borderRadius: 2, marginLeft: 12 },

  fab: {
    position: 'absolute', bottom: 32, right: 24,
    width: 64, height: 64, borderRadius: 32,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 10,
  },
  progressCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 6,
    borderColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  progressFill: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 32,
    borderWidth: 6,
    borderColor: 'transparent',
    borderTopColor: 'white',
    borderRightColor: 'white',
  },
});
