import React, { useEffect } from 'react';
import { Tabs, router } from 'expo-router';
import { House as Home, Plus, ChartBar as BarChart3, Settings, Sparkles, TestTube } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { View, StyleSheet, Platform } from 'react-native';

function TabIcon({ icon: Icon, focused, color }: { icon: any; focused: boolean; color: string }) {
  const { theme } = useTheme();
  return (
    <View style={focused ? [styles.tabIconActive, { backgroundColor: theme.colors.primary }] : null}>
      <Icon
        size={28}
        color={focused ? 'white' : color}
        strokeWidth={2.2}
      />
    </View>
  );
}

export default function TabLayout() {
  const { theme } = useTheme();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/(auth)/sign-in');
    }
  }, [user, loading]);

  if (loading || !user) {
    return null;
  }

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.isDark ? theme.colors.surface : theme.colors.surface,
          borderTopColor: theme.colors.border,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 80 : 72,
          paddingBottom: Platform.OS === 'ios' ? 24 : 12,
          paddingTop: 6,
          shadowColor: theme.colors.shadow,
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
          elevation: 8,
        },
        tabBarShowLabel: true,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textTertiary,
        tabBarLabelStyle: {
          fontFamily: 'Inter-Medium',
          fontSize: 12,
          marginTop: 2,
        },
      })}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon icon={Home} focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="suggestions"
        options={{
          title: 'AI Suggest',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon icon={Sparkles} focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="add-task"
        options={{
          title: 'Add Task',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon icon={Plus} focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: 'Analytics',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon icon={BarChart3} focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon icon={Settings} focused={focused} color={color} />
          ),
        }}
      />
      {/* Development only - remove in production */}
      <Tabs.Screen
        name="test-runner"
        options={{
          title: 'Tests',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon icon={TestTube} focused={focused} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabIconActive: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2563EB', // fallback, will be overridden by theme
    marginBottom: 2,
  },
});