// What's in the cart. Opens out of the cart button as in the prototype: it starts as the button's exact
// shape and colour, then opens up into the panel (380ms) while turning from terracotta to the background
// (280ms); its content fades in after 170ms (200ms). Closing: content fades (100ms), then it shrinks back
// into the button (340ms) and turns terracotta again (240ms, after 80ms).
import React, { useEffect, useState } from 'react';
import { haptic } from '@/lib/haptics';
import { type LayoutChangeEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { interpolate, interpolateColor, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { displayName } from '@/lib/addSearch';
import { tileOf } from '@/lib/catalog';
import { cartOf, letterOf } from '@/lib/derive';
import { AUTO_CLEAR_MS, latestCarted, useList } from '@/lib/ListStore';
import { CSS_EASE, EASE, MS } from '@/lib/motion';
import { C, F } from '@/theme';
import { IconCart, IconCheck, IconUndo } from './icons';
import { Illo } from './Illo';
import { qtyLabel } from './Tiles';

type Props = { open: boolean; W: number; bottom: number; onRequestClose: () => void; onClosed: () => void; onCheckout: () => void };

export function CartPanel({ open, W, bottom, onRequestClose, onClosed, onCheckout }: Props) {
  const { items, me, nameOf, putBack } = useList();
  const [H, setH] = useState(0);
  const morph = useSharedValue(0);   // 0 = the cart button, 1 = the panel
  const tint = useSharedValue(0);    // 0 = terracotta, 1 = background
  const content = useSharedValue(0);
  const back = useSharedValue(0);

  const cart = cartOf(items)
    .map((c) => ({ c, mine: (c.cart_by ?? me) === me }))
    .sort((a, b) => (a.mine === b.mine ? 0 : a.mine ? -1 : 1));
  const total = items.filter((i) => i.on_list).length;
  // the cart clears itself when the app is opened 6 hours after something last went into it
  const latest = latestCarted(items);
  const hoursLeft = latest == null ? 6 : Math.ceil((latest + AUTO_CLEAR_MS - Date.now()) / 3600e3);
  const autoText = hoursLeft >= 1 ? `Auto clears in ${hoursLeft} ${hoursLeft === 1 ? 'hour' : 'hours'}` : 'Auto clears next time the app opens';

  useEffect(() => {
    if (open && H) {
      morph.value = withTiming(1, { duration: MS.cartMorphIn, easing: EASE });
      tint.value = withTiming(1, { duration: MS.cartBgIn, easing: CSS_EASE });
      content.value = withDelay(MS.cartContentDelay, withTiming(1, { duration: MS.cartContentIn, easing: CSS_EASE }));
      back.value = withTiming(1, { duration: MS.cartBackdrop, easing: CSS_EASE });
    }
    if (!open) {
      content.value = withTiming(0, { duration: MS.cartContentOut, easing: CSS_EASE });
      morph.value = withDelay(MS.cartMorphOutDelay, withTiming(0, { duration: MS.cartMorphOut, easing: EASE }));
      tint.value = withDelay(MS.cartMorphOutDelay + MS.cartBgOutDelay, withTiming(0, { duration: MS.cartBgOut, easing: CSS_EASE }));
      back.value = withDelay(MS.cartMorphOutDelay, withTiming(0, { duration: MS.cartBackdrop, easing: CSS_EASE }, (d) => { if (d) scheduleOnRN(onClosed); }));
    }
  }, [open, !!H]); // eslint-disable-line react-hooks/exhaustive-deps

  const btnW = (W - 50) / 2, panelW = W - 40;
  const shell = useAnimatedStyle(() => ({
    opacity: H ? 1 : 0,
    width: interpolate(morph.value, [0, 1], [btnW, panelW]),
    height: interpolate(morph.value, [0, 1], [52, H || 52]),
    borderRadius: interpolate(morph.value, [0, 1], [26, 28]),
    backgroundColor: interpolateColor(tint.value, [0, 1], [C.cart, C.ground]),
  }));
  const inner = useAnimatedStyle(() => ({ opacity: content.value }));
  const backdrop = useAnimatedStyle(() => ({ opacity: back.value }));

  // follows its content: putting an item back makes the panel shorter straight away (as in the prototype)
  const onMeasure = (e: LayoutChangeEvent) => { const h = Math.min(560, Math.ceil(e.nativeEvent.layout.height)); setH((o) => (o === h ? o : h)); };

  return (
    <>
      <Animated.View style={[StyleSheet.absoluteFill, { zIndex: 10, backgroundColor: 'rgba(27,43,34,0.45)' }, backdrop]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close cart" onPress={() => { if (open) onRequestClose(); }} style={{ flex: 1 }} />
      </Animated.View>
      <Animated.View style={[styles.shell, { left: 20, bottom }, shell]}>
        <Animated.View onLayout={onMeasure} style={[styles.inner, { width: panelW, maxHeight: 560 }, inner]}>
          <View style={styles.handle} />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <IconCart size={28} color={C.ink} />
              <Text style={styles.h}>Cart</Text>
            </View>
            <Text style={{ fontFamily: F.regular, fontSize: 14, color: C.muted }}>{cart.length} of {total} items</Text>
          </View>
          {cart.length === 0 ? (
            <Text style={styles.empty}>Drag items here</Text>
          ) : (
            <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} contentContainerStyle={{ gap: 8 }}>
              {cart.map(({ c, mine }) => (
                <View key={c.id} style={[styles.row, { backgroundColor: tileOf(c.catalog_key) }]}>
                  <Illo kind={c.kind} size={40} letter={letterOf(c)} shape={c.shape} />
                  <Text style={{ flex: 1, fontFamily: F.medium, fontSize: 15, color: C.ink }} numberOfLines={2}>{displayName(c)} · {qtyLabel(c)}</Text>
                  {mine ? (
                    <Pressable accessibilityRole="button" accessibilityLabel={`Put ${displayName(c)} back on the list`} onPress={() => { haptic.tick(); putBack(c.id); }} style={styles.putBack}>
                      <IconUndo size={16} color={C.ink} width={2.2} />
                      <Text style={{ fontFamily: F.semibold, fontSize: 15, color: C.ink }}>Put back</Text>
                    </Pressable>
                  ) : (
                    <Text style={{ fontFamily: F.regular, fontSize: 13, color: C.muted, paddingRight: 10 }}>{nameOf(c.cart_by)} added</Text>
                  )}
                </View>
              ))}
            </ScrollView>
          )}
          {cart.length > 0 && (
            <>
              <Text style={styles.auto}>{autoText}</Text>
              <Pressable accessibilityRole="button" accessibilityHint="Takes everything in the cart off the list" onPress={onCheckout} style={styles.checkout}>
                <IconCheck size={20} color={C.white} width={2.2} />
                <Text style={{ fontFamily: F.semibold, fontSize: 15, color: C.white }}>Clear</Text>
              </Pressable>
            </>
          )}
        </Animated.View>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  // the panel is revealed from the button's corner, like the prototype's clip-path
  shell: { position: 'absolute', zIndex: 11, overflow: 'hidden' },
  inner: { position: 'absolute', left: 0, bottom: 0, paddingTop: 10, paddingHorizontal: 16, paddingBottom: 16, gap: 14 },
  handle: { width: 40, height: 5, borderRadius: 3, backgroundColor: C.handle, alignSelf: 'center' },
  h: { fontFamily: F.display, fontSize: 24, lineHeight: 26, letterSpacing: -0.48, color: C.ink },
  auto: { fontFamily: F.regular, fontSize: 12, color: C.muted, textAlign: 'center', marginBottom: -6 },
  empty: { paddingVertical: 24, textAlign: 'center', fontFamily: F.regular, fontSize: 14, color: C.muted },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingLeft: 12, paddingRight: 4, borderRadius: 30 },
  putBack: { height: 52, paddingHorizontal: 16, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.85)', flexDirection: 'row', alignItems: 'center', gap: 6 },
  checkout: { height: 52, borderRadius: 26, backgroundColor: C.green, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
});
