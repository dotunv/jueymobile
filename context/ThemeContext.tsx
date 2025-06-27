import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

export interface Theme {
  isDark: boolean;
  colors: {
    background: string;
    surface: string;
    surfaceVariant: string;
    primary: string;
    primaryVariant: string;
    secondary: string;
    accent: string;
    text: string;
    textSecondary: string;
    textTertiary: string;
    border: string;
    success: string;
    warning: string;
    error: string;
    shadow: string;
  };
}

const lightTheme: Theme = {
  isDark: false,
  colors: {
    background: '#FAFAFA',
    surface: '#FFFFFF',
    surfaceVariant: '#F5F5F5',
    primary: '#6366F1',
    primaryVariant: '#4F46E5',
    secondary: '#8B5CF6',
    accent: '#06B6D4',
    text: '#1F2937',
    textSecondary: '#6B7280',
    textTertiary: '#9CA3AF',
    border: '#E5E7EB',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    shadow: 'rgba(0, 0, 0, 0.1)',
  },
};

const darkTheme: Theme = {
  isDark: true,
  colors: {
    background: '#0F172A',
    surface: '#1E293B',
    surfaceVariant: '#334155',
    primary: '#818CF8',
    primaryVariant: '#6366F1',
    secondary: '#A78BFA',
    accent: '#06B6D4',
    text: '#F1F5F9',
    textSecondary: '#CBD5E1',
    textTertiary: '#94A3B8',
    border: '#475569',
    success: '#34D399',
    warning: '#FBBF24',
    error: '#F87171',
    shadow: 'rgba(0, 0, 0, 0.3)',
  },
};

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [isDark, setIsDark] = useState(systemColorScheme === 'dark');

  useEffect(() => {
    setIsDark(systemColorScheme === 'dark');
  }, [systemColorScheme]);

  const theme = isDark ? darkTheme : lightTheme;

  const toggleTheme = () => {
    setIsDark(!isDark);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};