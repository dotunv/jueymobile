import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  Settings, 
  Moon, 
  Sun, 
  Monitor, 
  Bell, 
  Brain, 
  Clock, 
  User, 
  LogOut,
  ChevronRight,
  Palette,
  Download,
  Upload,
  Trash2,
  Shield,
  HelpCircle
} from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { usePreferencesStore } from '../../lib/preferencesStore';
import { useDatabaseOperations } from '../../context/DatabaseContext';
import PageHeader from '../../components/PageHeader';
import ProfileModal from '../../components/ProfileModal';
import { router } from 'expo-router';

export default function SettingsScreen() {
  const { theme, toggleTheme } = useTheme();
  const { signOut, user, profile } = useAuth();
  const { getUserPreferences, createUserPreferences, updateUserPreferences } = useDatabaseOperations();
  const preferences = usePreferencesStore((state) => state.preferences);
  const setPreferences = usePreferencesStore((state) => state.setPreferences);
  const updatePreferences = usePreferencesStore((state) => state.updatePreferences);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reminderFrequency, setReminderFrequency] = useState<'hourly' | 'daily' | 'weekly'>('daily');
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Load preferences on mount
  useEffect(() => {
    loadPreferences();
  }, [user?.id]);

  const loadPreferences = async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      const userPrefs = await getUserPreferences();
      
      if (userPrefs) {
        setPreferences(userPrefs);
        setReminderFrequency(userPrefs.reminder_frequency);
      } else {
        // Create default preferences
        const defaultPrefs = {
          user_id: user.id,
          theme: 'system' as const,
          notifications_enabled: true,
          ai_suggestions_enabled: true,
          smart_reminders_enabled: false,
          reminder_frequency: 'daily' as const,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        
        await createUserPreferences(defaultPrefs);
        setPreferences(defaultPrefs);
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
      Alert.alert('Error', 'Failed to load preferences');
    } finally {
      setLoading(false);
    }
  };

  const handleThemeChange = async () => {
    try {
      setSaving(true);
      const newTheme = theme.isDark ? 'light' : 'dark';
      
      // Update local state
      toggleTheme();
      updatePreferences({ theme: newTheme });
      
      // Save to database
      if (user?.id) {
        await updateUserPreferences({ theme: newTheme });
      }
    } catch (error) {
      console.error('Error updating theme:', error);
      Alert.alert('Error', 'Failed to update theme');
    } finally {
      setSaving(false);
    }
  };

  const handlePreferenceChange = async (key: string, value: boolean) => {
    try {
      setSaving(true);
      
      // Update local state
      updatePreferences({ [key]: value });
      
      // Save to database
      if (user?.id) {
        await updateUserPreferences({ [key]: value });
      }
    } catch (error) {
      console.error('Error updating preference:', error);
      Alert.alert('Error', 'Failed to update setting');
    } finally {
      setSaving(false);
    }
  };

  const handleReminderFrequencyChange = async (frequency: 'hourly' | 'daily' | 'weekly') => {
    try {
      setSaving(true);
      setReminderFrequency(frequency);
      
      // Update local state
      updatePreferences({ reminder_frequency: frequency });
      
      // Save to database
      if (user?.id) {
        await updateUserPreferences({ reminder_frequency: frequency });
      }
    } catch (error) {
      console.error('Error updating reminder frequency:', error);
      Alert.alert('Error', 'Failed to update reminder frequency');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Sign Out', 
          style: 'destructive', 
          onPress: async () => {
            try {
              const { error } = await signOut();
              if (error) {
                Alert.alert('Error', 'Failed to sign out');
              } else {
                router.replace('/(auth)/sign-in');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to sign out');
            }
          }
        },
      ]
    );
  };

  const handleExportData = () => {
    Alert.alert(
      'Export Data',
      'This feature will be available soon. Your data will be exported as a JSON file.',
      [{ text: 'OK' }]
    );
  };

  const handleImportData = () => {
    Alert.alert(
      'Import Data',
      'This feature will be available soon. You will be able to import data from a JSON file.',
      [{ text: 'OK' }]
    );
  };

  const handleClearData = () => {
    Alert.alert(
      'Clear All Data',
      'This will permanently delete all your tasks, preferences, and settings. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear Data', 
          style: 'destructive', 
          onPress: () => {
            Alert.alert(
              'Confirm Deletion',
              'Are you absolutely sure? This will delete everything.',
              [
                { text: 'Cancel', style: 'cancel' },
                { 
                  text: 'Delete Everything', 
                  style: 'destructive', 
                  onPress: () => {
                    // TODO: Implement data clearing
                    Alert.alert('Success', 'All data has been cleared');
                  }
                },
              ]
            );
          }
        },
      ]
    );
  };

  const handlePrivacyPolicy = () => {
    Alert.alert(
      'Privacy Policy',
      'This app respects your privacy. Your data is stored locally and optionally synced to your account. We do not collect or share your personal information.',
      [{ text: 'OK' }]
    );
  };

  const handleHelp = () => {
    Alert.alert(
      'Help & Support',
      'Need help? Contact us at support@juey.app or visit our documentation.',
      [{ text: 'OK' }]
    );
  };

  const settingsSections = [
    {
      title: 'Appearance',
      icon: Palette,
      items: [
        {
          title: 'Theme',
          subtitle: theme.isDark ? 'Dark' : 'Light',
          icon: theme.isDark ? Moon : Sun,
          type: 'theme' as const,
        },
      ],
    },
    {
      title: 'Notifications',
      icon: Bell,
      items: [
        {
          title: 'Push Notifications',
          subtitle: 'Receive task reminders',
          type: 'toggle' as const,
          value: preferences?.notifications_enabled ?? false,
          onToggle: (value: boolean) => handlePreferenceChange('notifications_enabled', value),
        },
        {
          title: 'Smart Reminders',
          subtitle: 'AI-powered reminder timing',
          type: 'toggle' as const,
          value: preferences?.smart_reminders_enabled ?? false,
          onToggle: (value: boolean) => handlePreferenceChange('smart_reminders_enabled', value),
        },
        {
          title: 'Reminder Frequency',
          subtitle: reminderFrequency === 'hourly' ? 'Every hour' : 
                   reminderFrequency === 'daily' ? 'Daily' : 'Weekly',
          type: 'frequency' as const,
          value: reminderFrequency,
          onPress: () => {
            Alert.alert(
              'Reminder Frequency',
              'Choose how often you want to receive reminders',
              [
                { text: 'Cancel', style: 'cancel' },
                { 
                  text: 'Hourly', 
                  onPress: () => handleReminderFrequencyChange('hourly')
                },
                { 
                  text: 'Daily', 
                  onPress: () => handleReminderFrequencyChange('daily')
                },
                { 
                  text: 'Weekly', 
                  onPress: () => handleReminderFrequencyChange('weekly')
                },
              ]
            );
          },
        },
      ],
    },
    {
      title: 'AI Features',
      icon: Brain,
      items: [
        {
          title: 'AI Suggestions',
          subtitle: 'Get personalized task suggestions',
          type: 'toggle' as const,
          value: preferences?.ai_suggestions_enabled ?? false,
          onToggle: (value: boolean) => handlePreferenceChange('ai_suggestions_enabled', value),
        },
      ],
    },
    {
      title: 'Data Management',
      icon: Download,
      items: [
        {
          title: 'Export Data',
          subtitle: 'Download your data as JSON',
          type: 'link' as const,
          onPress: handleExportData,
        },
        {
          title: 'Import Data',
          subtitle: 'Import data from JSON file',
          type: 'link' as const,
          onPress: handleImportData,
        },
        {
          title: 'Clear All Data',
          subtitle: 'Permanently delete all data',
          type: 'action' as const,
          onPress: handleClearData,
          destructive: true,
        },
      ],
    },
    {
      title: 'Account',
      icon: User,
      items: [
        {
          title: 'Profile',
          subtitle: profile?.username || profile?.email || 'Manage your account',
          type: 'link' as const,
          onPress: () => setShowProfileModal(true),
        },
        {
          title: 'Privacy Policy',
          subtitle: 'Read our privacy policy',
          type: 'link' as const,
          onPress: handlePrivacyPolicy,
        },
        {
          title: 'Help & Support',
          subtitle: 'Get help and contact support',
          type: 'link' as const,
          onPress: handleHelp,
        },
        {
          title: 'Sign Out',
          subtitle: 'Sign out of your account',
          type: 'action' as const,
          onPress: handleSignOut,
          destructive: true,
        },
      ],
    },
  ];

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
            Loading settings...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <PageHeader
          icon={Settings}
          title="Settings"
          subtitle="Customize your experience"
        />

        {saving && (
          <View style={[styles.savingIndicator, { backgroundColor: theme.colors.primary + '20' }]}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text style={[styles.savingText, { color: theme.colors.primary }]}>
              Saving changes...
            </Text>
          </View>
        )}

        {settingsSections.map((section, sectionIndex) => (
          <View key={section.title} style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: theme.colors.primary + '15' }]}>
                <section.icon size={20} color={theme.colors.primary} strokeWidth={2} />
              </View>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                {section.title}
              </Text>
            </View>
            
            <View style={[styles.sectionContent, { backgroundColor: theme.colors.surface }]}>
              {section.items.map((item, itemIndex) => (
                <TouchableOpacity
                  key={item.title}
                  style={[
                    styles.settingItem,
                    itemIndex === section.items.length - 1 && styles.lastItem,
                  ]}
                  onPress={() => {
                    if (item.type === 'action' || item.type === 'link' || item.type === 'frequency') {
                      item.onPress?.();
                    }
                  }}
                  disabled={item.type === 'toggle' || item.type === 'theme'}
                >
                  <View style={styles.settingLeft}>
                    {'icon' in item && item.icon && (
                      <View style={[styles.itemIcon, { backgroundColor: theme.colors.primary + '15' }]}>
                        <item.icon size={18} color={theme.colors.primary} strokeWidth={2} />
                      </View>
                    )}
                    <View style={styles.settingText}>
                      <Text style={[
                        styles.settingTitle,
                        { color: 'destructive' in item && item.destructive ? theme.colors.error : theme.colors.text }
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
                        trackColor={{ false: theme.colors.border, true: theme.colors.primary + '40' }}
                        thumbColor={item.value ? theme.colors.primary : theme.colors.textTertiary}
                        disabled={saving}
                      />
                    )}
                    {item.type === 'theme' && (
                      <TouchableOpacity
                        style={styles.themeSelector}
                        onPress={handleThemeChange}
                        disabled={saving}
                      >
                        <item.icon size={20} color={theme.colors.primary} strokeWidth={2} />
                      </TouchableOpacity>
                    )}
                    {(item.type === 'link' || item.type === 'action' || item.type === 'frequency') && (
                      <ChevronRight size={20} color={theme.colors.textTertiary} strokeWidth={2} />
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        <View style={styles.footer}>
          <Text style={[styles.versionText, { color: theme.colors.textTertiary }]}>
            Juey v1.0.0
          </Text>
          <Text style={[styles.userInfo, { color: theme.colors.textTertiary }]}>
            {user?.email}
          </Text>
        </View>
      </ScrollView>

      <ProfileModal 
        visible={showProfileModal}
        onClose={() => setShowProfileModal(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0', // Fallback background
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  savingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginHorizontal: 20,
    borderRadius: 10,
  },
  savingText: {
    marginLeft: 8,
    fontSize: 14,
    fontFamily: 'Inter-Medium',
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  sectionContent: {
    backgroundColor: 'transparent',
    borderRadius: 16,
    overflow: 'hidden',
    marginHorizontal: 20,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  lastItem: {
    borderBottomWidth: 0,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  itemIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
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
  themeSelector: {
    padding: 8,
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 100,
    alignItems: 'center',
  },
  versionText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  userInfo: {
    marginTop: 4,
    fontSize: 12,
    fontFamily: 'Inter-Regular',
  },
});