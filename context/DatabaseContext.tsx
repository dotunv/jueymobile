import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { initDatabase, getDatabase } from '@/lib/database';
import { DatabaseService } from '@/lib/services/databaseService';
import { useAuth } from './AuthContext';

interface DatabaseContextType {
  isInitialized: boolean;
  isReady: boolean;
  error: string | null;
  initializeDatabase: () => Promise<void>;
  clearDatabase: () => Promise<void>;
}

const DatabaseContext = createContext<DatabaseContextType | undefined>(undefined);

interface DatabaseProviderProps {
  children: ReactNode;
}

export function DatabaseProvider({ children }: DatabaseProviderProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const initializeDatabase = async () => {
    try {
      setError(null);
      console.log('Initializing database...');
      
      // Initialize the database
      await initDatabase();
      setIsInitialized(true);
      
      console.log('Database initialized successfully');
      
      // Set ready when user is available
      if (user) {
        setIsReady(true);
        console.log('Database ready for user:', user.id);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize database';
      setError(errorMessage);
      console.error('Database initialization error:', err);
    }
  };

  const clearDatabase = async () => {
    try {
      // This would clear all data - use with caution
      // await DatabaseService.clearUserData(user?.id || '');
      setIsReady(false);
      console.log('Database cleared');
    } catch (err) {
      console.error('Error clearing database:', err);
    }
  };

  // Initialize database on mount
  useEffect(() => {
    initializeDatabase();
  }, []);

  // Set ready state when user changes
  useEffect(() => {
    if (isInitialized && user) {
      setIsReady(true);
    } else if (isInitialized && !user) {
      setIsReady(false);
    }
  }, [isInitialized, user]);

  const value: DatabaseContextType = {
    isInitialized,
    isReady,
    error,
    initializeDatabase,
    clearDatabase,
  };

  return (
    <DatabaseContext.Provider value={value}>
      {children}
    </DatabaseContext.Provider>
  );
}

export function useDatabase() {
  const context = useContext(DatabaseContext);
  if (context === undefined) {
    throw new Error('useDatabase must be used within a DatabaseProvider');
  }
  return context;
}

// Hook for database operations that require user authentication
export function useDatabaseOperations() {
  const { isReady, error } = useDatabase();
  const { user } = useAuth();

  const requireAuth = () => {
    if (!isReady) {
      throw new Error('Database not ready');
    }
    if (!user) {
      throw new Error('User not authenticated');
    }
    return user.id;
  };

  return {
    isReady,
    error,
    requireAuth,
    // Task operations
    createTask: async (taskData: any) => {
      const userId = requireAuth();
      return await DatabaseService.createTask(userId, taskData);
    },
    getTasks: async (filters?: any) => {
      const userId = requireAuth();
      return await DatabaseService.getTasks(userId, filters);
    },
    updateTask: async (taskId: string, updates: any) => {
      return await DatabaseService.updateTask(taskId, updates);
    },
    deleteTask: async (taskId: string) => {
      return await DatabaseService.deleteTask(taskId);
    },
    toggleTaskCompletion: async (taskId: string) => {
      return await DatabaseService.toggleTaskCompletion(taskId);
    },
    // Suggestion operations
    createSuggestion: async (suggestionData: any) => {
      const userId = requireAuth();
      return await DatabaseService.createSuggestion(userId, suggestionData);
    },
    getSuggestions: async (status?: string) => {
      const userId = requireAuth();
      return await DatabaseService.getSuggestions(userId, status);
    },
    updateSuggestionStatus: async (suggestionId: string, status: string) => {
      return await DatabaseService.updateSuggestionStatus(suggestionId, status);
    },
    // Feedback operations
    createFeedback: async (feedbackData: any) => {
      const userId = requireAuth();
      return await DatabaseService.createFeedback(userId, feedbackData);
    },
    // User preferences operations
    getUserPreferences: async () => {
      const userId = requireAuth();
      return await DatabaseService.getUserPreferences(userId);
    },
    createUserPreferences: async (preferences: any) => {
      const userId = requireAuth();
      return await DatabaseService.createUserPreferences(userId, preferences);
    },
    updateUserPreferences: async (updates: any) => {
      const userId = requireAuth();
      return await DatabaseService.updateUserPreferences(userId, updates);
    },
    // Analytics operations
    getTaskAnalytics: async (startDate?: string, endDate?: string) => {
      const userId = requireAuth();
      return await DatabaseService.getTaskAnalytics(userId, startDate, endDate);
    },
  };
} 