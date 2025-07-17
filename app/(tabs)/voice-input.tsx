import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import VoiceInputDemo from '@/components/VoiceInputDemo';
import PageHeader from '@/components/PageHeader';

export default function VoiceInputScreen() {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <PageHeader title="Voice Input" />
      <ScrollView style={styles.content}>
        <VoiceInputDemo />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
  },
});