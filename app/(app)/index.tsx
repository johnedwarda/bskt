// Your lists, and lists shared with you.
import { useRouter } from 'expo-router';
import { haptic } from '@/lib/haptics';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconPlus, IconUndo } from '@/components/icons';
import { ListCard } from '@/components/ListCard';
import { ListEditSheet } from '@/components/ListEditSheet';
import { type Origin } from '@/components/Sheet';
import { Avatar, Button } from '@/components/ui';
import { Wordmark } from '@/components/Wordmark';
import { signOut, useAuth } from '@/lib/auth';
import { ListProvider } from '@/lib/ListStore';
import { createList, deleteList, leaveList, useLists } from '@/lib/useLists';
import { C, F, R } from '@/theme';

export default function Lists() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userId, profile, session } = useAuth();
  // the account picture from the sign-in provider (Google gives avatar_url / picture)
  const meta = session?.user.user_metadata ?? {};
  const photo: string | null = meta.avatar_url || meta.picture || null;
  const me = userId ?? '';
  const { lists, loading, error, reload } = useLists();
  const [edit, setEdit] = useState<{ id: string; origin: Origin | null } | null>(null);
  const editId = edit?.id ?? null;
  const [hidden, setHidden] = useState<string[]>([]);
  const [undo, setUndo] = useState<{ id: string; name: string; kind: 'delete' | 'leave' } | null>(null);
  const [creating, setCreating] = useState(false);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);

  const visible = lists.filter((l) => !hidden.includes(l.id));
  const mine = visible.filter((l) => l.owner_id === me);
  const shared = visible.filter((l) => l.owner_id !== me);

  // Delete / leave only happens after the Undo window closes.
  const commit = async (u: NonNullable<typeof undo>) => {
    try {
      if (u.kind === 'delete') await deleteList(u.id);
      else await leaveList(u.id, me);
      await reload();
    } catch (e) {
      Alert.alert('Something went wrong', (e as Error).message);
    } finally {
      setHidden((h) => h.filter((x) => x !== u.id));
    }
  };
  const schedule = (id: string, name: string, kind: 'delete' | 'leave') => {
    if (pending.current && undo) { clearTimeout(pending.current); commit(undo); }
    const u = { id, name, kind };
    haptic.remove();
    setHidden((h) => [...h, id]);
    setUndo(u);
    pending.current = setTimeout(() => { setUndo(null); commit(u); }, 5000);
  };
  const doUndo = () => {
    if (pending.current) clearTimeout(pending.current);
    if (undo) setHidden((h) => h.filter((x) => x !== undo.id));
    setUndo(null);
  };
  useEffect(() => () => { if (pending.current) clearTimeout(pending.current); }, []);

  const newList = async () => {
    setCreating(true);
    try {
      const l = await createList(lists.length ? 'New list' : 'Groceries');
      await reload();
      setEdit({ id: l.id, origin: null });
    } catch (e) {
      Alert.alert('Couldn’t create a list', (e as Error).message);
    } finally { setCreating(false); }
  };

  const account = () =>
    Alert.alert(profile?.name || 'Your account', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => signOut() },
    ]);

  return (
    <View style={{ flex: 1, paddingTop: insets.top }}>
      <View style={styles.header}>
        <Wordmark width={80} />
        <Pressable accessibilityRole="button" accessibilityLabel="Account" onPress={account}>
          <Avatar label="You" bg={C.green} fg={C.white} uri={photo} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 20, gap: 14 }}>
        <Text style={styles.h2}>Your lists</Text>
        {loading ? (
          <ActivityIndicator color={C.green} style={{ marginVertical: 24 }} />
        ) : mine.length ? (
          mine.map((l) => <ListCard key={l.id} list={l} me={me} onOpen={() => router.push(`/list/${l.id}`)} hidden={editId === l.id} onEdit={(o) => setEdit({ id: l.id, origin: o })} />)
        ) : (
          <Text style={styles.none}>No lists of your own yet.</Text>
        )}
        {error && <Text style={{ fontFamily: F.regular, fontSize: 13, color: C.danger }}>{error}</Text>}

        {shared.length > 0 && <Text style={[styles.h2, { marginTop: 10 }]}>Shared with you</Text>}
        {shared.map((l) => <ListCard key={l.id} list={l} me={me} onOpen={() => router.push(`/list/${l.id}`)} hidden={editId === l.id} onEdit={(o) => setEdit({ id: l.id, origin: o })} />)}
      </ScrollView>

      <View style={{ padding: 20, paddingBottom: 20 + insets.bottom, borderTopWidth: 1, borderTopColor: C.line }}>
        <Button label="New list" loading={creating} onPress={newList} icon={(c) => <IconPlus size={20} color={c} />} />
      </View>

      {undo && (
        <Animated.View entering={FadeInDown} exiting={FadeOutDown} accessibilityRole="alert" style={[styles.toast, { bottom: 102 + insets.bottom }]}>
          <Text style={{ flex: 1, fontFamily: F.regular, fontSize: 14, color: C.white }} numberOfLines={2}>
            {undo.kind === 'delete' ? `“${undo.name}” deleted` : `You left “${undo.name}”`}
          </Text>
          <Button variant="white" label="Undo" onPress={doUndo} icon={(c) => <IconUndo size={16} color={c} />} />
        </Animated.View>
      )}

      {editId && (
        <ListProvider listId={editId}>
          <ListEditSheet
            visible={!!editId}
            origin={edit?.origin}
            onClose={() => { setEdit(null); reload(); }}
            onDelete={(id, name) => schedule(id, name, 'delete')}
            onLeave={(id, name) => schedule(id, name, 'leave')}
          />
        </ListProvider>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  h2: { fontFamily: F.semibold, fontSize: 15, color: C.ink },
  none: {
    paddingVertical: 18, paddingHorizontal: 16, borderRadius: R.card, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.outline,
    fontFamily: F.regular, fontSize: 14, color: C.muted, textAlign: 'center',
  },
  toast: {
    position: 'absolute', left: 20, right: 20, zIndex: 12, paddingVertical: 6, paddingRight: 6, paddingLeft: 18, borderRadius: 28,
    backgroundColor: C.ink, flexDirection: 'row', alignItems: 'center', gap: 10,
  },
});
