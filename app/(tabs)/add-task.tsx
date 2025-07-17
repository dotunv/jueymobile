import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  ActivityIndicator,
  Image,
  Switch,
  Alert as RNAlert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Plus, Tag, Clock, AlignLeft, Calendar, Zap, Target, CircleCheck as CheckCircle2, Hash } from 'lucide-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../../context/ThemeContext';
import { router } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { SupabaseTaskService } from '../../lib/services/supabaseService';
import { TaskCreateInput, TaskAttachment } from '../../lib/types';
import { useTaskStore } from '../../lib/taskStore';
import { TypedStorage } from '../../lib/storage';
import { isAuthError } from '../../lib/supabase';
import DateTimePicker from '@react-native-community/datetimepicker';
import PageHeader from '../../components/PageHeader';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Card from '@/components/ui/Card';
import { LocationService } from '../../lib/services/locationService';
import { MediaService } from '../../lib/services/mediaService';

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
  const [locationContext, setLocationContext] = useState<any>(null);
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [locationLoading, setLocationLoading] = useState(false);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [locationEnabled, setLocationEnabled] = useState(true);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);

  const scaleValue = useSharedValue(1);

  const animatedButtonStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scaleValue.value }],
    };
  });

  // On mount, get location if enabled
  useEffect(() => {
    let mounted = true;
    if (locationEnabled) {
      setLocationLoading(true);
      LocationService.getCurrentLocation().then(loc => {
        if (mounted) setLocationContext(loc);
        setLocationLoading(false);
      });
    } else {
      setLocationContext(null);
    }
    return () => { mounted = false; };
  }, [locationEnabled]);

  const handleTagToggle = (tagId: string) => {
    setSelectedTags(prev => 
      prev.includes(tagId) 
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const handleAddImage = async () => {
    setMediaLoading(true);
    const attachment = await MediaService.pickOrCaptureImage(user?.id || '');
    if (attachment) setAttachments(prev => [...prev, attachment]);
    setMediaLoading(false);
  };

  const handleAddImages = async () => {
    setMediaLoading(true);
    const newAttachments = await MediaService.pickOrCaptureImages(user?.id || '');
    if (newAttachments.length === 0) {
      RNAlert.alert('Permission Denied', 'Image access was denied. Please enable permissions in settings.');
    }
    setAttachments(prev => [...prev, ...newAttachments]);
    setMediaLoading(false);
  };
  const handleRemoveAttachment = (id: string) => {
    setAttachments(prev => MediaService.removeAttachment(prev, id));
  };
  const handlePreviewImage = (att: TaskAttachment) => {
    setPreviewImage(MediaService.getPreviewUrl(att));
  };
  const handleRunOCR = async (att: TaskAttachment) => {
    setOcrLoading(true);
    const text = await MediaService.runOCR(att.localPath || att.cloudUrl || '');
    setOcrLoading(false);
    if (text) {
      setDescription(d => d ? d + '\n' + text : text);
      RNAlert.alert('OCR Result', 'Extracted text has been added to the description.');
    } else {
      RNAlert.alert('OCR Failed', 'No text could be extracted from the image.');
    }
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
      locationContext: locationContext || undefined,
      attachments: attachments.length > 0 ? attachments : undefined,
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

  const handleCancel = () => {
    Alert.alert('Cancel Task', 'Are you sure you want to cancel adding this task?', [
      { text: 'No', style: 'cancel' },
      { text: 'Yes', onPress: () => router.back() },
    ]);
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
        <View 
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
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView 
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <PageHeader
          icon={Plus}
          title="Add Task"
          subtitle="Create a new task"
          actionButton={{
            text: "Cancel",
            onPress: handleCancel,
            variant: "secondary"
          }}
        />

        <ScrollView 
          style={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <Input
            label="Task Title"
            placeholder="What needs to be done?"
            value={title}
            onChangeText={setTitle}
            multiline
            autoFocus
          />

          <Input
            label="Description (Optional)"
            placeholder="Add more details about this task..."
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            containerStyle={{ marginTop: 16 }}
          />

          <Card style={styles.card}>
            <View style={styles.inputHeader}>
              <Tag size={20} color={theme.colors.primary} />
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Tags</Text>
            </View>
            <View style={styles.tagsContainer}>
              {predefinedTags.map((tag) => (
                <TouchableOpacity
                  key={tag.id}
                  onPress={() => setSelectedTags(prev => prev.includes(tag.id) ? prev.filter(id => id !== tag.id) : [...prev, tag.id])}
                  style={[
                    styles.tagChip,
                    { backgroundColor: selectedTags.includes(tag.id) ? tag.color : theme.colors.surfaceVariant, borderColor: tag.color }
                  ]}
                >
                  <Text style={[styles.tagText, { color: selectedTags.includes(tag.id) ? 'white' : theme.colors.text }]}>
                    {tag.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Card>
          
          <Card style={styles.card}>
            <View style={styles.inputHeader}>
              <Target size={20} color={theme.colors.primary} />
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Priority</Text>
            </View>
            <View style={styles.priorityContainer}>
              {priorities.map((priority) => (
                <TouchableOpacity
                  key={priority.key}
                  onPress={() => setSelectedPriority(priority.key)}
                  style={[
                    styles.priorityChip,
                    { backgroundColor: selectedPriority === priority.key ? priority.color : theme.colors.surfaceVariant, borderColor: priority.color }
                  ]}
                >
                  <View style={[styles.priorityDot, { backgroundColor: selectedPriority === priority.key ? 'white' : priority.color }]} />
                  <Text style={[styles.priorityText, { color: selectedPriority === priority.key ? 'white' : theme.colors.text }]}>
                    {priority.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Card>

          <TouchableOpacity onPress={() => setIsCompleted(!isCompleted)} style={styles.quickAction}>
            {isCompleted ? (
              <CheckCircle2 size={24} color={theme.colors.success} />
            ) : (
              <View style={[styles.checkbox, { borderColor: theme.colors.border }]} />
            )}
            <Text style={[styles.quickActionText, { color: theme.colors.text }]}> 
              Mark as already completed
            </Text>
          </TouchableOpacity>

          {/* Location status */}
          <Card style={styles.card}>
            <View style={styles.inputHeader}>
              <Hash size={20} color={theme.colors.primary} />
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Location</Text>
              <Switch
                value={locationEnabled}
                onValueChange={setLocationEnabled}
                style={{ marginLeft: 'auto' }}
              />
            </View>
            {locationEnabled && (locationLoading ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : locationContext ? (
              <Text style={{ color: theme.colors.textSecondary }}>
                {locationContext.address || `${locationContext.latitude.toFixed(4)}, ${locationContext.longitude.toFixed(4)}`}
              </Text>
            ) : (
              <Text style={{ color: theme.colors.error }}>Location not available</Text>
            ))}
          </Card>
          {/* Image attachments */}
          <Card style={styles.card}>
            <View style={styles.inputHeader}>
              <AlignLeft size={20} color={theme.colors.primary} />
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Attachments</Text>
              <TouchableOpacity onPress={handleAddImages} style={{ marginLeft: 'auto' }}>
                <Plus size={18} color={theme.colors.primary} />
              </TouchableOpacity>
            </View>
            {mediaLoading && <ActivityIndicator size="small" color={theme.colors.primary} />}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', gap: 8 }}>
              {attachments.map(att => (
                <View key={att.id} style={{ position: 'relative', marginRight: 8 }}>
                  <TouchableOpacity onPress={() => handlePreviewImage(att)}>
                    <Image
                      source={{ uri: att.localPath || att.cloudUrl }}
                      style={{ width: 64, height: 64, borderRadius: 8 }}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                  {/* Remove button */}
                  <TouchableOpacity
                    onPress={() => handleRemoveAttachment(att.id)}
                    style={{ position: 'absolute', top: -8, right: -8, backgroundColor: theme.colors.error, borderRadius: 10, padding: 2 }}
                  >
                    <X size={14} color="white" />
                  </TouchableOpacity>
                  {/* OCR button */}
                  <TouchableOpacity
                    onPress={() => handleRunOCR(att)}
                    style={{ position: 'absolute', bottom: -8, right: -8, backgroundColor: theme.colors.primary, borderRadius: 10, padding: 2 }}
                  >
                    {ocrLoading ? <ActivityIndicator size="small" color="white" /> : <AlignLeft size={14} color="white" />}
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </Card>
          {/* Image preview modal */}
          <Modal visible={!!previewImage} transparent animationType="fade" onRequestClose={() => setPreviewImage(null)}>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' }}>
              <TouchableOpacity style={{ position: 'absolute', top: 40, right: 20, zIndex: 2 }} onPress={() => setPreviewImage(null)}>
                <X size={32} color="white" />
              </TouchableOpacity>
              {previewImage && (
                <Image source={{ uri: previewImage }} style={{ width: 320, height: 320, borderRadius: 16 }} resizeMode="contain" />
              )}
            </View>
          </Modal>

        </ScrollView>

        {/* Submit Button */}
        <View
          style={[styles.submitContainer, { backgroundColor: theme.colors.background }]}
        >
          <View style={animatedButtonStyle}>
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
          </View>
        </View>
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
  card: { marginTop: 16 },
});