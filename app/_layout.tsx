import { BricolageGrotesque_700Bold } from '@expo-google-fonts/bricolage-grotesque';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { AuthProvider, PENDING_JOIN_KEY, useAuth } from '@/lib/auth';
import { supabaseConfigured } from '@/lib/supabase';
import { C, F } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

function Gate() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const top = segments[0];
    const inAuth = top === '(auth)';
    const passthrough = top === 'join' || top === 'auth-callback';
    if (!session && !inAuth && !passthrough) router.replace('/intro');
    else if (session && inAuth) {
      AsyncStorage.getItem(PENDING_JOIN_KEY).then((token) => {
        if (token) router.replace(`/join/${token}`);
        else router.replace('/');
      });
    }
  }, [session, loading, segments, router]);

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.ground }, animation: 'slide_from_right' }}>
      <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
      <Stack.Screen name="(app)" options={{ animation: 'fade' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    BricolageGrotesque_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  if (!supabaseConfigured) {
    return (
      <View style={{ flex: 1, backgroundColor: C.ground, padding: 24, justifyContent: 'center', gap: 12 }}>
        <Text style={{ fontFamily: F.display, fontSize: 28, color: C.ink }}>Connect Supabase</Text>
        <Text style={{ fontFamily: F.regular, fontSize: 15, lineHeight: 22, color: C.muted }}>
          Copy .env.example to .env, add your project's EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY,
          then restart with npx expo start -c.
        </Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: C.ground }}>
      <StatusBar style="dark" />
      <KeyboardProvider>
        <AuthProvider>
          <Gate />
        </AuthProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
