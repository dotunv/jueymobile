import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Settings, User, Bell, Moon, Sun, Brain, Shield, Download, Trash2, CircleHelp as HelpCircle, Mail, ChevronRight, Palette, Database, Zap, LogOut } from 'lucide-react-native';
import Animated, {
  FadeIn,
  SlideInRight,
  SlideInUp,
} from 'react-native-reanimated';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { router } from 'expo-router';
import { usePreferencesStore } from '@/lib/preferencesStore';

interface SettingItem {
  id: string;
  title: string;
  subtitle?: string;
  icon: any;
  type: 'toggle' | 'navigation' | 'action';
  value?: boolean;
  onPress?: () => void;
  onToggle?: (value: boolean) => void;
  destructive?: boolean;
}

export default function SettingsScreen() {
  const { theme, toggleTheme } = useTheme();
  const { user, profile, signOut } = useAuth();
  const preferences = usePreferencesStore((state) => state.preferences);
  const setPreferences = usePreferencesStore((state) => state.setPreferences);
  const updatePreferences = usePreferencesStore((state) => state.updatePreferences);
  const [notifications, setNotifications] = useState(true);
  const [aiSuggestions, setAiSuggestions] = useState(true);
  const [smartReminders, setSmartReminders] = useState(false);
  const [dataSync, setDataSync] = useState(true);

  const showComingSoon = () => {
    Alert.alert('Coming Soon', 'This feature will be available in a future update.');
  };

  const showConfirmation = (title: string, message: string) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', style: 'destructive' },
    ]);
  };

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/(auth)/sign-in');
          },
        },
      ]
    );
  };

  const settingSections = [
    {
      title: 'Account',
      items: [
        {
          id: 'profile',
          title: 'Profile',
          subtitle: profile?.email || user?.email || 'Manage your account details',
          icon: User,
          type: 'navigation' as const,
          onPress: showComingSoon,
        },
        {
          id: 'preferences',
          title: 'Preferences',
          subtitle: 'Customize your experience',
          icon: Palette,
          type: 'navigation' as const,
          onPress: showComingSoon,
        },
      ],
    },
    {
      title: 'AI & Intelligence',
      items: [
        {
          id: 'ai-suggestions',
          title: 'AI Suggestions',
          subtitle: 'Get personalized task recommendations',
          icon: Brain,
          type: 'toggle' as const,
          value: aiSuggestions,
          onToggle: setAiSuggestions,
        },
        {
          id: 'smart-reminders',
          title: 'Smart Reminders',
          subtitle: 'Intelligent timing for notifications',
          icon: Zap,
          type: 'toggle' as const,
          value: smartReminders,
          onToggle: setSmartReminders,
        },
        {
          id: 'learning-preferences',
          title: 'Learning Preferences',
          subtitle: 'How AI learns from your behavior',
          icon: Settings,
          type: 'navigation' as const,
          onPress: showComingSoon,
        },
      ],
    },
    {
      title: 'Notifications',
      items: [
        {
          id: 'notifications',
          title: 'Push Notifications',
          subtitle: 'Receive task reminders and updates',
          icon: Bell,
          type: 'toggle' as const,
          value: notifications,
          onToggle: setNotifications,
        },
        {
          id: 'notification-settings',
          title: 'Notification Schedule',
          subtitle: 'Customize when you receive alerts',
          icon: Bell,
          type: 'navigation' as const,
          onPress: showComingSoon,
        },
      ],
    },
    {
      title: 'Appearance',
      items: [
        {
          id: 'theme',
          title: theme.isDark ? 'Light Mode' : 'Dark Mode',
          subtitle: `Switch to ${theme.isDark ? 'light' : 'dark'} theme`,
          icon: theme.isDark ? Sun : Moon,
          type: 'action' as const,
          onPress: toggleTheme,
        },
      ],
    },
    {
      title: 'Data & Privacy',
      items: [
        {
          id: 'data-sync',
          title: 'Data Sync',
          subtitle: 'Sync data across devices',
          icon: Database,
          type: 'toggle' as const,
          value: dataSync,
          onToggle: setDataSync,
        },
        {
          id: 'privacy',
          title: 'Privacy Settings',
          subtitle: 'Control your data and privacy',
          icon: Shield,
          type: 'navigation' as const,
          onPress: showComingSoon,
        },
        {
          id: 'export-data',
          title: 'Export Data',
          subtitle: 'Download your task history',
          icon: Download,
          type: 'action' as const,
          onPress: showComingSoon,
        },
      ],
    },
    {
      title: 'Support',
      items: [
        {
          id: 'help',
          title: 'Help & FAQ',
          subtitle: 'Get answers to common questions',
          icon: HelpCircle,
          type: 'navigation' as const,
          onPress: showComingSoon,
        },
        {
          id: 'contact',
          title: 'Contact Support',
          subtitle: 'Get help from our team',
          icon: Mail,
          type: 'navigation' as const,
          onPress: showComingSoon,
        },
      ],
    },
    {
      title: 'Account Actions',
      items: [
        {
          id: 'sign-out',
          title: 'Sign Out',
          subtitle: 'Sign out of your account',
          icon: LogOut,
          type: 'action' as const,
          onPress: handleSignOut,
          destructive: true,
        },
        {
          id: 'clear-data',
          title: 'Clear All Data',
          subtitle: 'Permanently delete all tasks and data',
          icon: Trash2,
          type: 'action' as const,
          destructive: true,
          onPress: () => showConfirmation(
            'Clear All Data',
            'This action cannot be undone. All your tasks and data will be permanently deleted.'
          ),
        },
      ],
    },
  ];

  const renderSettingItem = (item: SettingItem, index: number) => {
    const IconComponent = item.icon;
    
    return (
      <View
        key={item.id}
       
        style={[styles.settingItem, { backgroundColor: theme.colors.surface }]}
      >
        <TouchableOpacity
          onPress={item.onPress}
          style={styles.settingContent}
          disabled={item.type === 'toggle'}
        >
          <View style={styles.settingLeft}>
            <View style={[
              styles.settingIcon,
              { 
                backgroundColor: item.destructive 
                  ? theme.colors.error + '20' 
                  : theme.colors.primary + '20' 
              }
            ]}>
              <IconComponent 
                size={20} 
                color={item.destructive ? theme.colors.error : theme.colors.primary} 
                strokeWidth={2} 
              />
            </View>
            <View style={styles.settingText}>
              <Text style={[
                styles.settingTitle,
                { 
                  color: item.destructive ? theme.colors.error : theme.colors.text 
                }
              ]}>
                {item.title}
              </Text>
              {item.subtitle && (
                <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>
                  {item.subtitle}
                </Text>
              )}
            </View>
          </View>
          
          <View style={styles.settingRight}>
            {item.type === 'toggle' && (
              <Switch
                value={item.value}
                onValueChange={item.onToggle}
                trackColor={{
                  false: theme.colors.border,
                  true: theme.colors.primary + '50',
                }}
                thumbColor={item.value ? theme.colors.primary : theme.colors.textTertiary}
              />
            )}
            {item.type === 'navigation' && (
              <ChevronRight size={20} color={theme.colors.textTertiary} strokeWidth={2} />
            )}
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Animated.View 
          entering={FadeIn.duration(600)}
          style={styles.header}
        >
          <LinearGradient
            colors={[theme.colors.primary, theme.colors.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerGradient}
          >
            <View style={styles.headerContent}>
              <View style={styles.headerLeft}>
                <Settings size={32} color="white" strokeWidth={2} />
                <View style={styles.headerText}>
                  <Text style={styles.headerTitle}>Settings</Text>
                  <Text style={styles.headerSubtitle}>
                    Customize your experience
                  </Text>
                </View>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* User Info */}
        <Animated.View
          entering={SlideInUp.delay(200).duration(600)}
          style={[styles.userInfo, { backgroundColor: theme.colors.surface }]}
        >
          <View style={[styles.userAvatar, { backgroundColor: theme.colors.primary }]}>
            <Text style={styles.userAvatarText}>
              {profile?.full_name 
                ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                : 'U'
              }
            </Text>
          </View>
          <View style={styles.userDetails}>
            <Text style={[styles.userFullName, { color: theme.colors.text }]}>
              {profile?.full_name || 'User'}
            </Text>
            <Text style={[styles.userEmail, { color: theme.colors.textSecondary }]}>
              {profile?.email || user?.email}
            </Text>
          </View>
        </Animated.View>

        {/* Settings Sections */}
        <View style={styles.sectionsContainer}>
          {settingSections.map((section, sectionIndex) => (
            <Animated.View
              key={section.title}
              entering={SlideInUp.delay(300 + sectionIndex * 100).duration(600)}
              style={styles.section}
            >
              <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
                {section.title.toUpperCase()}
              </Text>
              <View style={styles.sectionItems}>
                {section.items.map((item, itemIndex) => renderSettingItem(item, itemIndex))}
              </View>
            </Animated.View>
          ))}
        </View>

        {/* App Info */}
        <Animated.View
          entering={FadeIn.delay(800).duration(600)}
          style={styles.appInfo}
        >
          <Text style={[styles.appName, { color: theme.colors.text }]}>
            Juey
          </Text>
          <Text style={[styles.appVersion, { color: theme.colors.textSecondary }]}>
            Version 1.0.0
          </Text>
          <Text style={[styles.appCopyright, { color: theme.colors.textTertiary }]}>
            © 2024 Juey. All rights reserved.
          </Text>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    marginBottom: 24,
    overflow: 'hidden',
  },
  headerGradient: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerText: {
    marginLeft: 16,
  },
  headerTitle: {
    color: 'white',
    fontSize: 24,
    fontFamily: 'Inter-Bold',
  },
  headerSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    marginTop: 2,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 32,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  userAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  userAvatarText: {
    color: 'white',
    fontSize: 20,
    fontFamily: 'Inter-Bold',
  },
  userDetails: {
    flex: 1,
  },
  userFullName: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  sectionsContainer: {
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    letterSpacing: 1,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sectionItems: {
    gap: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  settingItem: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  settingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    lineHeight: 18,
  },
  settingRight: {
    marginLeft: 16,
  },
  appInfo: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 100,
    marginTop: 20,
  },
  appName: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    marginBottom: 4,
  },
  appVersion: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    marginBottom: 8,
  },
  appCopyright: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
  },
});