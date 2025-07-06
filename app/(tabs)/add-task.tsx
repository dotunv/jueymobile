import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Plus, Tag, Clock, AlignLeft, Calendar, Zap, Target, CircleCheck as CheckCircle2, Hash } from 'lucide-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  FadeIn,
  SlideInUp,
  ZoomIn,
} from 'react-native-reanimated';
import { useTheme } from '@/context/ThemeContext';
import { router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { SupabaseTaskService } from '@/lib/services/supabaseService';
import { TypedStorage } from '@/lib/storage';
import { isAuthError } from '@/lib/supabase';
import DateTimePicker from '@react-native-community/datetimepicker';

interface Tag {
  id: string;
  name: string;
  color: string;
}

const predefinedTags: Tag[] = [
  { id: '1', name: 'Work', color: '#6366F1' },
  { id: '2', name: 'Personal', color: '#8B5CF6' },
  { id: '3', name: 'Health', color: '#10B981' },
  { id: '4', name: 'Learning', color: '#F59E0B' },
  { id: '5', name: 'Home', color: '#EF4444' },
  { id: '6', name: 'Finance', color: '#06B6D4' },
];

const priorities = [
  { key: 'low', label: 'Low', color: '#10B981' },
  { key: 'medium', label: 'Medium', color: '#F59E0B' },
  { key: 'high', label: 'High', color: '#EF4444' },
];

export default function AddTaskScreen() {
  const { theme } = useTheme();
  const { user, signOut } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedPriority, setSelectedPriority] = useState('medium');
  const [isCompleted, setIsCompleted] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const scaleValue = useSharedValue(1);

  const animatedButtonStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scaleValue.value }],
    };
  });

  const handleTagToggle = (tagId: string) => {
    setSelectedTags(prev => 
      prev.includes(tagId) 
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const handleSubmit = async () => {
    if (!title.trim() || !user?.id) return;
    setLoading(true);
    setError(null);
    scaleValue.value = withSpring(0.95, {}, () => {
      scaleValue.value = withSpring(1);
    });
    const taskData: any = {
      title,
      description,
      tags: selectedTags,
      priority: selectedPriority as any,
      completed: isCompleted,
      ai_suggested: false,
      category: getSelectedTags()[0]?.name || 'Personal',
    };
    if (isCompleted && completedAt) {
      taskData.completed_at = completedAt;
    }
    try {
      // Try to create task in Supabase
      await SupabaseTaskService.createTask(user.id, taskData);
      setShowPreview(true);
      setTimeout(() => {
        router.replace('/(tabs)');
      }, 1500);
    } catch (err: any) {
      console.error('Error creating task:', err);
      
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
      
      // If offline, queue the task creation
      TypedStorage.offlineQueue.add({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        action: 'create',
        entity: 'task',
        data: { userId: user.id, ...taskData },
        timestamp: Date.now(),
      });
      setShowPreview(true);
      setTimeout(() => {
        router.replace('/(tabs)');
      }, 1500);
    } finally {
      setLoading(false);
    }
  };

  const getSelectedTags = () => {
    return predefinedTags.filter(tag => selectedTags.includes(tag.id));
  };

  const getSelectedPriority = () => {
    return priorities.find(p => p.key === selectedPriority);
  };

  if (showPreview) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Animated.View 
          entering={ZoomIn.duration(800)}
          style={styles.successContainer}
        >
          <View style={[styles.successCircle, { backgroundColor: theme.colors.success }]}>
            <CheckCircle2 size={64} color="white" strokeWidth={2} />
          </View>
          <Text style={[styles.successTitle, { color: theme.colors.text }]}>
            Task Created!
          </Text>
          <Text style={[styles.successSubtitle, { color: theme.colors.textSecondary }]}>
            Your task has been added successfully
          </Text>
          <TouchableOpacity
            style={{
              marginTop: 32,
              backgroundColor: theme.colors.primary,
              borderRadius: 16,
              paddingVertical: 14,
              paddingHorizontal: 32,
              alignSelf: 'center',
            }}
            onPress={() => router.replace('/(tabs)')}
          >
            <Text style={{ color: 'white', fontSize: 16, fontFamily: 'Inter-SemiBold' }}>Done</Text>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView 
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View 
          
          style={styles.header}
        >
          <LinearGradient
            colors={[theme.colors.primary, theme.colors.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerGradient}
          >
            <View style={styles.headerContent}>
              <TouchableOpacity 
                onPress={() => router.back()}
                style={styles.closeButton}
              >
                <X size={24} color="white" strokeWidth={2} />
              </TouchableOpacity>
              
              <View style={styles.headerCenter}>
                <Text style={styles.headerTitle}>Add New Task</Text>
                <Text style={styles.headerSubtitle}>Create and organize your tasks</Text>
              </View>
              
              <View style={styles.headerRight} />
            </View>
          </LinearGradient>
        </View>

        <ScrollView 
          style={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Task Title */}
          <Animated.View
            entering={SlideInUp.delay(200).duration(600)}
            style={[styles.inputSection, { backgroundColor: theme.colors.surface }]}
          >
            <View style={styles.inputHeader}>
              <AlignLeft size={20} color={theme.colors.primary} strokeWidth={2} />
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
                Task Title
              </Text>
            </View>
            <TextInput
              style={[styles.titleInput, { color: theme.colors.text }]}
              placeholder="What needs to be done?"
              placeholderTextColor={theme.colors.textTertiary}
              value={title}
              onChangeText={setTitle}
              multiline
              autoFocus
            />
          </Animated.View>

          {/* Description */}
          <Animated.View
            entering={SlideInUp.delay(300).duration(600)}
            style={[styles.inputSection, { backgroundColor: theme.colors.surface }]}
          >
            <View style={styles.inputHeader}>
              <Hash size={20} color={theme.colors.primary} strokeWidth={2} />
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
                Description (Optional)
              </Text>
            </View>
            <TextInput
              style={[styles.descriptionInput, { color: theme.colors.text }]}
              placeholder="Add more details about this task..."
              placeholderTextColor={theme.colors.textTertiary}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
            />
          </Animated.View>

          {/* Tags */}
          <Animated.View
            entering={SlideInUp.delay(400).duration(600)}
            style={[styles.inputSection, { backgroundColor: theme.colors.surface }]}
          >
            <View style={styles.inputHeader}>
              <Tag size={20} color={theme.colors.primary} strokeWidth={2} />
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
                Tags
              </Text>
            </View>
            <View style={styles.tagsContainer}>
              {predefinedTags.map((tag) => (
                <TouchableOpacity
                  key={tag.id}
                  onPress={() => handleTagToggle(tag.id)}
                  style={[
                    styles.tagChip,
                    {
                      backgroundColor: selectedTags.includes(tag.id) 
                        ? tag.color 
                        : theme.colors.surfaceVariant,
                      borderColor: tag.color,
                    }
                  ]}
                >
                  <Text
                    style={[
                      styles.tagText,
                      {
                        color: selectedTags.includes(tag.id) 
                          ? 'white' 
                          : theme.colors.text,
                      }
                    ]}
                  >
                    {tag.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>

          {/* Priority */}
          <Animated.View
            entering={SlideInUp.delay(500).duration(600)}
            style={[styles.inputSection, { backgroundColor: theme.colors.surface }]}
          >
            <View style={styles.inputHeader}>
              <Target size={20} color={theme.colors.primary} strokeWidth={2} />
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
                Priority
              </Text>
            </View>
            <View style={styles.priorityContainer}>
              {priorities.map((priority) => (
                <TouchableOpacity
                  key={priority.key}
                  onPress={() => setSelectedPriority(priority.key)}
                  style={[
                    styles.priorityChip,
                    {
                      backgroundColor: selectedPriority === priority.key 
                        ? priority.color 
                        : theme.colors.surfaceVariant,
                      borderColor: priority.color,
                    }
                  ]}
                >
                  <View style={[
                    styles.priorityDot,
                    { backgroundColor: selectedPriority === priority.key ? 'white' : priority.color }
                  ]} />
                  <Text
                    style={[
                      styles.priorityText,
                      {
                        color: selectedPriority === priority.key 
                          ? 'white' 
                          : theme.colors.text,
                      }
                    ]}
                  >
                    {priority.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>

          {/* Quick Actions */}
          <Animated.View
            entering={SlideInUp.delay(600).duration(600)}
            style={[styles.inputSection, { backgroundColor: theme.colors.surface }]}
          >
            <View style={styles.inputHeader}>
              <Zap size={20} color={theme.colors.primary} strokeWidth={2} />
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
                Quick Actions
              </Text>
            </View>
            
            <TouchableOpacity
              onPress={() => setIsCompleted(!isCompleted)}
              style={styles.quickAction}
            >
              <View style={styles.quickActionLeft}>
                {isCompleted ? (
                  <CheckCircle2 size={24} color={theme.colors.success} strokeWidth={2} />
                ) : (
                  <View style={[styles.checkbox, { borderColor: theme.colors.border }]} />
                )}
                <Text style={[styles.quickActionText, { color: theme.colors.text }]}>
                  Mark as completed
                </Text>
              </View>
            </TouchableOpacity>
            {isCompleted && (
              <>
                <View style={styles.inputHeader}>
                  <Clock size={16} color={theme.colors.primary} strokeWidth={2} />
                  <Text style={[styles.inputLabel, { color: theme.colors.textSecondary, marginLeft: 8 }]}>Completed at:</Text>
                  <Text style={[styles.inputLabel, { color: theme.colors.text }]}>{completedAt ? new Date(completedAt).toLocaleString() : ''}</Text>
                  <TouchableOpacity onPress={() => setShowDatePicker(true)} style={{ marginLeft: 12 }}>
                    <Text style={{ color: theme.colors.primary, textDecorationLine: 'underline' }}>Edit</Text>
                  </TouchableOpacity>
                </View>
                <View style={{ flexDirection: 'row', marginTop: 8 }}>
                  <TouchableOpacity onPress={() => { setCompletedAt(new Date().toISOString()); }} style={styles.timestampQuickBtn}>
                    <Text style={styles.timestampQuickBtnText}>Just now</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { const d = new Date(); d.setHours(9,0,0,0); setCompletedAt(d.toISOString()); }} style={styles.timestampQuickBtn}>
                    <Text style={styles.timestampQuickBtnText}>Earlier today</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { const d = new Date(); d.setDate(d.getDate()-1); d.setHours(18,0,0,0); setCompletedAt(d.toISOString()); }} style={styles.timestampQuickBtn}>
                    <Text style={styles.timestampQuickBtnText}>Yesterday</Text>
                  </TouchableOpacity>
                </View>
                {showDatePicker && (
                  <DateTimePicker
                    value={completedAt ? new Date(completedAt) : new Date()}
                    mode="datetime"
                    display={Platform.OS === 'android' ? 'default' : 'default'}
                    onChange={(event, date) => {
                      setShowDatePicker(false);
                      if (date) setCompletedAt(date.toISOString());
                    }}
                  />
                )}
              </>
            )}
          </Animated.View>

          {/* Task Preview */}
          {title.trim() && (
            <Animated.View
              entering={SlideInUp.delay(700).duration(600)}
              style={[styles.previewSection, { backgroundColor: theme.colors.surfaceVariant }]}
            >
              <View style={styles.inputHeader}>
                <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
                  Preview
                </Text>
              </View>
              
              <View style={[styles.previewCard, { backgroundColor: theme.colors.surface }]}>
                <View style={styles.previewHeader}>
                  <View style={styles.previewLeft}>
                    {isCompleted ? (
                      <CheckCircle2 size={20} color={theme.colors.success} strokeWidth={2} />
                    ) : (
                      <View style={[styles.previewCheckbox, { borderColor: theme.colors.border }]} />
                    )}
                    <Text style={[
                      styles.previewTitle,
                      { 
                        color: isCompleted ? theme.colors.textTertiary : theme.colors.text,
                        textDecorationLine: isCompleted ? 'line-through' : 'none'
                      }
                    ]}>
                      {title}
                    </Text>
                  </View>
                  <View style={[
                    styles.previewPriorityDot,
                    { backgroundColor: getSelectedPriority()?.color }
                  ]} />
                </View>
                
                {description.trim() && (
                  <Text style={[styles.previewDescription, { color: theme.colors.textSecondary }]}>
                    {description}
                  </Text>
                )}
                
                {selectedTags.length > 0 && (
                  <View style={styles.previewTags}>
                    {getSelectedTags().map((tag) => (
                      <View
                        key={tag.id}
                        style={[styles.previewTag, { backgroundColor: tag.color + '20' }]}
                      >
                        <Text style={[styles.previewTagText, { color: tag.color }]}>
                          {tag.name}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </Animated.View>
          )}
        </ScrollView>

        {/* Submit Button */}
        <Animated.View
          entering={SlideInUp.delay(800).duration(600)}
          style={[styles.submitContainer, { backgroundColor: theme.colors.background }]}
        >
          <Animated.View style={animatedButtonStyle}>
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={!title.trim() || loading}
              style={[
                styles.submitButton,
                {
                  backgroundColor: title.trim() ? theme.colors.primary : theme.colors.textTertiary,
                }
              ]}
            >
              <Plus size={20} color="white" strokeWidth={2} />
              <Text style={styles.submitButtonText}>Create Task</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardContainer: {
    flex: 1,
  },
  header: {
    overflow: 'hidden',
  },
  headerGradient: {
    paddingTop: 16,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 16,
  },
  headerTitle: {
    color: 'white',
    fontSize: 20,
    fontFamily: 'Inter-Bold',
  },
  headerSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    marginTop: 2,
  },
  headerRight: {
    width: 40,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 120,
  },
  inputSection: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  inputHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  inputLabel: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  titleInput: {
    fontSize: 18,
    fontFamily: 'Inter-Regular',
    minHeight: 50,
    textAlignVertical: 'top',
  },
  descriptionInput: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  tagText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
  },
  priorityContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  priorityChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  priorityText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
  },
  quickAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  quickActionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quickActionText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
  },
  previewSection: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  previewCard: {
    padding: 16,
    borderRadius: 12,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  previewLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  previewCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
  },
  previewTitle: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    flex: 1,
  },
  previewPriorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  previewDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    marginBottom: 12,
    marginLeft: 32,
  },
  previewTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginLeft: 32,
  },
  previewTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  previewTagText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
  },
  submitContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
    shadowColor: '#6366F1',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  successCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  successTitle: {
    fontSize: 28,
    fontFamily: 'Inter-Bold',
    marginBottom: 12,
  },
  successSubtitle: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
  },
  timestampQuickBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
    marginRight: 8,
  },
  timestampQuickBtnText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
  },
});