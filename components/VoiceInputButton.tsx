import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Animated, ActivityIndicator } from 'react-native';
import { Mic, MicOff, X } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { VoiceProcessor, TranscriptionResult } from '@/lib/services/voice/VoiceProcessor';
import { ParsedTask } from '@/lib/services/voice/NLPProcessor';
import * as Haptics from 'expo-haptics';

interface VoiceInputButtonProps {
  onTranscriptionComplete?: (result: TranscriptionResult) => void;
  onParsedTask?: (task: ParsedTask) => void;
  onCancel?: () => void;
  size?: 'small' | 'medium' | 'large';
}

export default function VoiceInputButton({
  onTranscriptionComplete,
  onParsedTask,
  onCancel,
  size = 'medium',
}: VoiceInputButtonProps) {
  const { theme } = useTheme();
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcription, setTranscription] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [voiceProcessor, setVoiceProcessor] = useState<VoiceProcessor | null>(null);
  
  // Animation values
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const recordingDuration = useRef(0);
  const recordingTimer = useRef<NodeJS.Timeout | null>(null);

  // Button size based on prop
  const buttonSize = size === 'small' ? 48 : size === 'large' ? 72 : 56;
  const iconSize = size === 'small' ? 20 : size === 'large' ? 32 : 24;

  useEffect(() => {
    // Initialize voice processor
    const processor = new VoiceProcessor({
      onTranscriptionComplete: (result) => {
        setTranscription(result.text);
        setIsProcessing(false);
        onTranscriptionComplete?.(result);
        
        // Process the transcription with NLP
        processor.processTranscription(result.text).then(parsedTask => {
          if (parsedTask) {
            onParsedTask?.(parsedTask);
          }
        });
      },
      onError: (err) => {
        setError(err.message);
        setIsRecording(false);
        setIsProcessing(false);
      }
    });
    
    setVoiceProcessor(processor);
    
    return () => {
      // Clean up
      if (processor) {
        processor.cleanup();
      }
      if (recordingTimer.current) {
        clearInterval(recordingTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isRecording) {
      // Start pulsing animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
      
      // Start recording timer
      recordingDuration.current = 0;
      recordingTimer.current = setInterval(() => {
        recordingDuration.current += 1;
        // Auto-stop after 30 seconds to prevent very long recordings
        if (recordingDuration.current >= 30) {
          handleStopRecording();
        }
      }, 1000);
    } else {
      // Stop animation
      pulseAnim.setValue(1);
      // Clear timer
      if (recordingTimer.current) {
        clearInterval(recordingTimer.current);
        recordingTimer.current = null;
      }
    }
  }, [isRecording]);

  const handleStartRecording = async () => {
    setError(null);
    setTranscription(null);
    
    if (!voiceProcessor) {
      setError('Voice processor not initialized');
      return;
    }
    
    try {
      // Trigger haptic feedback
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const success = await voiceProcessor.startRecording();
      if (success) {
        setIsRecording(true);
      } else {
        setError('Failed to start recording');
      }
    } catch (err) {
      setError('Error starting recording');
      console.error(err);
    }
  };

  const handleStopRecording = async () => {
    if (!voiceProcessor || !isRecording) {
      return;
    }
    
    try {
      // Trigger haptic feedback
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      setIsRecording(false);
      setIsProcessing(true);
      
      const audioUri = await voiceProcessor.stopRecording();
      if (audioUri) {
        await voiceProcessor.transcribeAudio(audioUri);
      } else {
        setError('No audio recorded');
        setIsProcessing(false);
      }
    } catch (err) {
      setError('Error stopping recording');
      setIsRecording(false);
      setIsProcessing(false);
      console.error(err);
    }
  };

  const handleCancel = () => {
    if (voiceProcessor) {
      voiceProcessor.cleanup();
    }
    setIsRecording(false);
    setIsProcessing(false);
    setTranscription(null);
    setError(null);
    onCancel?.();
  };

  return (
    <View style={styles.container}>
      {error && (
        <View style={[styles.errorContainer, { backgroundColor: theme.colors.errorLight }]}>
          <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text>
        </View>
      )}
      
      {transcription && !isProcessing && !isRecording && (
        <View style={[styles.transcriptionContainer, { backgroundColor: theme.colors.surfaceVariant }]}>
          <Text style={[styles.transcriptionText, { color: theme.colors.text }]}>{transcription}</Text>
        </View>
      )}
      
      <View style={styles.buttonContainer}>
        {isRecording && (
          <TouchableOpacity
            style={[styles.cancelButton, { backgroundColor: theme.colors.errorLight }]}
            onPress={handleCancel}
          >
            <X size={iconSize - 4} color={theme.colors.error} />
          </TouchableOpacity>
        )}
        
        <Animated.View
          style={[
            styles.pulseCircle,
            {
              width: buttonSize * 1.5,
              height: buttonSize * 1.5,
              borderRadius: buttonSize * 0.75,
              backgroundColor: isRecording ? `${theme.colors.error}30` : 'transparent',
              transform: [{ scale: pulseAnim }],
            },
          ]}
        />
        
        <TouchableOpacity
          style={[
            styles.micButton,
            {
              width: buttonSize,
              height: buttonSize,
              borderRadius: buttonSize / 2,
              backgroundColor: isRecording ? theme.colors.error : theme.colors.primary,
            },
          ]}
          onPress={isRecording ? handleStopRecording : handleStartRecording}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <ActivityIndicator color="white" size={iconSize} />
          ) : isRecording ? (
            <MicOff size={iconSize} color="white" />
          ) : (
            <Mic size={iconSize} color="white" />
          )}
        </TouchableOpacity>
      </View>
      
      {isRecording && (
        <Text style={[styles.recordingText, { color: theme.colors.error }]}>
          Recording... {recordingDuration.current}s
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  pulseCircle: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  micButton: {
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  cancelButton: {
    position: 'absolute',
    right: -40,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  recordingText: {
    marginTop: 12,
    fontSize: 14,
    fontFamily: 'Inter-Medium',
  },
  errorContainer: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    width: '100%',
  },
  errorText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
  },
  transcriptionContainer: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    width: '100%',
  },
  transcriptionText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
});