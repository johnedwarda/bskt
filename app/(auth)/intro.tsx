import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { type NativeScrollEvent, type NativeSyntheticEvent, Pressable, ScrollView, type ScrollViewInstance, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing, interpolateColor, FadeInDown, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming, ZoomIn,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CartRing, IconArrow, IconCart } from '@/components/icons';
import { Illo, type IlloKind } from '@/components/Illo';
import { Button, Display } from '@/components/ui';
import { Wordmark } from '@/components/Wordmark';
import { C, F } from '@/theme';

const SLIDES = [
  { title: 'Shop together', body: 'One list for the whole household. Everyone adds, everyone ticks off, and you all see it live.' },
  { title: 'Never run out of the usual', body: 'bskt learns how often you buy things and puts what’s due right at the top.' },
  { title: 'Shop in your order', body: 'Your list sorts itself the way you walk the shop. Drag items to the cart as you go.' },
];

export default function Intro() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [slide, setSlide] = useState(0);
  const scroller = useRef<ScrollViewInstance>(null);

  const goTo = (i: number) => {
    setSlide(i);
    scroller.current?.scrollTo({ x: i * width, animated: true });
  };
  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setSlide(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  return (
    <View style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <View style={styles.top}>
        <Wordmark width={74} />
        <Button variant="link" label="Skip" onPress={() => router.push('/signup')} />
      </View>

      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        style={{ flex: 1 }}
      >
        {SLIDES.map((sl, i) => (
          <View key={i} style={[styles.slide, { width }]} accessibilityElementsHidden={i !== slide} importantForAccessibility={i === slide ? 'auto' : 'no-hide-descendants'}>
            <View style={styles.art}>
              {i === slide && (i === 0 ? <ArtTogether /> : i === 1 ? <ArtUsual /> : <ArtOrder />)}
            </View>
            <View style={{ gap: 10, maxWidth: 320 }}>
              <Display size={30} style={{ textAlign: 'center' }}>{sl.title}</Display>
              <Text style={styles.body}>{sl.body}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.dots} accessibilityRole="tablist">
        {SLIDES.map((_, i) => (
          <Pressable
            key={i}
            accessibilityRole="tab"
            accessibilityLabel={`Page ${i + 1} of 3`}
            accessibilityState={{ selected: i === slide }}
            onPress={() => goTo(i)}
            style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}
          >
            <Dot on={i === slide} />
          </Pressable>
        ))}
      </View>

      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20, gap: 10 }}>
        <Button
          label={slide < 2 ? 'Next' : 'Get started'}
          iconRight={(c) => <IconArrow size={20} color={c} />}
          onPress={() => (slide < 2 ? goTo(slide + 1) : router.push('/signup'))}
        />
        <Button variant="outline" label="I already have an account" onPress={() => router.push('/login')} />
      </View>
    </View>
  );
}

// ---------- illustrations (animate in when their page shows) ----------

function Dot({ on }: { on: boolean }) {
  const k = useSharedValue(on ? 1 : 0);
  useEffect(() => { k.value = withTiming(on ? 1 : 0, { duration: 260, easing: Easing.bezier(0.25, 0.1, 0.25, 1) }); }, [on]); // eslint-disable-line react-hooks/exhaustive-deps
  const st = useAnimatedStyle(() => ({ width: 8 + 16 * k.value, backgroundColor: interpolateColor(k.value, [0, 1], [C.handle, C.green]) }));
  return <Animated.View style={[{ height: 8, borderRadius: 4 }, st]} />;
}

function Bob({ delay, children, style }: { delay: number; children: React.ReactNode; style: object }) {
  const reduce = useReducedMotion();
  const y = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    y.value = withDelay(delay, withRepeat(withSequence(withTiming(-6, { duration: 1600, easing: Easing.inOut(Easing.ease) }), withTiming(0, { duration: 1600, easing: Easing.inOut(Easing.ease) })), -1));
  }, [reduce, delay, y]);
  const st = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return <Animated.View style={[style, st]}>{children}</Animated.View>;
}

function Bubble({ kind, bg, delay, size = 48 }: { kind: IlloKind; bg: string; delay: number; size?: number }) {
  return (
    <Animated.View entering={ZoomIn.delay(delay).springify()} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Illo kind={kind} size={size * 0.7} />
    </Animated.View>
  );
}

function ArtTogether() {
  const av = (label: string, bg: string, fg: string, pos: object, delay: number) => (
    <Animated.View entering={ZoomIn.delay(delay).springify()} style={[{ position: 'absolute' }, pos]}>
      <Bob delay={delay + 400} style={[styles.avatar, { backgroundColor: bg }]}>
        <Text style={{ fontFamily: F.bold, fontSize: label.length > 1 ? 13 : 16, color: fg }}>{label}</Text>
      </Bob>
    </Animated.View>
  );
  return (
    <View style={styles.artBox}>
      <Animated.View entering={ZoomIn.duration(600)} style={[styles.artBg, { backgroundColor: '#E3F0DC' }]} />
      <Animated.View entering={FadeInDown.delay(150).duration(600)} style={styles.togetherCard}>
        <Text style={{ fontFamily: F.display, fontSize: 20, color: C.ink }}>Groceries</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Bubble kind="milk" bg="#E1ECFA" delay={520} />
          <Bubble kind="bread" bg="#F6E6CF" delay={650} />
          <Bubble kind="apple" bg="#FCE4E0" delay={780} />
          <Bubble kind="eggs" bg="#F8EFE2" delay={910} />
        </View>
      </Animated.View>
      {av('M', '#F2B33D', C.ink, { top: 40, right: 34 }, 900)}
      {av('J', '#9CC5E8', C.ink, { bottom: 44, left: 30 }, 1050)}
      {av('You', C.green, C.white, { bottom: 30, right: 54 }, 1200)}
    </View>
  );
}

function ArtUsual() {
  const tiles: [IlloKind, string, string, string, string][] = [
    ['milk', 'Milk', 'Overdue', '#8A2F0C', '#FBE3D6'],
    ['bread', 'Bread', 'Due today', '#6B4800', '#FCEFC7'],
    ['banana', 'Bananas', 'Due today', '#6B4800', '#FCEFC7'],
    ['coffee', 'Coffee', 'In 2 days', C.greenText, '#E6EFE9'],
  ];
  return (
    <View style={styles.artBox}>
      <Animated.View entering={ZoomIn.duration(600)} style={[styles.artBg, { backgroundColor: '#FCEFC7' }]} />
      <View style={styles.usualGrid}>
        {tiles.map(([k, name, chip, fg, bg], i) => (
          <Animated.View key={k} entering={ZoomIn.delay(200 + i * 120).springify()} style={styles.usualTile}>
            <Illo kind={k} size={48} />
            <Text style={{ fontFamily: F.semibold, fontSize: 14, color: C.ink }}>{name}</Text>
            <Text style={{ fontFamily: F.semibold, fontSize: 11, color: fg, backgroundColor: bg, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, overflow: 'hidden' }}>{chip}</Text>
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

function ArtOrder() {
  const reduce = useReducedMotion();
  const [n, setN] = useState(reduce ? 3 : 0);
  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setN((x) => (x + 1) % 5), 1100);
    return () => clearInterval(t);
  }, [reduce]);
  const shown = Math.min(n, 3);
  const tiles: [IlloKind, string, string, string][] = [
    ['apple', 'Apples', '1 kg', '#FCE4E0'],
    ['spinach', 'Spinach', '1 bag', '#DDEFD9'],
    ['milk', 'Milk', '2 × 1 L', '#E1ECFA'],
  ];
  return (
    <View style={styles.artBox}>
      <Animated.View entering={ZoomIn.duration(600)} style={[styles.artBg, { backgroundColor: '#F3E6EE' }]} />
      <View style={styles.orderRow}>
        {tiles.map(([k, name, qty, bg], i) => (
          <Animated.View key={k} entering={FadeInDown.delay(200 + i * 140)} style={[styles.orderTile, { backgroundColor: bg, opacity: shown > i ? 0.25 : 1 }]}>
            <View style={styles.orderNum}><Text style={{ fontFamily: F.bold, fontSize: 11, color: C.ink }}>{i + 1}</Text></View>
            <Illo kind={k} size={44} />
            <Text style={{ fontFamily: F.semibold, fontSize: 13, color: C.ink }}>{name}</Text>
            <Text style={{ fontFamily: F.semibold, fontSize: 11, color: C.ink }}>{qty}</Text>
          </Animated.View>
        ))}
      </View>
      <Animated.View entering={FadeInDown.delay(620)} style={styles.orderCart}>
        <IconCart size={28} color={C.white} />
        <Text style={{ flex: 1, fontFamily: F.semibold, fontSize: 13, color: C.white }}>Cart</Text>
        <Text style={{ fontFamily: F.regular, fontSize: 11, color: C.white }}>{shown} of 3</Text>
        <CartRing fraction={shown / 3} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20 },
  slide: { paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', gap: 28 },
  art: { width: 300, height: 300 },
  artBox: { width: 300, height: 300 },
  artBg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 150 },
  body: { fontFamily: F.regular, fontSize: 16, lineHeight: 23, color: C.muted, textAlign: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 4, paddingTop: 8, paddingBottom: 4 },
  avatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 3, borderColor: C.white, alignItems: 'center', justifyContent: 'center' },
  togetherCard: {
    position: 'absolute', left: 22, right: 22, top: 86, backgroundColor: C.white, borderRadius: 28, padding: 16, gap: 12,
    shadowColor: C.ink, shadowOpacity: 0.14, shadowRadius: 15, shadowOffset: { width: 0, height: 14 }, elevation: 6,
  },
  usualGrid: { position: 'absolute', left: 34, right: 34, top: 34, flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  usualTile: {
    width: 110, backgroundColor: C.white, borderWidth: 1.5, borderColor: C.dash, borderStyle: 'dashed', borderRadius: 18,
    paddingTop: 10, paddingBottom: 12, paddingHorizontal: 6, alignItems: 'center', gap: 4,
  },
  orderRow: { position: 'absolute', left: 22, right: 22, top: 62, flexDirection: 'row', gap: 8 },
  orderTile: { flex: 1, borderRadius: 18, paddingVertical: 10, paddingHorizontal: 4, alignItems: 'center', gap: 4, borderWidth: 1, borderColor: 'rgba(27,43,34,0.06)' },
  orderNum: { position: 'absolute', top: 6, left: 6, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.85)', alignItems: 'center', justifyContent: 'center' },
  orderCart: {
    position: 'absolute', left: 40, right: 40, bottom: 34, height: 52, borderRadius: 26, backgroundColor: C.cart,
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 14, paddingRight: 16,
    shadowColor: C.ink, shadowOpacity: 0.22, shadowRadius: 11, shadowOffset: { width: 0, height: 10 }, elevation: 6,
  },
});
