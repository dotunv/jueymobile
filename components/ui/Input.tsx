import React from 'react';
import { View, Text, TextInput, StyleSheet, ViewStyle, TextInputProps } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import Card from './Card';

interface InputProps extends TextInputProps {
  label: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerStyle?: ViewStyle;
}

export default function Input({
  label,
  error,
  leftIcon,
  rightIcon,
  containerStyle,
  ...props
}: InputProps) {
  const { theme } = useTheme();

  return (
    <View style={containerStyle}>
      <Text style={[styles.label, { color: theme.colors.text }]}>{label}</Text>
      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: theme.colors.surface,
            borderColor: error ? theme.colors.error : theme.colors.border,
            shadowColor: theme.colors.shadow,
          },
        ]}
      >
        {leftIcon && <View style={styles.iconWrapper}>{leftIcon}</View>}
        <TextInput
          style={[styles.textInput, { color: theme.colors.text }]}
          placeholderTextColor={theme.colors.textTertiary}
          {...props}
        />
        {rightIcon && <View style={styles.iconWrapper}>{rightIcon}</View>}
      </View>
      {error && <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  iconWrapper: {
    paddingVertical: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  errorText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    marginTop: 6,
  },
});