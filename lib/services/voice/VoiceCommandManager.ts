import { VoiceCommand, VoiceTranscription } from '@/lib/types';
import { NLPProcessor, ParsedTask } from './NLPProcessor';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';

const VOICE_COMMANDS_STORAGE_KEY = 'voice_commands_history';
const VOICE_COMMANDS_MAX_HISTORY = 50;

/**
 * VoiceCommandManager handles storing, retrieving, and analyzing voice command history
 * to improve transcription accuracy and task parsing over time.
 */
export class VoiceCommandManager {
  private nlpProcessor: NLPProcessor;
  
  constructor() {
    this.nlpProcessor = new NLPProcessor();
  }
  
  /**
   * Store a new voice command in history
   */
  public async storeVoiceCommand(
    transcription: VoiceTranscription, 
    parsedTask: ParsedTask,
    taskId?: string
  ): Promise<VoiceCommand> {
    try {
      const command: VoiceCommand = {
        id: this.generateId(),
        user_id: 'current_user', // In a real app, get from auth context
        transcription: transcription.text,
        parsed_intent: parsedTask.isCompleted ? 'complete_task' : 'create_task',
        confidence: transcription.confidence,
        created_at: new Date().toISOString(),
        task_id: taskId,
      };
      
      // Get existing commands
      const existingCommands = await this.getVoiceCommandHistory();
      
      // Add new command to the beginning
      existingCommands.unshift(command);
      
      // Limit history size
      if (existingCommands.length > VOICE_COMMANDS_MAX_HISTORY) {
        existingCommands.length = VOICE_COMMANDS_MAX_HISTORY;
      }
      
      // Save updated history
      await AsyncStorage.setItem(
        VOICE_COMMANDS_STORAGE_KEY, 
        JSON.stringify(existingCommands)
      );
      
      return command;
    } catch (error) {
      console.error('Failed to store voice command:', error);
      throw new Error('Failed to store voice command');
    }
  }
  
  /**
   * Get voice command history
   */
  public async getVoiceCommandHistory(): Promise<VoiceCommand[]> {
    try {
      const history = await AsyncStorage.getItem(VOICE_COMMANDS_STORAGE_KEY);
      return history ? JSON.parse(history) : [];
    } catch (error) {
      console.error('Failed to get voice command history:', error);
      return [];
    }
  }
  
  /**
   * Clear voice command history
   */
  public async clearVoiceCommandHistory(): Promise<void> {
    try {
      await AsyncStorage.removeItem(VOICE_COMMANDS_STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear voice command history:', error);
      throw new Error('Failed to clear voice command history');
    }
  }
  
  /**
   * Get voice command accuracy statistics
   */
  public async getAccuracyStats(): Promise<{
    totalCommands: number;
    averageConfidence: number;
    successRate: number;
  }> {
    try {
      const commands = await this.getVoiceCommandHistory();
      
      if (commands.length === 0) {
        return {
          totalCommands: 0,
          averageConfidence: 0,
          successRate: 0,
        };
      }
      
      // Calculate average confidence
      const totalConfidence = commands.reduce(
        (sum, command) => sum + command.confidence, 
        0
      );
      
      // Count successful commands (those that resulted in a task)
      const successfulCommands = commands.filter(
        command => !!command.task_id
      ).length;
      
      return {
        totalCommands: commands.length,
        averageConfidence: totalConfidence / commands.length,
        successRate: successfulCommands / commands.length,
      };
    } catch (error) {
      console.error('Failed to get accuracy stats:', error);
      throw new Error('Failed to get accuracy stats');
    }
  }
  
  /**
   * Get common phrases and patterns from voice command history
   */
  public async getCommonPhrases(): Promise<{
    phrase: string;
    frequency: number;
    category?: string;
  }[]> {
    try {
      const commands = await this.getVoiceCommandHistory();
      
      if (commands.length < 5) {
        return [];
      }
      
      // Simple phrase extraction - in a real app, this would be more sophisticated
      const phrases: Record<string, { count: number; category?: string }> = {};
      
      commands.forEach(command => {
        // Split by common separators
        const parts = command.transcription
          .toLowerCase()
          .split(/\s+(?:to|and|then|at|on|by|for)\s+/);
        
        parts.forEach(part => {
          if (part.length > 5) {
            if (!phrases[part]) {
              phrases[part] = { count: 0 };
            }
            phrases[part].count++;
          }
        });
      });
      
      // Convert to array and sort by frequency
      return Object.entries(phrases)
        .map(([phrase, data]) => ({
          phrase,
          frequency: data.count,
          category: data.category,
        }))
        .filter(item => item.frequency > 1)
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 10);
    } catch (error) {
      console.error('Failed to get common phrases:', error);
      return [];
    }
  }
  
  /**
   * Provide feedback on voice command accuracy
   */
  public async provideFeedback(
    commandId: string, 
    isAccurate: boolean, 
    correctedText?: string
  ): Promise<void> {
    try {
      const commands = await this.getVoiceCommandHistory();
      const commandIndex = commands.findIndex(cmd => cmd.id === commandId);
      
      if (commandIndex === -1) {
        throw new Error('Command not found');
      }
      
      // In a real app, this feedback would be used to improve the model
      // For now, we'll just update the command with the corrected text if provided
      if (correctedText && !isAccurate) {
        commands[commandIndex].transcription = correctedText;
        await AsyncStorage.setItem(
          VOICE_COMMANDS_STORAGE_KEY, 
          JSON.stringify(commands)
        );
      }
      
      // In a real app, we would send this feedback to a server for model improvement
    } catch (error) {
      console.error('Failed to provide feedback:', error);
      throw new Error('Failed to provide feedback');
    }
  }
  
  /**
   * Generate a unique ID for a voice command
   */
  private generateId(): string {
    return 'vc_' + Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }
}