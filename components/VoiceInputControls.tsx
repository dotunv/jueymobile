import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { Mic, MicOff, X, Settings, Volume2 } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import VoiceInputFeedback from './VoiceInputFeedback';
import * as Haptics from 'expo-haptics';

interface VoiceInputControlsProps {
  isRecording: boolean;
  isProcessing: boolean;
  duration: number;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onCancel: () => void;
  onSettingsPress?: () => void;
  size?: 'small' | 'medium' | 'large';
  showFeedback?: boolean;
}

/**
 * Voice input controls component with visual feedback
 */
export default function VoiceInputControls({
  isRecording,
  isProcessing,
  duration,
  onStartRecording,
  onStopRecording,
  onCancel,
  onSettingsPress,
  size = 'medium',
  showFeedback = true,
}: VoiceInputControlsProps) {
  const { theme } = useTheme();
  const [volume, setVolume] = useState(0.5);
  
  // Button size based on prop
  const buttonSize = size === 'small' ? 48 : size === 'large' ? 72 : 56;
  const iconSize = size === 'small' ? 20 : size === 'large' ? 32 : 24;
  
  // Simulate volume changes when recording
  useEffect(() => {
    if (isRecording) {
      const volumeInterval = setInterval(() => {
        // Simulate volume changes between 0.3 and 0.9
        setVolume(0.3 + Math.random() * 0.6);
      }, 200);
      
      return () => clearInterval(volumeInterval);
    }
  }, [isRecording]);
  
  const handleStartRecording = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onStartRecording();
  };
  
  const handleStopRecording = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onStopRecording();
  };
  
  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onCancel();
  };
  
  return (
    <View style={styles.container}>
      {/* Voice feedback visualization */}
      {showFeedback && isRecording && (
        <VoiceInputFeedback 
          isRecording={isRecording} 
          volume={volume}
          duration={duration}
        />
      )}
      
      {/* Controls */}
      <View style={styles.controlsContainer}>
        {/* Settings button (optional) */}
        {onSettingsPress && !isRecording && !isProcessing && (
          <TouchableOpacity
            style={[styles.settingsButton, { backgroundColor: theme.colors.surfaceVariant }]}
            onPress={onSettingsPress}
          >
            <Settings size={iconSize - 4} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        )}
        
        {/* Cancel button (when recording) */}
        {isRecording && (
          <TouchableOpacity
            style={[styles.cancelButton, { backgroundColor: theme.colors.errorLight }]}
            onPress={handleCancel}
          >
            <X size={iconSize - 4} color={theme.colors.error} />
          </TouchableOpacity>
        )}
        
        {/* Main recording button */}
        <TouchableOpacity
          style={[
            styles.micButton,
            {
              width: buttonSize,
              height: buttonSize,
              borderRadius: buttonSize / 2,
              backgroundColor: isRecording ? theme.colors.error : theme.colors.primary,
            },
          ]}
          onPress={isRecording ? handleStopRecording : handleStartRecording}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <ActivityIndicator color="white" size={iconSize} />
          ) : isRecording ? (
            <MicOff size={iconSize} color="white" />
          ) : (
            <Mic size={iconSize} color="white" />
          )}
        </TouchableOpacity>
        
        {/* Volume indicator (when recording) */}
        {isRecording && (
          <TouchableOpacity
            style={[styles.volumeButton, { backgroundColor: theme.colors.surfaceVariant }]}
            disabled={true}
          >
            <Volume2 size={iconSize - 4} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
      
      {/* Status text */}
      {isRecording && (
        <Text style={[styles.statusText, { color: theme.colors.error }]}>
          Recording... Tap to stop
        </Text>
      )}
      
      {isProcessing && (
        <Text style={[styles.statusText, { color: theme.colors.textSecondary }]}>
          Processing...
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  controlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  micButton: {
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    zIndex: 10,
  },
  cancelButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  volumeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 16,
  },
  statusText: {
    marginTop: 12,
    fontSize: 14,
    fontFamily: 'Inter-Medium',
  },
});