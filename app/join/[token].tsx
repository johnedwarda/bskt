// Opening a share link (bskt://join/<token>) adds you to that list.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Button, Display, T } from '@/components/ui';
import { PENDING_JOIN_KEY, useAuth } from '@/lib/auth';
import { joinList } from '@/lib/useLists';
import { C } from '@/theme';

export default function Join() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { session, loading } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !token) return;
    if (!session) {
      // remember it, sign in first, then come back here
      AsyncStorage.setItem(PENDING_JOIN_KEY, token).then(() => router.replace('/intro'));
      return;
    }
    AsyncStorage.removeItem(PENDING_JOIN_KEY);
    joinList(token)
      .then((listId) => router.replace(`/list/${listId}`))
      .catch((e) => setError(e.message ?? 'This invite link doesn’t work any more.'));
  }, [token, session, loading, router]);

  return (
    <View style={{ flex: 1, backgroundColor: C.ground, padding: 24, justifyContent: 'center', gap: 16 }}>
      {error ? (
        <>
          <Display size={28}>Couldn’t join that list</Display>
          <T style={{ color: C.muted }}>{error}</T>
          <Button label="Go to your lists" onPress={() => router.replace('/')} />
        </>
      ) : (
        <ActivityIndicator color={C.green} />
      )}
    </View>
  );
}
