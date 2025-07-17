import { useState, useEffect, useCallback } from 'react';
import { VoiceProcessor, TranscriptionResult } from '@/lib/services/voice/VoiceProcessor';
import { NLPProcessor, ParsedTask } from '@/lib/services/voice/NLPProcessor';
import { VoiceCommandManager } from '@/lib/services/voice/VoiceCommandManager';
import { TaskCreateInput } from '@/lib/types';

interface UseVoiceInputOptions {
  onTranscriptionComplete?: (result: TranscriptionResult) => void;
  onParsedTask?: (task: ParsedTask) => void;
  onError?: (error: Error) => void;
  onInterimTranscription?: (text: string, confidence: number) => void;
  autoStart?: boolean;
  useRealtimeTranscription?: boolean;
  noiseCancellation?: boolean;
  language?: string;
}

interface UseVoiceInputResult {
  isRecording: boolean;
  isProcessing: boolean;
  transcription: TranscriptionResult | null;
  parsedTask: ParsedTask | null;
  taskInput: TaskCreateInput | null;
  error: Error | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  cancelRecording: () => void;
  resetState: () => void;
  accuracy: {
    totalCommands: number;
    averageConfidence: number;
    successRate: number;
  } | null;
}

export default function useVoiceInput(options: UseVoiceInputOptions = {}): UseVoiceInputResult {
  const [voiceProcessor, setVoiceProcessor] = useState<VoiceProcessor | null>(null);
  const [commandManager, setCommandManager] = useState<VoiceCommandManager | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcription, setTranscription] = useState<TranscriptionResult | null>(null);
  const [parsedTask, setParsedTask] = useState<ParsedTask | null>(null);
  const [taskInput, setTaskInput] = useState<TaskCreateInput | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [accuracy, setAccuracy] = useState<{
    totalCommands: number;
    averageConfidence: number;
    successRate: number;
  } | null>(null);

  // Initialize voice processor and command manager
  useEffect(() => {
    const processor = new VoiceProcessor({
      onTranscriptionComplete: handleTranscriptionComplete,
      onInterimTranscription: options.onInterimTranscription,
      onError: handleError,
      useRealtimeTranscription: options.useRealtimeTranscription || false,
      noiseCancellation: options.noiseCancellation !== false, // Default to true
      language: options.language || 'en-US',
    });
    
    const manager = new VoiceCommandManager();
    
    setVoiceProcessor(processor);
    setCommandManager(manager);
    
    // Load accuracy stats
    loadAccuracyStats(manager);
    
    return () => {
      if (processor) {
        processor.cleanup();
      }
    };
  }, [options.useRealtimeTranscription, options.language, options.noiseCancellation]);

  // Auto-start recording if requested
  useEffect(() => {
    if (options.autoStart && voiceProcessor) {
      startRecording();
    }
  }, [voiceProcessor, options.autoStart]);

  const loadAccuracyStats = async (manager: VoiceCommandManager) => {
    try {
      const stats = await manager.getAccuracyStats();
      setAccuracy(stats);
    } catch (error) {
      console.error('Failed to load accuracy stats:', error);
    }
  };

  const handleTranscriptionComplete = useCallback(
    async (result: TranscriptionResult) => {
      setTranscription(result);
      setIsProcessing(true);
      
      options.onTranscriptionComplete?.(result);
      
      try {
        if (voiceProcessor) {
          const parsed = await voiceProcessor.processTranscription(result.text);
          setParsedTask(parsed);
          
          // Convert to TaskCreateInput
          const nlpProcessor = new NLPProcessor();
          const taskInput = nlpProcessor.toTaskCreateInput(parsed);
          setTaskInput(taskInput);
          
          options.onParsedTask?.(parsed);
          
          // Store in command history
          if (commandManager) {
            await commandManager.storeVoiceCommand(result, parsed);
            await loadAccuracyStats(commandManager);
          }
        }
      } catch (err) {
        handleError(err as Error);
      } finally {
        setIsProcessing(false);
      }
    },
    [voiceProcessor, commandManager, options]
  );

  const handleError = useCallback(
    (err: Error) => {
      setError(err);
      setIsRecording(false);
      setIsProcessing(false);
      options.onError?.(err);
    },
    [options]
  );

  const startRecording = async () => {
    if (!voiceProcessor) {
      handleError(new Error('Voice processor not initialized'));
      return;
    }
    
    setError(null);
    setTranscription(null);
    setParsedTask(null);
    setTaskInput(null);
    
    try {
      const success = await voiceProcessor.startRecording();
      if (success) {
        setIsRecording(true);
      } else {
        handleError(new Error('Failed to start recording'));
      }
    } catch (err) {
      handleError(err as Error);
    }
  };

  const stopRecording = async () => {
    if (!voiceProcessor || !isRecording) {
      return;
    }
    
    try {
      setIsRecording(false);
      setIsProcessing(true);
      
      const audioUri = await voiceProcessor.stopRecording();
      if (audioUri) {
        await voiceProcessor.transcribeAudio(audioUri);
      } else {
        handleError(new Error('No audio recorded'));
      }
    } catch (err) {
      handleError(err as Error);
    }
  };

  const cancelRecording = () => {
    if (voiceProcessor) {
      voiceProcessor.cleanup();
    }
    
    setIsRecording(false);
    setIsProcessing(false);
    setTranscription(null);
    setParsedTask(null);
    setTaskInput(null);
    setError(null);
  };

  const resetState = () => {
    setTranscription(null);
    setParsedTask(null);
    setTaskInput(null);
    setError(null);
  };

  return {
    isRecording,
    isProcessing,
    transcription,
    parsedTask,
    taskInput,
    error,
    startRecording,
    stopRecording,
    cancelRecording,
    resetState,
    accuracy,
  };
}