import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Text, type TextInputInstance, View } from 'react-native';
import { AuthScaffold } from '@/components/AuthScaffold';
import { IconArrow } from '@/components/icons';
import { Button, Field } from '@/components/ui';
import { signUp } from '@/lib/auth';
import { C, F } from '@/theme';

const emailRe = /^\S+@\S+\.\S+$/;

export default function Signup() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const emailRef = useRef<TextInputInstance>(null);
  const pwRef = useRef<TextInputInstance>(null);

  const emailOk = emailRe.test(email.trim());
  const nameOk = name.trim().length > 0;
  const pwOk = pw.length >= 8;
  const ok = nameOk && emailOk && pwOk;

  const submit = async () => {
    setErr(null);
    if (!ok) { setTried(true); return; }
    setBusy(true);
    try {
      const r = await signUp(name, email, pw);
      if (r.needsConfirmation) setConfirm(true);
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <AuthScaffold
      title="Create your account"
      subtitle="Start a list and share it in seconds."
      footerPrompt="Already have an account?"
      footerLabel="Log in"
      onFooter={() => router.replace('/login')}
      belowSocial={
        <Text style={{ fontFamily: F.regular, fontSize: 12, lineHeight: 18, color: C.muted2, textAlign: 'center' }}>
          By creating an account you agree to the <Text style={{ fontFamily: F.semibold, color: C.greenText }}>Terms</Text> and{' '}
          <Text style={{ fontFamily: F.semibold, color: C.greenText }}>Privacy Policy</Text>.
        </Text>
      }
    >
      {confirm ? (
        <View style={{ padding: 16, borderRadius: 18, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, gap: 6 }}>
          <Text style={{ fontFamily: F.semibold, fontSize: 15, color: C.ink }}>Check your email</Text>
          <Text style={{ fontFamily: F.regular, fontSize: 14, lineHeight: 20, color: C.muted }}>
            We sent a confirmation link to {email.trim()}. Open it, then log in.
          </Text>
        </View>
      ) : (
        <>
          <View style={{ gap: 14 }}>
            <Field
              label="Your name" value={name} onChangeText={setName} placeholder="e.g. Alex" autoComplete="name"
              textContentType="name" returnKeyType="next" onSubmitEditing={() => emailRef.current?.focus()}
              error={tried && !nameOk && 'Tell us what to call you.'}
            />
            <Field
              ref={emailRef} label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com"
              keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress"
              returnKeyType="next" onSubmitEditing={() => pwRef.current?.focus()}
              error={tried && !emailOk && 'Enter a valid email address.'}
            />
            <Field
              ref={pwRef} label="Password" value={pw} onChangeText={setPw} placeholder="At least 8 characters" password
              autoComplete="new-password" textContentType="newPassword" returnKeyType="go" onSubmitEditing={submit}
              hint="At least 8 characters" error={tried && !pwOk && 'Use at least 8 characters.'}
            />
          </View>
          {err && <Text accessibilityRole="alert" style={{ fontFamily: F.regular, fontSize: 13, color: C.danger }}>{err}</Text>}
          <Button label="Create account" disabledLook={!ok} loading={busy} onPress={submit} iconRight={(c) => <IconArrow size={20} color={c} />} />
        </>
      )}
    </AuthScaffold>
  );
}
