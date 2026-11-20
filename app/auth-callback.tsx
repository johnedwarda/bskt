// Lands here when an OAuth provider redirects back into the app.
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { completeSessionFromUrl } from '@/lib/auth';
import { C } from '@/theme';

export default function AuthCallback() {
  const url = Linking.useURL();
  const router = useRouter();
  useEffect(() => {
    if (!url) return;
    completeSessionFromUrl(url)
      .catch(() => false)
      .finally(() => router.replace('/'));
  }, [url, router]);
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.ground }}>
      <ActivityIndicator color={C.green} />
    </View>
  );
}
