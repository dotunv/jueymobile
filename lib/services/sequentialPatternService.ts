import { Task } from '../types';
import { UserPattern, PatternDatabaseUtils } from '../patternDatabase';
import { DatabaseUtils } from '../database';

/**
 * Sequential Pattern Recognition Service
 * Analyzes task sequences to identify common workflows and task chains
 */

export interface TaskSequence {
  id: string;
  tasks: Task[];
  frequency: number;
  confidence: number;
  avgTimeBetween: number; // Average time between tasks in minutes
  lastOccurrence: Date;
  nextPredicted?: Task;
}

export interface SequentialPattern {
  sequence: string[]; // Task titles or categories
  support: number; // How often this sequence appears
  confidence: number; // Confidence in the pattern
  avgGapTime: number; // Average time between tasks in sequence
  category: string;
}

export interface WorkflowSuggestion {
  nextTask: string;
  confidence: number;
  reasoning: string;
  estimatedTime?: number;
  category: string;
}

export class SequentialPatternService {
  private readonly MIN_SUPPORT = 0.1; // Minimum support threshold (10%)
  private readonly MIN_CONFIDENCE = 0.3; // Minimum confidence threshold
  private readonly MAX_SEQUENCE_LENGTH = 5; // Maximum sequence length to analyze
  private readonly MAX_GAP_HOURS = 24; // Maximum gap between tasks in a sequence (hours)

  /**
   * Analyze sequential patterns in user's task completion history
   */
  async analyzeSequentialPatterns(userId: string, tasks: Task[]): Promise<SequentialPattern[]> {
    const completedTasks = tasks
      .filter(task => task.completed && task.completed_at)
      .sort((a, b) => new Date(a.completed_at!).getTime() - new Date(b.completed_at!).getTime());

    if (completedTasks.length < 3) {
      return [];
    }

    // Extract sequences of different lengths
    const sequences = this.extractSequences(completedTasks);
    
    // Mine frequent sequences using modified Apriori algorithm
    const frequentSequences = this.mineFrequentSequences(sequences);
    
    // Calculate confidence and create patterns
    const patterns = this.createSequentialPatterns(frequentSequences, completedTasks);
    
    // Store patterns in database
    await this.storeSequentialPatterns(userId, patterns);
    
    return patterns.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Extract task sequences from completed tasks
   */
  private extractSequences(tasks: Task[]): TaskSequence[] {
    const sequences: TaskSequence[] = [];
    
    for (let i = 0; i < tasks.length - 1; i++) {
      for (let length = 2; length <= Math.min(this.MAX_SEQUENCE_LENGTH, tasks.length - i); length++) {
        const sequenceTasks = tasks.slice(i, i + length);
        
        // Check if tasks are within reasonable time gap
        if (this.isValidSequence(sequenceTasks)) {
          const sequence: TaskSequence = {
            id: DatabaseUtils.generateId(),
            tasks: sequenceTasks,
            frequency: 1,
            confidence: 0,
            avgTimeBetween: this.calculateAvgTimeBetween(sequenceTasks),
            lastOccurrence: new Date(sequenceTasks[sequenceTasks.length - 1].completed_at!)
          };
          
          sequences.push(sequence);
        }
      }
    }
    
    return sequences;
  }

  /**
   * Check if a sequence of tasks is valid (within time constraints)
   */
  private isValidSequence(tasks: Task[]): boolean {
    for (let i = 0; i < tasks.length - 1; i++) {
      const current = new Date(tasks[i].completed_at!);
      const next = new Date(tasks[i + 1].completed_at!);
      const gapHours = (next.getTime() - current.getTime()) / (1000 * 60 * 60);
      
      if (gapHours > this.MAX_GAP_HOURS) {
        return false;
      }
    }
    return true;
  }

  /**
   * Calculate average time between tasks in a sequence
   */
  private calculateAvgTimeBetween(tasks: Task[]): number {
    if (tasks.length < 2) return 0;
    
    let totalGap = 0;
    for (let i = 0; i < tasks.length - 1; i++) {
      const current = new Date(tasks[i].completed_at!);
      const next = new Date(tasks[i + 1].completed_at!);
      totalGap += (next.getTime() - current.getTime()) / (1000 * 60); // Convert to minutes
    }
    
    return totalGap / (tasks.length - 1);
  }

  /**
   * Mine frequent sequences using modified Apriori algorithm
   */
  private mineFrequentSequences(sequences: TaskSequence[]): Map<string, TaskSequence[]> {
    const sequenceGroups = new Map<string, TaskSequence[]>();
    
    // Group sequences by their task title pattern
    for (const sequence of sequences) {
      const pattern = sequence.tasks.map(task => task.title).join(' -> ');
      
      if (!sequenceGroups.has(pattern)) {
        sequenceGroups.set(pattern, []);
      }
      sequenceGroups.get(pattern)!.push(sequence);
    }
    
    // Filter by minimum support
    const totalSequences = sequences.length;
    const frequentSequences = new Map<string, TaskSequence[]>();
    
    for (const [pattern, patternSequences] of sequenceGroups.entries()) {
      const support = patternSequences.length / totalSequences;
      if (support >= this.MIN_SUPPORT) {
        frequentSequences.set(pattern, patternSequences);
      }
    }
    
    return frequentSequences;
  }

  /**
   * Create sequential patterns from frequent sequences
   */
  private createSequentialPatterns(
    frequentSequences: Map<string, TaskSequence[]>,
    allTasks: Task[]
  ): SequentialPattern[] {
    const patterns: SequentialPattern[] = [];
    
    for (const [pattern, sequences] of frequentSequences.entries()) {
      const taskTitles = pattern.split(' -> ');
      const support = sequences.length / allTasks.length;
      
      // Calculate confidence using association rule mining
      const confidence = this.calculateSequenceConfidence(taskTitles, allTasks);
      
      if (confidence >= this.MIN_CONFIDENCE) {
        const avgGapTime = sequences.reduce((sum, seq) => sum + seq.avgTimeBetween, 0) / sequences.length;
        const category = this.determineSequenceCategory(sequences);
        
        patterns.push({
          sequence: taskTitles,
          support,
          confidence,
          avgGapTime,
          category
        });
      }
    }
    
    return patterns;
  }

  /**
   * Calculate confidence for a sequence pattern
   */
  private calculateSequenceConfidence(sequence: string[], allTasks: Task[]): number {
    if (sequence.length < 2) return 0;
    
    const antecedent = sequence.slice(0, -1);
    const consequent = sequence[sequence.length - 1];
    
    // Count occurrences of antecedent
    let antecedentCount = 0;
    let fullSequenceCount = 0;
    
    const completedTasks = allTasks.filter(task => task.completed);
    
    for (let i = 0; i <= completedTasks.length - antecedent.length; i++) {
      const window = completedTasks.slice(i, i + antecedent.length);
      const windowTitles = window.map(task => task.title);
      
      if (this.arraysEqual(windowTitles, antecedent)) {
        antecedentCount++;
        
        // Check if consequent follows
        if (i + antecedent.length < completedTasks.length) {
          const nextTask = completedTasks[i + antecedent.length];
          if (nextTask.title === consequent) {
            fullSequenceCount++;
          }
        }
      }
    }
    
    return antecedentCount > 0 ? fullSequenceCount / antecedentCount : 0;
  }

  /**
   * Determine the primary category for a sequence
   */
  private determineSequenceCategory(sequences: TaskSequence[]): string {
    const categoryCount = new Map<string, number>();
    
    for (const sequence of sequences) {
      for (const task of sequence.tasks) {
        const category = task.category || 'Uncategorized';
        categoryCount.set(category, (categoryCount.get(category) || 0) + 1);
      }
    }
    
    let maxCategory = 'Mixed';
    let maxCount = 0;
    
    for (const [category, count] of categoryCount.entries()) {
      if (count > maxCount) {
        maxCount = count;
        maxCategory = category;
      }
    }
    
    return maxCategory;
  }

  /**
   * Generate workflow suggestions based on current context
   */
  async generateWorkflowSuggestions(
    userId: string,
    recentTasks: Task[],
    limit: number = 5
  ): Promise<WorkflowSuggestion[]> {
    const patterns = await PatternDatabaseUtils.getUserPatterns(userId, 'sequential');
    const suggestions: WorkflowSuggestion[] = [];
    
    if (recentTasks.length === 0 || patterns.length === 0) {
      return suggestions;
    }
    
    const recentTaskTitles = recentTasks
      .filter(task => task.completed)
      .slice(-3) // Look at last 3 completed tasks
      .map(task => task.title);
    
    for (const pattern of patterns) {
      const sequenceData = pattern.pattern_data as { sequence: string[]; avgGapTime: number };
      const sequence = sequenceData.sequence;
      
      // Find matching subsequences
      const matchIndex = this.findSubsequenceMatch(recentTaskTitles, sequence);
      
      if (matchIndex >= 0 && matchIndex < sequence.length - 1) {
        const nextTask = sequence[matchIndex + 1];
        const confidence = pattern.confidence * this.calculateRecencyBoost(recentTasks);
        
        suggestions.push({
          nextTask,
          confidence,
          reasoning: `Based on your pattern: ${sequence.slice(0, matchIndex + 2).join(' → ')}`,
          estimatedTime: Math.round(sequenceData.avgGapTime),
          category: this.extractCategoryFromPattern(pattern)
        });
      }
    }
    
    // Sort by confidence and remove duplicates
    const uniqueSuggestions = this.removeDuplicateSuggestions(suggestions);
    return uniqueSuggestions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, limit);
  }

  /**
   * Find if recent tasks match a subsequence of a pattern
   */
  private findSubsequenceMatch(recentTasks: string[], sequence: string[]): number {
    if (recentTasks.length === 0) return -1;
    
    // Try to match the end of recent tasks with the beginning of sequence
    for (let i = 0; i < sequence.length - 1; i++) {
      const subseq = sequence.slice(0, i + 1);
      if (recentTasks.length >= subseq.length) {
        const recentEnd = recentTasks.slice(-subseq.length);
        if (this.arraysEqual(recentEnd, subseq)) {
          return i;
        }
      }
    }
    
    return -1;
  }

  /**
   * Calculate recency boost for suggestions
   */
  private calculateRecencyBoost(recentTasks: Task[]): number {
    if (recentTasks.length === 0) return 1;
    
    const mostRecent = recentTasks[recentTasks.length - 1];
    if (!mostRecent.completed_at) return 1;
    
    const hoursAgo = (Date.now() - new Date(mostRecent.completed_at).getTime()) / (1000 * 60 * 60);
    
    // Boost decreases exponentially with time
    return Math.exp(-hoursAgo / 12); // Half-life of 12 hours
  }

  /**
   * Remove duplicate suggestions
   */
  private removeDuplicateSuggestions(suggestions: WorkflowSuggestion[]): WorkflowSuggestion[] {
    const seen = new Set<string>();
    return suggestions.filter(suggestion => {
      if (seen.has(suggestion.nextTask)) {
        return false;
      }
      seen.add(suggestion.nextTask);
      return true;
    });
  }

  /**
   * Extract category from pattern data
   */
  private extractCategoryFromPattern(pattern: UserPattern): string {
    return pattern.pattern_data.category || 'General';
  }

  /**
   * Store sequential patterns in database
   */
  private async storeSequentialPatterns(userId: string, patterns: SequentialPattern[]): Promise<void> {
    for (const pattern of patterns) {
      const userPattern: Omit<UserPattern, 'created_at' | 'updated_at'> = {
        id: DatabaseUtils.generateId(),
        user_id: userId,
        pattern_type: 'sequential',
        pattern_data: {
          sequence: pattern.sequence,
          support: pattern.support,
          avgGapTime: pattern.avgGapTime,
          category: pattern.category
        },
        confidence: pattern.confidence,
        frequency: Math.round(pattern.support * 100), // Convert support to frequency
        last_occurrence: DatabaseUtils.formatDate(new Date()),
        next_predicted: undefined
      };
      
      await PatternDatabaseUtils.upsertUserPattern(userPattern);
    }
  }

  /**
   * Detect task dependencies based on completion patterns
   */
  async detectTaskDependencies(userId: string, tasks: Task[]): Promise<Map<string, string[]>> {
    const dependencies = new Map<string, string[]>();
    const patterns = await PatternDatabaseUtils.getUserPatterns(userId, 'sequential');
    
    for (const pattern of patterns) {
      const sequenceData = pattern.pattern_data as { sequence: string[] };
      const sequence = sequenceData.sequence;
      
      for (let i = 1; i < sequence.length; i++) {
        const dependent = sequence[i];
        const prerequisite = sequence[i - 1];
        
        if (!dependencies.has(dependent)) {
          dependencies.set(dependent, []);
        }
        
        if (!dependencies.get(dependent)!.includes(prerequisite)) {
          dependencies.get(dependent)!.push(prerequisite);
        }
      }
    }
    
    return dependencies;
  }

  /**
   * Utility function to check array equality
   */
  private arraysEqual<T>(a: T[], b: T[]): boolean {
    if (a.length !== b.length) return false;
    return a.every((val, index) => val === b[index]);
  }

  /**
   * Get sequential patterns for debugging and visualization
   */
  async getSequentialPatternsForVisualization(userId: string): Promise<{
    topSequences: SequentialPattern[];
    dependencyGraph: Record<string, string[]>;
    categoryWorkflows: Record<string, SequentialPattern[]>;
  }> {
    const patterns = await PatternDatabaseUtils.getUserPatterns(userId, 'sequential');
    
    const sequentialPatterns: SequentialPattern[] = patterns.map(pattern => ({
      sequence: pattern.pattern_data.sequence,
      support: pattern.pattern_data.support,
      confidence: pattern.confidence,
      avgGapTime: pattern.pattern_data.avgGapTime,
      category: pattern.pattern_data.category
    }));
    
    const topSequences = sequentialPatterns
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 10);
    
    const dependencyGraph: Record<string, string[]> = {};
    const categoryWorkflows: Record<string, SequentialPattern[]> = {};
    
    for (const pattern of sequentialPatterns) {
      // Build dependency graph
      for (let i = 1; i < pattern.sequence.length; i++) {
        const dependent = pattern.sequence[i];
        const prerequisite = pattern.sequence[i - 1];
        
        if (!dependencyGraph[dependent]) {
          dependencyGraph[dependent] = [];
        }
        if (!dependencyGraph[dependent].includes(prerequisite)) {
          dependencyGraph[dependent].push(prerequisite);
        }
      }
      
      // Group by category
      if (!categoryWorkflows[pattern.category]) {
        categoryWorkflows[pattern.category] = [];
      }
      categoryWorkflows[pattern.category].push(pattern);
    }
    
    return {
      topSequences,
      dependencyGraph,
      categoryWorkflows
    };
  }
}

// Export singleton instance
export const sequentialPatternService = new SequentialPatternService();