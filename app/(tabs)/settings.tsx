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
  Palette
} from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { usePreferencesStore } from '../../lib/preferencesStore';
import PageHeader from '../../components/PageHeader';

export default function SettingsScreen() {
  const { theme, toggleTheme } = useTheme();
  const { signOut, user } = useAuth();
  const preferences = usePreferencesStore((state) => state.preferences);
  const updatePreferences = usePreferencesStore((state) => state.updatePreferences);

  const handleThemeChange = () => {
    toggleTheme();
    updatePreferences({ theme: theme.isDark ? 'light' : 'dark' });
  };

  const handlePreferenceChange = (key: string, value: boolean) => {
    updatePreferences({ [key]: value });
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: signOut },
      ]
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
      title: 'Account',
      icon: User,
      items: [
        {
          title: 'Profile',
          subtitle: 'Manage your account settings',
          type: 'link' as const,
          onPress: () => console.log('Navigate to profile'),
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <PageHeader
          icon={Settings}
          title="Settings"
          subtitle="Customize your experience"
        />

        {settingsSections.map((section, sectionIndex) => (
          <View key={section.title} style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIcon}>
                <section.icon size={20} color={theme.colors.primary} strokeWidth={2} />
              </View>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                {section.title}
              </Text>
            </View>
            
            <View style={styles.sectionContent}>
              {section.items.map((item, itemIndex) => (
        <TouchableOpacity
                  key={item.title}
                  style={[
                    styles.settingItem,
                    { backgroundColor: theme.colors.surface },
                    itemIndex === section.items.length - 1 && styles.lastItem,
                  ]}
                  onPress={() => {
                    if (item.type === 'action' || item.type === 'link') {
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
              />
            )}
                    {item.type === 'theme' && (
                      <TouchableOpacity
                        style={styles.themeSelector}
                        onPress={handleThemeChange}
                      >
                        <item.icon size={20} color={theme.colors.primary} strokeWidth={2} />
                      </TouchableOpacity>
                    )}
                    {(item.type === 'link' || item.type === 'action') && (
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
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
});