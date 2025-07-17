import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import VoiceInputButton from './VoiceInputButton';
import { TranscriptionResult } from '@/lib/services/voice/VoiceProcessor';
import { ParsedTask } from '@/lib/services/voice/NLPProcessor';
import Button from './ui/Button';
import { TaskCreateInput } from '@/lib/types';

export default function VoiceInputDemo() {
  const { theme } = useTheme();
  const [transcription, setTranscription] = useState<TranscriptionResult | null>(null);
  const [parsedTask, setParsedTask] = useState<ParsedTask | null>(null);
  const [taskInput, setTaskInput] = useState<TaskCreateInput | null>(null);
  const [status, setStatus] = useState<'idle' | 'recording' | 'processing' | 'complete'>('idle');

  const handleTranscriptionComplete = (result: TranscriptionResult) => {
    setTranscription(result);
    setStatus('processing');
  };

  const handleParsedTask = (task: ParsedTask) => {
    setParsedTask(task);
    
    // Convert to TaskCreateInput
    const taskInput: TaskCreateInput = {
      title: task.title,
      description: task.description,
      completed: task.isCompleted,
      completed_at: task.completedAt?.toISOString(),
      logged_after_completion: task.isCompleted,
      priority: task.priority || 'medium',
      category: task.category || 'general',
      tags: task.tags,
      reminder_enabled: !!task.reminderTime,
      reminder_time: task.reminderTime?.toISOString(),
      due_date: task.dueDate?.toISOString(),
    };
    
    setTaskInput(taskInput);
    setStatus('complete');
  };

  const handleReset = () => {
    setTranscription(null);
    setParsedTask(null);
    setTaskInput(null);
    setStatus('idle');
  };

  const handleSaveTask = () => {
    // In a real implementation, this would save the task to the database
    console.log('Saving task:', taskInput);
    alert('Task saved successfully!');
    handleReset();
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Voice Input Demo</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
          Tap the microphone button and speak to create a task
        </Text>
      </View>

      <View style={styles.voiceInputContainer}>
        <VoiceInputButton
          onTranscriptionComplete={handleTranscriptionComplete}
          onParsedTask={handleParsedTask}
          size="large"
        />
      </View>

      {transcription && (
        <View style={[styles.resultCard, { backgroundColor: theme.colors.surfaceVariant }]}>
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Transcription</Text>
          <Text style={[styles.transcriptionText, { color: theme.colors.text }]}>
            {transcription.text}
          </Text>
          <View style={styles.metadataContainer}>
            <Text style={[styles.metadataText, { color: theme.colors.textSecondary }]}>
              Confidence: {Math.round(transcription.confidence * 100)}%
            </Text>
            <Text style={[styles.metadataText, { color: theme.colors.textSecondary }]}>
              Duration: {transcription.duration.toFixed(1)}s
            </Text>
          </View>
        </View>
      )}

      {parsedTask && (
        <View style={[styles.resultCard, { backgroundColor: theme.colors.surfaceVariant }]}>
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Parsed Task</Text>
          
          <View style={styles.taskField}>
            <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary }]}>Title:</Text>
            <Text style={[styles.fieldValue, { color: theme.colors.text }]}>{parsedTask.title}</Text>
          </View>
          
          {parsedTask.description && (
            <View style={styles.taskField}>
              <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary }]}>Description:</Text>
              <Text style={[styles.fieldValue, { color: theme.colors.text }]}>{parsedTask.description}</Text>
            </View>
          )}
          
          <View style={styles.taskField}>
            <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary }]}>Status:</Text>
            <Text style={[styles.fieldValue, { color: theme.colors.text }]}>
              {parsedTask.isCompleted ? 'Completed' : 'Pending'}
            </Text>
          </View>
          
          {parsedTask.dueDate && (
            <View style={styles.taskField}>
              <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary }]}>Due Date:</Text>
              <Text style={[styles.fieldValue, { color: theme.colors.text }]}>
                {parsedTask.dueDate.toLocaleString()}
              </Text>
            </View>
          )}
          
          {parsedTask.priority && (
            <View style={styles.taskField}>
              <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary }]}>Priority:</Text>
              <Text style={[styles.fieldValue, { color: theme.colors.text }]}>
                {parsedTask.priority.charAt(0).toUpperCase() + parsedTask.priority.slice(1)}
              </Text>
            </View>
          )}
          
          {parsedTask.category && (
            <View style={styles.taskField}>
              <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary }]}>Category:</Text>
              <Text style={[styles.fieldValue, { color: theme.colors.text }]}>
                {parsedTask.category.charAt(0).toUpperCase() + parsedTask.category.slice(1)}
              </Text>
            </View>
          )}
          
          {parsedTask.tags.length > 0 && (
            <View style={styles.taskField}>
              <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary }]}>Tags:</Text>
              <Text style={[styles.fieldValue, { color: theme.colors.text }]}>
                {parsedTask.tags.join(', ')}
              </Text>
            </View>
          )}
          
          {parsedTask.reminderTime && (
            <View style={styles.taskField}>
              <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary }]}>Reminder:</Text>
              <Text style={[styles.fieldValue, { color: theme.colors.text }]}>
                {parsedTask.reminderTime.toLocaleString()}
              </Text>
            </View>
          )}
        </View>
      )}

      {status === 'complete' && (
        <View style={styles.actionButtons}>
          <Button onPress={handleSaveTask} style={styles.actionButton}>
            Save Task
          </Button>
          <Button 
            onPress={handleReset} 
            variant="secondary" 
            style={styles.actionButton}
          >
            Reset
          </Button>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  voiceInputContainer: {
    alignItems: 'center',
    marginVertical: 32,
  },
  resultCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 12,
  },
  transcriptionText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    lineHeight: 24,
  },
  metadataContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  metadataText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  taskField: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    marginBottom: 4,
  },
  fieldValue: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 32,
  },
  actionButton: {
    flex: 1,
    marginHorizontal: 8,
  },
});