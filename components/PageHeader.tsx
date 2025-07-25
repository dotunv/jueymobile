import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LucideIcon } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';

interface PageHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  actionButton?: {
    text: string;
    onPress: () => void;
    variant?: 'primary' | 'secondary';
  };
}

export default function PageHeader({ icon: Icon, title, subtitle, actionButton }: PageHeaderProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.header, { backgroundColor: theme.colors.background }]}>
      <View style={styles.headerContent}>
        {/* Left: Icon + Text */}
        <View style={styles.headerLeft}>
          <View style={[styles.iconContainer, { backgroundColor: theme.colors.primary + '15' }]}>
            <Icon size={28} color={theme.colors.primary} strokeWidth={2} />
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.headerTitle, { color: theme.colors.text }]} numberOfLines={1}>
              {title}
            </Text>
            {subtitle && (
              <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                {subtitle}
              </Text>
            )}
          </View>
        </View>

        {/* Right: Action Button */}
        {actionButton && (
          <TouchableOpacity
            onPress={actionButton.onPress}
            style={[
              styles.actionButton,
              {
                backgroundColor:
                  actionButton.variant === 'secondary'
                    ? theme.colors.surface
                    : theme.colors.primary,
              },
            ]}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.actionButtonText,
                {
                  color:
                    actionButton.variant === 'secondary'
                      ? theme.colors.primary
                      : 'white',
                },
              ]}
              numberOfLines={1}
            >
              {actionButton.text}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    marginTop: 4,
  },
  actionButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    flexShrink: 0,
    maxWidth: 140,
  },
  actionButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    textAlign: 'center',
  },
});
