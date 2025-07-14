import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import { useTheme } from '@/context/ThemeContext';

interface ButtonProps {
  onPress: () => void;
  children: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'destructive';
  icon?: React.ReactNode;
  style?: object;
}

export default function Button({
  onPress,
  children,
  loading = false,
  disabled = false,
  variant = 'primary',
  icon,
  style,
}: ButtonProps) {
  const { theme } = useTheme();

  const getButtonStyles = () => {
    switch (variant) {
      case 'secondary':
        return {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.primary,
          borderWidth: 1,
        };
      case 'destructive':
        return {
          backgroundColor: theme.colors.error,
        };
      case 'primary':
      default:
        return {
          backgroundColor: theme.colors.primary,
        };
    }
  };

  const getTextStyle = () => {
    switch (variant) {
      case 'secondary':
        return { color: theme.colors.primary };
      case 'destructive':
      case 'primary':
      default:
        return { color: 'white' };
    }
  };

  const isDisabled = loading || disabled;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      style={[
        styles.button,
        getButtonStyles(),
        { opacity: isDisabled ? 0.6 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' ? theme.colors.primary : 'white'} />
      ) : (
        <View style={styles.content}>
          {icon && <View style={styles.iconWrapper}>{icon}</View>}
          <Text style={[styles.text, getTextStyle()]}>{children}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  text: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    textAlign: 'center',
  },
  iconWrapper: {},
});