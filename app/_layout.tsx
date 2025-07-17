import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { useFonts } from 'expo-font';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { ThemeProvider } from '@/context/ThemeContext';
import { AuthProvider } from '@/context/AuthContext';
import { DatabaseProvider } from '@/context/DatabaseContext';
import { usePreferencesStore } from '@/lib/preferencesStore';
import { Image, ActivityIndicator, View, Text } from 'react-native';
import { OfflineAIProvider } from '@/context/ThemeContext';

SplashScreen.preventAutoHideAsync();

function AppSplashScreen() {
  const colorScheme = useColorScheme();
  const logo = colorScheme === 'dark'
    ? require('@/assets/images/logo-dark.svg')
    : require('@/assets/images/logo-light.svg');
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colorScheme === 'dark' ? '#121212' : '#fff' }}>
      <Image
        source={logo}
        style={{ width: 96, height: 96, marginBottom: 32 }}
        resizeMode="contain"
      />
      <Text style={{ fontSize: 28, fontWeight: 'bold', color: colorScheme === 'dark' ? '#3B82F6' : '#2563EB', marginBottom: 8 }}>Juey</Text>
      <Text style={{ fontSize: 16, color: '#888', marginBottom: 32 }}>Your Smart Task Companion</Text>
      <ActivityIndicator size="large" color={colorScheme === 'dark' ? '#3B82F6' : '#2563EB'} />
    </View>
  );
}

export default function RootLayout() {
  useFrameworkReady();
  
  const [fontsLoaded, fontError] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-Medium': Inter_500Medium,
    'Inter-SemiBold': Inter_600SemiBold,
    'Inter-Bold': Inter_700Bold,
  });

  const hasHydrated = usePreferencesStore((state) => state._hasHydrated);

  useEffect(() => {
    if ((fontsLoaded || fontError) && hasHydrated) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, hasHydrated]);

  if ((!fontsLoaded && !fontError) || !hasHydrated) {
    return <AppSplashScreen />;
  }

  return (
    <AuthProvider>
      <DatabaseProvider>
        <ThemeProvider>
          <OfflineAIProvider>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="+not-found" />
            </Stack>
            <StatusBar style="auto" />
          </OfflineAIProvider>
        </ThemeProvider>
      </DatabaseProvider>
    </AuthProvider>
  );
}