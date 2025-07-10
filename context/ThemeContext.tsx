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
    background: '#181A20',         // Deep blue-gray, not pure black
    surface: '#23243A',            // Lighter blue-gray for cards
    surfaceVariant: '#26283C',     // For subtle section backgrounds
    primary: '#1CB0F6',            // Duolingo blue
    primaryVariant: '#0094D4',     // Slightly deeper blue
    secondary: '#30E6A9',          // Duolingo green accent
    accent: '#FFD600',             // Duolingo yellow accent
    text: '#F1F5F9',               // Near-white
    textSecondary: '#B0B8C1',      // Soft gray
    textTertiary: '#6B7280',       // Muted gray
    border: '#23243A',             // Soft border
    success: '#30E6A9',            // Green accent
    warning: '#FFD600',            // Yellow accent
    error: '#FF5A5F',              // Red accent
    shadow: 'rgba(0,0,0,0.12)',    // Very subtle shadow
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