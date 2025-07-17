import * as FileSystem from 'expo-file-system';
import { Audio } from 'expo-av';
import { NLPProcessor, ParsedTask } from './NLPProcessor';
import { AudioProcessor } from './AudioProcessor';
import { VoiceModelManager } from './VoiceModelManager';
import { SpeechRecognitionService } from './SpeechRecognitionService';
import { VoiceTranscription } from '@/lib/types';

export interface TranscriptionResult {
  text: string;
  confidence: number;
  alternatives: string[];
  language: string;
  duration: number;
}

export interface VoiceProcessorOptions {
  onTranscriptionComplete?: (result: TranscriptionResult) => void;
  onInterimTranscription?: (text: string, confidence: number) => void;
  onError?: (error: Error) => void;
  quality?: Audio.RecordingOptionsPresets;
  language?: string;
  noiseCancellation?: boolean;
  useRealtimeTranscription?: boolean;
}

/**
 * VoiceProcessor handles audio recording, speech-to-text conversion,
 * and natural language processing for voice commands.
 */
export class VoiceProcessor {
  private recording: Audio.Recording | null = null;
  private audioUri: string | null = null;
  private options: VoiceProcessorOptions;
  private nlpProcessor: NLPProcessor;
  private speechRecognitionService: SpeechRecognitionService;
  private voiceModelManager: VoiceModelManager | null = null;
  private recordingStartTime: number = 0;
  private isInitialized: boolean = false;

  constructor(options: VoiceProcessorOptions = {}) {
    this.options = {
      quality: Audio.RecordingOptionsPresets.HIGH_QUALITY,
      language: 'en-US',
      noiseCancellation: true,
      ...options
    };
    this.nlpProcessor = new NLPProcessor();
    this.speechRecognitionService = new SpeechRecognitionService({
      language: this.options.language,
      useLocalProcessing: false // Default to cloud processing for better accuracy
    });
    
    // Initialize voice model manager with a default user ID
    // In a real app, this would use the authenticated user's ID
    this.initializeVoiceModelManager('current_user');
  }
  
  /**
   * Initialize voice model manager
   */
  private async initializeVoiceModelManager(userId: string): Promise<void> {
    try {
      this.voiceModelManager = new VoiceModelManager(userId);
      await this.voiceModelManager.initialize();
    } catch (error) {
      console.error('Failed to initialize voice model manager:', error);
    }
  }

  /**
   * Initialize audio recording permissions and settings
   */
  private async initialize(): Promise<boolean> {
    try {
      // Request permissions
      const permissionResponse = await Audio.requestPermissionsAsync();
      if (!permissionResponse.granted) {
        throw new Error('Audio recording permission not granted');
      }

      // Set audio mode for recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });

      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize audio recording:', error);
      this.handleError(error as Error);
      return false;
    }
  }

  /**
   * Start recording audio
   */
  public async startRecording(): Promise<boolean> {
    try {
      // Initialize if not already done
      if (!this.isInitialized) {
        const initialized = await this.initialize();
        if (!initialized) return false;
      }

      // If using real-time transcription, use the speech recognition service
      if (this.options.useRealtimeTranscription) {
        return await this.speechRecognitionService.startRealtimeTranscription(
          (interimResult) => {
            // Forward interim results to the callback if provided
            if (this.options.onInterimTranscription) {
              this.options.onInterimTranscription(
                interimResult.partialText,
                interimResult.confidence || 0.5
              );
            }
          }
        );
      }

      // Otherwise, use standard recording
      this.recording = new Audio.Recording();

      // Prepare recording with options
      const recordingOptions: Audio.RecordingOptions = {
        ...(this.options.quality as Audio.RecordingOptions),
        android: {
          ...(this.options.quality as Audio.RecordingOptions).android,
          extension: '.m4a',
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
        },
        ios: {
          ...(this.options.quality as Audio.RecordingOptions).ios,
          extension: '.m4a',
          outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
      };

      await this.recording.prepareToRecordAsync(recordingOptions);
      
      // Start recording
      await this.recording.startAsync();
      this.recordingStartTime = Date.now();
      
      return true;
    } catch (error) {
      console.error('Failed to start recording:', error);
      this.handleError(error as Error);
      return false;
    }
  }

  /**
   * Stop recording and return the audio URI
   */
  public async stopRecording(): Promise<string | null> {
    try {
      // If using real-time transcription, stop it and get the final result
      if (this.options.useRealtimeTranscription) {
        const result = await this.speechRecognitionService.stopRealtimeTranscription();
        
        if (result) {
          // Call the onTranscriptionComplete callback if provided
          this.options.onTranscriptionComplete?.(result);
          
          // Return a dummy URI since we don't have an actual file
          // In a real implementation, we might want to save the audio for verification
          return 'realtime-transcription';
        }
        
        return null;
      }
      
      // Otherwise, handle standard recording
      if (!this.recording) {
        throw new Error('No active recording');
      }

      // Stop recording
      await this.recording.stopAndUnloadAsync();
      
      // Get recording URI
      const uri = this.recording.getURI();
      if (!uri) {
        throw new Error('Failed to get recording URI');
      }
      
      this.audioUri = uri;
      this.recording = null;
      
      return uri;
    } catch (error) {
      console.error('Failed to stop recording:', error);
      this.handleError(error as Error);
      return null;
    }
  }

  /**
   * Transcribe recorded audio to text
   */
  public async transcribeAudio(audioUri: string): Promise<TranscriptionResult> {
    try {
      // Process audio for better quality if noise cancellation is enabled
      let processedAudioUri = audioUri;
      if (this.options.noiseCancellation) {
        // Apply noise reduction
        processedAudioUri = await AudioProcessor.applyNoiseReduction(audioUri, {
          intensity: 0.7,
          preserveSpeech: true
        });
        
        // Enhance audio quality
        processedAudioUri = await AudioProcessor.enhanceAudioQuality(processedAudioUri, {
          clarity: 0.8,
          volumeBoost: 0.4
        });
      }
      
      // Get audio information for accurate duration
      const audioInfo = await AudioProcessor.getAudioInfo(processedAudioUri);
      
      // Check if audio contains speech
      const speechDetection = await AudioProcessor.detectSpeech(processedAudioUri);
      if (!speechDetection.hasSpeech) {
        throw new Error('No speech detected in recording');
      }
      
      // Use speech recognition service to transcribe audio
      const transcriptionResult = await this.speechRecognitionService.transcribeAudio(processedAudioUri);
      
      // Adjust confidence based on speech detection
      transcriptionResult.confidence *= speechDetection.confidence;
      
      // Clean up processed audio if it's different from the original
      if (processedAudioUri !== audioUri) {
        const fileInfo = await FileSystem.getInfoAsync(processedAudioUri);
        if (fileInfo.exists) {
          await FileSystem.deleteAsync(processedAudioUri);
        }
      }
      
      // Call the onTranscriptionComplete callback if provided
      this.options.onTranscriptionComplete?.(transcriptionResult);
      
      return transcriptionResult;
    } catch (error) {
      console.error('Failed to transcribe audio:', error);
      this.handleError(error as Error);
      throw error;
    }
  }

  /**
   * Process transcription with NLP
   */
  public async processTranscription(text: string): Promise<ParsedTask> {
    try {
      return await this.nlpProcessor.parseText(text);
    } catch (error) {
      console.error('Failed to process transcription:', error);
      this.handleError(error as Error);
      throw error;
    }
  }

  /**
   * Clean up resources
   */
  public async cleanup(): Promise<void> {
    try {
      if (this.recording) {
        await this.recording.stopAndUnloadAsync();
        this.recording = null;
      }
      
      if (this.audioUri) {
        const fileInfo = await FileSystem.getInfoAsync(this.audioUri);
        if (fileInfo.exists) {
          await FileSystem.deleteAsync(this.audioUri);
        }
        this.audioUri = null;
      }
    } catch (error) {
      console.error('Failed to clean up:', error);
    }
  }

  /**
   * Handle errors
   */
  private handleError(error: Error): void {
    console.error('VoiceProcessor error:', error);
    this.options.onError?.(error);
  }

  /**
   * Get available languages for speech recognition
   */
  public async getAvailableLanguages(): Promise<string[]> {
    return await this.speechRecognitionService.getAvailableLanguages();
  }
  
  /**
   * Check if speech recognition is available on this device
   */
  public async isSpeechRecognitionAvailable(): Promise<boolean> {
    return await this.speechRecognitionService.isAvailable();
  }
}