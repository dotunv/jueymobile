import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * AccuracyMonitor tracks speech recognition accuracy over time
 * and provides feedback for improving transcription quality.
 */
export class AccuracyMonitor {
  private readonly STORAGE_KEY = 'voice_accuracy_metrics';
  private readonly MAX_HISTORY_ITEMS = 100;
  
  /**
   * Track a new transcription for accuracy monitoring
   */
  public async trackTranscription(text: string, confidence: number): Promise<void> {
    try {
      // Get existing metrics
      const metrics = await this.getMetrics();
      
      // Add new transcription to history
      const newEntry = {
        timestamp: new Date().toISOString(),
        text,
        confidence,
        length: text.length,
        wordCount: text.split(/\s+/).length,
        hasNumbers: /\d/.test(text),
        hasPunctuation: /[.,!?;:]/.test(text),
        userCorrected: false,
        userRating: null
      };
      
      // Add to history, keeping only the most recent MAX_HISTORY_ITEMS
      metrics.history.unshift(newEntry);
      if (metrics.history.length > this.MAX_HISTORY_ITEMS) {
        metrics.history = metrics.history.slice(0, this.MAX_HISTORY_ITEMS);
      }
      
      // Update aggregate metrics
      metrics.totalTranscriptions += 1;
      metrics.averageConfidence = this.calculateAverageConfidence(metrics.history);
      metrics.lastUpdated = new Date().toISOString();
      
      // Save updated metrics
      await this.saveMetrics(metrics);
    } catch (error) {
      console.error('Failed to track transcription:', error);
    }
  }
  
  /**
   * Record user feedback on transcription accuracy
   */
  public async recordUserFeedback(
    originalText: string, 
    correctedText: string | null, 
    rating: number | null
  ): Promise<void> {
    try {
      const metrics = await this.getMetrics();
      
      // Find the matching transcription in history
      const matchingIndex = metrics.history.findIndex(item => item.text === originalText);
      if (matchingIndex !== -1) {
        // Update with user feedback
        metrics.history[matchingIndex].userCorrected = correctedText !== null;
        metrics.history[matchingIndex].userRating = rating;
        
        if (correctedText) {
          // Calculate correction distance
          const distance = this.calculateLevenshteinDistance(originalText, correctedText);
          metrics.history[matchingIndex].correctionDistance = distance;
          metrics.history[matchingIndex].correctedText = correctedText;
          
          // Update accuracy metrics
          metrics.totalCorrected += 1;
          metrics.averageErrorDistance = this.calculateAverageErrorDistance(metrics.history);
        }
        
        // Update rating metrics if provided
        if (rating !== null) {
          metrics.totalRated += 1;
          metrics.averageRating = this.calculateAverageRating(metrics.history);
        }
        
        metrics.lastUpdated = new Date().toISOString();
        await this.saveMetrics(metrics);
      }
    } catch (error) {
      console.error('Failed to record user feedback:', error);
    }
  }
  
  /**
   * Get accuracy metrics for a specific time period
   */
  public async getAccuracyMetrics(
    period: 'day' | 'week' | 'month' | 'all' = 'all'
  ): Promise<AccuracyMetrics> {
    try {
      const metrics = await this.getMetrics();
      
      // Filter history based on time period
      const filteredHistory = this.filterHistoryByPeriod(metrics.history, period);
      
      return {
        totalTranscriptions: filteredHistory.length,
        averageConfidence: this.calculateAverageConfidence(filteredHistory),
        totalCorrected: filteredHistory.filter(item => item.userCorrected).length,
        averageErrorDistance: this.calculateAverageErrorDistance(filteredHistory),
        totalRated: filteredHistory.filter(item => item.userRating !== null).length,
        averageRating: this.calculateAverageRating(filteredHistory),
        improvementRate: this.calculateImprovementRate(filteredHistory),
        commonErrorPatterns: this.identifyCommonErrorPatterns(filteredHistory),
        period
      };
    } catch (error) {
      console.error('Failed to get accuracy metrics:', error);
      return this.getDefaultMetrics();
    }
  }
  
  /**
   * Get suggestions for improving transcription accuracy
   */
  public async getImprovementSuggestions(): Promise<string[]> {
    try {
      const metrics = await this.getMetrics();
      const recentHistory = metrics.history.slice(0, 20);
      const suggestions: string[] = [];
      
      // Check for low confidence scores
      const averageConfidence = this.calculateAverageConfidence(recentHistory);
      if (averageConfidence < 0.7) {
        suggestions.push('Try speaking more clearly and at a moderate pace');
        suggestions.push('Reduce background noise when recording');
      }
      
      // Check for short transcriptions
      const averageLength = recentHistory.reduce((sum, item) => sum + item.length, 0) / recentHistory.length;
      if (averageLength < 10) {
        suggestions.push('Try speaking in complete sentences for better recognition');
      }
      
      // Check for number recognition issues
      const numberItems = recentHistory.filter(item => item.hasNumbers);
      if (numberItems.length > 0) {
        const numberConfidence = this.calculateAverageConfidence(numberItems);
        if (numberConfidence < averageConfidence - 0.1) {
          suggestions.push('Try pronouncing numbers more distinctly');
        }
      }
      
      // Add general suggestions
      suggestions.push('Hold the device 6-12 inches from your mouth for optimal recording');
      suggestions.push('Speak at a consistent volume and pace');
      
      return suggestions;
    } catch (error) {
      console.error('Failed to get improvement suggestions:', error);
      return [
        'Speak clearly and at a moderate pace',
        'Reduce background noise when recording',
        'Hold the device 6-12 inches from your mouth'
      ];
    }
  }
  
  /**
   * Get raw metrics data from storage
   */
  private async getMetrics(): Promise<AccuracyMetricsStorage> {
    try {
      const data = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (data) {
        return JSON.parse(data);
      }
      return this.getDefaultMetricsStorage();
    } catch (error) {
      console.error('Failed to get metrics from storage:', error);
      return this.getDefaultMetricsStorage();
    }
  }
  
  /**
   * Save metrics data to storage
   */
  private async saveMetrics(metrics: AccuracyMetricsStorage): Promise<void> {
    try {
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(metrics));
    } catch (error) {
      console.error('Failed to save metrics to storage:', error);
    }
  }
  
  /**
   * Get default metrics storage object
   */
  private getDefaultMetricsStorage(): AccuracyMetricsStorage {
    return {
      history: [],
      totalTranscriptions: 0,
      averageConfidence: 0,
      totalCorrected: 0,
      averageErrorDistance: 0,
      totalRated: 0,
      averageRating: 0,
      lastUpdated: new Date().toISOString()
    };
  }
  
  /**
   * Get default metrics object
   */
  private getDefaultMetrics(): AccuracyMetrics {
    return {
      totalTranscriptions: 0,
      averageConfidence: 0,
      totalCorrected: 0,
      averageErrorDistance: 0,
      totalRated: 0,
      averageRating: 0,
      improvementRate: 0,
      commonErrorPatterns: [],
      period: 'all'
    };
  }
  
  /**
   * Calculate average confidence from history items
   */
  private calculateAverageConfidence(history: TranscriptionHistoryItem[]): number {
    if (history.length === 0) return 0;
    return history.reduce((sum, item) => sum + item.confidence, 0) / history.length;
  }
  
  /**
   * Calculate average error distance from history items
   */
  private calculateAverageErrorDistance(history: TranscriptionHistoryItem[]): number {
    const correctedItems = history.filter(
      item => item.userCorrected && item.correctionDistance !== undefined
    );
    if (correctedItems.length === 0) return 0;
    return correctedItems.reduce((sum, item) => sum + (item.correctionDistance || 0), 0) / correctedItems.length;
  }
  
  /**
   * Calculate average user rating from history items
   */
  private calculateAverageRating(history: TranscriptionHistoryItem[]): number {
    const ratedItems = history.filter(item => item.userRating !== null);
    if (ratedItems.length === 0) return 0;
    return ratedItems.reduce((sum, item) => sum + (item.userRating || 0), 0) / ratedItems.length;
  }
  
  /**
   * Calculate improvement rate over time
   */
  private calculateImprovementRate(history: TranscriptionHistoryItem[]): number {
    if (history.length < 10) return 0;
    
    // Split history into two halves
    const midpoint = Math.floor(history.length / 2);
    const recentItems = history.slice(0, midpoint);
    const olderItems = history.slice(midpoint);
    
    // Compare confidence scores
    const recentConfidence = this.calculateAverageConfidence(recentItems);
    const olderConfidence = this.calculateAverageConfidence(olderItems);
    
    // Calculate improvement rate
    if (olderConfidence === 0) return 0;
    return (recentConfidence - olderConfidence) / olderConfidence;
  }
  
  /**
   * Identify common error patterns in transcriptions
   */
  private identifyCommonErrorPatterns(history: TranscriptionHistoryItem[]): ErrorPattern[] {
    const correctedItems = history.filter(
      item => item.userCorrected && item.correctedText !== undefined
    );
    
    if (correctedItems.length < 5) return [];
    
    const patterns: Record<string, { count: number, examples: string[] }> = {};
    
    // Analyze corrections for patterns
    correctedItems.forEach(item => {
      if (!item.correctedText) return;
      
      // Compare original and corrected text
      const original = item.text.toLowerCase();
      const corrected = item.correctedText.toLowerCase();
      
      // Check for common substitutions
      this.findSubstitutions(original, corrected).forEach(sub => {
        const key = `${sub.original} → ${sub.corrected}`;
        if (!patterns[key]) {
          patterns[key] = { count: 0, examples: [] };
        }
        patterns[key].count += 1;
        if (patterns[key].examples.length < 3) {
          patterns[key].examples.push(`"${item.text}" → "${item.correctedText}"`);
        }
      });
    });
    
    // Convert to array and sort by frequency
    return Object.entries(patterns)
      .map(([pattern, data]) => ({
        pattern,
        count: data.count,
        examples: data.examples
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }
  
  /**
   * Find word substitutions between original and corrected text
   */
  private findSubstitutions(original: string, corrected: string): { original: string, corrected: string }[] {
    const originalWords = original.split(/\s+/);
    const correctedWords = corrected.split(/\s+/);
    const substitutions: { original: string, corrected: string }[] = [];
    
    // Simple word-by-word comparison
    // This is a simplified approach - a real implementation would use more sophisticated alignment
    const minLength = Math.min(originalWords.length, correctedWords.length);
    
    for (let i = 0; i < minLength; i++) {
      if (originalWords[i] !== correctedWords[i]) {
        substitutions.push({
          original: originalWords[i],
          corrected: correctedWords[i]
        });
      }
    }
    
    return substitutions;
  }
  
  /**
   * Filter history items by time period
   */
  private filterHistoryByPeriod(
    history: TranscriptionHistoryItem[], 
    period: 'day' | 'week' | 'month' | 'all'
  ): TranscriptionHistoryItem[] {
    if (period === 'all') return history;
    
    const now = new Date();
    const cutoff = new Date();
    
    switch (period) {
      case 'day':
        cutoff.setDate(now.getDate() - 1);
        break;
      case 'week':
        cutoff.setDate(now.getDate() - 7);
        break;
      case 'month':
        cutoff.setMonth(now.getMonth() - 1);
        break;
    }
    
    return history.filter(item => {
      const timestamp = new Date(item.timestamp);
      return timestamp >= cutoff;
    });
  }
  
  /**
   * Calculate Levenshtein distance between two strings
   */
  private calculateLevenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];
    
    // Initialize matrix
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }
    
    // Fill matrix
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }
    
    return matrix[b.length][a.length];
  }
}

/**
 * Interface for transcription history item
 */
interface TranscriptionHistoryItem {
  timestamp: string;
  text: string;
  confidence: number;
  length: number;
  wordCount: number;
  hasNumbers: boolean;
  hasPunctuation: boolean;
  userCorrected: boolean;
  userRating: number | null;
  correctionDistance?: number;
  correctedText?: string;
}

/**
 * Interface for accuracy metrics storage
 */
interface AccuracyMetricsStorage {
  history: TranscriptionHistoryItem[];
  totalTranscriptions: number;
  averageConfidence: number;
  totalCorrected: number;
  averageErrorDistance: number;
  totalRated: number;
  averageRating: number;
  lastUpdated: string;
}

/**
 * Interface for accuracy metrics
 */
export interface AccuracyMetrics {
  totalTranscriptions: number;
  averageConfidence: number;
  totalCorrected: number;
  averageErrorDistance: number;
  totalRated: number;
  averageRating: number;
  improvementRate: number;
  commonErrorPatterns: ErrorPattern[];
  period: 'day' | 'week' | 'month' | 'all';
}

/**
 * Interface for error pattern
 */
export interface ErrorPattern {
  pattern: string;
  count: number;
  examples: string[];
}