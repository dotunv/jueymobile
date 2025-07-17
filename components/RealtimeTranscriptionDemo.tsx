import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { Mic, MicOff, RefreshCw, ThumbsUp, ThumbsDown } from 'lucide-react-native';
import { SpeechRecognitionService } from '@/lib/services/voice/SpeechRecognitionService';
import { TranscriptionUpdate } from '@/lib/services/voice/RealTimeTranscriptionManager';
import { TranscriptionResult } from '@/lib/services/voice/VoiceProcessor';
import * as Haptics from 'expo-haptics';

export default function RealtimeTranscriptionDemo() {
  const { theme } = useTheme();
  const [isListening, setIsListening] = useState(false);
  const [transcription, setTranscription] = useState<string>('');
  const [confidence, setConfidence] = useState<number>(0);
  const [alternatives, setAlternatives] = useState<string[]>([]);
  const [finalResult, setFinalResult] = useState<TranscriptionResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedbackGiven, setFeedbackGiven] = useState(false);
  const [improvementSuggestions, setImprovementSuggestions] = useState<string[]>([]);
  
  const speechService = useRef<SpeechRecognitionService | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  
  // Initialize speech recognition service
  useEffect(() => {
    speechService.current = new SpeechRecognitionService({
      language: 'en-US',
      useLocalProcessing: false
    });
    
    // Get improvement suggestions
    loadImprovementSuggestions();
    
    return () => {
      // Clean up
      if (speechService.current) {
        speechService.current.cleanup();
      }
    };
  }, []);
  
  // Load improvement suggestions
  const loadImprovementSuggestions = async () => {
    if (speechService.current) {
      const suggestions = await speechService.current.getImprovementSuggestions();
      setImprovementSuggestions(suggestions);
    }
  };
  
  // Handle interim transcription updates
  const handleInterimResult = (result: TranscriptionUpdate) => {
    setTranscription(result.partialText);
    if (result.confidence) {
      setConfidence(result.confidence);
    }
    
    // Scroll to bottom of transcription
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollToEnd({ animated: true });
    }
  };
  
  // Start listening
  const startListening = async () => {
    try {
      setError(null);
      setTranscription('');
      setConfidence(0);
      setAlternatives([]);
      setFinalResult(null);
      setFeedbackGiven(false);
      setIsProcessing(true);
      
      // Trigger haptic feedback
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      if (speechService.current) {
        const success = await speechService.current.startRealtimeTranscription(handleInterimResult);
        if (success) {
          setIsListening(true);
        } else {
          setError('Failed to start speech recognition');
        }
      } else {
        setError('Speech recognition service not initialized');
      }
      
      setIsProcessing(false);
    } catch (err) {
      setError('Error starting speech recognition');
      setIsProcessing(false);
      console.error(err);
    }
  };
  
  // Stop listening
  const stopListening = async () => {
    try {
      setIsProcessing(true);
      
      // Trigger haptic feedback
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      if (speechService.current) {
        const result = await speechService.current.stopRealtimeTranscription();
        if (result) {
          setFinalResult(result);
          setTranscription(result.text);
          setConfidence(result.confidence);
          setAlternatives(result.alternatives);
        }
      }
      
      setIsListening(false);
      setIsProcessing(false);
    } catch (err) {
      setError('Error stopping speech recognition');
      setIsListening(false);
      setIsProcessing(false);
      console.error(err);
    }
  };
  
  // Reset demo
  const resetDemo = () => {
    setTranscription('');
    setConfidence(0);
    setAlternatives([]);
    setFinalResult(null);
    setError(null);
    setFeedbackGiven(false);
  };
  
  // Submit feedback
  const submitFeedback = async (isPositive: boolean) => {
    if (speechService.current && finalResult) {
      await speechService.current.recordUserFeedback(
        finalResult.text,
        null, // No corrected text
        isPositive ? 5 : 1 // 5-star or 1-star rating
      );
      setFeedbackGiven(true);
      
      // Refresh improvement suggestions
      loadImprovementSuggestions();
      
      // Trigger haptic feedback
      Haptics.notificationAsync(
        isPositive 
          ? Haptics.NotificationFeedbackType.Success 
          : Haptics.NotificationFeedbackType.Error
      );
    }
  };
  
  // Use alternative as main transcription
  const useAlternative = (text: string) => {
    setTranscription(text);
    if (finalResult) {
      setFinalResult({
        ...finalResult,
        text
      });
    }
  };
  
  // Calculate confidence color
  const getConfidenceColor = (score: number) => {
    if (score >= 0.9) return theme.colors.success;
    if (score >= 0.7) return theme.colors.warning;
    return theme.colors.error;
  };
  
  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: theme.colors.text }]}>
        Real-time Transcription
      </Text>
      
      {error && (
        <View style={[styles.errorContainer, { backgroundColor: theme.colors.errorLight }]}>
          <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text>
        </View>
      )}
      
      <View style={[styles.transcriptionContainer, { 
        backgroundColor: theme.colors.surfaceVariant,
        borderColor: isListening ? theme.colors.primary : theme.colors.border
      }]}>
        <ScrollView 
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollViewContent}
        >
          {transcription ? (
            <Text style={[styles.transcriptionText, { color: theme.colors.text }]}>
              {transcription}
            </Text>
          ) : (
            <Text style={[styles.placeholderText, { color: theme.colors.textSecondary }]}>
              {isListening ? 'Listening...' : 'Press the microphone button to start'}
            </Text>
          )}
        </ScrollView>
        
        {(confidence > 0 || isListening) && (
          <View style={styles.confidenceContainer}>
            <Text style={[styles.confidenceLabel, { color: theme.colors.textSecondary }]}>
              Confidence:
            </Text>
            <View style={[styles.confidenceMeter, { backgroundColor: theme.colors.surfaceVariant }]}>
              <View 
                style={[
                  styles.confidenceFill, 
                  { 
                    width: `${confidence * 100}%`,
                    backgroundColor: getConfidenceColor(confidence)
                  }
                ]} 
              />
            </View>
            <Text style={[styles.confidenceValue, { color: getConfidenceColor(confidence) }]}>
              {Math.round(confidence * 100)}%
            </Text>
          </View>
        )}
      </View>
      
      {finalResult && alternatives.length > 1 && (
        <View style={[styles.alternativesContainer, { backgroundColor: theme.colors.surfaceVariant }]}>
          <Text style={[styles.alternativesTitle, { color: theme.colors.text }]}>
            Alternative Transcriptions:
          </Text>
          {alternatives.slice(1).map((alt, index) => (
            <TouchableOpacity 
              key={index}
              style={[styles.alternativeItem, { borderBottomColor: theme.colors.border }]}
              onPress={() => useAlternative(alt)}
            >
              <Text style={[styles.alternativeText, { color: theme.colors.text }]}>
                {alt}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      
      {finalResult && !feedbackGiven && (
        <View style={styles.feedbackContainer}>
          <Text style={[styles.feedbackTitle, { color: theme.colors.text }]}>
            Was this transcription accurate?
          </Text>
          <View style={styles.feedbackButtons}>
            <TouchableOpacity 
              style={[styles.feedbackButton, { backgroundColor: theme.colors.success + '20' }]}
              onPress={() => submitFeedback(true)}
            >
              <ThumbsUp size={24} color={theme.colors.success} />
              <Text style={[styles.feedbackButtonText, { color: theme.colors.success }]}>
                Yes
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.feedbackButton, { backgroundColor: theme.colors.error + '20' }]}
              onPress={() => submitFeedback(false)}
            >
              <ThumbsDown size={24} color={theme.colors.error} />
              <Text style={[styles.feedbackButtonText, { color: theme.colors.error }]}>
                No
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      
      {improvementSuggestions.length > 0 && (
        <View style={[styles.suggestionsContainer, { backgroundColor: theme.colors.surfaceVariant }]}>
          <Text style={[styles.suggestionsTitle, { color: theme.colors.text }]}>
            Tips for Better Transcription:
          </Text>
          {improvementSuggestions.slice(0, 3).map((suggestion, index) => (
            <Text 
              key={index}
              style={[styles.suggestionText, { color: theme.colors.textSecondary }]}
            >
              • {suggestion}
            </Text>
          ))}
        </View>
      )}
      
      <View style={styles.controlsContainer}>
        {!isListening && finalResult && (
          <TouchableOpacity
            style={[styles.resetButton, { backgroundColor: theme.colors.surfaceVariant }]}
            onPress={resetDemo}
          >
            <RefreshCw size={20} color={theme.colors.primary} />
            <Text style={[styles.resetButtonText, { color: theme.colors.primary }]}>
              Reset
            </Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity
          style={[
            styles.micButton,
            { backgroundColor: isListening ? theme.colors.error : theme.colors.primary }
          ]}
          onPress={isListening ? stopListening : startListening}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <ActivityIndicator color="white" size={32} />
          ) : isListening ? (
            <MicOff size={32} color="white" />
          ) : (
            <Mic size={32} color="white" />
          )}
        </TouchableOpacity>
      </View>
    </View>
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
  transcriptionContainer: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    minHeight: 150,
    marginBottom: 16,
  },
  scrollView: {
    maxHeight: 200,
  },
  scrollViewContent: {
    flexGrow: 1,
  },
  transcriptionText: {
    fontSize: 18,
    fontFamily: 'Inter-Regular',
    lineHeight: 26,
  },
  placeholderText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    fontStyle: 'italic',
  },
  confidenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  confidenceLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    marginRight: 8,
  },
  confidenceMeter: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    borderRadius: 4,
  },
  confidenceValue: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    marginLeft: 8,
    width: 40,
    textAlign: 'right',
  },
  alternativesContainer: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  alternativesTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 8,
  },
  alternativeItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  alternativeText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  feedbackContainer: {
    marginBottom: 16,
    alignItems: 'center',
  },
  feedbackTitle: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    marginBottom: 12,
  },
  feedbackButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  feedbackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginHorizontal: 8,
  },
  feedbackButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    marginLeft: 8,
  },
  suggestionsContainer: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  suggestionsTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 8,
  },
  suggestionText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    marginBottom: 4,
    lineHeight: 20,
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  micButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  resetButton: {
    position: 'absolute',
    left: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  resetButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    marginLeft: 4,
  },
});