import * as Speech from 'expo-speech';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import { Audio } from 'expo-av';
import * as ExpoSpeech from 'expo-speech';
import { TranscriptionResult } from './VoiceProcessor';
import { AudioProcessor } from './AudioProcessor';
import { RealTimeTranscriptionManager, TranscriptionUpdate } from './RealTimeTranscriptionManager';

// Import platform-specific modules conditionally
let SpeechRecognition: any = null;
if (Platform.OS === 'web') {
  // Web Speech API
  SpeechRecognition = (window as any).SpeechRecognition || 
                      (window as any).webkitSpeechRecognition ||
                      null;
}

/**
 * SpeechRecognitionService provides cross-platform speech-to-text functionality
 * with fallback options and confidence scoring.
 */
export class SpeechRecognitionService {
  private language: string;
  private useLocalProcessing: boolean;
  private realTimeManager: RealTimeTranscriptionManager | null = null;
  private onInterimResultCallback: ((result: TranscriptionUpdate) => void) | null = null;
  private recognitionEngine: 'native' | 'web' | 'expo' | 'mock' = 'mock';
  private accuracyMonitor: AccuracyMonitor;
  
  constructor(options: {
    language?: string;
    useLocalProcessing?: boolean;
  } = {}) {
    this.language = options.language || 'en-US';
    this.useLocalProcessing = options.useLocalProcessing || false;
    this.accuracyMonitor = new AccuracyMonitor();
    
    // Determine the best available recognition engine
    this.detectRecognitionEngine();
  }
  
  /**
   * Detect the best available speech recognition engine
   */
  private async detectRecognitionEngine(): Promise<void> {
    try {
      // Check for native platform support first
      if (Platform.OS === 'ios') {
        // Check for iOS Speech framework availability
        // This is a placeholder - in a real app we would check via native module
        this.recognitionEngine = 'native';
      } else if (Platform.OS === 'android') {
        // Check for Android SpeechRecognizer availability
        // This is a placeholder - in a real app we would check via native module
        this.recognitionEngine = 'native';
      } else if (Platform.OS === 'web' && SpeechRecognition) {
        // Web Speech API is available
        this.recognitionEngine = 'web';
      } else if (await ExpoSpeech.isSpeechAvailableAsync()) {
        // Expo Speech is available as fallback
        this.recognitionEngine = 'expo';
      } else {
        // No recognition engine available, use mock
        this.recognitionEngine = 'mock';
      }
      
      console.log(`Using speech recognition engine: ${this.recognitionEngine}`);
      
      // Override with local processing if specified
      if (this.useLocalProcessing) {
        console.log('Using local processing for speech recognition');
      }
    } catch (error) {
      console.error('Error detecting speech recognition engine:', error);
      this.recognitionEngine = 'mock';
    }
  }
  
  /**
   * Transcribe audio file to text
   */
  public async transcribeAudio(audioUri: string): Promise<TranscriptionResult> {
    try {
      // Apply audio preprocessing for better quality
      const processedAudioUri = await this.preprocessAudio(audioUri);
      
      // Check if we should use local processing
      if (this.useLocalProcessing) {
        return await this.localTranscription(processedAudioUri);
      }
      
      // Try platform-specific APIs first
      try {
        if (this.recognitionEngine === 'native') {
          if (Platform.OS === 'ios') {
            return await this.iosTranscription(processedAudioUri);
          } else if (Platform.OS === 'android') {
            return await this.androidTranscription(processedAudioUri);
          }
        } else if (this.recognitionEngine === 'web') {
          return await this.webTranscription(processedAudioUri);
        } else if (this.recognitionEngine === 'expo') {
          return await this.expoTranscription(processedAudioUri);
        }
      } catch (error) {
        console.warn(`${this.recognitionEngine} transcription failed, falling back to mock:`, error);
      }
      
      // Fall back to mock implementation
      return await this.mockTranscription(processedAudioUri);
    } catch (error) {
      console.error('Transcription failed:', error);
      throw new Error('Failed to transcribe audio');
    }
  }
  
  /**
   * Preprocess audio for better quality and noise reduction
   */
  private async preprocessAudio(audioUri: string): Promise<string> {
    try {
      // Apply noise reduction
      let processedUri = await AudioProcessor.applyNoiseReduction(audioUri, {
        intensity: 0.7,
        preserveSpeech: true
      });
      
      // Enhance audio quality
      processedUri = await AudioProcessor.enhanceAudioQuality(processedUri, {
        clarity: 0.8,
        volumeBoost: 0.5
      });
      
      return processedUri;
    } catch (error) {
      console.error('Audio preprocessing failed:', error);
      // Return original audio if preprocessing fails
      return audioUri;
    }
  }
  
  /**
   * iOS-specific speech recognition using Speech framework
   */
  private async iosTranscription(audioUri: string): Promise<TranscriptionResult> {
    // In a real implementation, this would use the native Speech framework via native modules
    // For now, we'll implement a more realistic simulation of iOS speech recognition
    
    try {
      // Simulate iOS speech recognition with multiple alternatives and confidence scores
      const fileInfo = await FileSystem.getInfoAsync(audioUri);
      const fileSizeInMB = fileInfo.size ? fileInfo.size / (1024 * 1024) : 0;
      
      // Simulate processing time based on file size
      const processingTime = Math.min(fileSizeInMB * 400, 1500); // iOS is typically faster
      await new Promise(resolve => setTimeout(resolve, processingTime));
      
      // Get audio info for duration
      const audioInfo = await AudioProcessor.getAudioInfo(audioUri);
      
      // Generate realistic alternatives with varying confidence
      const alternatives = [
        "Remind me to buy groceries tomorrow at 5pm",
        "Remind me to buy groceries tomorrow at 5",
        "Remind me to buy grocery tomorrow at 5pm",
        "Remind me to buy groceries to morrow at 5pm"
      ];
      
      // iOS typically has high accuracy
      const confidence = 0.94;
      
      // Track this transcription for accuracy monitoring
      this.accuracyMonitor.trackTranscription(alternatives[0], confidence);
      
      return {
        text: alternatives[0],
        confidence,
        alternatives,
        language: this.language,
        duration: audioInfo.duration
      };
    } catch (error) {
      console.error('iOS transcription failed:', error);
      throw error;
    }
  }
  
  /**
   * Android-specific speech recognition using SpeechRecognizer API
   */
  private async androidTranscription(audioUri: string): Promise<TranscriptionResult> {
    // In a real implementation, this would use the SpeechRecognizer API via native modules
    // For now, we'll implement a more realistic simulation of Android speech recognition
    
    try {
      // Simulate Android speech recognition with multiple alternatives and confidence scores
      const fileInfo = await FileSystem.getInfoAsync(audioUri);
      const fileSizeInMB = fileInfo.size ? fileInfo.size / (1024 * 1024) : 0;
      
      // Simulate processing time based on file size
      const processingTime = Math.min(fileSizeInMB * 450, 1800); // Android can be slightly slower
      await new Promise(resolve => setTimeout(resolve, processingTime));
      
      // Get audio info for duration
      const audioInfo = await AudioProcessor.getAudioInfo(audioUri);
      
      // Generate realistic alternatives with varying confidence
      const alternatives = [
        "Remind me to buy groceries tomorrow at 5pm",
        "Remind me to buy groceries tomorrow at 5",
        "Remind me to buy grocery tomorrow at 5pm",
        "Remind me to buy groceries tomorrow at five pm"
      ];
      
      // Android typically has good accuracy but slightly lower than iOS
      const confidence = 0.91;
      
      // Track this transcription for accuracy monitoring
      this.accuracyMonitor.trackTranscription(alternatives[0], confidence);
      
      return {
        text: alternatives[0],
        confidence,
        alternatives,
        language: this.language,
        duration: audioInfo.duration
      };
    } catch (error) {
      console.error('Android transcription failed:', error);
      throw error;
    }
  }
  
  /**
   * Web-specific speech recognition using Web Speech API
   */
  private async webTranscription(audioUri: string): Promise<TranscriptionResult> {
    // In a real implementation, this would use the Web Speech API
    // For now, we'll implement a simulation of web speech recognition
    
    try {
      // Simulate web speech recognition
      const fileInfo = await FileSystem.getInfoAsync(audioUri);
      const fileSizeInMB = fileInfo.size ? fileInfo.size / (1024 * 1024) : 0;
      
      // Simulate processing time based on file size
      const processingTime = Math.min(fileSizeInMB * 500, 2000);
      await new Promise(resolve => setTimeout(resolve, processingTime));
      
      // Get audio info for duration
      const audioInfo = await AudioProcessor.getAudioInfo(audioUri);
      
      // Generate realistic alternatives with varying confidence
      const alternatives = [
        "Remind me to buy groceries tomorrow at 5pm",
        "Remind me to buy groceries tomorrow at 5",
        "Remind me to buy grocery tomorrow at 5pm"
      ];
      
      // Web Speech API typically has moderate accuracy
      const confidence = 0.88;
      
      // Track this transcription for accuracy monitoring
      this.accuracyMonitor.trackTranscription(alternatives[0], confidence);
      
      return {
        text: alternatives[0],
        confidence,
        alternatives,
        language: this.language,
        duration: audioInfo.duration
      };
    } catch (error) {
      console.error('Web transcription failed:', error);
      throw error;
    }
  }
  
  /**
   * Expo-specific speech recognition using Expo Speech
   */
  private async expoTranscription(audioUri: string): Promise<TranscriptionResult> {
    // Expo doesn't have direct speech-to-text, but we can simulate it
    // In a real app, we might use a cloud service or native module
    
    try {
      // Simulate Expo-based speech recognition
      const fileInfo = await FileSystem.getInfoAsync(audioUri);
      const fileSizeInMB = fileInfo.size ? fileInfo.size / (1024 * 1024) : 0;
      
      // Simulate processing time based on file size
      const processingTime = Math.min(fileSizeInMB * 600, 2500); // Expo might be slower
      await new Promise(resolve => setTimeout(resolve, processingTime));
      
      // Get audio info for duration
      const audioInfo = await AudioProcessor.getAudioInfo(audioUri);
      
      // Generate realistic alternatives with varying confidence
      const alternatives = [
        "Remind me to buy groceries tomorrow at 5pm",
        "Remind me to buy groceries tomorrow at 5"
      ];
      
      // Expo-based solution might have lower accuracy
      const confidence = 0.85;
      
      // Track this transcription for accuracy monitoring
      this.accuracyMonitor.trackTranscription(alternatives[0], confidence);
      
      return {
        text: alternatives[0],
        confidence,
        alternatives,
        language: this.language,
        duration: audioInfo.duration
      };
    } catch (error) {
      console.error('Expo transcription failed:', error);
      throw error;
    }
  }
  
  /**
   * Local transcription using lightweight models
   */
  private async localTranscription(audioUri: string): Promise<TranscriptionResult> {
    // In a real implementation, this would use a local speech-to-text model
    // For now, we'll simulate local processing with lower accuracy
    
    try {
      // Simulate local model processing
      const fileInfo = await FileSystem.getInfoAsync(audioUri);
      const fileSizeInMB = fileInfo.size ? fileInfo.size / (1024 * 1024) : 0;
      
      // Local processing might be faster but less accurate
      const processingTime = Math.min(fileSizeInMB * 300, 1200);
      await new Promise(resolve => setTimeout(resolve, processingTime));
      
      // Get audio info for duration
      const audioInfo = await AudioProcessor.getAudioInfo(audioUri);
      
      // Generate realistic alternatives with varying confidence
      const alternatives = [
        "Remind me to buy groceries tomorrow at 5pm",
        "Remind me to buy groceries tomorrow at 5"
      ];
      
      // Local models typically have lower accuracy
      const confidence = 0.78;
      
      // Track this transcription for accuracy monitoring
      this.accuracyMonitor.trackTranscription(alternatives[0], confidence);
      
      return {
        text: alternatives[0],
        confidence,
        alternatives,
        language: this.language,
        duration: audioInfo.duration
      };
    } catch (error) {
      console.error('Local transcription failed:', error);
      throw error;
    }
  }
  
  /**
   * Mock implementation for demo purposes
   */
  private async mockTranscription(audioUri: string): Promise<TranscriptionResult> {
    // Simulate processing time based on file size
    const fileInfo = await FileSystem.getInfoAsync(audioUri);
    const fileSizeInMB = fileInfo.size ? fileInfo.size / (1024 * 1024) : 0;
    const processingTime = Math.min(fileSizeInMB * 500, 2000); // Max 2 seconds
    
    await new Promise(resolve => setTimeout(resolve, processingTime));
    
    // Generate mock alternatives with varying confidence
    const mockAlternatives = [
      "Remind me to buy groceries tomorrow at 5pm"