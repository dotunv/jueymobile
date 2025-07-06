import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Supabase configuration
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key';

// Custom storage adapter for secure token storage
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => {
    if (Platform.OS === 'web') {
      // Use localStorage for web
      return Promise.resolve(localStorage.getItem(key));
    }
    return SecureStore.getItemAsync(key);
  },
  setItem: (key: string, value: string) => {
    if (Platform.OS === 'web') {
      // Use localStorage for web
      localStorage.setItem(key, value);
      return Promise.resolve();
    }
    return SecureStore.setItemAsync(key, value);
  },
  removeItem: (key: string) => {
    if (Platform.OS === 'web') {
      // Use localStorage for web
      localStorage.removeItem(key);
      return Promise.resolve();
    }
    return SecureStore.deleteItemAsync(key);
  },
};

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Utility function to clear corrupted sessions
export const clearCorruptedSession = async () => {
  try {
    // Clear all auth-related storage
    const authKeys = [
      'supabase.auth.token',
      'supabase.auth.refreshToken',
      'supabase.auth.expiresAt',
      'supabase.auth.expiresIn',
      'supabase.auth.tokenType',
      'supabase.auth.user',
      'supabase.auth.session',
    ];
    
    for (const key of authKeys) {
      await ExpoSecureStoreAdapter.removeItem(key);
    }
    
    // Also clear any localStorage items if on web
    if (Platform.OS === 'web') {
      for (const key of authKeys) {
        localStorage.removeItem(key);
      }
    }
    
    console.log('Corrupted session cleared successfully');
  } catch (error) {
    console.error('Error clearing corrupted session:', error);
  }
};

// Utility function to check if an error is authentication-related
export const isAuthError = (error: any): boolean => {
  if (!error || !error.message) return false;
  
  const authErrorMessages = [
    'Refresh Token Not Found',
    'Invalid Refresh Token',
    'JWT expired',
    'Invalid JWT',
    'Authentication failed',
    'Unauthorized',
    'Token expired',
  ];
  
  return authErrorMessages.some(msg => 
    error.message.includes(msg)
  );
};

// Database types
export interface Profile {
  id: string;
  email: string;
  username: string;
  full_name?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  category: string;
  tags: string[];
  ai_suggested: boolean;
  created_at: string;
  updated_at: string;
  due_date?: string;
}

export interface AIInsight {
  id: string;
  user_id: string;
  type: 'suggestion' | 'insight' | 'reminder';
  title: string;
  description: string;
  confidence: number;
  metadata: Record<string, any>;
  created_at: string;
  dismissed: boolean;
}