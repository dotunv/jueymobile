import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { Audio } from 'expo-av';
import { AudioProcessor } from '@/lib/services/voice/AudioProcessor';
import VoiceInputControls from './VoiceInputControls';
import Button from './ui/Button';
import { Volume2, VolumeX } from 'lucide-react-native';

/**
 * Component to demonstrate audio quality enhancement and noise reduction
 */
export default function AudioQualityDemo() {
  const { theme } = useTheme();
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [durationTimer, setDurationTimer] = useState<NodeJS.Timeout | null>(null);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [originalAudioUri, setOriginalAudioUri] = useState<string | null>(null);
  const [enhancedAudioUri, setEnhancedAudioUri] = useState<string | null>(null);
  const [originalSound, setOriginalSound] = useState<Audio.Sound | null>(null);
  const [enhancedSound, setEnhancedSound] = useState<Audio.Sound | null>(null);
  const [isPlayingOriginal, setIsPlayingOriginal] = useState(false);
  const [isPlayingEnhanced, setIsPlayingEnhanced] = useState(false);
  const [noiseReductionEnabled, setNoiseReductionEnabled] = useState(true);
  const [qualityEnhancementEnabled, setQualityEnhancementEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Clean up resources when component unmounts
  useEffect(() => {
    return () => {
      if (durationTimer) clearInterval(durationTimer);
      if (recording) recording.stopAndUnloadAsync();
      if (originalSound) originalSound.unloadAsync();
      if (enhancedSound) enhancedSound.unloadAsync();
    };
  }, []);

  // Start recording
  const handleStartRecording = async () => {
    try {
      setError(null);
      
      // Request permissions
      const permissionResponse = await Audio.requestPermissionsAsync();
      if (!permissionResponse.granted) {
        setError('Audio recording permission not granted');
        return;
      }

      // Set audio mode for recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });

      // Create recording object
      const newRecording = new Audio.Recording();
      
      // Prepare recording with options
      await newRecording.prepareToRecordAsync({
        android: {
          extension: '.m4a',
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
        },
        ios: {
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
      });
      
      // Start recording
      await newRecording.startAsync();
      setRecording(newRecording);
      setIsRecording(true);
      
      // Start duration timer
      setRecordingDuration(0);
      const timer = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
      setDurationTimer(timer);
      
    } catch (error) {
      console.error('Failed to start recording:', error);
      setError('Failed to start recording');
    }
  };

  // Stop recording and process audio
  const handleStopRecording = async () => {
    try {
      if (!recording) {
        setError('No active recording');
        return;
      }
      
      // Stop recording
      setIsRecording(false);
      setIsProcessing(true);
      
      // Clear duration timer
      if (durationTimer) {
        clearInterval(durationTimer);
        setDurationTimer(null);
      }
      
      // Stop and unload recording
      await recording.stopAndUnloadAsync();
      
      // Get recording URI
      const uri = recording.getURI();
      if (!uri) {
        setError('Failed to get recording URI');
        setIsProcessing(false);
        return;
      }
      
      // Store original audio URI
      setOriginalAudioUri(uri);
      
      // Process audio if enabled
      let processedUri = uri;
      
      if (noiseReductionEnabled) {
        processedUri = await AudioProcessor.applyNoiseReduction(processedUri, {
          intensity: 0.7,
          preserveSpeech: true
        });
      }
      
      if (qualityEnhancementEnabled) {
        processedUri = await AudioProcessor.enhanceAudioQuality(processedUri, {
          clarity: 0.8,
          volumeBoost: 0.4
        });
      }
      
      // Store enhanced audio URI
      setEnhancedAudioUri(processedUri);
      
      // Create sound objects for playback
      const original = new Audio.Sound();
      await original.loadAsync({ uri });
      setOriginalSound(original);
      
      const enhanced = new Audio.Sound();
      await enhanced.loadAsync({ uri: processedUri });
      setEnhancedSound(enhanced);
      
      setIsProcessing(false);
    } catch (error) {
      console.error('Failed to stop recording:', error);
      setError('Failed to process audio');
      setIsProcessing(false);
    }
  };

  // Cancel recording
  const handleCancelRecording = async () => {
    try {
      if (recording) {
        await recording.stopAndUnloadAsync();
        setRecording(null);
      }
      
      if (durationTimer) {
        clearInterval(durationTimer);
        setDurationTimer(null);
      }
      
      setIsRecording(false);
      setIsProcessing(false);
      setRecordingDuration(0);
    } catch (error) {
      console.error('Failed to cancel recording:', error);
  