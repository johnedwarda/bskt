import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '@/lib/auth';
import { useList } from '@/lib/ListStore';
import { C, F } from '@/theme';
import { IconCheck, IconClose, IconInvite, IconLink, IconTrash } from './icons';
import { type Origin, Sheet } from './Sheet';
import { Avatar, Button, Display, Divider, Switch } from './ui';

type Props = {
  visible: boolean;
  origin?: Origin | null;
  onClose: () => void;
  // Deleting is handed to the caller so it can offer Undo for a few seconds.
  onDelete: (listId: string, name: string) => void;
  onLeave: (listId: string, name: string) => void;
};

export function ListEditSheet({ visible, origin, onClose, onDelete, onLeave }: Props) {
  const { list, members, invites, me, invite, cancelInvite, setNotify, renameList, shoppingNow } = useList();
  const meta = useAuth().session?.user.user_metadata ?? {};
  const photo: string | null = meta.avatar_url || meta.picture || null;
  const [name, setName] = useState(list?.name ?? '');
  const [email, setEmail] = useState('');
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const saved = useRef(list?.name ?? '');

  useEffect(() => {
    if (visible) { setName(list?.name ?? ''); saved.current = list?.name ?? ''; setConfirm(false); setInviteMsg(null); setCopied(false); }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!list) return null;
  const isOwner = list.owner_id === me;
  const mine = members.find((m) => m.user_id === me);
  const displayName = name.trim() || 'Untitled list';

  const saveName = () => {
    const n = name.trim() || 'Untitled list';
    if (n !== saved.current) { saved.current = n; renameList(n); }
  };

  const sendInvite = async () => {
    const e = email.trim();
    if (!e) return;
    setInviteBusy(true);
    setInviteMsg(null);
    try {
      const r = await invite(e);
      setEmail('');
      setInviteMsg(r === 'added' ? `${e} can see this list now.` : `Invite saved. ${e} joins when they sign up with that email.`);
    } catch (err) {
      setInviteMsg((err as Error).message === 'invalid email' ? 'That doesn’t look like an email address.' : (err as Error).message);
    } finally { setInviteBusy(false); }
  };

  const copyLink = async () => {
    await Clipboard.setStringAsync(Linking.createURL(`join/${list.invite_token}`));
    setCopied(true);
  };

  const sorted = members.slice().sort((a, b) => (a.user_id === me ? -1 : b.user_id === me ? 1 : 0));

  return (
    <Sheet visible={visible} origin={origin} onClose={() => { saveName(); onClose(); }}>
      {(close) => (<>
      <Display size={26}>Edit list</Display>
      <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 16 }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 6 }}>
          <Text style={styles.label}>List name</Text>
          <TextInput
            accessibilityLabel="List name" value={name} onChangeText={setName} onBlur={saveName} placeholder="Name this list"
            placeholderTextColor="#8B958F" returnKeyType="done" style={[styles.input, { height: 44, borderRadius: 22, fontFamily: F.semibold }]}
          />
        </View>
        <Divider />
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <Text style={styles.h}>Shared with</Text>
          <Text style={styles.meta}>{members.length + invites.length} {members.length + invites.length === 1 ? 'person' : 'people'}</Text>
        </View>
        <View>
          {sorted.map((m) => {
            const you = m.user_id === me;
            const nm = you ? 'You' : m.profiles?.name || 'Someone';
            const shopping = shoppingNow(m.user_id);
            return (
              <View key={m.user_id} style={styles.member}>
                <Avatar size={32} label={you ? 'You' : nm.charAt(0).toUpperCase()} bg={you ? C.green : m.profiles?.color || '#E2DED2'} fg={you ? C.white : C.ink} uri={you ? photo || m.profiles?.avatar_url : m.profiles?.avatar_url} />
                <View style={{ flex: 1, gap: 1 }}>
                  <Text style={{ fontFamily: F.medium, fontSize: 14, color: C.ink }}>{nm}</Text>
                  {shopping && <Text style={{ fontFamily: F.semibold, fontSize: 12, color: C.greenText }}>Shopping now</Text>}
                </View>
                <Text style={styles.meta}>{m.role === 'owner' ? 'Owner' : 'Can edit'}</Text>
              </View>
            );
          })}
          {invites.map((iv) => (
            <View key={iv.id} style={styles.member}>
              <Avatar size={32} label={iv.email.charAt(0).toUpperCase()} bg={C.ground} fg={C.muted} dashed />
              <View style={{ flex: 1, gap: 1 }}>
                <Text style={{ fontFamily: F.medium, fontSize: 14, color: C.ink }} numberOfLines={1}>{iv.email}</Text>
                <Text style={{ fontFamily: F.semibold, fontSize: 12, color: C.muted }}>Invite sent · not joined yet</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel={`Cancel invite for ${iv.email}`} onPress={() => cancelInvite(iv.id)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                <IconClose size={16} color={C.muted} />
              </Pressable>
            </View>
          ))}
        </View>
        <View style={{ gap: 6 }}>
          <Text style={styles.label}>Invite by email</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              accessibilityLabel="Email to invite" value={email} onChangeText={setEmail} placeholder="e.g. grandma@example.com"
              placeholderTextColor="#8B958F" keyboardType="email-address" autoCapitalize="none" autoComplete="email"
              returnKeyType="send" onSubmitEditing={sendInvite} style={[styles.input, { flex: 1 }]}
            />
            <Button label="Invite" loading={inviteBusy} onPress={sendInvite} icon={(c) => <IconInvite size={16} color={c} />} />
          </View>
          {inviteMsg && <Text style={{ fontFamily: F.regular, fontSize: 12, color: C.muted }}>{inviteMsg}</Text>}
          <Button
            variant={copied ? 'primary' : 'outline'} label={copied ? 'Link copied' : 'Copy invite link'} onPress={copyLink}
            icon={(c) => <IconLink size={16} color={c} />} style={{ alignSelf: 'flex-start', marginTop: 4 }}
          />
        </View>
        <Divider />
        <View style={{ gap: 4 }}>
          <Text style={styles.h}>Notifications</Text>
          {([['notify_shop', 'When someone starts shopping'], ['notify_add', 'When items are added']] as const).map(([k, label]) => (
            <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 }}>
              <Text style={{ flex: 1, fontFamily: F.regular, fontSize: 14, color: C.ink }}>{label}</Text>
              <Switch label={label} value={!!mine?.[k]} onChange={(v) => setNotify(k, v)} />
            </View>
          ))}
        </View>
      </ScrollView>
      {confirm ? (
        <View style={{ gap: 8 }}>
          <Text style={{ fontFamily: F.regular, fontSize: 13, color: C.muted, textAlign: 'center' }}>
            {isOwner ? `Delete “${displayName}” for everyone on it?` : `Leave “${displayName}”? You can rejoin with an invite.`}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button flex variant="neutral" label="Cancel" onPress={() => setConfirm(false)} icon={(c) => <IconClose size={16} color={c} />} style={{ backgroundColor: 'transparent' }} />
            <Button
              flex variant="danger" label={isOwner ? 'Delete' : 'Leave'} icon={(c) => <IconTrash size={16} color={c} />}
              onPress={() => close(() => (isOwner ? onDelete : onLeave)(list.id, displayName))}
            />
          </View>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button variant="dangerOutline" label={isOwner ? 'Delete list' : 'Leave list'} onPress={() => setConfirm(true)} icon={(c) => <IconTrash size={16} color={c} />} />
          <Button flex label="Done" onPress={() => close()} icon={(c) => <IconCheck size={20} color={c} />} />
        </View>
      )}
      </>)}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: F.semibold, fontSize: 13, color: C.muted },
  h: { fontFamily: F.semibold, fontSize: 15, color: C.ink },
  meta: { fontFamily: F.regular, fontSize: 12, color: C.muted },
  member: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48 },
  input: {
    height: 52, paddingHorizontal: 16, borderRadius: 26, borderWidth: 1, borderColor: C.line2, backgroundColor: C.white,
    fontFamily: F.regular, fontSize: 15, color: C.ink,
  },
});
