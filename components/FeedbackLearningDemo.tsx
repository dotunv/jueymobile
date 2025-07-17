import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Suggestion } from '../lib/types';
import { useFeedbackLearning } from '../hooks/useFeedbackLearning';
import FeedbackInterface from './FeedbackInterface';

interface FeedbackLearningDemoProps {
  userId: string;
}

/**
 * A component that demonstrates the feedback learning system in action
 * Shows how suggestions improve over time based on user feedback
 */
export const FeedbackLearningDemo: React.FC<FeedbackLearningDemoProps> = ({ userId }) => {
  const [demoSuggestions, setDemoSuggestions] = useState<Suggestion[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null);
  const [feedbackModalVisible, setFeedbackModalVisible] = useState(false);
  const [demoStep, setDemoStep] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);

  const { 
    submitFeedback, 
    applyLearningToSuggestions, 
    analytics, 
    insights, 
    isLoading 
  } = useFeedbackLearning({ userId });

  // Generate demo suggestions
  useEffect(() => {
    generateDemoSuggestions();
  }, []);

  const generateDemoSuggestions = async () => {
    setIsGenerating(true);
    
    // Create some sample suggestions for the demo
    const initialSuggestions: Suggestion[] = [
      createDemoSuggestion('Complete project report', 'Work', 0.65, ['time pattern', 'category frequency']),
      createDemoSuggestion('Schedule team meeting', 'Work', 0.72, ['sequential pattern', 'recurring task']),
      createDemoSuggestion('Go for a run', 'Health', 0.58, ['time of day', 'weather context']),
      createDemoSuggestion('Buy groceries', 'Shopping', 0.81, ['location pattern', 'inventory prediction']),
      createDemoSuggestion('Call mom', 'Personal', 0.67, ['day of week', 'communication pattern']),
    ];
    
    setDemoSuggestions(initialSuggestions);
    setIsGenerating(false);
  };

  // Create a demo suggestion
  const createDemoSuggestion = (
    title: string, 
    category: string, 
    confidence: number, 
    basedOn: string[]
  ): Suggestion => {
    return {
      id: `demo-${Math.random().toString(36).substring(2, 11)}`,
      user_id: userId,
      title,
      category,
      confidence,
      based_on: JSON.stringify(basedOn),
      status: 'pending',
      priority: 'medium',
      created_at: new Date().toISOString()
    };
  };

  // Handle feedback submission
  const handleFeedbackSubmitted = async (suggestionId: string, feedbackType: 'positive' | 'negative') => {
    try {
      // Submit the feedback
      await submitFeedback(suggestionId, feedbackType);
      
      // Update the suggestion status in our local state
      setDemoSuggestions(prev => 
        prev.map(s => 
          s.id === suggestionId 
            ? { ...s, status: feedbackType === 'positive' ? 'accepted' : 'rejected' } 
            : s
        )
      );
      
      // Move to the next step in the demo
      setDemoStep(prev => prev + 1);
      
      // If we've provided feedback on at least 3 suggestions, show how the system learns
      if (demoStep >= 3) {
        // Apply learning to generate improved suggestions
        const improvedSuggestions = await applyLearningToSuggestions(demoSuggestions);
        setDemoSuggestions(improvedSuggestions);
      }
    } catch (error) {
      console.error('Error in feedback demo:', error);
    }
  };

  // Open feedback modal for a suggestion
  const openFeedbackModal = (suggestion: Suggestion) => {
    setSelectedSuggestion(suggestion);
    setFeedbackModalVisible(true);
  };

  // Reset the demo
  const resetDemo = () => {
    setDemoStep(1);
    generateDemoSuggestions();
  };

  if (isLoading || isGenerating) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Setting up learning demo...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Feedback Learning Demo</Text>
        <Text style={styles.subtitle}>
          See how the system learns from your feedback to improve suggestions
        </Text>
      </View>

      <View style={styles.stepIndicator}>
        <Text style={styles.stepText}>Step {demoStep} of 5</Text>
        <View style={styles.stepDots}>
          {[1, 2, 3, 4, 5].map(step => (
            <View 
              key={step} 
              style={[
                styles.stepDot, 
                step === demoStep && styles.activeStepDot,
                step < demoStep && styles.completedStepDot
              ]} 
            />
          ))}
        </View>
      </View>

      <View style={styles.instructionCard}>
        <Text style={styles.instructionTitle}>
          {demoStep === 1 && "Rate some suggestions"}
          {demoStep === 2 && "Keep providing feedback"}
          {demoStep === 3 && "One more suggestion"}
          {demoStep === 4 && "Learning in progress"}
          {demoStep === 5 && "Learning complete!"}
        </Text>
        <Text style={styles.instructionText}>
          {demoStep === 1 && "Tap on a suggestion below and rate whether it would be helpful for you. The system will learn from your preferences."}
          {demoStep === 2 && "Great! Now rate another suggestion to help the system understand your preferences better."}
          {demoStep === 3 && "One more rating will help the system learn enough to start adapting to your preferences."}
          {demoStep === 4 && "The system is now analyzing your feedback patterns and adjusting suggestion confidence scores."}
          {demoStep === 5 && "The system has learned from your feedback! Notice how suggestion confidence scores have been adjusted based on your preferences."}
        </Text>
      </View>

      <View style={styles.suggestionsContainer}>
        <Text style={styles.sectionTitle}>
          {demoStep < 5 ? "Rate these suggestions:" : "Improved suggestions:"}
        </Text>
        
        {demoSuggestions.map((suggestion) => (
          <TouchableOpacity 
            key={suggestion.id} 
            style={[
              styles.suggestionCard,
              suggestion.status === 'accepted' && styles.acceptedSuggestion,
              suggestion.status === 'rejected' && styles.rejectedSuggestion
            ]}
            onPress={() => suggestion.status === 'pending' && openFeedbackModal(suggestion)}
            disabled={suggestion.status !== 'pending'}
          >
            <View style={styles.suggestionHeader}>
              <Text style={styles.suggestionTitle}>{suggestion.title}</Text>
              <View style={[
                styles.confidenceBadge,
                suggestion.confidence >= 0.7 ? styles.highConfidence :
                suggestion.confidence >= 0.5 ? styles.mediumConfidence :
                styles.lowConfidence
              ]}>
                <Text style={styles.confidenceText}>
                  {Math.round(suggestion.confidence * 100)}%
                </Text>
              </View>
            </View>
            
            <Text style={styles.suggestionCategory}>{suggestion.category}</Text>
            
            <View style={styles.basedOnContainer}>
              {JSON.parse(suggestion.based_on).map((factor: string, index: number) => (
                <View key={index} style={styles.basedOnBadge}>
                  <Text style={styles.basedOnText}>{factor}</Text>
                </View>
              ))}
            </View>
            
            {suggestion.status !== 'pending' && (
              <View style={[
                styles.feedbackBadge,
                suggestion.status === 'accepted' ? styles.acceptedBadge : styles.rejectedBadge
              ]}>
                <Text style={styles.feedbackBadgeText}>
                  {suggestion.status === 'accepted' ? '👍 Helpful' : '👎 Not helpful'}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {demoStep === 5 && insights.length > 0 && (
        <View style={styles.insightsContainer}>
          <Text style={styles.sectionTitle}>Learning Insights:</Text>
          {insights.map((insight, index) => (
            <View key={index} style={styles.insightCard}>
              <Text style={styles.insightText}>{insight}</Text>
            </View>
          ))}
        </View>
      )}

      {demoStep === 5 && (
        <TouchableOpacity style={styles.resetButton} onPress={resetDemo}>
          <Text style={styles.resetButtonText}>Reset Demo</Text>
        </TouchableOpacity>
      )}

      {selectedSuggestion && (
        <FeedbackInterface
          suggestion={selectedSuggestion}
          userId={userId}
          onFeedbackSubmitted={handleFeedbackSubmitted}
          visible={feedbackModalVisible}
          onClose={() => setFeedbackModalVisible(false)}
        />
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    padding: 20,
    paddingBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    lineHeight: 22,
  },
  stepIndicator: {
    padding: 20,
    paddingTop: 0,
    paddingBottom: 10,
  },
  stepText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 8,
  },
  stepDots: {
    flexDirection: 'row',
    gap: 8,
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#e0e0e0',
  },
  activeStepDot: {
    backgroundColor: '#007AFF',
    width: 12,
    height: 12,
  },
  completedStepDot: {
    backgroundColor: '#4CAF50',
  },
  instructionCard: {
    margin: 20,
    marginTop: 0,
    padding: 16,
    backgroundColor: '#e3f2fd',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#1976d2',
  },
  instructionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1976d2',
    marginBottom: 8,
  },
  instructionText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  suggestionsContainer: {
    padding: 20,
    paddingTop: 0,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  suggestionCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  acceptedSuggestion: {
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  rejectedSuggestion: {
    borderLeftWidth: 4,
    borderLeftColor: '#f44336',
  },
  suggestionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  suggestionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 40,
    alignItems: 'center',
  },
  highConfidence: {
    backgroundColor: '#e8f5e9',
  },
  mediumConfidence: {
    backgroundColor: '#fff8e1',
  },
  lowConfidence: {
    backgroundColor: '#ffebee',
  },
  confidenceText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  suggestionCategory: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  basedOnContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  basedOnBadge: {
    backgroundColor: '#f1f3f4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  basedOnText: {
    fontSize: 12,
    color: '#666',
  },
  feedbackBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  acceptedBadge: {
    backgroundColor: '#e8f5e9',
  },
  rejectedBadge: {
    backgroundColor: '#ffebee',
  },
  feedbackBadgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  insightsContainer: {
    padding: 20,
    paddingTop: 0,
  },
  insightCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#9c27b0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  insightText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  resetButton: {
    margin: 20,
    padding: 16,
    backgroundColor: '#007AFF',
    borderRadius: 12,
    alignItems: 'center',
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
});

export default FeedbackLearningDemo;