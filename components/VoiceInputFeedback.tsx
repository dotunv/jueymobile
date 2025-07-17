import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Text, Animated, Easing } from 'react-native';
import { useTheme } from '@/context/ThemeContext';

interface VoiceInputFeedbackProps {
  isRecording: boolean;
  volume?: number; // 0-1 scale
  duration: number; // in seconds
}

/**
 * Visual feedback component for voice recording
 * Shows animated waveform and recording duration
 */
export default function VoiceInputFeedback({
  isRecording,
  volume = 0.5,
  duration,
}: VoiceInputFeedbackProps) {
  const { theme } = useTheme();
  
  // Animation values for waveform bars
  const barAnimations = useRef([
    new Animated.Value(0.3),
    new Animated.Value(0.5),
    new Animated.Value(0.7),
    new Animated.Value(0.4),
    new Animated.Value(0.6),
    new Animated.Value(0.3),
    new Animated.Value(0.5),
  ]).current;
  
  // Format duration as MM:SS
  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };
  
  // Animate waveform when recording
  useEffect(() => {
    if (isRecording) {
      // Create animations for each bar with different durations and delays
      const animations = barAnimations.map((anim, index) => {
        return Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: 0.2 + Math.random() * 0.8, // Random height between 0.2 and 1.0
              duration: 700 + Math.random() * 300, // Random duration between 700-1000ms
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: false,
            }),
            Animated.timing(anim, {
              toValue: 0.2 + Math.random() * 0.8,
              duration: 700 + Math.random() * 300,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: false,
            }),
          ])
        );
      });
      
      // Start all animations
      Animated.parallel(animations).start();
      
      return () => {
        // Stop animations when component unmounts or recording stops
        animations.forEach(anim => anim.stop());
      };
    } else {
      // Reset all bars to initial state when not recording
      barAnimations.forEach(anim => {
        Animated.timing(anim, {
          toValue: 0.3,
          duration: 300,
          useNativeDriver: false,
        }).start();
      });
    }
  }, [isRecording]);
  
  // Adjust animation based on volume when recording
  useEffect(() => {
    if (isRecording && volume !== undefined) {
      // Scale the animations based on volume
      barAnimations.forEach(anim => {
        anim.setValue(0.2 + volume * 0.8);
      });
    }
  }, [volume, isRecording]);
  
  return (
    <View style={styles.container}>
      {/* Waveform visualization */}
      <View style={styles.waveformContainer}>
        {barAnimations.map((anim, index) => (
          <Animated.View
            key={index}
            style={[
              styles.waveformBar,
              {
                backgroundColor: isRecording ? theme.colors.primary : theme.colors.textSecondary,
                height: anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        ))}
      </View>
      
      {/* Recording duration */}
      {isRecording && (
        <Text style={[styles.durationText, { color: theme.colors.error }]}>
          {formatDuration(duration)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 60,
    width: '100%',
    justifyContent: 'center',
  },
  waveformBar: {
    width: 4,
    marginHorizontal: 3,
    borderRadius: 2,
  },
  durationText: {
    marginTop: 8,
    fontSize: 16,
    fontFamily: 'Inter-Medium',
  },
});