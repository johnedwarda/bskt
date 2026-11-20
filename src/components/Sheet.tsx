// Bottom sheet / floating panel that opens the way the design does: the thing you tapped
// (a tile, a list card, the cart button) grows into the panel's shape while the backdrop
// dims, then the panel's content fades in. Closing runs the same steps backwards.
// Timings and easing are the prototype's: 360ms cubic-bezier(0.2, 0.8, 0.2, 1),
// content fade 160ms in / 120ms out. No springs.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, type LayoutChangeEvent, Modal, Pressable, StyleSheet, View, type ViewInstance, type ViewStyle } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import Animated, { Easing, interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, R } from '@/theme';
import { Illo, type IlloKind } from './Illo';

export type Rect = { x: number; y: number; w: number; h: number };

export type Origin = Rect & {
  r: number;    // corner radius of the thing tapped
  bg: string;   // its colour
  illo?: { kind: IlloKind | string; letter?: string; cx: number; cy: number; scale: number }; // picture centre, scale vs 72px
};

const EASE = Easing.bezier(0.2, 0.8, 0.2, 1);
const MORPH_MS = 360;
const IN_MS = 160;
const OUT_MS = 120;

type CloseFn = (after?: () => void) => void;

type Props = {
  visible: boolean;
  onClose: () => void; // called once the closing animation has finished
  origin?: Origin | null;
  variant?: 'sheet' | 'floating';
  illoTarget?: React.RefObject<ViewInstance | null>; // where the picture lands in the panel
  closeLabel?: string;
  panelStyle?: ViewStyle;
  scrim?: string;
  children: React.ReactNode | ((close: CloseFn) => React.ReactNode);
};

// Measure something on screen in window coordinates.
export function measure(ref: React.RefObject<ViewInstance | null>): Promise<Rect | null> {
  return new Promise((resolve) => {
    const el = ref.current;
    if (!el) { resolve(null); return; }
    el.measureInWindow((x, y, w, h) => resolve(w || h ? { x, y, w, h } : null));
  });
}

export function Sheet({ visible, onClose, origin, variant = 'sheet', illoTarget, closeLabel = 'Close', panelStyle, scrim = C.scrim, children }: Props) {
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const [morphing, setMorphing] = useState(!!origin);
  const panelRect = useRef<Rect | null>(null);
  const started = useRef(false);
  const closing = useRef(false);

  const p = useSharedValue(0);      // 0 = at the origin, 1 = at the panel
  const c = useSharedValue(0);      // panel content opacity
  const from = useSharedValue<Origin>(origin ?? { x: 0, y: 0, w: 0, h: 0, r: 0, bg: C.ground });
  const to = useSharedValue<Rect>({ x: 0, y: 0, w: 0, h: 0 });
  const illoTo = useSharedValue({ cx: 0, cy: 0 });

  useEffect(() => {
    if (visible) {
      started.current = false;
      closing.current = false;
      p.value = 0;
      c.value = 0;
      if (origin) from.value = origin;
      setMorphing(!!origin);
      setMounted(true);
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = useCallback(async () => {
    if (started.current || !panelRect.current) return;
    started.current = true;
    to.value = panelRect.current;
    if (origin?.illo && illoTarget) {
      const t = await measure(illoTarget);
      if (t) illoTo.value = { cx: t.x + t.w / 2, cy: t.y + t.h / 2 };
    }
    if (!origin) {
      p.value = withTiming(1, { duration: MORPH_MS, easing: EASE });
      c.value = withTiming(1, { duration: MORPH_MS, easing: EASE });
      return;
    }
    p.value = withTiming(1, { duration: MORPH_MS, easing: EASE });
    setTimeout(() => {
      c.value = withTiming(1, { duration: IN_MS });
      setTimeout(() => setMorphing(false), IN_MS + 10);
    }, 400);
  }, [origin, illoTarget]); // eslint-disable-line react-hooks/exhaustive-deps

  const onPanelLayout = (e: LayoutChangeEvent) => {
    const { x, y, width, height } = e.nativeEvent.layout;
    panelRect.current = { x, y, w: width, h: height };
    if (!closing.current) to.value = panelRect.current;
    if (!started.current) requestAnimationFrame(() => { open(); });
  };

  const close: CloseFn = useCallback((after) => {
    if (closing.current) return;
    closing.current = true;
    Keyboard.dismiss();
    const done = () => { setMounted(false); onClose(); after?.(); };
    if (!origin) {
      c.value = withTiming(0, { duration: 200 });
      p.value = withTiming(0, { duration: 240, easing: EASE });
      setTimeout(done, 250);
      return;
    }
    c.value = withTiming(0, { duration: OUT_MS });
    setTimeout(() => {
      setMorphing(true);
      p.value = withTiming(0, { duration: MORPH_MS, easing: EASE });
      setTimeout(done, MORPH_MS + 10);
    }, OUT_MS);
  }, [origin, onClose]); // eslint-disable-line react-hooks/exhaustive-deps

  // the parent hid it without going through close(): still animate out
  useEffect(() => {
    if (!visible && mounted && !closing.current) close();
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const floating = variant === 'floating';
  const panelR = R.card;

  const backdrop = useAnimatedStyle(() => ({ opacity: p.value }));
  const content = useAnimatedStyle(() => (origin
    ? { opacity: c.value }
    : { opacity: c.value, transform: [{ translateY: (1 - p.value) * 40 }] }));
  const shape = useAnimatedStyle(() => {
    const f = from.value, t = to.value, k = p.value;
    const lerp = (a: number, b: number) => a + (b - a) * k;
    return {
      left: lerp(f.x, t.x),
      top: lerp(f.y, t.y),
      width: lerp(f.w, t.w),
      height: lerp(f.h, t.h),
      borderTopLeftRadius: lerp(f.r, panelR),
      borderTopRightRadius: lerp(f.r, panelR),
      borderBottomLeftRadius: lerp(f.r, floating ? panelR : 0),
      borderBottomRightRadius: lerp(f.r, floating ? panelR : 0),
      backgroundColor: interpolateColor(k, [0, 1], [f.bg, C.ground]),
    };
  });
  const flyIllo = useAnimatedStyle(() => {
    const il = from.value.illo;
    if (!il) return { opacity: 0 };
    const k = p.value;
    return {
      opacity: 1,
      left: il.cx + (illoTo.value.cx - il.cx) * k - 36,
      top: il.cy + (illoTo.value.cy - il.cy) * k - 36,
      transform: [{ scale: il.scale + (1 - il.scale) * k }],
    };
  });

  if (!mounted) return null;

  const body = typeof children === 'function' ? children(close) : children;
  const panel = (
    <Animated.View
      onLayout={onPanelLayout}
      style={[
        floating ? [styles.floating, { bottom: 20 + insets.bottom }] : [styles.sheet, { paddingBottom: 20 + insets.bottom }],
        content,
        panelStyle,
      ]}
    >
      <View style={styles.handle} />
      {body}
    </Animated.View>
  );

  return (
    <Modal visible transparent animationType="none" onRequestClose={() => close()} statusBarTranslucent navigationBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: scrim }, backdrop]} />
      {floating ? (
        <View style={{ flex: 1 }}>
          <Pressable accessibilityRole="button" accessibilityLabel={closeLabel} onPress={() => close()} style={StyleSheet.absoluteFill} />
          {panel}
        </View>
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <Pressable accessibilityRole="button" accessibilityLabel={closeLabel} onPress={() => close()} style={{ flex: 1, minHeight: 80 }} />
          {panel}
        </KeyboardAvoidingView>
      )}
      {origin && morphing && (
        <>
          <Animated.View pointerEvents="none" style={[styles.shape, shape]} />
          {origin.illo && (
            <Animated.View pointerEvents="none" style={[styles.illo, flyIllo]}>
              <Illo kind={origin.illo.kind} size={72} letter={origin.illo.letter} />
            </Animated.View>
          )}
        </>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: C.ground,
    borderTopLeftRadius: R.card,
    borderTopRightRadius: R.card,
    paddingTop: 10,
    paddingHorizontal: 20,
    gap: 16,
    maxHeight: '92%',
  },
  floating: {
    position: 'absolute', left: 20, right: 20, maxHeight: 560, backgroundColor: C.ground, borderRadius: R.card,
    paddingTop: 10, paddingHorizontal: 16, paddingBottom: 16, gap: 14,
  },
  handle: { width: 40, height: 5, borderRadius: 3, backgroundColor: C.handle, alignSelf: 'center' },
  shape: { position: 'absolute' },
  illo: { position: 'absolute', width: 72, height: 72 },
});
