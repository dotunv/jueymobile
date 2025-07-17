import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Animated } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import VoiceInputControls from './VoiceInputControls';
import useVoiceInput from '@/hooks/useVoiceInput';
import { TranscriptionResult } from '@/lib/services/voice/VoiceProcessor';
import { ParsedTask } from '@/lib/services/voice/NLPProcessor';
import Button from './ui/Button';

/**
 * Component to demonstrate real-time transcription capabilities
 */
export default function RealtimeTranscriptionDemo() {
  const { theme } = useTheme();
  const [interimText, setInterimText] = useState<string>('');
  const [interimConfidence, setInterimConfidence] = useState<number>(0);
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const durationTimer = useRef<NodeJS.Timeout | null>(null);
  const confidenceAnim = useRef(new Animated.Value(0)).current;
  
  // Use the voice input hook with real-time transcription enabled
  const {
    isRecording,
    isProcessing,
    transcription,
    parsedTask,
    error,
    startRecording,
    stopRecording,
    cancelRecording,
    resetState,
  } = useVoiceInput({
    onTranscriptionComplete: (result) => {
      console.log('Transcription complete:', result);
    },
    onParsedTask: (task) => {
      console.log('Parsed task:', task);
    },
    onError: (err) => {
      console.error('Voice input error:', err);
    },
    useRealtimeTranscription: true,
    onInterimTranscription: (text, confidence) => {
      setInterimText(text);
      setInterimConfidence(confidence);
      
      // Animate confidence indicator
      Animated.timing(confidenceAnim, {
        toValue: confidence,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  });
  
  // Handle recording duration timer
  useEffect(() => {
    if (isRecording) {
      setRecordingDuration(0);
      durationTimer.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (durationTimer.current) {
        clearInterval(durationTimer.current);
        durationTimer.current = null;
      }
    }
    
    return () => {
      if (durationTimer.current) {
        clearInterval(durationTimer.current);
      }
    };
  }, [isRecording]);
  
  // Reset interim text when not recording
  useEffect(() => {
    if (!isRecording && !isProcessing) {
      // Keep the text briefly so user can see the final result
      const timeout = setTimeout(() => {
        if (!isRecording && !isProcessing) {
          setInterimText('');
        }
      }, 3000);
      
      return () => clearTimeout(timeout);
    }
  }, [isRecording, isProcessing]);
  
  // Get confidence color based on confidence level
  const getConfidenceColor = (confidence: number) => {
    if (confidence > 0.8) return theme.colors.success;
    if (confidence > 0.5) return theme.colors.warning;
    return theme.colors.error;
  };
  
  // Format confidence as percentage
  const formatConfidence = (confidence: number) => {
    return `${Math.round(confidence * 100)}%`;
  };
  
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          Real-time Transcription
        </Text>
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
          See your speech transcribed in real-time as you speak
        </Text>
      </View>
      
      {/* Real-time transcription display */}
      <View 
        style={[
          styles.transcriptionBox, 
          { 
            backgroundColor: theme.colors.surfaceVariant,
            borderColor: isRecording ? theme.colors.primary : theme.colors.border
          }
        ]}
      >
        {interimText ? (
          <Text style={[styles.transcriptionText, { color: theme.colors.text }]}>
            {interimText}
          </Text>
        ) : (
          <Text style={[styles.placeholderText, { color: theme.colors.textSecondary }]}>
            {isRecording ? 'Listening...' : 'Tap the microphone to start speaking'}
          </Text>
        )}
        
        {/* Confidence indicator */}
        {isRecording && interimText && (
          <View style={styles.confidenceContainer}>
            <Text style={[styles.confidenceLabel, { color: theme.colors.textSecondary }]}>
              Confidence:
            </Text>
            <View style={styles.confidenceBarContainer}>
              <Animated.View 
                style={[
                  styles.confidenceBar,
                  {
                    width: confidenceAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%']
                    }),
                    backgroundColor: getConfidenceColor(interimConfidence)
                  }
                ]}
              />
            </View>
            <Text 
              style={[
                styles.confidenceValue, 
                { color: getConfidenceColor(interimConfidence) }
              ]}
            >
              {formatConfidence(interimConfidence)}
            </Text>
          </View>
        )}
      </View>
      
      {/* Voice input controls */}
      <View style={styles.controlsContainer}>
        <VoiceInputControls
          isRecording={isRecording}
          isProcessing={isProcessing}
          duration={recordingDuration}
          onStartRecording={startRecording}
          onStopRecording={stopRecording}
          onCancel={cancelRecording}
          size="large"
          showFeedback={true}
        />
      </View>
      
      {/* Error display */}
      {error && (
        <View style={[styles.errorContainer, { backgroundColor: theme.colors.errorLight }]}>
          <Text style={[styles.errorText, { color: theme.colors.error }]}>
            {error.message}
          </Text>
        </View>
      )}
      
      {/* Parsed task display (if available) */}
      {parsedTask && (
        <View style={[styles.parsedTaskContainer, { backgroundColor: theme.colors.surfaceVariant }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Parsed Task
          </Text>
          
          <View style={styles.taskField}>
            <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary }]}>Title:</Text>
            <Text style={[styles.fieldValue, { color: theme.colors.text }]}>{parsedTask.title}</Text>
          </View>
          
          {parsedTask.dueDate && (
            <View style={styles.taskField}>
              <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary }]}>Due:</Text>
              <Text style={[styles.fieldValue, { color: theme.colors.text }]}>
                {parsedTask.dueDate.toLocaleString()}
              </Text>
            </View>
          )}
          
          {parsedTask.priority && (
            <View style={styles.taskField}>
              <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary }]}>Priority:</Text>
              <Text style={[styles.fieldValue, { color: theme.colors.text }]}>
                {parsedTask.priority}
              </Text>
            </View>
          )}
          
          <View style={styles.taskField}>
            <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary }]}>Status:</Text>
            <Text style={[styles.fieldValue, { color: theme.colors.text }]}>
              {parsedTask.isCompleted ? 'Completed' : 'Not completed'}
            </Text>
          </View>
        </View>
      )}
      
      {/* Reset button */}
      {(transcription || parsedTask) && (
        <Button 
          onPress={resetState}
          variant="secondary"
          style={styles.resetButton}
        >
          Reset
        </Button>
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
  transcriptionBox: {
    borderRadius: 12,
    padding: 16,
    minHeight: 120,
    borderWidth: 1,
    marginBottom: 24,
  },
  transcriptionText: {
    fontSize: 18,
    fontFamily: 'Inter-Regular',
    lineHeight: 28,
  },
  placeholderText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    fontStyle: 'italic',
  },
  confidenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  confidenceLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    marginRight: 8,
  },
  confidenceBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  confidenceBar: {
    height: '100%',
  },
  confidenceValue: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    marginLeft: 8,
    width: 45,
    textAlign: 'right',
  },
  controlsContainer: {
    alignItems: 'center',
    marginVertical: 24,
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
  parsedTaskContainer: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 12,
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
  resetButton: {
    marginBottom: 32,
  },
});