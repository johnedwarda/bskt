import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigured = !!url && !!anonKey && !url.includes('YOUR-PROJECT');

export const supabase = createClient(url || 'http://localhost:54321', anonKey || 'missing-key', {
  auth: {
    storage: Platform.OS === 'web' && typeof window === 'undefined' ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});

// Which social sign-in providers are switched on in the Supabase project.
export async function enabledProviders(): Promise<{ apple: boolean; google: boolean }> {
  try {
    const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: anonKey ?? '' } });
    const json = await res.json();
    return { apple: !!json?.external?.apple, google: !!json?.external?.google };
  } catch {
    return { apple: false, google: false };
  }
}

// Only refresh the session while the app is in the foreground.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
