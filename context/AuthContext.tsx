import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User, AuthError } from '@supabase/supabase-js';
import { supabase, Profile, clearCorruptedSession, isAuthError } from '@/lib/supabase';
import { router } from 'expo-router';
import { useTaskStore } from '@/lib/taskStore';
import { usePreferencesStore } from '@/lib/preferencesStore';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string, username: string, fullName?: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<{ error: AuthError | null }>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: any }>;
  clearSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const clearTasks = useTaskStore((state) => state.clearTasks);
  const clearPreferences = usePreferencesStore((state) => state.clearPreferences);

  const clearAllUserData = () => {
    setProfile(null);
    clearTasks();
    clearPreferences();
    // Add other store clearing here if needed
    console.log('Cleared all user data');
  };

  const clearSession = async () => {
    try {
      await supabase.auth.signOut();
      await clearCorruptedSession();
      clearAllUserData();
      setSession(null);
      setUser(null);
      router.replace('/(auth)/sign-in');
    } catch (error) {
      console.error('Error clearing session:', error);
    }
  };

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('Error getting session:', error);
        // If there's an error getting the session, clear it and redirect to sign-in
        if (isAuthError(error)) {
          clearSession();
          return;
        }
      }
      
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.id);
        
        // Handle specific auth events
        if (event === 'TOKEN_REFRESHED') {
          console.log('Token refreshed successfully');
        } else if (event === 'SIGNED_OUT') {
          console.log('User signed out');
          clearAllUserData();
          setSession(null);
          setUser(null);
          router.replace('/(auth)/sign-in');
          return;
        } else if (event === 'SIGNED_IN') {
          console.log('User signed in:', session?.user?.id);
          // Clear any existing profile data when signing in
          clearAllUserData();
          setSession(session);
          setUser(session?.user ?? null);
          
          if (session?.user) {
            await fetchProfile(session.user.id);
          }
          setLoading(false);
          return;
        }
        
        // For other events (like USER_UPDATED), update session and user
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          await fetchProfile(session.user.id);
        } else {
          setProfile(null);
        }
        
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching profile:', error);
        return;
      }

      if (data) {
        setProfile(data);
      } else {
        // Profile doesn't exist, create one
        console.log('Profile not found, creating new profile for user:', userId);
        await createProfile(userId);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const createProfile = async (userId: string) => {
    try {
      // Get user data from auth
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      if (!authUser) {
        console.error('No auth user found when creating profile');
        return;
      }

      // Create profile with available data
      const profileData = {
        id: userId,
        email: authUser.email || '',
        username: authUser.user_metadata?.username || authUser.email?.split('@')[0] || 'user',
        full_name: authUser.user_metadata?.full_name || '',
        avatar_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('profiles')
        .insert([profileData])
        .select()
        .single();

      if (error) {
        console.error('Error creating profile:', error);
        return;
      }

      console.log('Profile created successfully:', data);
      setProfile(data);
    } catch (error) {
      console.error('Error creating profile:', error);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { error };
    } catch (error: any) {
      console.error('Sign in error:', error);
      return { error };
    }
  };

  const signUp = async (email: string, password: string, username: string, fullName?: string) => {
    try {
      // Defensive check for username
      if (!username || username.trim() === "") {
        console.error("SignUp error: username is missing or empty", { username });
        return { error: { message: "Username is required" } };
      }
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            username: username,
          },
        },
      });

      return { error };
    } catch (error: any) {
      console.error('Sign up error:', error);
      return { error };
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      return { error };
    } catch (error: any) {
      console.error('Sign out error:', error);
      return { error };
    }
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return { error: new Error('No user logged in') };

    try {
      // First, check if profile exists
      const { data: existingProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (fetchError && fetchError.code === 'PGRST116') {
        // Profile doesn't exist, create it first
        console.log('Profile not found during update, creating new profile');
        await createProfile(user.id);
      }

      // Now update the profile
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (!error) {
        setProfile(prev => prev ? { ...prev, ...updates } : null);
      }

      return { error };
    } catch (error: any) {
      console.error('Update profile error:', error);
      return { error };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        loading,
        signIn,
        signUp,
        signOut,
        updateProfile,
        clearSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};