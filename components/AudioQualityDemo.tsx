import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Slider, ActivityIndicator, Switch } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { Mic, Play, Pause, Save, Volume2, Volume, VolumeX } from 'lucide-react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { AudioProcessor } from '@/lib/services/voice/AudioProcessor';
import * as Haptics from 'expo-haptics';

export default function AudioQualityDemo() {
  const { theme } = useTheme();
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [originalAudioUri, setOriginalAudioUri] = useState<string | null>(null);
  const [enhancedAudioUri, setEnhancedAudioUri] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [noiseReductionEnabled, setNoiseReductionEnabled] = useState(true);
  const [clarityLevel, setClarityLevel] = useState(0.7);
  const [volumeBoost, setVolumeBoost] = useState(0.5);
  
  const recording = useRef<Audio.Recording | null>(null);
  const sound = useRef<Audio.Sound | null>(null);
  const recordingTimer = useRef<NodeJS.Timeout | null>(null);
  const playbackTimer = useRef<NodeJS.Timeout | null>(null);
  
  // Initialize audio
  useEffect(() => {
    initializeAudio();
    
    return () => {
      // Clean up
      cleanupAudio();
    };
  }, []);
  
  // Update playback position during playback
  useEffect(() => {
    if (isPlaying) {
      playbackTimer.current = setInterval(async () => {
        if (sound.current) {
          const status = await sound.current.getStatusAsync();
          if (status.isLoaded) {
            setPlaybackPosition(status.positionMillis / 1000);
            
            // Stop when playback ends
            if (status.didJustFinish) {
              setIsPlaying(false);
              setPlaybackPosition(0);
              clearInterval(playbackTimer.current!);
              playbackTimer.current = null;
            }
          }
        }
      }, 100);
    } else if (playbackTimer.current) {
      clearInterval(playbackTimer.current);
      playbackTimer.current = null;
    }
    
    return () => {
      if (playbackTimer.current) {
        clearInterval(playbackTimer.current);
        playbackTimer.current = null;
      }
    };
  }, [isPlaying]);
  
  // Initialize audio
  const initializeAudio = async () => {
    try {
      // Request permissions
      const permissionResponse = await Audio.requestPermissionsAsync();
      if (!permissionResponse.granted) {
        setError('Audio recording permission not granted');
        return;
      }
      
      // Set audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });
    } catch (err) {
      console.error('Failed to initialize audio:', err);
      setError('Failed to initialize audio');
    }
  };
  
  // Clean up audio resources
  const cleanupAudio = async () => {
    try {
      // Stop and unload recording
      if (recording.current) {
        await recording.current.stopAndUnloadAsync();
        recording.current = null;
      }
      
      // Stop and unload sound
      if (sound.current) {
        await sound.current.unloadAsync();
        sound.current = null;
      }
      
      // Clear timers
      if (recordingTimer.current) {
        clearInterval(recordingTimer.current);
        recordingTimer.current = null;
      }
      
      if (playbackTimer.current) {
        clearInterval(playbackTimer.current);
        playbackTimer.current = null;
      }
      
      // Delete temporary files
      if (originalAudioUri) {
        const fileInfo = await FileSystem.getInfoAsync(originalAudioUri);
        if (fileInfo.exists) {
          await FileSystem.deleteAsync(originalAudioUri);
        }
      }
      
      if (enhancedAudioUri) {
        const fileInfo = await FileSystem.getInfoAsync(enhancedAudioUri);
        if (fileInfo.exists) {
          await FileSystem.deleteAsync(enhancedAudioUri);
        }
      }
    } catch (err) {
      console.error('Failed to clean up audio:', err);
    }
  };
  
  // Start recording
  const startRecording = async () => {
    try {
      setError(null);
      
      // Clean up previous recordings
      await cleanupAudio();
      
      // Create new recording
      recording.current = new Audio.Recording();
      
      // Prepare recording with options
      await recording.current.prepareToRecordAsync({
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
      await recording.current.startAsync();
      setIsRecording(true);
      setRecordingDuration(0);
      
      // Start recording timer
      recordingTimer.current = setInterval(() => {
        setRecordingDuration(prev => {
          // Auto-stop after 30 seconds
          if (prev >= 30) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
      
      // Trigger haptic feedback
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (err) {
      console.error('Failed to start recording:', err);
      setError('Failed to start recording');
    }
  };
  
  // Stop recording
  const stopRecording = async () => {
    try {
      if (!recording.current) {
        return;
      }
      
      // Stop recording timer
      if (recordingTimer.current) {
        clearInterval(recordingTimer.current);
        recordingTimer.current = null;
      }
      
      // Stop recording
      await recording.current.stopAndUnloadAsync();
      const uri = recording.current.getURI();
      recording.current = null;
      
      if (uri) {
        setOriginalAudioUri(uri);
        
        // Get audio info
        const audioInfo = await AudioProcessor.getAudioInfo(uri);
        setAudioDuration(audioInfo.duration);
        
        // Process audio if noise reduction is enabled
        if (noiseReductionEnabled) {
          await enhanceAudio(uri);
        } else {
          setEnhancedAudioUri(uri);
        }
      }
      
      setIsRecording(false);
      
      // Trigger haptic feedback
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (err) {
      console.error('Failed to stop recording:', err);
      setError('Failed to stop recording');
      setIsRecording(false);
    }
  };
  
  // Enhance audio quality
  const enhanceAudio = async (audioUri: string) => {
    try {
      setIsProcessing(true);
      
      // Apply noise reduction
      let processedUri = audioUri;
      if (noiseReductionEnabled) {
        processedUri = await AudioProcessor.applyNoiseReduction(audioUri, {
          intensity: 0.7,
          preserveSpeech: true
        });
      }
      
      // Enhance audio quality
      processedUri = await AudioProcessor.enhanceAudioQuality(processedUri, {
        clarity: clarityLevel,
        volumeBoost: volumeBoost
      });
      
      setEnhancedAudioUri(processedUri);
      setIsProcessing(false);
    } catch (err) {
      console.error('Failed to enhance audio:', err);
      setError('Failed to enhance audio');
      setIsProcessing(false);
    }
  };
  
  // Play audio
  const playAudio = async () => {
    try {
      if (!enhancedAudioUri) {
        return;
      }
      
      // Unload previous sound
      if (sound.current) {
        await sound.current.unloadAsync();
      }
      
      // Load and play sound
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: enhancedAudioUri },
        { shouldPlay: true }
      );
      sound.current = newSound;
      
      // Set up playback status updates
      sound.current.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          setPlaybackPosition(status.positionMillis / 1000);
          
          // Stop when playback ends
          if (status.didJustFinish) {
            setIsPlaying(false);
            setPlaybackPosition(0);
          }
        }
      });
      
      setIsPlaying(true);
    } catch (err) {
      console.error('Failed to play audio:', err);
      setError('Failed to play audio');
    }
  };
  
  // Pause audio
  const pauseAudio = async () => {
    try {
      if (sound.current) {
        await sound.current.pauseAsync();
        setIsPlaying(false);
      }
    } catch (err) {
      console.error('Failed to pause audio:', err);
      setError('Failed to pause audio');
    }
  };
  
  // Seek audio
  const seekAudio = async (position: number) => {
    try {
      if (sound.current) {
        await sound.current.setPositionAsync(position * 1000);
        setPlaybackPosition(position);
      }
    } catch (err) {
      console.error('Failed to seek audio:', err);
    }
  };
  
  // Save enhanced audio
  const saveEnhancedAudio = async () => {
    try {
      if (!enhancedAudioUri) {
        return;
      }
      
      // In a real app, this would save to the user's device or cloud storage
      // For this demo, we'll just show a success message
      
      // Trigger haptic feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      alert('Audio saved successfully!');
    } catch (err) {
      console.error('Failed to save audio:', err);
      setError('Failed to save audio');
    }
  };
  
  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };
  
  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: theme.colors.text }]}>
        Audio Quality Enhancement
      </Text>
      
      {error && (
        <View style={[styles.errorContainer, { backgroundColor: theme.colors.errorLight }]}>
          <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text>
        </View>
      )}
      
      <View style={[styles.recordingContainer, { 
        backgroundColor: theme.colors.surfaceVariant,
        borderColor: isRecording ? theme.colors.error : theme.colors.border
      }]}>
        {isRecording ? (
          <Text style={[styles.recordingText, { color: theme.colors.error }]}>
            Recording... {formatTime(recordingDuration)}
          </Text>
        ) : enhancedAudioUri ? (
          <View style={styles.playbackContainer}>
            <View style={styles.timeContainer}>
              <Text style={[styles.timeText, { color: theme.colors.textSecondary }]}>
                {formatTime(playbackPosition)}
              </Text>
              <Text style={[styles.timeText, { color: theme.colors.textSecondary }]}>
                {formatTime(audioDuration)}
              </Text>
            </View>
            
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={audioDuration}
              value={playbackPosition}
              onValueChange={seekAudio}
              minimumTrackTintColor={theme.colors.primary}
              maximumTrackTintColor={theme.colors.border}
              thumbTintColor={theme.colors.primary}
              disabled={isProcessing}
            />
            
            <View style={styles.playbackControls}>
              <TouchableOpacity
                style={[styles.playButton, { backgroundColor: theme.colors.primary }]}
                onPress={isPlaying ? pauseAudio : playAudio}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator color="white" size={24} />
                ) : isPlaying ? (
                  <Pause size={24} color="white" />
                ) : (
                  <Play size={24} color="white" />
                )}
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: theme.colors.secondary }]}
                onPress={saveEnhancedAudio}
                disabled={isProcessing}
              >
                <Save size={20} color="white" />
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <Text style={[styles.placeholderText, { color: theme.colors.textSecondary }]}>
            Press the microphone button to record audio
          </Text>
        )}
      </View>
      
      <View style={styles.settingsContainer}>
        <Text style={[styles.settingsTitle, { color: theme.colors.text }]}>
          Audio Enhancement Settings
        </Text>
        
        <View style={styles.settingRow}>
          <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
            Noise Reduction
          </Text>
          <Switch
            value={noiseReductionEnabled}
            onValueChange={setNoiseReductionEnabled}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary + '80' }}
            thumbColor={noiseReductionEnabled ? theme.colors.primary : theme.colors.surfaceVariant}
            disabled={isRecording || isProcessing}
          />
        </View>
        
        <View style={styles.settingRow}>
          <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
            Clarity
          </Text>
          <View style={styles.sliderContainer}>
            <VolumeX size={16} color={theme.colors.textSecondary} />
            <Slider
              style={styles.settingSlider}
              minimumValue={0}
              maximumValue={1}
              step={0.1}
              value={clarityLevel}
              onValueChange={setClarityLevel}
              minimumTrackTintColor={theme.colors.primary}
              maximumTrackTintColor={theme.colors.border}
              thumbTintColor={theme.colors.primary}
              disabled={isRecording || isProcessing}
            />
            <Volume2 size={16} color={theme.colors.textSecondary} />
          </View>
        </View>
        
        <View style={styles.settingRow}>
          <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
            Volume Boost
          </Text>
          <View style={styles.sliderContainer}>
            <Volume size={16} color={theme.colors.textSecondary} />
            <Slider
              style={styles.settingSlider}
              minimumValue={0}
              maximumValue={1}
              step={0.1}
              value={volumeBoost}
              onValueChange={setVolumeBoost}
              minimumTrackTintColor={theme.colors.primary}
              maximumTrackTintColor={theme.colors.border}
              thumbTintColor={theme.colors.primary}
              disabled={isRecording || isProcessing}
            />
            <Volume2 size={16} color={theme.colors.textSecondary} />
          </View>
        </View>
      </View>
      
      <View style={styles.controlsContainer}>
        <TouchableOpacity
          style={[
            styles.micButton,
            { backgroundColor: isRecording ? theme.colors.error : theme.colors.primary }
          ]}
          onPress={isRecording ? stopRecording : startRecording}
          disabled={isProcessing}
        >
          <Mic size={32} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    marginBottom: 16,
  },
  errorContainer: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
  },
  recordingContainer: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    minHeight: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  recordingText: {
    fontSize: 18,
    fontFamily: 'Inter-Medium',
  },
  placeholderText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    fontStyle: 'italic',
  },
  playbackContainer: {
    width: '100%',
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  timeText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  playbackControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 24,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    marginLeft: 8,
  },
  settingsContainer: {
    marginBottom: 16,
  },
  settingsTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 12,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  settingLabel: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '60%',
  },
  settingSlider: {
    flex: 1,
    marginHorizontal: 8,
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  micButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
});