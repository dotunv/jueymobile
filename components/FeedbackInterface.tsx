import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, TextInput, Alert } from 'react-native';
import { Suggestion } from '../lib/types';
import FeedbackLearningService, { FeedbackContext } from '../lib/services/feedbackLearningService';

interface FeedbackInterfaceProps {
  suggestion: Suggestion;
  userId: string;
  onFeedbackSubmitted: (suggestionId: string, feedbackType: 'positive' | 'negative') => void;
  visible: boolean;
  onClose: () => void;
}

export const FeedbackInterface: React.FC<FeedbackInterfaceProps> = ({
  suggestion,
  userId,
  onFeedbackSubmitted,
  visible,
  onClose
}) => {
  const [selectedFeedback, setSelectedFeedback] = useState<'positive' | 'negative' | null>(null);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const feedbackService = FeedbackLearningService.getInstance();

  const handleFeedbackSubmit = async () => {
    if (!selectedFeedback) {
      Alert.alert('Please select feedback', 'Choose whether this suggestion was helpful or not.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Capture current context
      const now = new Date();
      const context: FeedbackContext = {
        time_of_day: now.getHours(),
        day_of_week: now.getDay(),
        device_context: 'mobile', // Could be enhanced to detect actual device
        user_activity: 'reviewing_suggestions'
      };

      // Submit feedback
      await feedbackService.collectFeedback(
        userId,
        suggestion.id,
        selectedFeedback,
        reason.trim() || undefined,
        context
      );

      // Notify parent component
      onFeedbackSubmitted(suggestion.id, selectedFeedback);

      // Reset form
      setSelectedFeedback(null);
      setReason('');
      onClose();

      Alert.alert(
        'Thank you!', 
        'Your feedback helps improve future suggestions.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error submitting feedback:', error);
      Alert.alert(
        'Error', 
        'Failed to submit feedback. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const getFeedbackReasons = (type: 'positive' | 'negative'): string[] => {
    if (type === 'positive') {
      return [
        'Perfect timing',
        'Exactly what I needed',
        'Good category match',
        'Helpful reminder',
        'Saved me time'
      ];
    } else {
      return [
        'Wrong timing',
        'Not relevant',
        'Wrong category',
        'Already completed',
        'Too frequent',
        'Not important'
      ];
    }
  };

  const QuickReasonButton: React.FC<{ reason: string; onSelect: () => void }> = ({ reason, onSelect }) => (
    <TouchableOpacity style={styles.quickReasonButton} onPress={onSelect}>
      <Text style={styles.quickReasonText}>{reason}</Text>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Rate this suggestion</Text>
          
          <View style={styles.suggestionPreview}>
            <Text style={styles.suggestionTitle}>{suggestion.title}</Text>
            <Text style={styles.suggestionCategory}>{suggestion.category}</Text>
            <Text style={styles.suggestionConfidence}>
              Confidence: {Math.round(suggestion.confidence * 100)}%
            </Text>
          </View>

          <Text style={styles.feedbackLabel}>Was this suggestion helpful?</Text>
          
          <View style={styles.feedbackButtons}>
            <TouchableOpacity
              style={[
                styles.feedbackButton,
                styles.positiveButton,
                selectedFeedback === 'positive' && styles.selectedButton
              ]}
              onPress={() => setSelectedFeedback('positive')}
            >
              <Text style={[
                styles.feedbackButtonText,
                selectedFeedback === 'positive' && styles.selectedButtonText
              ]}>
                👍 Helpful
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.feedbackButton,
                styles.negativeButton,
                selectedFeedback === 'negative' && styles.selectedButton
              ]}
              onPress={() => setSelectedFeedback('negative')}
            >
              <Text style={[
                styles.feedbackButtonText,
                selectedFeedback === 'negative' && styles.selectedButtonText
              ]}>
                👎 Not helpful
              </Text>
            </TouchableOpacity>
          </View>

          {selectedFeedback && (
            <View style={styles.reasonSection}>
              <Text style={styles.reasonLabel}>
                Why was this suggestion {selectedFeedback === 'positive' ? 'helpful' : 'not helpful'}?
              </Text>
              
              <View style={styles.quickReasons}>
                {getFeedbackReasons(selectedFeedback).map((quickReason, index) => (
                  <QuickReasonButton
                    key={index}
                    reason={quickReason}
                    onSelect={() => setReason(quickReason)}
                  />
                ))}
              </View>

              <TextInput
                style={styles.reasonInput}
                placeholder="Or write your own reason (optional)"
                value={reason}
                onChangeText={setReason}
                multiline
                numberOfLines={3}
              />
            </View>
          )}

          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.submitButton,
                (!selectedFeedback || isSubmitting) && styles.disabledButton
              ]}
              onPress={handleFeedbackSubmit}
              disabled={!selectedFeedback || isSubmitting}
            >
              <Text style={[
                styles.submitButtonText,
                (!selectedFeedback || isSubmitting) && styles.disabledButtonText
              ]}>
                {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  suggestionPreview: {
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  suggestionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  suggestionCategory: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  suggestionConfidence: {
    fontSize: 12,
    color: '#888',
  },
  feedbackLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 15,
    color: '#333',
  },
  feedbackButtons: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  feedbackButton: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
  },
  positiveButton: {
    borderColor: '#4CAF50',
    backgroundColor: '#f8fff8',
  },
  negativeButton: {
    borderColor: '#f44336',
    backgroundColor: '#fff8f8',
  },
  selectedButton: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  feedbackButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  selectedButtonText: {
    color: 'white',
  },
  reasonSection: {
    marginBottom: 20,
  },
  reasonLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 10,
    color: '#333',
  },
  quickReasons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 15,
  },
  quickReasonButton: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#bbdefb',
  },
  quickReasonText: {
    fontSize: 12,
    color: '#1976d2',
  },
  reasonInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    textAlignVertical: 'top',
    minHeight: 80,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelButton: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
  },
  submitButton: {
    flex: 2,
    padding: 15,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  disabledButtonText: {
    color: '#999',
  },
});

export default FeedbackInterface;