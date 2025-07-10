import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  Sparkles, 
  Brain, 
  TrendingUp, 
  Target, 
  Clock, 
  Calendar, 
  Zap,
  Info,
  ThumbsUp,
  ThumbsDown,
  CheckCircle
} from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { useSuggestionStore } from '../../lib/suggestionStore';
import PageHeader from '../../components/PageHeader';

interface Suggestion {
  id: string;
  title: string;
  description: string;
  category: string;
  confidence: number;
  reasoning: string;
  time_estimate: string;
  priority: 'low' | 'medium' | 'high';
  based_on: string[];
}

const mockSuggestions: Suggestion[] = [
  {
    id: '1',
    title: 'Review project documentation',
    description: 'Update and review the current project documentation before the upcoming client meeting.',
    category: 'Work',
    confidence: 92,
    reasoning: 'Based on your recent work patterns and upcoming calendar events',
    time_estimate: '45 mins',
    priority: 'high',
    based_on: ['Recent work sessions', 'Calendar events', 'Similar past tasks'],
  },
  {
    id: '2',
    title: 'Schedule dental checkup',
    description: 'It\'s been 6 months since your last dental appointment. Book your routine checkup.',
    category: 'Health',
    confidence: 88,
    reasoning: 'Recurring health maintenance based on your schedule',
    time_estimate: '10 mins',
    priority: 'medium',
    based_on: ['Health reminders', 'Time patterns', 'Personal schedule'],
  },
  {
    id: '3',
    title: 'Weekly grocery planning',
    description: 'Plan and organize your weekly grocery list for efficient shopping.',
    category: 'Personal',
    confidence: 85,
    reasoning: 'Based on your weekly routine and shopping patterns',
    time_estimate: '20 mins',
    priority: 'low',
    based_on: ['Weekly patterns', 'Shopping history', 'Meal planning'],
  },
  {
    id: '4',
    title: 'Team sync preparation',
    description: 'Prepare agenda and updates for tomorrow\'s team synchronization meeting.',
    category: 'Work',
    confidence: 95,
    reasoning: 'High priority based on calendar and work patterns',
    time_estimate: '30 mins',
    priority: 'high',
    based_on: ['Calendar events', 'Work patterns', 'Team collaboration'],
  },
];

export default function SuggestionsScreen() {
  const { theme } = useTheme();
  const suggestions = useSuggestionStore((state) => state.suggestions);
  const setSuggestions = useSuggestionStore((state) => state.setSuggestions);
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null);

  const handleFeedback = (suggestionId: string, type: 'positive' | 'negative') => {
    // In a real app, this would send feedback to the AI system
    const updatedSuggestions = suggestions.filter(s => s.id !== suggestionId);
    setSuggestions(updatedSuggestions);
  };

  const handleAcceptSuggestion = (suggestionId: string) => {
    // In a real app, this would add the task to the user's task list
    const updatedSuggestions = suggestions.filter(s => s.id !== suggestionId);
    setSuggestions(updatedSuggestions);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return theme.colors.error;
      case 'medium': return theme.colors.warning;
      case 'low': return theme.colors.success;
      default: return theme.colors.textTertiary;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Work': return Target;
      case 'Health': return Zap;
      case 'Personal': return Calendar;
      default: return Clock;
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <PageHeader
          icon={Sparkles}
          title="AI Suggestions"
          subtitle="Personalized recommendations for you"
        />

        {/* Stats */}
        <View
          style={styles.statsContainer}
        >
          <View style={[styles.statCard, { backgroundColor: theme.colors.surface }]}>
            <TrendingUp size={20} color={theme.colors.primary} strokeWidth={2} />
            <Text style={[styles.statNumber, { color: theme.colors.text }]}>92%</Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
              Avg Accuracy
            </Text>
          </View>
          
          <View style={[styles.statCard, { backgroundColor: theme.colors.surface }]}>
            <Target size={20} color={theme.colors.success} strokeWidth={2} />
            <Text style={[styles.statNumber, { color: theme.colors.text }]}>
              {suggestions.length}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
              New Suggestions
            </Text>
          </View>
          
          <View style={[styles.statCard, { backgroundColor: theme.colors.surface }]}>
            <Clock size={20} color={theme.colors.accent} strokeWidth={2} />
            <Text style={[styles.statNumber, { color: theme.colors.text }]}>2.5h</Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
              Est. Time
            </Text>
          </View>
        </View>

        {/* Suggestions List */}
        <View
          style={styles.suggestionsContainer}
        >
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Today's Recommendations
            </Text>
            <Text style={[styles.suggestionCount, { color: theme.colors.textSecondary }]}>
              {suggestions.length} suggestions
            </Text>
          </View>

          {suggestions.map((suggestion, index) => {
            const CategoryIcon = getCategoryIcon(suggestion.category);
            
            return (
              <View
                key={suggestion.id}
                style={[styles.suggestionCard, { backgroundColor: theme.colors.surface, shadowColor: theme.colors.shadow }]}
              >
                {/* Card Header */}
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <View style={[styles.categoryIcon, { backgroundColor: theme.colors.primary + '20' }]}>
                      <CategoryIcon size={16} color={theme.colors.primary} strokeWidth={2} />
                    </View>
                    <View>
                      <Text style={[styles.categoryText, { color: theme.colors.textSecondary }]}>
                        {suggestion.category}
                      </Text>
                      <View style={styles.priorityContainer}>
                        <View style={[
                          styles.priorityDot,
                          { backgroundColor: getPriorityColor(suggestion.priority) }
                        ]} />
                        <Text style={[styles.priorityText, { color: theme.colors.textTertiary }]}>
                          {suggestion.priority.toUpperCase()} PRIORITY
                        </Text>
                      </View>
                    </View>
                  </View>
                  
                  <View style={styles.confidenceContainer}>
                    <Text style={[styles.confidenceNumber, { color: theme.colors.success }]}>
                      {suggestion.confidence}%
                    </Text>
                    <Text style={[styles.confidenceLabel, { color: theme.colors.textTertiary }]}>
                      confidence
                    </Text>
                  </View>
                </View>

                {/* Card Content */}
                <View style={styles.cardContent}>
                  <Text style={[styles.suggestionTitle, { color: theme.colors.text }]}>
                    {suggestion.title}
                  </Text>
                  <Text style={[styles.suggestionDescription, { color: theme.colors.textSecondary }]}>
                    {suggestion.description}
                  </Text>
                  
                  <View style={styles.metaInfo}>
                    <View style={styles.timeEstimate}>
                      <Clock size={14} color={theme.colors.textTertiary} strokeWidth={2} />
                      <Text style={[styles.timeText, { color: theme.colors.textTertiary }]}>
                        {suggestion.time_estimate}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Reasoning Section */}
                <TouchableOpacity
                  onPress={() => setSelectedSuggestion(
                    selectedSuggestion === suggestion.id ? null : suggestion.id
                  )}
                  style={styles.reasoningToggle}
                >
                  <Info size={16} color={theme.colors.primary} strokeWidth={2} />
                  <Text style={[styles.reasoningToggleText, { color: theme.colors.primary }]}>
                    Why this suggestion?
                  </Text>
                </TouchableOpacity>

                {selectedSuggestion === suggestion.id && (
                  <View
                    style={[styles.reasoningContainer, { backgroundColor: theme.colors.surfaceVariant }]}
                  >
                    <Text style={[styles.reasoningText, { color: theme.colors.textSecondary }]}>
                      {suggestion.reasoning}
                    </Text>
                    <Text style={[styles.basedOnLabel, { color: theme.colors.textTertiary }]}>
                      Based on:
                    </Text>
                    <View style={styles.basedOnContainer}>
                      {suggestion.based_on.map((factor: string, idx: number) => (
                        <View key={idx} style={[styles.factorChip, { backgroundColor: theme.colors.primary + '20' }]}>
                          <Text style={[styles.factorText, { color: theme.colors.primary }]}>
                            {factor}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Action Buttons */}
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    onPress={() => handleAcceptSuggestion(suggestion.id)}
                    style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}
                    activeOpacity={0.8}
                  >
                    <CheckCircle size={16} color="white" strokeWidth={2} />
                    <Text style={styles.actionButtonText}>Accept</Text>
                  </TouchableOpacity>
                  
                  <View style={styles.feedbackButtons}>
                    <TouchableOpacity
                      onPress={() => handleFeedback(suggestion.id, 'positive')}
                      style={[styles.feedbackButton, { backgroundColor: theme.colors.success + '20' }]}
                      activeOpacity={0.8}
                    >
                      <ThumbsUp size={16} color={theme.colors.success} strokeWidth={2} />
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      onPress={() => handleFeedback(suggestion.id, 'negative')}
                      style={[styles.feedbackButton, { backgroundColor: theme.colors.error + '20' }]}
                      activeOpacity={0.8}
                    >
                      <ThumbsDown size={16} color={theme.colors.error} strokeWidth={2} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 32,
    gap: 12,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  statNumber: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    marginTop: 4,
    textAlign: 'center',
  },
  suggestionsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: 'Inter-SemiBold',
  },
  suggestionCount: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  suggestionCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  categoryText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  priorityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  priorityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  priorityText: {
    fontSize: 10,
    fontFamily: 'Inter-Medium',
    letterSpacing: 0.5,
  },
  confidenceContainer: {
    alignItems: 'flex-end',
  },
  confidenceNumber: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
  },
  confidenceLabel: {
    fontSize: 10,
    fontFamily: 'Inter-Regular',
  },
  cardContent: {
    marginBottom: 16,
  },
  suggestionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 8,
    lineHeight: 24,
  },
  suggestionDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    lineHeight: 20,
    marginBottom: 12,
  },
  metaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeEstimate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
  },
  reasoningToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  reasoningToggleText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
  },
  reasoningContainer: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  reasoningText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    lineHeight: 20,
    marginBottom: 12,
  },
  basedOnLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    marginBottom: 8,
  },
  basedOnContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  factorChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  factorText: {
    fontSize: 11,
    fontFamily: 'Inter-Medium',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
  },
  feedbackButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  feedbackButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    marginTop: 24,
    marginBottom: 12,
  },
  emptyDescription: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
    lineHeight: 24,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
});