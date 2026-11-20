// Shared frame for the log-in and sign-up screens.
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { signInWithProvider } from '@/lib/auth';
import { enabledProviders } from '@/lib/supabase';
import { C, F } from '@/theme';
import { IconBack } from './icons';
import { Button, Display, Divider, IconButton } from './ui';

type Props = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footerPrompt: string;
  footerLabel: string;
  onFooter: () => void;
  belowSocial?: React.ReactNode;
};

export function AuthScaffold({ title, subtitle, children, footerPrompt, footerLabel, onFooter, belowSocial }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState<'apple' | 'google' | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [providers, setProviders] = useState({ apple: false, google: false });
  useEffect(() => { enabledProviders().then(setProviders); }, []);
  const anySocial = providers.apple || providers.google;

  const social = async (p: 'apple' | 'google') => {
    setErr(null);
    setBusy(p);
    try { await signInWithProvider(p); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(null); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, paddingTop: insets.top }} behavior="padding">
      <View style={{ paddingTop: 20, paddingLeft: 9, paddingRight: 20 }}>
        <IconButton label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/intro'))}>
          <IconBack size={22} color={C.ink} />
        </IconButton>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20, gap: 20 }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 8 }}>
          <Display size={32}>{title}</Display>
          <Text style={{ fontFamily: F.regular, fontSize: 16, color: C.muted }}>{subtitle}</Text>
        </View>
        {children}
        {anySocial && <Divider label="or" />}
        {anySocial && (
          <View style={{ gap: 10 }}>
            {providers.apple && <Button variant="neutral" label="Continue with Apple" loading={busy === 'apple'} onPress={() => social('apple')} />}
            {providers.google && <Button variant="neutral" label="Continue with Google" loading={busy === 'google'} onPress={() => social('google')} />}
          </View>
        )}
        {err && <Text accessibilityRole="alert" style={{ fontFamily: F.regular, fontSize: 13, color: C.danger, textAlign: 'center' }}>{err}</Text>}
        {belowSocial}
      </ScrollView>
      <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 + insets.bottom, borderTopWidth: 1, borderTopColor: C.line, gap: 10 }}>
        <Text style={{ fontFamily: F.semibold, fontSize: 15, color: C.ink, textAlign: 'center' }}>{footerPrompt}</Text>
        <Button variant="outline" label={footerLabel} onPress={onFooter} />
      </View>
    </KeyboardAvoidingView>
  );
}
