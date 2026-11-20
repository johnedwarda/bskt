import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Text, type TextInputInstance, View } from 'react-native';
import { AuthScaffold } from '@/components/AuthScaffold';
import { IconArrow } from '@/components/icons';
import { Button, Field } from '@/components/ui';
import { sendPasswordReset, signIn } from '@/lib/auth';
import { C, F } from '@/theme';

const emailRe = /^\S+@\S+\.\S+$/;

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const pwRef = useRef<TextInputInstance>(null);

  const emailOk = emailRe.test(email.trim());
  const ok = emailOk && pw.length > 0;

  const submit = async () => {
    setErr(null);
    if (!ok) { setTried(true); return; }
    setBusy(true);
    try { await signIn(email, pw); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  const forgot = async () => {
    setErr(null);
    if (!emailOk) { setTried(true); setErr('Enter your email above first.'); return; }
    try { await sendPasswordReset(email); setResetSent(true); }
    catch (e) { setErr((e as Error).message); }
  };

  return (
    <AuthScaffold
      title="Welcome back"
      subtitle="Log in to see your lists."
      footerPrompt="New to bskt?"
      footerLabel="Create an account"
      onFooter={() => router.replace('/signup')}
    >
      <View style={{ gap: 14 }}>
        <Field
          label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com"
          keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress"
          returnKeyType="next" onSubmitEditing={() => pwRef.current?.focus()}
          error={tried && !emailOk && 'Enter a valid email address.'}
        />
        <Field
          ref={pwRef} label="Password" value={pw} onChangeText={setPw} placeholder="Your password" password
          autoComplete="current-password" textContentType="password" returnKeyType="go" onSubmitEditing={submit}
          error={tried && pw.length === 0 && 'Enter your password.'}
        />
        <Button variant="link" label={resetSent ? 'Reset link sent' : 'Forgot password?'} onPress={forgot} style={{ alignSelf: 'flex-end', marginTop: -6 }} />
      </View>
      {err && <Text accessibilityRole="alert" style={{ fontFamily: F.regular, fontSize: 13, color: C.danger }}>{err}</Text>}
      <Button label="Log in" disabledLook={!ok} loading={busy} onPress={submit} iconRight={(c) => <IconArrow size={20} color={c} />} />
    </AuthScaffold>
  );
}
