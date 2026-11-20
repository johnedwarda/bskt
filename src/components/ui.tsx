import React, { forwardRef, useState } from 'react';
import {
  Image,
  ActivityIndicator,
  Pressable,
  type PressableProps,
  StyleSheet,
  Text,
  TextInput,
  type TextInputInstance,
  type TextInputProps,
  type TextProps,
  View,
  type ViewStyle,
} from 'react-native';
import { C, F, R } from '@/theme';
import { IconEye, IconEyeOff } from './icons';

// ---------- text ----------

export function Display({ style, ...p }: TextProps & { size?: number }) {
  const size = p.size ?? 32;
  return <Text {...p} style={[{ fontFamily: F.display, fontSize: size, lineHeight: size * 1.12, letterSpacing: -0.02 * size, color: C.ink }, style]} />;
}

export function T({ style, w = 'regular', ...p }: TextProps & { w?: keyof typeof F }) {
  return <Text {...p} style={[{ fontFamily: F[w], fontSize: 15, color: C.ink }, style]} />;
}

// ---------- buttons ----------

type Variant = 'primary' | 'outline' | 'neutral' | 'danger' | 'dangerOutline' | 'white' | 'link';

type BtnProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  variant?: Variant;
  icon?: (color: string) => React.ReactNode;
  iconRight?: (color: string) => React.ReactNode;
  disabledLook?: boolean; // looks disabled but still pressable (to show validation)
  loading?: boolean;
  style?: ViewStyle;
  flex?: boolean;
};

const VARIANTS: Record<Variant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: C.green, fg: C.white },
  outline: { bg: 'transparent', fg: C.greenText, border: C.green },
  neutral: { bg: C.white, fg: C.ink, border: C.outline },
  danger: { bg: C.danger, fg: C.white },
  dangerOutline: { bg: 'transparent', fg: C.danger, border: C.dangerBorder },
  white: { bg: C.white, fg: C.ink },
  link: { bg: 'transparent', fg: C.greenText },
};

export function Button({ label, variant = 'primary', icon, iconRight, disabledLook, loading, style, flex, ...p }: BtnProps) {
  const v = VARIANTS[variant];
  const bg = disabledLook && variant === 'primary' ? C.disabled : v.bg;
  const isLink = variant === 'link';
  return (
    <Pressable
      accessibilityRole="button"
      {...p}
      style={({ pressed }) => [
        isLink ? s.link : s.btn,
        { backgroundColor: bg, borderColor: v.border ?? 'transparent', borderWidth: v.border ? 1.5 : 0, opacity: pressed ? 0.85 : 1 },
        flex && { flex: 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <>
          {icon?.(v.fg)}
          <Text style={[s.btnText, { color: v.fg }, isLink && { fontSize: 14 }]} numberOfLines={1}>
            {label}
          </Text>
          {iconRight?.(v.fg)}
        </>
      )}
    </Pressable>
  );
}

export function IconButton({
  label, children, onPress, bg = 'transparent', size = 44, style,
}: { label: string; children: React.ReactNode; onPress?: () => void; bg?: string; size?: number; style?: ViewStyle }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 }, style]}
    >
      {children}
    </Pressable>
  );
}

// ---------- fields ----------

type FieldProps = TextInputProps & {
  label: string;
  error?: string | false;
  hint?: string;
  password?: boolean;
};

export const Field = forwardRef<TextInputInstance, FieldProps>(function Field({ label, error, hint, password, style, ...p }, ref) {
  const [show, setShow] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.label}>{label}</Text>
      <View style={[s.fieldBox, { borderColor: error ? C.errorBorder : C.field }]}>
        <TextInput
          ref={ref}
          placeholderTextColor="#8B958F"
          accessibilityLabel={label}
          secureTextEntry={password && !show}
          {...p}
          style={[s.input, style]}
        />
        {password && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={show ? 'Hide password' : 'Show password'}
            accessibilityState={{ selected: show }}
            onPress={() => setShow(!show)}
            style={s.eye}
          >
            {show ? <IconEyeOff color={C.ink} /> : <IconEye color={C.ink} />}
          </Pressable>
        )}
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={s.err}>{error}</Text>
      ) : hint ? (
        <Text style={s.hint}>{hint}</Text>
      ) : null}
    </View>
  );
});

export function Divider({ label }: { label?: string }) {
  if (!label) return <View style={{ height: 1, backgroundColor: C.line2 }} />;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ flex: 1, height: 1, backgroundColor: C.line2 }} />
      <Text style={{ fontFamily: F.regular, fontSize: 13, color: C.muted2 }}>{label}</Text>
      <View style={{ flex: 1, height: 1, backgroundColor: C.line2 }} />
    </View>
  );
}

// A person: their account picture when there is one (e.g. from Google), else a label on a colour.
export function Avatar({ label, bg, fg = C.ink, size = 40, dashed, uri }: { label: string; bg: string; fg?: string; size?: number; dashed?: boolean; uri?: string | null }) {
  const [failed, setFailed] = React.useState(false);
  return (
    <View
      style={{
        width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
        borderWidth: dashed ? 1.5 : 0, borderColor: C.dash, borderStyle: dashed ? 'dashed' : 'solid',
      }}
    >
      {uri && !failed ? <Image source={{ uri }} onError={() => setFailed(true)} style={{ width: size, height: size }} accessibilityIgnoresInvertColors /> : <Text style={{ fontFamily: F.semibold, fontSize: label.length > 1 ? size * 0.32 : size * 0.4, color: fg }}>{label}</Text>}
    </View>
  );
}

export function Switch({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      style={{ width: 52, height: 32, borderRadius: 16, padding: 3, backgroundColor: value ? C.green : C.switchOff, alignItems: value ? 'flex-end' : 'flex-start' }}
    >
      <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: C.white }} />
    </Pressable>
  );
}

export const s = StyleSheet.create({
  btn: {
    height: 52,
    paddingHorizontal: 16,
    borderRadius: R.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  link: { minHeight: 44, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center', gap: 6 },
  btnText: { fontFamily: F.semibold, fontSize: 15 },
  label: { fontFamily: F.semibold, fontSize: 13, color: C.muted },
  fieldBox: {
    height: 52,
    borderRadius: R.pill,
    borderWidth: 1.5,
    backgroundColor: C.white,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: { flex: 1, height: '100%', paddingHorizontal: 18, fontFamily: F.regular, fontSize: 16, color: C.ink },
  eye: { width: 44, height: 44, marginRight: 4, borderRadius: 22, backgroundColor: C.ground, alignItems: 'center', justifyContent: 'center' },
  err: { fontFamily: F.regular, fontSize: 12, color: C.danger },
  hint: { fontFamily: F.regular, fontSize: 12, color: C.muted2 },
});
