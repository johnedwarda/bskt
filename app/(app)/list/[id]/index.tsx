// A list: tiles to get, Due soon, the cart. Behaviour and motion follow the design prototype.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { haptic } from '@/lib/haptics';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, type NativeScrollEvent, type NativeSyntheticEvent, Pressable, StyleSheet, Text, useWindowDimensions, View, type ViewInstance } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { interpolate, scrollTo, useAnimatedReaction, useAnimatedRef, useAnimatedStyle, useScrollOffset, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { Callout, CalloutFade } from '@/components/Callout';
import { CartPanel } from '@/components/CartPanel';
import { CartRing, IconBack, IconCart, IconCheck, IconChevron, IconPlus, IconStar } from '@/components/icons';
import { Illo } from '@/components/Illo';
import { type DragCtx, DueTile, ListTile, rowFlags, TileFace } from '@/components/Tiles';
import { Display, IconButton } from '@/components/ui';
import { shownName } from '@/lib/addSearch';
import { deepen, tileOf } from '@/lib/catalog';
import { cartOf, dueSoonOf, groupTodo, letterOf, SORTS, todoOf } from '@/lib/derive';
import { useList } from '@/lib/ListStore';
import { CSS_EASE, CSS_EASE_IN, DROP_Y, EASE, FLY_S, FLY_X, FLY_Y, MS } from '@/lib/motion';
import { formatNum } from '@/lib/parse';
import { suggestedQty } from '@/lib/rhythm';
import type { Item, SortMode } from '@/lib/types';
import { C, F } from '@/theme';

type Box = { x: number; y: number; w: number; h: number };
const GAP = 8;
const HEADER = 72;      // the header covers the top of the list
const TRAY_H = 206, TRAY_OVER_H = 226;
const SLOTS = [{ x: 40, y: 54, r: -8 }, { x: 55, y: 55, r: 6 }, { x: 70, y: 53, r: -4 }, { x: 47, y: 42, r: 10 }, { x: 63, y: 42, r: -6 }, { x: 55, y: 30, r: 4 }];

export default function ListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: W, height: SH } = useWindowDimensions();
  const { listId, list, items, purchasesByItem, putInCart, putOnList, checkout } = useList();

  const [sort, setSort] = useState<SortMode>('usual');
  const [sortOpen, setSortOpen] = useState(false);
  useEffect(() => { AsyncStorage.getItem(`bskt.sort.${listId}`).then((v) => { if (v) setSort(v as SortMode); }).catch(() => {}); }, [listId]);
  const pickSort = (m: SortMode) => { setSort(m); setSortOpen(false); AsyncStorage.setItem(`bskt.sort.${listId}`, m).catch(() => {}); };
  const chev = useSharedValue(0);
  useEffect(() => { chev.value = withTiming(sortOpen ? 180 : 0, { duration: MS.chevron, easing: CSS_EASE }); }, [sortOpen]); // eslint-disable-line react-hooks/exhaustive-deps
  const chevStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${chev.value}deg` }] }));

  const todo = useMemo(() => todoOf(items), [items]);
  const cart = useMemo(() => cartOf(items), [items]);
  const groups = useMemo(() => groupTodo(todo, sort), [todo, sort]);
  const due = useMemo(() => dueSoonOf(items, purchasesByItem), [items, purchasesByItem]);
  const listCount = todo.length + cart.length;
  const tileW = Math.floor((W - 40 - GAP * 2) / 3);
  const dueW = Math.floor((W - 40 - 20) / 3);
  const bottomOff = 20 + insets.bottom;
  const dockTop = SH - (20 + 52 + bottomOff);

  // ---------- tile refs and measuring ----------
  const rootRef = useRef<ViewInstance>(null);
  const root = useRef({ x: 0, y: 0 });
  const tiles = useRef(new Map<string, ViewInstance>());
  const register = useCallback((id: string, r: ViewInstance | null) => { if (r) tiles.current.set(id, r); else tiles.current.delete(id); }, []);
  const measure = (id: string) => new Promise<Box | null>((res) => {
    const el = tiles.current.get(id);
    if (!el) { res(null); return; }
    el.measureInWindow((x, y, w, h) => res(w ? { x: x - root.current.x, y: y - root.current.y, w, h } : null));
  });
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useRef(0);
  // for tiles that scroll the list when flicked: where it is, how far it goes, and the glide after letting go
  const offset = useScrollOffset(scrollRef);
  const maxOffset = useSharedValue(0);
  const viewH = useRef(0), contentH = useRef(0);
  const setRange = () => { maxOffset.value = Math.max(0, contentH.current - viewH.current); };
  const glide = useSharedValue(0), gliding = useSharedValue(0);
  useAnimatedReaction(() => glide.value, (v) => { if (gliding.value) scrollTo(scrollRef, 0, v, false); });

  // ---------- quick-edit callout ----------
  const [co, setCo] = useState<{ id: string; key: number; closing: boolean } | null>(null);
  const [anchor, setAnchor] = useState<Box | null>(null);
  const [coH, setCoH] = useState(0);
  const [field, setField] = useState<'type' | 'note' | null>(null);
  const [kbH, setKbH] = useState(0);
  const coItem = co ? items.find((i) => i.id === co.id && i.on_list && !i.in_cart) ?? null : null;
  const scrim = useSharedValue(0);
  const openCallout = (id: string) => { setAnchor(null); setCo({ id, key: Date.now(), closing: false }); setField(null); };
  const closeCallout = () => { Keyboard.dismiss(); setCo((c) => (c && !c.closing ? { ...c, closing: true } : c)); };
  useEffect(() => { scrim.value = withTiming(co && !co.closing ? 1 : 0, { duration: MS.scrim, easing: CSS_EASE }); }, [co?.closing, !!co]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (co && !co.closing && !coItem) closeCallout(); }, [coItem, co]);
  useEffect(() => {
    const a = Keyboard.addListener('keyboardDidShow', (e) => setKbH(e.endCoordinates.height));
    const b = Keyboard.addListener('keyboardDidHide', () => setKbH(0));
    return () => { a.remove(); b.remove(); };
  }, []);
  const docked = !!field && kbH > 0;   // Type / Note focused: the callout sits flush on the keyboard
  const kbAnim = useReanimatedKeyboardAnimation();
  const kbTop = useSharedValue(0);
  useAnimatedReaction(() => -kbAnim.height.value, (v) => { kbTop.value = v; });

  // below its tile; scroll so it never covers the dock (only when it opens or its size changes)
  const lastKey = useRef('');
  const place = useCallback(async (fromScroll = false) => {
    if (!co || co.closing) return;
    const r = await measure(co.id);
    if (!r) return;
    setAnchor(r);
    if (fromScroll || !coH || docked) return;
    const key = `${co.key}|${coH}`;
    if (lastKey.current === key) return;
    lastKey.current = key;
    const below = r.y + r.h + 12, limit = dockTop - 8;
    let shift = 0;
    if (below + coH > limit) shift = below + coH - limit;
    else if (r.y < insets.top + HEADER + 4) shift = r.y - insets.top - HEADER - 4;
    if (Math.abs(shift) > 1) {
      scrollRef.current?.scrollTo({ y: Math.max(0, scrollY.current + shift), animated: true });
      setTimeout(() => place(true), 320);
    }
  }, [co, coH, docked, dockTop]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { place(); }, [place, items]);
  // when the keyboard closes, the tile scrolls back into view
  useEffect(() => { if (!docked) { lastKey.current = ''; place(); } }, [docked]); // eslint-disable-line react-hooks/exhaustive-deps
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => { scrollY.current = e.nativeEvent.contentOffset.y; if (co) place(true); };

  // ---------- fly-in from Due soon, then the tile pops ----------
  const [pops, setPops] = useState<Record<string, number>>({});
  const [flyId, setFlyId] = useState<string | null>(null);
  const fx = useSharedValue(0), fy = useSharedValue(0), fs = useSharedValue(1), fr = useSharedValue(0), fbg = useSharedValue(1), fsh = useSharedValue(1);
  const flyItem = flyId ? items.find((i) => i.id === flyId) : undefined;
  const addFromDue = (item: Item, from: { x: number; y: number } | null) => {
    if (co) { closeCallout(); return; } // with a callout open, a Due soon tap only closes it
    const q = suggestedQty(item, item.catalog_key, purchasesByItem);
    putOnList(item.id, { qty: q.qty, unit: q.unit });
    haptic.done();
    if (!from) return;
    fx.value = from.x - root.current.x; fy.value = from.y - root.current.y + 32; fs.value = 1.05; fr.value = -8; fbg.value = 1; fsh.value = 1;
    setFlyId(item.id);
    setTimeout(async () => {
      const r = await measure(item.id);
      if (!r) { setFlyId(null); return; }
      fx.value = withTiming(r.x + r.w / 2, { duration: MS.fly, easing: FLY_X });
      fy.value = withTiming(r.y + 38, { duration: MS.fly, easing: FLY_Y });
      fs.value = withTiming(1.33, { duration: MS.fly, easing: FLY_S });
      fr.value = withTiming(0, { duration: MS.fly, easing: FLY_S });
      fbg.value = withDelay(MS.flyBgDelay, withTiming(0, { duration: MS.flyBg, easing: CSS_EASE }));
      fsh.value = withTiming(0, { duration: MS.fly, easing: CSS_EASE });
    }, 40);
    setTimeout(() => { setFlyId(null); setPops((p) => ({ ...p, [item.id]: Date.now() })); }, MS.flyLand);
  };
  const flyStyle = useAnimatedStyle(() => ({
    left: fx.value - 28, top: fy.value - 28,
    transform: [{ scale: fs.value }, { rotate: `${fr.value}deg` }],
    shadowOpacity: 0.3 * fsh.value, elevation: 10 * fsh.value,
  }));
  const flyBg = useAnimatedStyle(() => ({ opacity: fbg.value }));

  // ---------- drag into the cart ----------
  const [dragId, setDragId] = useState<string | null>(null);
  const dragIdRef = useRef<string | null>(null);
  dragIdRef.current = dragId;
  const [dropId, setDropId] = useState<string | null>(null);
  const [trayText, setTrayText] = useState('');
  const overRef = useRef(false);
  const gx = useSharedValue(0), gy = useSharedValue(0), gScale = useSharedValue(1);
  const tray = useSharedValue(0), trayOver = useSharedValue(0), trayC = useSharedValue(0), trayOp = useSharedValue(0);
  const rcX = useSharedValue(-21), rcB = useSharedValue(-22), rcS = useSharedValue(22 / 96), rcDy = useSharedValue(0);
  const dx = useSharedValue(0), dy = useSharedValue(0), ds = useSharedValue(1), dr = useSharedValue(-4), dbg = useSharedValue(1);
  const nativeScroll = useMemo(() => Gesture.Native(), []);
  const clampX = (x: number) => Math.max(16, Math.min(W - 40 - 96 - 16, x - 20 - 55));
  const nameOfId = (id: string) => { const it = items.find((i) => i.id === id); return it ? shownName(it) : ''; };

  const openTray = () => {
    tray.value = withTiming(1, { duration: MS.trayIn, easing: EASE });
    trayOp.value = withTiming(1, { duration: 120, easing: CSS_EASE });
    trayC.value = withDelay(MS.trayContentDelay, withTiming(1, { duration: MS.trayContentIn, easing: CSS_EASE }));
  };
  const closeTray = () => {
    tray.value = withTiming(0, { duration: MS.trayOut, easing: EASE });
    trayOver.value = withTiming(0, { duration: MS.trayOut, easing: EASE });
    trayOp.value = withDelay(260, withTiming(0, { duration: 120, easing: CSS_EASE }));
    trayC.value = withTiming(0, { duration: 80, easing: CSS_EASE });
    rcX.value = withTiming(-21, { duration: MS.trayOut, easing: EASE });
    rcB.value = withTiming(-22, { duration: MS.trayOut, easing: EASE });
    rcS.value = withTiming(22 / 96, { duration: MS.trayOut, easing: EASE });
    rcDy.value = withTiming(0, { duration: MS.trayOut, easing: EASE });
  };
  // the cart icon leaves the button and rolls under the tile's column
  const rcActive = (x: number | null) => {
    rcX.value = withTiming(x == null ? 16 : clampX(x), { duration: x == null ? MS.trayIn : 420, easing: EASE });
    rcB.value = withTiming(6, { duration: MS.trayIn, easing: EASE });
    rcS.value = withTiming(1, { duration: MS.trayIn, easing: EASE });
  };

  const startDrop = (id: string, x: number, y: number) => {
    setDropId(id);
    setTrayText(`Added ${nameOfId(id)}`);
    const slot = SLOTS[Math.min(cart.length, 5)];
    const cx = clampX(x);
    const trayTop = SH - root.current.y - bottomOff - TRAY_OVER_H;
    dx.value = x; dy.value = y; ds.value = 1; dr.value = -4; dbg.value = 1;
    trayOver.value = withTiming(1, { duration: MS.trayIn, easing: EASE });
    rcActive(x);
    setTimeout(() => {
      // it falls into the cart: across in 200ms, down in 340ms (accelerating), shrinking to 32%
      dx.value = withTiming(20 + cx + slot.x, { duration: MS.dropX, easing: CSS_EASE });
      dy.value = withTiming(trayTop + (TRAY_OVER_H - 6 - 96) + slot.y, { duration: MS.dropFall, easing: DROP_Y });
      ds.value = withTiming(0.32, { duration: MS.dropFall, easing: CSS_EASE_IN });
      dr.value = withTiming(slot.r, { duration: MS.dropFall, easing: CSS_EASE_IN });
      dbg.value = withTiming(0, { duration: 200, easing: CSS_EASE });
    }, MS.dropStart);
    setTimeout(() => { haptic.done(); putInCart(id); rcDy.value = withTiming(3, { duration: 140, easing: CSS_EASE }); }, MS.dropLand);
    setTimeout(() => { setDropId(null); closeTray(); }, MS.dropDone);
  };

  const drag: DragCtx = {
    gx, gy, scroll: nativeScroll, listRef: scrollRef, offset, maxOffset, glide, gliding,
    onStart: (id) => {
      if (co) closeCallout(); // picking a tile up closes the callout
      haptic.pickUp();
      overRef.current = false; setDragId(id);
      setTrayText('Drop here to put it in the cart');
      gScale.value = 1;
      openTray(); rcActive(null);
    },
    onMove: (x, y) => {
      const lx = x - root.current.x, ly = y - root.current.y;
      const top = SH - root.current.y - bottomOff - (overRef.current ? TRAY_OVER_H : TRAY_H);
      const o = ly >= top && lx >= 20 && lx <= W - 20;
      if (o) rcX.value = withTiming(clampX(lx), { duration: 420, easing: EASE });
      if (o !== overRef.current) {
        overRef.current = o;
        if (o) haptic.overTarget();
        trayOver.value = withTiming(o ? 1 : 0, { duration: MS.trayIn, easing: EASE });
        gScale.value = o ? 0.8 : 1;
        if (!o) rcX.value = withTiming(16, { duration: MS.trayIn, easing: EASE });
        const id = dragIdRef.current;
        setTrayText(o && id ? `Let go to add ${nameOfId(id)}` : 'Drop here to put it in the cart');
      }
    },
    onEnd: (id) => {
      setDragId(null);
      if (overRef.current) startDrop(id, gx.value - root.current.x, gy.value - root.current.y);
      else closeTray();
      overRef.current = false;
    },
    onCancel: () => {
      const id = dragIdRef.current;
      if (!id) return;
      setDragId(null);
      if (overRef.current) startDrop(id, gx.value - root.current.x, gy.value - root.current.y); else closeTray();
      overRef.current = false;
    },
  };

  // screen readers: "Put in cart" without dragging
  const cartFromTile = async (item: Item) => {
    const r = await measure(item.id);
    const x = r ? r.x + r.w / 2 : W / 2, y = r ? r.y + 38 : SH / 2;
    setTrayText(`Putting ${shownName(item)} in the cart`);
    openTray(); trayOver.value = withTiming(1, { duration: MS.trayIn, easing: EASE }); rcActive(x);
    setTimeout(() => startDrop(item.id, x, y), 380);
  };

  const trayStyle = useAnimatedStyle(() => ({
    opacity: trayOp.value,
    width: interpolate(tray.value, [0, 1], [(W - 50) / 2, W - 40]),
    height: interpolate(tray.value, [0, 1], [52, TRAY_H]) + trayOver.value * (TRAY_OVER_H - TRAY_H) * tray.value,
    borderRadius: interpolate(tray.value, [0, 1], [26, 28]),
  }));
  const trayContent = useAnimatedStyle(() => ({ opacity: trayC.value }));
  const rcStyle = useAnimatedStyle(() => ({ left: rcX.value, bottom: rcB.value, transform: [{ translateY: rcDy.value }, { scale: rcS.value }] }));
  const rx = root.current.x, ry = root.current.y;
  const ghostStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: gx.value - rx - 52 }, { translateY: gy.value - ry - 52 }, { rotate: '-4deg' }, { scale: gScale.value }],
  }));
  const dropStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: dx.value - 52 }, { translateY: dy.value - 52 }, { rotate: `${dr.value}deg` }, { scale: ds.value }],
    shadowOpacity: 0.28 * dbg.value, elevation: 12 * dbg.value,
  }));
  const dropBg = useAnimatedStyle(() => ({ opacity: dbg.value }));

  // ---------- cart panel ----------
  const [cartState, setCartState] = useState<'closed' | 'open' | 'closing'>('closed');
  const doCheckout = () => { setCartState('closing'); setTimeout(() => { haptic.done(); checkout(); }, 480); };

  const dragItem = dragId ? items.find((i) => i.id === dragId) : undefined;
  const dropItem = dropId ? items.find((i) => i.id === dropId) : undefined;
  const belowTop = anchor ? anchor.y + anchor.h + 12 : 0;
  const coVisible = !!anchor && (docked || (anchor.y + anchor.h > insets.top + HEADER + 4 && anchor.y < dockTop - 4 && belowTop + coH <= dockTop - 8 + 1));
  const coTop = docked ? SH - root.current.y - kbH - coH : belowTop;
  const coAx = anchor ? Math.round(Math.max(56, Math.min(W - 56, anchor.x + anchor.w / 2))) : W / 2;
  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrim.value }));

  return (
    <View ref={rootRef} collapsable={false} onLayout={() => rootRef.current?.measureInWindow((x, y) => { root.current = { x, y }; })} style={{ flex: 1, backgroundColor: C.ground }}>
      <GestureDetector gesture={nativeScroll}>
        <Animated.ScrollView
          ref={scrollRef}
          onLayout={(e) => { viewH.current = e.nativeEvent.layout.height; setRange(); }}
          onContentSizeChange={(_w, h) => { contentH.current = h; setRange(); }}
          onScroll={onScroll}
          scrollEventThrottle={16}
          scrollEnabled={!dragId}
          contentContainerStyle={{ paddingTop: insets.top + HEADER + 6, paddingHorizontal: 20, paddingBottom: 20, gap: 14 }}
        >
          {todo.length > 0 ? groups.map((g, gi) => {
            const flags = rowFlags(g.items, 3);
            return (
              <View key={g.title ?? gi} style={{ gap: 10, marginBottom: 6 }}>
                {g.title && <Text style={styles.groupTitle}>{g.title} · {g.items.length}</Text>}
                <View style={styles.grid}>
                  {g.items.map((it, i) => (
                    <ListTile
                      key={it.id}
                      item={it}
                      width={tileW}
                      showVariant={flags[i].v}
                      showNote={flags[i].n}
                      faded={dragId === it.id || dropId === it.id}
                      hidden={flyId === it.id}
                      popKey={pops[it.id]}
                      onTap={(x) => (co && co.id === x.id && !co.closing ? closeCallout() : openCallout(x.id))}
                      onCart={cartFromTile}
                      drag={drag}
                      register={register}
                    />
                  ))}
                </View>
              </View>
            );
          }) : (
            <View style={styles.allDone}>
              <View style={styles.doneBadge}><IconCheck size={28} color={C.white} width={2.5} /></View>
              <Display size={20}>{listCount ? 'All in the cart' : 'Nothing on the list'}</Display>
              <Text style={{ fontFamily: F.regular, fontSize: 14, color: C.muted, textAlign: 'center' }}>
                {listCount ? 'Nothing left to get. Add something below.' : 'Add the first thing below.'}
              </Text>
            </View>
          )}

          {due.length > 0 && (
            <View style={{ gap: 10, paddingTop: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: F.semibold, fontSize: 15, color: C.ink }}>Due soon</Text>
                <Text style={{ fontFamily: F.regular, fontSize: 12, color: C.muted }}>tap to add</Text>
              </View>
              <View style={[styles.grid, { gap: 10 }]}>
                {(() => {
                  const flags = rowFlags(due.map((d) => d.item), 3);
                  return due.map(({ item }, i) => {
                    const q = suggestedQty(item, item.catalog_key, purchasesByItem);
                    return <DueTile key={item.id} item={item} width={dueW} showVariant={flags[i].v} showNote={flags[i].n} qty={`${formatNum(q.qty)} ${q.unit}`} onAdd={addFromDue} />;
                  });
                })()}
              </View>
            </View>
          )}
          {/* room to scroll the callout clear of the dock */}
          {co && <View style={{ height: coH }} />}
        </Animated.ScrollView>
      </GestureDetector>

      {/* header over the top of the list, fading into it */}
      <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" accessible={false}>
          <Defs>
            <LinearGradient id="hd" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={C.ground} stopOpacity={1} />
              <Stop offset="0.6" stopColor={C.ground} stopOpacity={1} />
              <Stop offset="1" stopColor={C.ground} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#hd)" />
        </Svg>
        <IconButton label="All lists" onPress={() => router.back()}><IconBack size={22} color={C.ink} /></IconButton>
        <Display size={26} style={{ flex: 1 }} numberOfLines={1}>{list?.name ?? ''}</Display>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: sortOpen }} onPress={() => setSortOpen(!sortOpen)} style={styles.sortBtn}>
          <Text style={{ fontFamily: F.medium, fontSize: 13, color: C.muted2 }}>by {SORTS.find((s) => s[0] === sort)?.[1]}</Text>
          <Animated.View style={chevStyle}><IconChevron size={16} color={C.muted2} /></Animated.View>
        </Pressable>
      </View>

      {/* dock: cart (left) and Add an item (right), equal widths */}
      <View style={[styles.dock, { paddingBottom: bottomOff }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Cart, ${cart.length} of ${listCount} items`} onPress={() => setCartState(cartState === 'open' ? 'closing' : 'open')} style={styles.cartBtn}>
          <IconCart size={22} color={C.white} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: F.semibold, fontSize: 13, lineHeight: 16, color: C.white }}>Cart</Text>
            {cart.length === 0 && <Text style={{ fontFamily: F.regular, fontSize: 11, lineHeight: 13, color: C.white, opacity: 0.9 }} numberOfLines={1}>Drag items here</Text>}
          </View>
          {cart.length > 0 && <Text style={{ fontFamily: F.regular, fontSize: 11, color: C.white }}>{cart.length} of {listCount}</Text>}
          {cart.length > 0 && <CartRing fraction={listCount ? cart.length / listCount : 0} />}
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.push(`/list/${listId}/add`)} style={styles.addBtn}>
          <IconPlus size={18} color={C.green} width={2.4} />
          <Text style={{ flex: 1, fontFamily: F.semibold, fontSize: 13, color: C.muted }} numberOfLines={1}>Add an item</Text>
        </Pressable>
      </View>

      {/* the cart opens into a drop zone while dragging */}
      <Animated.View pointerEvents="none" style={[styles.tray, { left: 20, bottom: bottomOff }, trayStyle]}>
        <Animated.View style={[StyleSheet.absoluteFill, trayContent]}>
          <Text style={styles.trayText} numberOfLines={1}>{trayText}</Text>
        </Animated.View>
        <Animated.View style={[styles.rc, rcStyle]}>
          {cart.slice(-6).map((c, i) => (
            <View key={c.id} style={{ position: 'absolute', left: SLOTS[i].x - 13, top: SLOTS[i].y - 13, width: 26, height: 26, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: `${SLOTS[i].r}deg` }] }}>
              <Illo kind={c.kind} size={24} letter={letterOf(c)} shape={c.shape} />
            </View>
          ))}
          <IconCart size={96} color={C.white} width={1.6} />
        </Animated.View>
      </Animated.View>

      {dropItem && (
        <Animated.View pointerEvents="none" style={[styles.big, { zIndex: 16 }, dropStyle]}>
          <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: 26, backgroundColor: tileOf(dropItem.catalog_key) }, dropBg]} />
          <Illo kind={dropItem.kind} size={76} letter={letterOf(dropItem)} shape={dropItem.shape} />
        </Animated.View>
      )}
      {dragItem && (
        <Animated.View pointerEvents="none" style={[styles.big, { zIndex: 20, backgroundColor: tileOf(dragItem.catalog_key) }, ghostStyle]}>
          <Illo kind={dragItem.kind} size={76} letter={letterOf(dragItem)} shape={dragItem.shape} />
        </Animated.View>
      )}
      {flyItem && (
        <Animated.View pointerEvents="none" style={[styles.fly, flyStyle]}>
          <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: 16, backgroundColor: tileOf(flyItem.catalog_key) }, flyBg]} />
          <Illo kind={flyItem.kind} size={42} letter={letterOf(flyItem)} shape={flyItem.shape} />
        </Animated.View>
      )}

      {sortOpen && (
        <>
          <Pressable accessibilityLabel="Close sort menu" onPress={() => setSortOpen(false)} style={[StyleSheet.absoluteFill, { zIndex: 8 }]} />
          <View accessibilityRole="menu" style={[styles.menu, { top: insets.top + 20 + 48 }]}>
            {SORTS.map(([k, label]) => (
              <Pressable key={k} accessibilityRole="menuitem" accessibilityState={{ checked: k === sort }} onPress={() => pickSort(k)} style={[styles.menuItem, k === sort && { backgroundColor: C.soft }]}>
                <Text style={{ flex: 1, fontFamily: k === sort ? F.semibold : F.medium, fontSize: 14, color: C.ink }}>{label}</Text>
                {k === sort && <IconCheck size={16} color={C.greenText} width={2.5} />}
              </Pressable>
            ))}
          </View>
        </>
      )}

      {/* quick-edit callout: everything but its tile and the callout is dimmed; a tap there closes it */}
      {co && (
        <Animated.View style={[StyleSheet.absoluteFill, { zIndex: 20, backgroundColor: C.scrim }, scrimStyle]} pointerEvents={co.closing ? 'none' : 'auto'}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close details" onPress={closeCallout} style={{ flex: 1 }} />
        </Animated.View>
      )}
      {co && coItem && anchor && !docked && !co.closing && coVisible && (
        <Pressable
          onPress={closeCallout}
          accessibilityLabel={`Close details for ${shownName(coItem)}`}
          style={[styles.raised, { left: anchor.x, top: anchor.y, width: anchor.w, height: anchor.h, backgroundColor: tileOf(coItem.catalog_key) }]}
        >
          <TileFace item={coItem} showVariant={!!coItem.variant} showNote={!!coItem.note} />
          {coItem.must_buy && (
            <View style={{ position: 'absolute', top: 9, right: 9 }} pointerEvents="none">
              <IconStar size={16} fill={deepen(tileOf(coItem.catalog_key))} color={deepen(tileOf(coItem.catalog_key))} />
            </View>
          )}
        </Pressable>
      )}
      {co && (() => {
        const it = coItem ?? items.find((i) => i.id === co.id);
        if (!it) return null;
        return (
          <CalloutFade visible={coVisible || co.closing}>
            <Callout
              key={co.key}
              screen="list"
              item={it}
              closing={co.closing}
              ready={!!anchor && coH > 0 && !flyId}
              W={W}
              top={coTop}
              ax={coAx}
              arrow={!docked && coVisible}
              minHeight={0}
              dock={docked ? kbTop : null}
              onHeight={setCoH}
              onDone={closeCallout}
              onExited={() => { setCo((c) => (c && c.closing ? null : c)); setCoH(0); lastKey.current = ''; }}
              onField={setField}
              onFieldDone={() => Keyboard.dismiss()}
            />
          </CalloutFade>
        );
      })()}

      {cartState !== 'closed' && (
        <CartPanel
          open={cartState === 'open'}
          W={W}
          bottom={bottomOff}
          onRequestClose={() => setCartState('closing')}
          onClosed={() => setCartState('closed')}
          onCheckout={doCheckout}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 9, flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 9, paddingRight: 20, paddingBottom: 22 },
  sortBtn: { height: 44, paddingLeft: 8, paddingRight: 2, borderRadius: 22, flexDirection: 'row', alignItems: 'center', gap: 6 },
  menu: {
    position: 'absolute', right: 20, width: 220, zIndex: 9, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 6,
    shadowColor: C.ink, shadowOpacity: 0.16, shadowRadius: 14, shadowOffset: { width: 0, height: 12 }, elevation: 8,
  },
  menuItem: { height: 44, paddingHorizontal: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  groupTitle: { marginTop: 4, fontFamily: F.semibold, fontSize: 13, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  allDone: { paddingVertical: 28, paddingHorizontal: 20, borderRadius: 22, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, alignItems: 'center', gap: 8 },
  doneBadge: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' },
  dock: { paddingTop: 20, paddingHorizontal: 20, borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.ground, flexDirection: 'row', alignItems: 'center', gap: 10 },
  cartBtn: { flex: 1, height: 52, borderRadius: 26, backgroundColor: C.cart, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16 },
  addBtn: { flex: 1, height: 52, borderRadius: 26, borderWidth: 1.5, borderColor: C.green, backgroundColor: C.white, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 },
  tray: {
    position: 'absolute', zIndex: 15, backgroundColor: C.cart,
    shadowColor: C.ink, shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: -8 }, elevation: 10,
  },
  trayText: { position: 'absolute', left: 16, right: 16, top: 26, textAlign: 'center', fontFamily: F.semibold, fontSize: 16, color: C.white },
  rc: { position: 'absolute', width: 96, height: 96 },
  big: {
    position: 'absolute', left: 0, top: 0, width: 104, height: 104, borderRadius: 26, alignItems: 'center', justifyContent: 'center',
    shadowColor: C.ink, shadowOpacity: 0.28, shadowRadius: 15, shadowOffset: { width: 0, height: 14 }, elevation: 12,
  },
  fly: {
    position: 'absolute', zIndex: 30, width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    shadowColor: C.ink, shadowRadius: 13, shadowOffset: { width: 0, height: 12 },
  },
  raised: {
    position: 'absolute', zIndex: 21, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(27,43,34,0.06)', paddingTop: 10, paddingBottom: 12, paddingHorizontal: 6,
    alignItems: 'center', gap: 6,
  },
});
