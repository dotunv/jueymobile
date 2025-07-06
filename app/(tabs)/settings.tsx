import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Settings, User, Bell, Moon, Sun, Brain, Shield, Download, Trash2, CircleHelp as HelpCircle, Mail, ChevronRight, Palette, Database, Zap, LogOut, Edit3, Save, X } from 'lucide-react-native';
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
  const { user, profile, signOut, updateProfile } = useAuth();
  const preferences = usePreferencesStore((state) => state.preferences);
  const setPreferences = usePreferencesStore((state) => state.setPreferences);
  const updatePreferences = usePreferencesStore((state) => state.updatePreferences);
  const [notifications, setNotifications] = useState(true);
  const [aiSuggestions, setAiSuggestions] = useState(true);
  const [smartReminders, setSmartReminders] = useState(false);
  const [dataSync, setDataSync] = useState(true);
  
  // Edit Profile Modal State
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editUsername, setEditUsername] = useState(profile?.username || '');
  const [editFullName, setEditFullName] = useState(profile?.full_name || '');
  const [editLoading, setEditLoading] = useState(false);
  const [editErrors, setEditErrors] = useState<{ username?: string; fullName?: string; general?: string }>({});

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

  const openEditProfile = () => {
    setEditUsername(profile?.username || '');
    setEditFullName(profile?.full_name || '');
    setEditErrors({});
    setShowEditProfile(true);
  };

  const closeEditProfile = () => {
    setShowEditProfile(false);
    setEditErrors({});
  };

  const validateEditForm = () => {
    const newErrors: { username?: string; fullName?: string } = {};

    if (!editUsername.trim()) {
      newErrors.username = 'Username is required';
    } else if (editUsername.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    } else if (!/^[a-zA-Z0-9_]+$/.test(editUsername)) {
      newErrors.username = 'Username can only contain letters, numbers, and underscores';
    }

    if (!editFullName.trim()) {
      newErrors.fullName = 'Full name is required';
    }

    setEditErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveProfile = async () => {
    if (!validateEditForm()) return;

    setEditLoading(true);
    setEditErrors({});

    try {
      const { error } = await updateProfile({
        username: editUsername.trim(),
        full_name: editFullName.trim(),
      });

      if (error) {
        setEditErrors({ general: error.message });
      } else {
        Alert.alert('Success', 'Profile updated successfully!');
        closeEditProfile();
      }
    } catch (error: any) {
      setEditErrors({ general: 'An unexpected error occurred' });
    } finally {
      setEditLoading(false);
    }
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
          onPress: openEditProfile,
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
              {profile?.username 
                ? profile.username.charAt(0).toUpperCase()
                : profile?.full_name
                ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                : 'U'
              }
            </Text>
          </View>
          <View style={styles.userDetails}>
            <Text style={[styles.userFullName, { color: theme.colors.text }]}>
              {profile?.username || profile?.full_name || 'User'}
            </Text>
            <Text style={[styles.userEmail, { color: theme.colors.textSecondary }]}>
              {profile?.email || user?.email}
            </Text>
            <Text style={[styles.editHint, { color: theme.colors.textTertiary }]}>
              Tap to edit profile
            </Text>
          </View>
          <TouchableOpacity 
            onPress={openEditProfile}
            style={[styles.editButton, { backgroundColor: theme.colors.primary + '20' }]}
          >
            <Edit3 size={16} color={theme.colors.primary} strokeWidth={2} />
          </TouchableOpacity>
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

      {/* Edit Profile Modal */}
      <Modal
        visible={showEditProfile}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeEditProfile}
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
          <KeyboardAvoidingView 
            style={styles.modalContent}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={closeEditProfile} style={styles.modalCloseButton}>
                <X size={24} color={theme.colors.text} strokeWidth={2} />
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                Edit Profile
              </Text>
              <TouchableOpacity 
                onPress={handleSaveProfile} 
                disabled={editLoading}
                style={styles.modalSaveButton}
              >
                {editLoading ? (
                  <Text style={[styles.modalSaveText, { color: theme.colors.textTertiary }]}>
                    Saving...
                  </Text>
                ) : (
                  <Save size={24} color={theme.colors.primary} strokeWidth={2} />
                )}
              </TouchableOpacity>
            </View>

            {/* Form */}
            <ScrollView style={styles.modalForm} showsVerticalScrollIndicator={false}>
              {/* General Error */}
              {editErrors.general && (
                <View style={[styles.errorContainer, { backgroundColor: theme.colors.error + '20' }]}>
                  <Text style={[styles.errorText, { color: theme.colors.error }]}>
                    {editErrors.general}
                  </Text>
                </View>
              )}

              {/* Username Input */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Username</Text>
                <View style={[
                  styles.inputContainer,
                  { 
                    backgroundColor: theme.colors.surface,
                    borderColor: editErrors.username ? theme.colors.error : theme.colors.border,
                  }
                ]}>
                  <User size={20} color={theme.colors.textSecondary} strokeWidth={2} />
                  <TextInput
                    style={[styles.textInput, { color: theme.colors.text }]}
                    placeholder="Enter your username"
                    placeholderTextColor={theme.colors.textTertiary}
                    value={editUsername}
                    onChangeText={setEditUsername}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
                {editErrors.username && (
                  <Text style={[styles.fieldError, { color: theme.colors.error }]}>
                    {editErrors.username}
                  </Text>
                )}
              </View>

              {/* Full Name Input */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Full Name</Text>
                <View style={[
                  styles.inputContainer,
                  { 
                    backgroundColor: theme.colors.surface,
                    borderColor: editErrors.fullName ? theme.colors.error : theme.colors.border,
                  }
                ]}>
                  <User size={20} color={theme.colors.textSecondary} strokeWidth={2} />
                  <TextInput
                    style={[styles.textInput, { color: theme.colors.text }]}
                    placeholder="Enter your full name"
                    placeholderTextColor={theme.colors.textTertiary}
                    value={editFullName}
                    onChangeText={setEditFullName}
                    autoCapitalize="words"
                    autoCorrect={false}
                  />
                </View>
                {editErrors.fullName && (
                  <Text style={[styles.fieldError, { color: theme.colors.error }]}>
                    {editErrors.fullName}
                  </Text>
                )}
              </View>

              {/* Email Display (Read-only) */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Email</Text>
                <View style={[
                  styles.inputContainer,
                  { 
                    backgroundColor: theme.colors.surface + '50',
                    borderColor: theme.colors.border,
                  }
                ]}>
                  <Mail size={20} color={theme.colors.textTertiary} strokeWidth={2} />
                  <Text style={[styles.textInput, { color: theme.colors.textTertiary }]}>
                    {profile?.email || user?.email}
                  </Text>
                </View>
                <Text style={[styles.fieldHelp, { color: theme.colors.textTertiary }]}>
                  Email cannot be changed
                </Text>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
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
  editButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editHint: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    marginTop: 4,
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
  // Modal Styles
  modalContainer: {
    flex: 1,
  },
  modalContent: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  modalCloseButton: {
    padding: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    flex: 1,
    textAlign: 'center',
  },
  modalSaveButton: {
    padding: 8,
  },
  modalSaveText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
  },
  modalForm: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  errorContainer: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  errorText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  fieldError: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    marginTop: 4,
  },
  fieldHelp: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    marginTop: 4,
  },
});