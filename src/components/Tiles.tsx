// Tiles, styled and animated as in the design prototype.
import React, { useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewInstance } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { type AnimatedRef, cancelAnimation, interpolateColor, scrollTo, type SharedValue, useAnimatedStyle, useSharedValue, withDecay, withDelay, withSequence, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { shownName } from '@/lib/addSearch';
import { deepen, tileOf } from '@/lib/catalog';
import { letterOf } from '@/lib/derive';
import { BOUNCE, MS } from '@/lib/motion';
import { formatNum } from '@/lib/parse';
import type { Item } from '@/lib/types';
import { C, F } from '@/theme';
import { IconEdit, IconStar, IconTrash } from './icons';
import { Illo } from './Illo';

const NB = ' ';
export const qtyLabel = (i: { qty: number; unit: string }) => `${formatNum(i.qty)} ${i.unit}`;

// Keep a type / note line in a row only if some tile in that row has one (rows stay aligned).
export function rowFlags<T extends { variant?: string; note?: string }>(arr: T[], perRow: number) {
  return arr.map((_, idx) => {
    const r = Math.floor(idx / perRow);
    const row = arr.slice(r * perRow, r * perRow + perRow);
    return { v: row.some((x) => !!x.variant), n: row.some((x) => !!x.note) };
  });
}

// A tile scales up a little when something lands on it, then settles (260ms each way, slight bounce).
function usePop(popKey: number | undefined, to: number) {
  const s = useSharedValue(1);
  useEffect(() => {
    if (!popKey) return;
    s.value = withSequence(
      withTiming(to, { duration: MS.pop, easing: BOUNCE }),
      withDelay(MS.popBack - MS.flyLand - MS.pop, withTiming(1, { duration: MS.pop, easing: BOUNCE })),
    );
  }, [popKey]); // eslint-disable-line react-hooks/exhaustive-deps
  return useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
}

// ---------- list tile: tap for the callout; a slow move drags it, a quick flick scrolls ----------

export type DragCtx = {
  gx: SharedValue<number>; gy: SharedValue<number>;   // finger, in window coordinates
  scroll: ReturnType<typeof Gesture.Native>;           // the list's own scrolling waits while a tile is touched
  // a quick flick on a tile scrolls the list from here (like the prototype): its ref, offset and range
  listRef: AnimatedRef<any>; offset: SharedValue<number>; maxOffset: SharedValue<number>; glide: SharedValue<number>; gliding: SharedValue<number>;
  onStart: (id: string) => void;
  onMove: (x: number, y: number) => void;
  onEnd: (id: string) => void;
  onCancel: () => void;
};

type ListTileProps = {
  item: Item; width: number; showVariant: boolean; showNote: boolean;
  faded: boolean; hidden: boolean; popKey?: number;
  onTap: (item: Item) => void; onCart: (item: Item) => void; drag: DragCtx;
  register: (id: string, ref: ViewInstance | null) => void;
};

export function ListTile({ item, width, showVariant, showNote, faded, hidden, popKey, onTap, onCart, drag, register }: ListTileProps) {
  const bg = tileOf(item.catalog_key);
  const t0 = useSharedValue(0), sx = useSharedValue(0), sy = useSharedValue(0), decided = useSharedValue(0), mode = useSharedValue(0), from = useSharedValue(0);
  // where the touch started: dragging to the cart only starts from the middle 70% of the tile
  const edge = useSharedValue(0), tw = useSharedValue(0), th = useSharedValue(0);
  const id = item.id;
  // The gestures are built once per tile: rebuilding them on a re-render would cancel a drag in progress.
  const live = useRef({ item, onTap, drag });
  live.current = { item, onTap, drag };
  const js = useMemo(() => ({
    start: (tid: string) => live.current.drag.onStart(tid),
    move: (x: number, y: number) => live.current.drag.onMove(x, y),
    end: (tid: string) => live.current.drag.onEnd(tid),
    cancel: () => live.current.drag.onCancel(),
    tap: () => live.current.onTap(live.current.item),
  }), []);
  const { gx, gy, listRef, offset, maxOffset, glide, gliding } = drag;
  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .manualActivation(true)
      .blocksExternalGesture(drag.scroll)
      .onTouchesDown((e) => {
        decided.value = 0; mode.value = 0; t0.value = Date.now(); sx.value = e.allTouches[0].absoluteX; sy.value = e.allTouches[0].absoluteY;
        // the drag target is 30% smaller than the tile (15% off each side): a move that starts on the outer
        // band always scrolls the list, however slow
        const lx = e.allTouches[0].x, ly = e.allTouches[0].y;
        edge.value = tw.value > 0 && (lx < tw.value * 0.15 || lx > tw.value * 0.85 || ly < th.value * 0.15 || ly > th.value * 0.85) ? 1 : 0;
        // a touch stops a glide in progress
        if (gliding.value) { gliding.value = 0; cancelAnimation(glide); }
      })
      .onTouchesMove((e, mgr) => {
        // decided once, at the first 8px: never re-judged during a drag (that would cancel it)
        if (decided.value) return;
        const t = e.allTouches[0];
        const dist = Math.hypot(t.absoluteX - sx.value, t.absoluteY - sy.value);
        if (dist < 8) return;
        decided.value = 1;
        // speed so far in px/ms: quick flicks scroll, slow deliberate moves drag (as in the prototype)
        mode.value = edge.value || dist / Math.max(1, Date.now() - t0.value) > 0.2 ? 2 : 1;
        mgr.activate();
      })
      .onStart((e) => {
        if (mode.value === 2) { from.value = offset.value + (e.absoluteY - sy.value); return; }
        gx.value = e.absoluteX; gy.value = e.absoluteY; scheduleOnRN(js.start, id);
      })
      .onUpdate((e) => {
        if (mode.value === 2) {
          // the list follows the finger
          scrollTo(listRef, 0, Math.min(maxOffset.value, Math.max(0, from.value - (e.absoluteY - sy.value))), false);
          return;
        }
        gx.value = e.absoluteX; gy.value = e.absoluteY; scheduleOnRN(js.move, e.absoluteX, e.absoluteY);
      })
      .onEnd((e) => {
        if (mode.value === 2) {
          // let go while moving: it glides on and slows down, stopping at the ends
          glide.value = offset.value; gliding.value = 1;
          glide.value = withDecay({ velocity: -e.velocityY, deceleration: 0.997, clamp: [0, maxOffset.value] }, () => { gliding.value = 0; });
          return;
        }
        scheduleOnRN(js.end, id);
      })
      .onFinalize((_e, ok) => { if (!ok && mode.value === 1) scheduleOnRN(js.cancel); });
    const tap = Gesture.Tap().onEnd((_e, ok) => { if (ok) scheduleOnRN(js.tap); });
    return Gesture.Exclusive(pan, tap);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const popStyle = usePop(popKey, 1.08);
  const deep = deepen(bg);
  const name = shownName(item);

  return (
    <Animated.View style={[{ width }, popStyle]}>
      <GestureDetector gesture={gesture}>
        <View
          ref={(r) => register(id, r)}
          collapsable={false}
          onLayout={(e) => { tw.value = e.nativeEvent.layout.width; th.value = e.nativeEvent.layout.height; }}
          accessible
          accessibilityRole="button"
          accessibilityLabel={`${item.variant ? item.variant + ' ' + name.toLowerCase() : name}${item.must_buy ? ' (must buy)' : ''}, ${qtyLabel(item)}`}
          accessibilityHint="Opens quick edit. Drag to the cart to tick it off."
          accessibilityActions={[{ name: 'activate' }, { name: 'cart', label: 'Put in cart' }]}
          onAccessibilityAction={(e) => (e.nativeEvent.actionName === 'cart' ? onCart(item) : onTap(item))}
          style={[styles.tile, { backgroundColor: bg, opacity: hidden ? 0 : faded ? 0.35 : 1 }]}
        >
          <TileFace item={item} showVariant={showVariant} showNote={showNote} />
          {item.must_buy && (
            <View style={styles.star} pointerEvents="none"><IconStar size={16} fill={deep} color={deep} /></View>
          )}
        </View>
      </GestureDetector>
    </Animated.View>
  );
}

// The inside of a list tile (also used for the raised copy above the callout's backdrop).
export function TileFace({ item, showVariant, showNote }: { item: Item; showVariant: boolean; showNote: boolean }) {
  return (
    <>
      <Illo kind={item.kind} size={56} letter={letterOf(item)} shape={item.shape} />
      <Text style={styles.name} numberOfLines={2}>{shownName(item)}</Text>
      {showVariant && <Text style={styles.variant} numberOfLines={1}>{item.variant || NB}</Text>}
      {showNote && <Text style={styles.note} numberOfLines={1}>{item.note || NB}</Text>}
      <Text style={styles.qty}>{qtyLabel(item)}</Text>
    </>
  );
}

// ---------- dashed "Due soon" tile: tap to add ----------

type DueProps = {
  item: Item; width: number; showVariant: boolean; showNote: boolean; hidden?: boolean; qty?: string;
  onAdd: (item: Item, from: { x: number; y: number } | null) => void;
};

export function DueTile({ item, width, showVariant, showNote, hidden, qty, onAdd }: DueProps) {
  const ref = useRef<ViewInstance>(null);
  const name = shownName(item);
  const tap = () => {
    const el = ref.current;
    if (!el) { onAdd(item, null); return; }
    el.measureInWindow((x, y, w) => onAdd(item, { x: x + w / 2, y }));
  };
  return (
    <View style={{ width }}>
      <Pressable
        ref={ref}
        accessibilityRole="button"
        accessibilityLabel={`Add ${item.variant ? item.variant + ' ' + name.toLowerCase() : name}`}
        onPress={tap}
        style={[styles.due, { opacity: hidden ? 0 : 1 }]}
      >
        <Illo kind={item.kind} size={44} letter={letterOf(item)} shape={item.shape} />
        <Text style={styles.name} numberOfLines={1}>{name}</Text>
        {showVariant && <Text style={styles.variant} numberOfLines={1}>{item.variant || NB}</Text>}
        {showNote && <Text style={styles.dueNote} numberOfLines={1}>{item.note || NB}</Text>}
        <Text style={styles.dueQty} numberOfLines={1}>{qty ?? qtyLabel(item)}</Text>
      </Pressable>
    </View>
  );
}

// ---------- suggestion tile (Add screen) ----------

type SugProps = {
  label: string; variant: string; note: string; kind: string; letter: string; shape: string;
  qty: string; width: number; showVariant: boolean; showNote: boolean;
  active: 'on' | 'cart' | null; enter: boolean; forgettable: boolean;
  onPress: (from: { x: number; y: number } | null) => void; onForget: () => void;
};

export function SugTile(p: SugProps) {
  const ref = useRef<ViewInstance>(null);
  // the Enter target is outlined in solid green; the outline changes over 160ms
  const k = useSharedValue(p.enter ? 1 : 0);
  useEffect(() => { k.value = withTiming(p.enter ? 1 : 0, { duration: MS.outline }); }, [p.enter]); // eslint-disable-line react-hooks/exhaustive-deps
  const ring = useAnimatedStyle(() => ({ borderColor: interpolateColor(k.value, [0, 1], [C.dash, C.green]) }));
  const name = p.variant ? `${p.variant} ${p.label.toLowerCase()}` : p.label;
  const press = () => {
    const el = ref.current;
    if (!el) { p.onPress(null); return; }
    el.measureInWindow((x, y, w) => p.onPress({ x: x + w / 2, y }));
  };
  return (
    <View style={{ width: p.width }}>
      <Pressable
        ref={ref}
        accessibilityRole="button"
        accessibilityLabel={p.active === 'on' ? `${name}, already on the list. Edit` : p.active === 'cart' ? `Add another ${name} (one is in the cart)` : `Add ${name}`}
        onPress={press}
        style={{ flexGrow: 1, opacity: p.active === 'on' ? 0.5 : 1 }}
      >
        <Animated.View style={[styles.sug, { borderStyle: p.enter ? 'solid' : 'dashed' }, ring]}>
          <View style={{ alignItems: 'center', gap: 2, maxWidth: '100%' }}>
            <Illo kind={p.kind} size={32} letter={p.letter} shape={p.shape} />
            <Text style={[styles.name, { fontSize: 12 }]} numberOfLines={1}>{p.label}</Text>
            {p.showVariant && <Text style={[styles.variant, { fontSize: 11, lineHeight: 13 }]} numberOfLines={1}>{p.variant || NB}</Text>}
            {p.showNote && <Text style={[styles.dueNote, { fontSize: 10 }]} numberOfLines={1}>{p.note || NB}</Text>}
            <Text style={[styles.dueQty, { fontSize: 11 }]} numberOfLines={1}>{p.qty}</Text>
          </View>
          {p.active === 'on' && <Badge label="On list" bg={C.greenText} small />}
          {p.active === 'cart' && <Badge label="In cart" bg={C.danger} small />}
        </Animated.View>
      </Pressable>
      {p.forgettable && (
        <Pressable accessibilityRole="button" accessibilityLabel={`Don't suggest ${p.label} again`} onPress={p.onForget} hitSlop={8} style={styles.forget}>
          <IconTrash size={13} color={C.danger} width={2.4} />
        </Pressable>
      )}
    </View>
  );
}

// ---------- "On the list" strip tile (Add screen) ----------

type StripProps = {
  item: Item; size: number; ringed: boolean; hidden: boolean; raised?: boolean; popKey?: number;
  onPress: (item: Item) => void; register: (id: string, ref: ViewInstance | null) => void;
};

export function StripTile({ item, size, ringed, hidden, popKey, onPress, register }: StripProps) {
  const popStyle = usePop(popKey, 1.18);
  const r = useSharedValue(ringed ? 1 : 0);
  useEffect(() => { r.value = withTiming(ringed ? 1 : 0, { duration: 200 }); }, [ringed]); // eslint-disable-line react-hooks/exhaustive-deps
  const ringStyle = useAnimatedStyle(() => ({ opacity: r.value }));
  const ill = Math.min(40, size * 0.75);
  return (
    <Animated.View style={popStyle}>
      <Pressable
        ref={(x) => register(item.id, x)}
        accessibilityRole="button"
        accessibilityLabel={`${shownName(item)}${item.variant ? ', ' + item.variant : ''} details`}
        onPress={() => onPress(item)}
        style={{ width: size, height: size, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: tileOf(item.catalog_key), opacity: hidden ? 0 : item.in_cart ? 0.35 : 1 }}
      >
        <Illo kind={item.kind} size={ill} letter={letterOf(item)} shape={item.shape} />
      </Pressable>
      <Animated.View pointerEvents="none" style={[styles.stripRing, ringStyle]} />
    </Animated.View>
  );
}

// "On list" / "In cart": white 600 text on a filled, fully rounded pill (10px on the smaller search tiles)
export function Badge({ label, bg, small }: { label: string; bg: string; small?: boolean }) {
  return (
    <View style={{ marginTop: 'auto', paddingTop: 2 }}>
      <Text style={{ fontFamily: F.semibold, fontSize: small ? 10 : 11, lineHeight: small ? 13 : 14.3, color: C.white, backgroundColor: bg, borderRadius: small ? 7 : 8, paddingHorizontal: small ? 6 : 7, paddingVertical: 1, overflow: 'hidden' }}>{label}</Text>
    </View>
  );
}

export function EditBadge() {
  return (
    <View style={styles.editBadge} pointerEvents="none"><IconEdit size={11} color={C.greenText} width={2.6} /></View>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: 18, borderWidth: 1, borderColor: 'rgba(27,43,34,0.06)', paddingTop: 10, paddingBottom: 12, paddingHorizontal: 6,
    alignItems: 'center', gap: 6, flexGrow: 1,
  },
  name: { fontFamily: F.semibold, fontSize: 14, lineHeight: 17, color: C.ink, textAlign: 'center' },
  variant: { fontFamily: F.semibold, fontSize: 12, lineHeight: 15, color: C.greenText, textAlign: 'center' },
  note: { fontFamily: F.regular, fontSize: 12, lineHeight: 15, color: C.muted, textAlign: 'center' },
  qty: { fontFamily: F.semibold, fontSize: 12, color: C.ink, marginTop: 'auto', paddingTop: 2 },
  star: { position: 'absolute', top: 9, right: 9 },
  due: {
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.dash, borderRadius: 18, paddingTop: 10, paddingBottom: 12, paddingHorizontal: 6,
    alignItems: 'center', gap: 6, flexGrow: 1,
  },
  sug: { flexGrow: 1, borderWidth: 1.5, borderRadius: 16, paddingTop: 6, paddingBottom: 8, paddingHorizontal: 4, alignItems: 'center', gap: 2 },
  dueNote: { fontFamily: F.regular, fontStyle: 'italic', fontSize: 11, color: C.muted2, textAlign: 'center' },
  dueQty: { fontFamily: F.regular, fontSize: 12, color: C.muted, textAlign: 'center' },
  flag: { fontFamily: F.semibold, fontSize: 10, marginTop: 'auto', paddingTop: 2 },
  forget: {
    position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: C.outline,
    backgroundColor: C.white, alignItems: 'center', justifyContent: 'center',
  },
  stripRing: { position: 'absolute', top: -2, left: -2, right: -2, bottom: -2, borderRadius: 16, borderWidth: 2, borderColor: C.green },
  editBadge: {
    position: 'absolute', right: -4, bottom: -4, width: 20, height: 20, borderRadius: 10, backgroundColor: C.white,
    borderWidth: 1, borderColor: C.outline, alignItems: 'center', justifyContent: 'center',
  },
});
