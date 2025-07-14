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
    background: '#F7F8FA',         // Soft off-white
    surface: '#FFFFFF',            // True white for cards
    surfaceVariant: '#F1F5F9',     // For subtle section backgrounds
    primary: '#2563EB',            // Bold blue (Blue-600)
    primaryVariant: '#1D4ED8',     // Blue-700
    secondary: '#38BDF8',          // Sky-400
    accent: '#0EA5E9',             // Sky-500
    text: '#18181B',               // Near-black
    textSecondary: '#52525B',      // Dark gray
    textTertiary: '#A1A1AA',       // Lighter gray
    border: '#E5E7EB',             // Subtle border
    success: '#22C55E',            // Vivid green
    warning: '#F59E42',            // Vivid orange
    error: '#EF4444',              // Vivid red
    shadow: 'rgba(0,0,0,0.06)',    // Subtle shadow
  },
};

const darkTheme: Theme = {
  isDark: true,
  colors: {
    background: '#121212',         // True black for OLED screens
    surface: '#1E1E1E',            // Dark grey for cards and surfaces
    surfaceVariant: '#2C2C2E',     // Lighter grey for subtle backgrounds
    primary: '#3B82F6',            // A vibrant blue, consistent with light theme
    primaryVariant: '#2563EB',     // A deeper blue for accents
    secondary: '#10B981',          // A cool green for secondary actions
    accent: '#F59E0B',             // A warm yellow/orange for highlights
    text: '#E5E5E5',               // Off-white for text
    textSecondary: '#A3A3A3',      // Lighter grey for subtitles
    textTertiary: '#737373',       // Muted grey for inactive elements
    border: '#2C2C2E',             // Subtle border, same as surface variant
    success: '#22C55E',            // Consistent green
    warning: '#F59E0B',            // Consistent orange
    error: '#EF4444',              // Consistent red
    shadow: 'rgba(0,0,0,0.2)',    // More subtle shadow for dark mode
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