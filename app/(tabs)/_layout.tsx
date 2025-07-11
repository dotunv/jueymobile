import React, { useEffect } from 'react';
import { Tabs, router } from 'expo-router';
import {
  House as Home,
  Plus,
  ChartBar as BarChart3,
  Settings,
  Sparkles,
  TestTube,
} from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { View, StyleSheet, Platform } from 'react-native';

function TabIcon({
  icon: Icon,
  focused,
  color,
  routeName,
}: {
  icon: any;
  focused: boolean;
  color: string;
  routeName: string;
}) {
  const { theme } = useTheme();

  if (routeName === 'add-task') {
    return (
      <View style={styles.fabContainer}>
        <View style={[styles.fabButton, { backgroundColor: theme.colors.primary }]}>
          <Icon size={28} color="white" strokeWidth={2} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.iconWrapper}>
      {focused ? (
        <View style={[styles.tabIconActive, { backgroundColor: theme.colors.primary }]}>
          <Icon size={24} color="white" strokeWidth={2} />
        </View>
      ) : (
        <Icon size={24} color={color} strokeWidth={2} />
      )}
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

  if (loading || !user) return null;

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: 10,
          height: 80,
          paddingTop: 10,
          paddingBottom: Platform.OS === 'ios' ? 24 : 12,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.1,
          shadowRadius: 12,
          elevation: 10,
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
            <TabIcon icon={Home} focused={focused} color={color} routeName="index" />
          ),
        }}
      />
      <Tabs.Screen
        name="suggestions"
        options={{
          title: 'AI Suggest',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon icon={Sparkles} focused={focused} color={color} routeName="suggestions" />
          ),
        }}
      />
      <Tabs.Screen
        name="add-task"
        options={{
          title: '',
          tabBarLabel: '',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon icon={Plus} focused={focused} color={color} routeName="add-task" />
          ),
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: 'Analytics',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon icon={BarChart3} focused={focused} color={color} routeName="analytics" />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon icon={Settings} focused={focused} color={color} routeName="settings" />
          ),
        }}
      />
      <Tabs.Screen
        name="test-runner"
        options={{
          title: 'Tests',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon icon={TestTube} focused={focused} color={color} routeName="test-runner" />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrapper: {
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabIconActive: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Platform.OS === 'ios' ? 4 : 2,
  },
  fabContainer: {
    position: 'absolute',
    top: -24,
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 8,
  },
  fabButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
