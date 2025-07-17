import { Audio } from 'expo-av';
import { EventEmitter } from 'events';
import { TranscriptionResult } from './VoiceProcessor';

/**
 * Interface for real-time transcription events
 */
export interface TranscriptionUpdate {
  partialText: string;
  isFinal: boolean;
  confidence?: number;
}

/**
 * RealTimeTranscriptionManager handles streaming audio for real-time
 * speech-to-text conversion with interim results.
 */
export class RealTimeTranscriptionManager extends EventEmitter {
  private isListening: boolean = false;
  private recording: Audio.Recording | null = null;
  private language: string;
  private interimResults: TranscriptionUpdate[] = [];
  private finalResult: TranscriptionResult | null = null;
  private startTime: number = 0;
  
  constructor(options: { language?: string } = {}) {
    super();
    this.language = options.language || 'en-US';
  }
  
  /**
   * Start real-time transcription
   */
  public async startListening(): Promise<boolean> {
    if (this.isListening) {
      return true;
    }
    
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
      
      // Create recording object
      this.recording = new Audio.Recording();
      
      // Prepare recording with options optimized for speech
      await this.recording.prepareToRecordAsync({
        android: {
          extension: '.m4a',
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 16000, // 16kHz is good for speech
          numberOfChannels: 1, // Mono for speech
          bitRate: 64000, // Lower bitrate for speech
        },
        ios: {
          extension: '.m4a',
          outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
          audioQuality: Audio.IOSAudioQuality.MEDIUM, // Medium quality is sufficient for speech
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 64000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
      });
      
      // Start recording
      await this.recording.startAsync();
      this.isListening = true;
      this.startTime = Date.now();
      this.interimResults = [];
      this.finalResult = null;
      
      // Start simulating interim results
      // In a real implementation, this would connect to a streaming speech-to-text API
      this.simulateInterimResults();
      
      return true;
    } catch (error) {
      console.error('Failed to start real-time transcription:', error);
      return false;
    }
  }
  
  /**
   * Stop real-time transcription and get final result
   */
  public async stopListening(): Promise<TranscriptionResult | null> {
    if (!this.isListening || !this.recording) {
      return null;
    }
    
    try {
      // Stop recording
      await this.recording.stopAndUnloadAsync();
      const audioUri = this.recording.getURI();
      this.recording = null;
      this.isListening = false;
      
      // Calculate duration
      const duration = (Date.now() - this.startTime) / 1000;
      
      // In a real implementation, we would get the final transcription from the API
      // For this demo, we'll use the last interim result as the final result
      const lastInterim = this.interimResults[this.interimResults.length - 1];
      
      if (lastInterim) {
        this.finalResult = {
          text: lastInterim.partialText,
          confidence: lastInterim.confidence || 0.9,
          alternatives: this.generateAlternatives(lastInterim.partialText),
          language: this.language,
          duration,
        };
        
        // Emit final result
        this.emit('finalResult', this.finalResult);
        
        return this.finalResult;
      }
      
      return null;
    } catch (error) {
      console.error('Failed to stop real-time transcription:', error);
      this.isListening = false;
      return null;
    }
  }
  
  /**
   * Check if currently listening
   */
  public isCurrentlyListening(): boolean {
    return this.isListening;
  }
  
  /**
   * Get the current interim result
   */
  public getCurrentInterimResult(): TranscriptionUpdate | null {
    if (this.interimResults.length === 0) {
      return null;
    }
    return this.interimResults[this.interimResults.length - 1];
  }
  
  /**
   * Simulate interim results for demo purposes
   * In a real implementation, this would receive streaming results from an API
   */
  private simulateInterimResults(): void {
    if (!this.isListening) {
      return;
    }
    
    // Simulate the gradual building of a transcription
    const phrases = [
      { text: "Re", confidence: 0.5, time: 300 },
      { text: "Remind", confidence: 0.6, time: 500 },
      { text: "Remind me", confidence: 0.7, time: 700 },
      { text: "Remind me to", confidence: 0.75, time: 900 },
      { text: "Remind me to buy", confidence: 0.8, time: 1100 },
      { text: "Remind me to buy groceries", confidence: 0.85, time: 1300 },
      { text: "Remind me to buy groceries tomorrow", confidence: 0.9, time: 1500 },
      { text: "Remind me to buy groceries tomorrow at", confidence: 0.9, time: 1700 },
      { text: "Remind me to buy groceries tomorrow at 5", confidence: 0.92, time: 1900 },
      { text: "Remind me to buy groceries tomorrow at 5pm", confidence: 0.95, time: 2100 },
    ];
    
    let currentIndex = 0;
    
    const emitNextResult = () => {
      if (!this.isListening || currentIndex >= phrases.length) {
        return;
      }
      
      const current = phrases[currentIndex];
      const update: TranscriptionUpdate = {
        partialText: current.text,
        isFinal: currentIndex === phrases.length - 1,
        confidence: current.confidence,
      };
      
      // Add to interim results
      this.interimResults.push(update);
      
      // Emit the update event
      this.emit('interimResult', update);
      
      // Schedule next update
      currentIndex++;
      if (currentIndex < phrases.length) {
        setTimeout(emitNextResult, phrases[currentIndex].time - phrases[currentIndex - 1].time);
      }
    };
    
    // Start the simulation
    setTimeout(emitNextResult, phrases[0].time);
  }
  
  /**
   * Generate alternative transcriptions for the final result
   */
  private generateAlternatives(text: string): string[] {
    // In a real implementation, these would come from the speech-to-text API
    // For this demo, we'll generate some simple alternatives
    
    const alternatives = [text];
    
    // Add some variations
    if (text.includes('tomorrow')) {
      alternatives.push(text.replace('tomorrow', 'today'));
    }
    
    if (text.includes('5pm')) {
      alternatives.push(text.replace('5pm', '5'));
      alternatives.push(text.replace('5pm', 'five pm'));
    }
    
    if (text.includes('groceries')) {
      alternatives.push(text.replace('groceries', 'grocery'));
    }
    
    // Return unique alternatives
    return [...new Set(alternatives)];
  }
  
  /**
   * Clean up resources
   */
  public async cleanup(): Promise<void> {
    if (this.recording) {
      try {
        await this.recording.stopAndUnloadAsync();
      } catch (error) {
        // Ignore errors during cleanup
      }
      this.recording = null;
    }
    this.isListening = false;
    this.removeAllListeners();
  }
}