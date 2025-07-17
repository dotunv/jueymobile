import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { Check, X, Edit2, ThumbsUp, ThumbsDown, RotateCcw } from 'lucide-react-native';
import { SpeechRecognitionService } from '@/lib/services/voice/SpeechRecognitionService';
import { TranscriptionResult } from '@/lib/services/voice/VoiceProcessor';
import * as Haptics from 'expo-haptics';
import { useFeedbackLearning } from '@/hooks/useFeedbackLearning';

interface TranscriptionItem {
  id: string;
  text: string;
  confidence: number;
  timestamp: Date;
  corrected?: string;
  rating?: number;
}

export default function FeedbackLearningDemo() {
  const { theme } = useTheme();
  const [transcriptions, setTranscriptions] = useState<TranscriptionItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { 
    recordFeedback, 
    getAccuracyTrend, 
    getImprovementRate,
    resetLearningData
  } = useFeedbackLearning();
  
  // Load sample transcriptions on mount
  useEffect(() => {
    loadSampleTranscriptions();
  }, []);
  
  // Load sample transcriptions
  const loadSampleTranscriptions = () => {
    const samples: TranscriptionItem[] = [
      {
        id: '1',
        text: 'Remind me to buy groceries tomorrow at 5pm',
        confidence: 0.92,
        timestamp: new Date(Date.now() - 3600000 * 24 * 3), // 3 days ago
      },
      {
        id: '2',
        text: 'Schedule a meeting with John on Friday',
        confidence: 0.88,
        timestamp: new Date(Date.now() - 3600000 * 24 * 2), // 2 days ago
      },
      {
        id: '3',
        text: 'Call mom this weekend',
        confidence: 0.95,
        timestamp: new Date(Date.now() - 3600000 * 24), // 1 day ago
      },
      {
        id: '4',
        text: 'Finish the presentation by Thursday',
        confidence: 0.85,
        timestamp: new Date(Date.now() - 3600000 * 12), // 12 hours ago
      },
      {
        id: '5',
        text: 'Pick up dry cleaning after work',
        confidence: 0.91,
        timestamp: new Date(Date.now() - 3600000 * 2), // 2 hours ago
      },
    ];
    
    setTranscriptions(samples);
  };
  
  // Start editing a transcription
  const startEditing = (id: string, text: string) => {
    setEditingId(id);
    setEditText(text);
  };
  
  // Save edited transcription
  const saveEdit = async (id: string) => {
    try {
      setIsLoading(true);
      
      // Find the transcription
      const index = transcriptions.findIndex(item => item.id === id);
      if (index === -1) return;
      
      const transcription = transcriptions[index];
      
      // Update transcription
      const updated = [...transcriptions];
      updated[index] = {
        ...transcription,
        corrected: editText,
      };
      
      // Record feedback
      await recordFeedback(transcription.text, editText, null);
      
      // Update state
      setTranscriptions(updated);
      setEditingId(null);
      setEditText('');
      
      // Trigger haptic feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      setIsLoading(false);
    } catch (err) {
      console.error('Failed to save edit:', err);
      setError('Failed to save edit');
      setIsLoading(false);
    }
  };
  
  // Cancel editing
  const cancelEdit = () => {
    setEditingId(null);
    setEditText('');
  };
  
  // Rate transcription
  const rateTranscription = async (id: string, rating: number) => {
    try {
      setIsLoading(true);
      
      // Find the transcription
      const index = transcriptions.findIndex(item => item.id === id);
      if (index === -1) return;
      
      const transcription = transcriptions[index];
      
      // Update transcription
      const updated = [...transcriptions];
      updated[index] = {
        ...transcription,
        rating,
      };
      
      // Record feedback
      await recordFeedback(transcription.text, null, rating);
      
      // Update state
      setTranscriptions(updated);
      
      // Trigger haptic feedback
      Haptics.notificationAsync(
        rating >= 4 
          ? Haptics.NotificationFeedbackType.Success 
          : Haptics.NotificationFeedbackType.Warning
      );
      
      setIsLoading(false);
    } catch (err) {
      console.error('Failed to rate transcription:', err);
      setError('Failed to rate transcription');
      setIsLoading(false);
    }
  };
  
  // Reset learning data
  const handleResetLearning = async () => {
    try {
      setIsLoading(true);
      
      await resetLearningData();
      
      // Reset transcriptions
      loadSampleTranscriptions();
      
      // Trigger haptic feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      setIsLoading(false);
    } catch (err) {
      console.error('Failed to reset learning data:', err);
      setError('Failed to reset learning data');
      setIsLoading(false);
    }
  };
  
  // Get accuracy trend
  const accuracyTrend = getAccuracyTrend();
  
  // Get improvement rate
  const improvementRate = getImprovementRate();
  
  // Format date
  const formatDate = (date: Date) => {
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };
  
  // Get confidence color
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return theme.colors.success;
    if (confidence >= 0.7) return theme.colors.warning;
    return theme.colors.error;
  };
  
  // Render transcription item
  const renderTranscriptionItem = (item: TranscriptionItem) => {
    const isEditing = editingId === item.id;
    
    return (
      <View 
        key={item.id}
        style={[
          styles.transcriptionItem, 
          { backgroundColor: theme.colors.surfaceVariant }
        ]}
      >
        <View style={styles.transcriptionHeader}>
          <Text style={[styles.timestamp, { color: theme.colors.textSecondary }]}>
            {formatDate(item.timestamp)}
          </Text>
          <View style={styles.confidenceContainer}>
            <Text style={[styles.confidenceLabel, { color: theme.colors.textSecondary }]}>
              Confidence:
            </Text>
            <Text style={[styles.confidenceValue, { color: getConfidenceColor(item.confidence) }]}>
              {Math.round(item.confidence * 100)}%
            </Text>
          </View>
        </View>
        
        {isEditing ? (
          <View style={styles.editContainer}>
            <TextInput
              style={[styles.editInput, { 
                color: theme.colors.text,
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.background
              }]}
              value={editText}
              onChangeText={setEditText}
              multiline
              autoFocus
            />
            
            <View style={styles.editActions}>
              <TouchableOpacity
                style={[styles.editButton, { backgroundColor: theme.colors.success + '20' }]}
                onPress={() => saveEdit(item.id)}
                disabled={isLoading}
              >
                <Check size={20} color={theme.colors.success} />
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.editButton, { backgroundColor: theme.colors.error + '20' }]}
                onPress={cancelEdit}
                disabled={isLoading}
              >
                <X size={20} color={theme.colors.error} />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            <Text style={[styles.transcriptionText, { color: theme.colors.text }]}>
              {item.text}
            </Text>
            
            {item.corrected && (
              <View style={[styles.correctionContainer, { borderTopColor: theme.colors.border }]}>
                <Text style={[styles.correctionLabel, { color: theme.colors.textSecondary }]}>
                  Corrected to:
                </Text>
                <Text style={[styles.correctionText, { color: theme.colors.text }]}>
                  {item.corrected}
                </Text>
              </View>
            )}
            
            <View style={styles.actionContainer}>
              {!item.corrected && !item.rating && (
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: theme.colors.primary + '20' }]}
                  onPress={() => startEditing(item.id, item.text)}
                  disabled={isLoading}
                >
                  <Edit2 size={16} color={theme.colors.primary} />
                  <Text style={[styles.actionText, { color: theme.colors.primary }]}>
                    Correct
                  </Text>
                </TouchableOpacity>
              )}
              
              {!item.rating && (
                <View style={styles.ratingContainer}>
                  <TouchableOpacity
                    style={[styles.ratingButton, { backgroundColor: theme.colors.success + '20' }]}
                    onPress={() => rateTranscription(item.id, 5)}
                    disabled={isLoading}
                  >
                    <ThumbsUp size={16} color={theme.colors.success} />
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.ratingButton, { backgroundColor: theme.colors.error + '20' }]}
                    onPress={() => rateTranscription(item.id, 1)}
                    disabled={isLoading}
                  >
                    <ThumbsDown size={16} color={theme.colors.error} />
                  </TouchableOpacity>
                </View>
              )}
              
              {item.rating && (
                <View style={styles.ratingDisplay}>
                  <Text style={[styles.ratingText, { 
                    color: item.rating >= 4 ? theme.colors.success : theme.colors.error 
                  }]}>
                    {item.rating >= 4 ? 'Good' : 'Needs Improvement'}
                  </Text>
                </View>
              )}
            </View>
          </>
        )}
      </View>
    );
  };
  
  return (
    <ScrollView style={styles.container}>
      <Text style={[styles.title, { color: theme.colors.text }]}>
        Feedback Learning System
      </Text>
      
      {error && (
        <View style={[styles.errorContainer, { backgroundColor: theme.colors.errorLight }]}>
          <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text>
        </View>
      )}
      
      <View style={[styles.statsContainer, { backgroundColor: theme.colors.surfaceVariant }]}>
        <View style={styles.statItem}>
          <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
            Accuracy Trend
          </Text>
          <Text style={[styles.statValue, { 
            color: accuracyTrend === 'improving' 
              ? theme.colors.success 
              : accuracyTrend === 'declining' 
                ? theme.colors.error 
                : theme.colors.textSecondary
          }]}>
            {accuracyTrend === 'improving' 
              ? '↑ Improving' 
              : accuracyTrend === 'declining' 
                ? '↓ Declining' 
                : '→ Stable'}
          </Text>
        </View>
        
        <View style={styles.statItem}>
          <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
            Improvement Rate
          </Text>
          <Text style={[styles.statValue, { 
            color: improvementRate > 0 
              ? theme.colors.success 
              : improvementRate < 0 
                ? theme.colors.error 
                : theme.colors.textSecondary
          }]}>
            {improvementRate > 0 
              ? `+${Math.round(improvementRate * 100)}%` 
              : improvementRate < 0 
                ? `${Math.round(improvementRate * 100)}%` 
                : '0%'}
          </Text>
        </View>
      </View>
      
      <View style={styles.transcriptionsHeader}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Recent Transcriptions
        </Text>
        
        <TouchableOpacity
          style={[styles.resetButton, { backgroundColor: theme.colors.surfaceVariant }]}
          onPress={handleResetLearning}
          disabled={isLoading}
        >
          <RotateCcw size={16} color={theme.colors.primary} />
          <Text style={[styles.resetButtonText, { color: theme.colors.primary }]}>
            Reset Learning
          </Text>
        </TouchableOpacity>
      </View>
      
      {transcriptions.map(renderTranscriptionItem)}
      
      <View style={styles.infoContainer}>
        <Text style={[styles.infoTitle, { color: theme.colors.text }]}>
          How Feedback Learning Works
        </Text>
        <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
          The system learns from your corrections and ratings to improve transcription accuracy over time.
          Correcting transcriptions helps the system understand your speech patterns, while ratings provide
          feedback on overall quality.
        </Text>
      </View>
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
  statsContainer: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
  },
  statLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
  },
  transcriptionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  resetButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    marginLeft: 4,
  },
  transcriptionItem: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  transcriptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  timestamp: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
  },
  confidenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  confidenceLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    marginRight: 4,
  },
  confidenceValue: {
    fontSize: 12,
    fontFamily: 'Inter-Bold',
  },
  transcriptionText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    lineHeight: 22,
  },
  correctionContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  correctionLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    marginBottom: 4,
  },
  correctionText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    lineHeight: 22,
  },
  actionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  actionText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    marginLeft: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
  },
  ratingButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  ratingDisplay: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  ratingText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
  },
  editContainer: {
    marginTop: 8,
  },
  editInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    minHeight: 80,
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  editButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  infoContainer: {
    marginTop: 16,
    marginBottom: 32,
  },
  infoTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    lineHeight: 20,
  },
});