// Add items (canvas SPEC: "Add item: search, suggestions and duplicates"). Every add puts the item
// straight on the list and opens its quick-edit callout (Due soon adds quietly).
import { useRouter } from 'expo-router';
import { haptic } from '@/lib/haptics';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Pressable, ScrollView, type ScrollViewInstance, StyleSheet, Text, TextInput, type TextInputInstance, useWindowDimensions, View, type ViewInstance } from 'react-native';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import Animated, { useAnimatedReaction, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Callout, CalloutFade } from '@/components/Callout';
import { IconCheck, IconUndo } from '@/components/icons';
import { Illo } from '@/components/Illo';
import { DueTile, rowFlags, StripTile, SugTile } from '@/components/Tiles';
import { addSpecFor, search, shownName, type Tile } from '@/lib/addSearch';
import { tileOf } from '@/lib/catalog';
import { byOrder, dueForAdd, letterOf } from '@/lib/derive';
import { useList } from '@/lib/ListStore';
import { CSS_EASE, FLY_S, FLY_X, FLY_Y, MS } from '@/lib/motion';
import { formatNum } from '@/lib/parse';
import { suggestedQty } from '@/lib/rhythm';
import type { Item } from '@/lib/types';
import { C, F } from '@/theme';

type Rect = { x: number; y: number; w: number; h: number };

export default function AddScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: W } = useWindowDimensions();
  const { list, items, purchasesByItem, add, putOnList, forget, unforget } = useList();
  const [q, setQ] = useState('');
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const [kbOpen, setKbOpen] = useState(true);
  const input = useRef<TextInputInstance>(null);

  // lift everything above the keyboard (Android draws edge-to-edge, so the window doesn't resize)
  const kb = useReanimatedKeyboardAnimation();
  const kbTop = useSharedValue(0);
  useAnimatedReaction(() => -kb.height.value, (v) => { kbTop.value = v; });
  const [field, setField] = useState<'type' | 'note' | null>(null);
  const barH = useSharedValue(0);
  const barEdge = useSharedValue(0);
  useAnimatedReaction(() => kbTop.value + barH.value, (v) => { barEdge.value = v; }); // the search bar frame's top edge
  const [natH, setNatH] = useState(0); // the callout's own height (what its content needs)
  const liftStyle = useAnimatedStyle(() => ({ paddingBottom: -kb.height.value }));
  const barPad = useAnimatedStyle(() => ({ paddingBottom: 20 + insets.bottom * (1 - kb.progress.value) }));
  useEffect(() => {
    const a = Keyboard.addListener('keyboardDidShow', () => setKbOpen(true));
    const b = Keyboard.addListener('keyboardDidHide', () => setKbOpen(false));
    return () => { a.remove(); b.remove(); };
  }, []);

  // the strip shows only what's still to get (its count matches "N to get"); the cart isn't in it
  const onList = useMemo(() => items.filter((i) => i.on_list && !i.in_cart).sort(byOrder), [items]);
  const todoCount = onList.length;
  const due = useMemo(() => dueForAdd(items, purchasesByItem), [items, purchasesByItem]);
  const res = useMemo(() => search(q, items, purchasesByItem), [q, items, purchasesByItem]);

  // ---------- geometry ----------
  // custom items can be dropped from suggestions for good; a banner offers Undo for about 5 seconds
  const [forgot, setForgot] = useState<{ id: string; name: string } | null>(null);
  const forgotShown = !!forgot;
  const rootRef = useRef<ViewInstance>(null);
  const root = useRef({ x: 0, y: 0 });
  const strips = useRef(new Map<string, ViewInstance>());
  const register = useCallback((id: string, r: ViewInstance | null) => { if (r) strips.current.set(id, r); else strips.current.delete(id); }, []);
  const measure = (id: string) => new Promise<Rect | null>((done) => {
    const el = strips.current.get(id);
    if (!el) { done(null); return; }
    el.measureInWindow((x, y, w, h) => done(w ? { x: x - root.current.x, y: y - root.current.y, w, h } : null));
  });
  const stripRef = useRef<ViewInstance>(null);
  const barRef = useRef<ViewInstance>(null);
  const [strip, setStrip] = useState<Rect | null>(null);
  const [barTop, setBarTop] = useState(0);
  const [barBottom, setBarBottom] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  // measurements are only stored when they change (storing equal ones would re-render in a loop)
  const measureFrame = () => {
    stripRef.current?.measureInWindow((x, y, w, h) => {
      const r = { x: x - root.current.x, y: y - root.current.y, w, h };
      setStrip((o) => (o && o.x === r.x && o.y === r.y && o.w === r.w && o.h === r.h ? o : r));
    });
    barRef.current?.measureInWindow((_x, y, _w, h) => {
      const t = y - root.current.y;
      setBarTop((o) => (o === t ? o : t));
      setBarBottom((o) => (o === t + h ? o : t + h));
      barH.value = h;
    });
  };
  // the suggestions grow as tall as they need, up to just below the strip; beyond that they scroll.
  // Worked out from fixed edges (the bar's bottom, the strip's bottom), never from the panel's own size.
  const BAR_FIXED = 20 + 52 + 8 + 18 + 8 + 20; // padding, search box, gaps, "Suggestion" heading
  const sugMax = strip && barBottom ? Math.max(84, Math.floor(barBottom - BAR_FIXED - (strip.y + strip.h) - 12 - (forgotShown ? 52 : 0))) : 148;
  const scrollRef = useRef<ScrollViewInstance>(null);
  const scrollY = useRef(0);

  // ---------- fly to the strip, then it pops ----------
  const [pops, setPops] = useState<Record<string, number>>({});
  const [flyId, setFlyId] = useState<string | null>(null);
  const fx = useSharedValue(0), fy = useSharedValue(0), fs = useSharedValue(1), fr = useSharedValue(0), fsh = useSharedValue(1);
  const flyStyle = useAnimatedStyle(() => ({
    left: fx.value - 28, top: fy.value - 28, transform: [{ scale: fs.value }, { rotate: `${fr.value}deg` }],
    shadowOpacity: 0.3 - 0.15 * (1 - fsh.value), shadowRadius: 6 + 7 * fsh.value, elevation: 2 + 8 * fsh.value,
  }));
  const fly = (id: string, from: { x: number; y: number } | null, off: number) => {
    if (!from) return;
    fx.value = from.x - root.current.x; fy.value = from.y - root.current.y + off; fs.value = 1.05; fr.value = -8; fsh.value = 1;
    setFlyId(id);
    setTimeout(async () => {
      const r = await measure(id);
      if (!r) { setFlyId(null); return; }
      fx.value = withTiming(r.x + r.w / 2, { duration: MS.fly, easing: FLY_X });
      fy.value = withTiming(r.y + r.h / 2, { duration: MS.fly, easing: FLY_Y });
      fs.value = withTiming(0.98, { duration: MS.fly, easing: FLY_S });
      fr.value = withTiming(0, { duration: MS.fly, easing: FLY_S });
      fsh.value = withTiming(0, { duration: MS.fly, easing: CSS_EASE });
    }, 40);
    setTimeout(() => { setFlyId(null); setPops((p) => ({ ...p, [id]: Date.now() })); }, MS.flyLand);
  };
  const flyItem = flyId ? items.find((i) => i.id === flyId) : undefined;

  // ---------- callout ----------
  const [co, setCo] = useState<{ id: string; key: number; closing: boolean } | null>(null);
  const [anchor, setAnchor] = useState<Rect | null>(null);
  const [coH, setCoH] = useState(0);
  const coItem = co ? items.find((i) => i.id === co.id && i.on_list) ?? null : null;
  const openCallout = (id: string) => { setAnchor(null); setCo({ id, key: Date.now(), closing: false }); };
  const closeCallout = () => setCo((c) => (c && !c.closing ? { ...c, closing: true } : c));
  useEffect(() => { if (co && !co.closing && !coItem) closeCallout(); }, [coItem, co]);
  const scrim = useSharedValue(0);
  const coOpen = !!co && !co.closing && !q;
  useEffect(() => { scrim.value = withTiming(coOpen ? 1 : 0, { duration: MS.scrim, easing: CSS_EASE }); }, [coOpen]); // eslint-disable-line react-hooks/exhaustive-deps
  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrim.value }));
  // Due soon fades out while the callout is open with the keyboard up
  const dueOp = useSharedValue(1);
  useEffect(() => { dueOp.value = withTiming(coOpen && kbOpen ? 0 : 1, { duration: MS.dueFade, easing: CSS_EASE }); }, [coOpen, kbOpen]); // eslint-disable-line react-hooks/exhaustive-deps
  const dueStyle = useAnimatedStyle(() => ({ opacity: dueOp.value }));

  const lastKey = useRef('');
  const place = useCallback(async (fromScroll = false) => {
    measureFrame();
    if (!co || co.closing) return;
    const r = await measure(co.id);
    if (!r) return;
    setAnchor(r);
    if (fromScroll || !coH || !barTop) return;
    const key = `${co.key}|${coH}|${barTop}`;
    if (lastKey.current === key) return;
    lastKey.current = key;
    const below = r.y + r.h + 12, limit = barTop - 8;
    if (below + coH > limit) {
      scrollRef.current?.scrollTo({ y: scrollY.current + below + coH - limit, animated: true });
      setTimeout(() => place(true), 320);
    }
  }, [co, coH, barTop]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { place(); }, [place, items, kbOpen]);
  const [tileRects, setTileRects] = useState<Record<string, Rect>>({});
  const measureStrip = useCallback(async () => {
    const out: Record<string, Rect> = {};
    for (const id of strips.current.keys()) { const r = await measure(id); if (r) out[id] = r; }
    setTileRects(out);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (coOpen) { measureStrip(); const t = setTimeout(measureStrip, 350); return () => clearTimeout(t); } }, [coOpen, co?.id, items.length, kbOpen, measureStrip]);

  // ---------- adding ----------
  const added = (id: string, from: { x: number; y: number } | null, off: number, quiet = false) => {
    setLastAdded(id);
    setQ('');
    haptic.done();
    // the keyboard stays open while adding, so the next item can be typed straight away
    setTimeout(() => {
      const el = input.current;
      if (!el) return;
      if (!Keyboard.isVisible()) el.blur(); // Android hides the keyboard on its action key even when focus stays
      setTimeout(() => el.focus(), 30);
    }, 60);
    setTimeout(() => fly(id, from, off), 0);
    if (!quiet) openCallout(id);
  };
  const qtyFor = (rec: Item | null, key: string | null) => {
    const base = suggestedQty(rec, key, purchasesByItem);
    return res.amount ? { qty: res.amount, unit: res.unit || base.unit } : base;
  };
  const addTile = (t: Tile, from: { x: number; y: number } | null) => {
    if (t.active && t.record) { setQ(''); setLastAdded(t.record.id); openCallout(t.record.id); return; } // dimmed: edit it
    if (t.brandNew) { addNew(res.name, from); return; }
    const spec = addSpecFor(t.root, t.variant, t.alias, qtyFor(t.record, t.root.catalog?.id ?? null), items.length);
    added(add(spec), from, 22);
  };
  const addNew = (name: string, from: { x: number; y: number } | null) => {
    const spec = { catalog_key: null, name, shown_as: '', kind: 'generic', variant: '', qty: res.amount ?? 1, unit: res.amount ? res.unit || 'pcs' : 'pcs', units: [res.amount ? res.unit || 'pcs' : 'pcs'], step: 1, grp: 'Other', sort_order: 1000 + items.length, is_custom: true };
    added(add(spec), from, 22);
  };
  const onEnter = () => {
    const e = res.enter;
    if (e.type === 'add') {
      const rec = e.root.rows.find((x) => (x.variant || '').toLowerCase() === e.variant.toLowerCase()) ?? null;
      added(add(addSpecFor(e.root, e.variant, e.alias, qtyFor(rec, e.root.catalog?.id ?? null), items.length)), null, 0);
    } else if (e.type === 'new') addNew(e.name, null);
    else if (q.trim()) haptic.no(); // already on the list: Enter does nothing
  };
  const addDue = (item: Item, from: { x: number; y: number } | null) => {
    if (co && !co.closing) { closeCallout(); return; } // with a callout open, a Due soon tap only closes it
    const qq = suggestedQty(item, item.catalog_key, purchasesByItem);
    putOnList(item.id, { qty: qq.qty, unit: qq.unit });
    added(item.id, from, 33, true);
  };

  const forgotT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doForget = (t: Tile) => {
    const recs = t.root.rows;
    if (!recs.length) return;
    recs.forEach((r) => forget(r.id));
    haptic.remove();
    setForgot({ id: recs[0].id, name: t.label });
    if (forgotT.current) clearTimeout(forgotT.current);
    forgotT.current = setTimeout(() => setForgot(null), 5000);
  };
  const undoForget = () => {
    if (!forgot) return;
    items.filter((i) => i.is_custom && i.name.toLowerCase() === items.find((x) => x.id === forgot.id)?.name.toLowerCase()).forEach((i) => unforget(i.id));
    haptic.tick();
    setForgot(null);
  };

  const condW = Math.floor((W - 40 - 5 * 6) / 6); // 6 columns; rounded down so the 6th never wraps
  const dueW = Math.floor((W - 40 - 3 * 8) / 4);
  const dueFlags = rowFlags(due.map((d) => d.item), 4);
  const sugFlags = rowFlags(res.tiles.map((t) => ({ variant: t.variant, note: t.record?.note ?? '' })), 4);
  const coVisible = !!anchor && anchor.y + anchor.h > (strip?.y ?? 0) - 40 && (anchor.y + anchor.h + 12 + coH <= barTop - 8 + 1 || kbOpen);
  const coTop = anchor ? anchor.y + anchor.h + 12 : 0;
  const coAx = anchor ? Math.round(Math.max(56, Math.min(W - 56, anchor.x + anchor.w / 2))) : W / 2;
  const coMin = kbOpen && anchor && barTop ? Math.max(0, Math.round(barTop - 8 - coTop)) : 0;

  return (
    <Animated.View
      ref={rootRef}
      collapsable={false}
      onLayout={() => { rootRef.current?.measureInWindow((x, y) => { root.current = { x, y }; measureFrame(); }); }}
      style={[{ flex: 1, paddingTop: insets.top, backgroundColor: C.ground }, liftStyle]}
    >
      <View style={styles.header}>
        <Text style={{ flex: 1, fontFamily: F.semibold, fontSize: 16, color: C.ink }} numberOfLines={1}>Add to {list?.name ?? 'list'}</Text>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.doneBtn}>
          <IconCheck size={20} color={C.white} width={2.2} />
          <Text style={{ fontFamily: F.semibold, fontSize: 15, color: C.white }}>Done</Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        onLayout={(e) => setScrollTop(e.nativeEvent.layout.y)}
        onScroll={(e) => { scrollY.current = e.nativeEvent.contentOffset.y; if (co) { place(true); measureStrip(); } }}
        scrollEventThrottle={16}
        scrollEnabled={!q}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: 16, gap: 10 }}
      >
        {/* a tap on empty space closes the keyboard */}
        <Pressable accessible={false} onPress={() => { if (!co) Keyboard.dismiss(); }} style={{ gap: 10 }}>
          <View style={{ gap: 8, paddingBottom: 8 }}>
            <Text style={styles.h}>On the list · {todoCount} to get</Text>
            <View ref={stripRef} collapsable={false} onLayout={measureFrame} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {onList.map((i) => (
                <StripTile
                  key={i.id}
                  item={i}
                  size={condW}
                  ringed={i.id === lastAdded && flyId !== i.id}
                  hidden={flyId === i.id}
                  popKey={pops[i.id]}
                  onPress={(x) => { setQ(''); setLastAdded(x.id); openCallout(x.id); }}
                  register={register}
                />
              ))}
            </View>
          </View>

          {!q && due.length > 0 && (
            <Animated.View style={[{ gap: 10 }, dueStyle]} pointerEvents={coOpen && kbOpen ? 'none' : 'auto'}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <Text style={styles.h}>Due soon</Text>
                <Text style={styles.hint}>tap to add</Text>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {due.map(({ item }, i) => {
                  const qq = suggestedQty(item, item.catalog_key, purchasesByItem);
                  return <DueTile key={item.id} item={item} width={dueW} showVariant={dueFlags[i].v} showNote={dueFlags[i].n} qty={`${formatNum(qq.qty)} ${qq.unit}`} onAdd={addDue} />;
                })}
              </View>
            </Animated.View>
          )}
          {!q && due.length === 0 && (
            <Text style={[styles.hint, { paddingTop: 8 }]}>As you tick things off, bskt learns how often you buy them and shows what’s due here.</Text>
          )}
          {co && <View style={{ height: coH }} />}
        </Pressable>
      </ScrollView>

      <Animated.View ref={barRef} collapsable={false} onLayout={measureFrame} style={[styles.bar, barPad]}>
        {forgot && (
          <View accessibilityRole="alert" style={styles.banner}>
            <Text style={{ flex: 1, fontFamily: F.regular, fontSize: 14, color: C.white }} numberOfLines={1}>“{forgot.name}” removed from suggestions</Text>
            <Pressable accessibilityRole="button" onPress={undoForget} style={styles.undo}>
              <IconUndo size={15} color={C.ink} width={2.2} />
              <Text style={{ fontFamily: F.semibold, fontSize: 14, color: C.ink }}>Undo</Text>
            </Pressable>
          </View>
        )}
        {!!q.trim() && (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <Text style={styles.h}>Suggestion</Text>
              <Text style={styles.hint}>tap to add</Text>
            </View>
            <ScrollView style={{ maxHeight: sugMax }} keyboardShouldPersistTaps="always">
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 2 }}>
                {res.tiles.map((t, i) => (
                  <SugTile
                    key={t.id}
                    label={t.label}
                    variant={t.variant}
                    note={t.record?.note ?? ''}
                    kind={t.root.kind}
                    letter={t.root.custom ? t.root.name : ''}
                    shape={t.record?.shape ?? t.root.rows[0]?.shape ?? ''}
                    qty={`${formatNum(t.qty)} ${t.unit}`}
                    width={dueW}
                    showVariant={sugFlags[i].v}
                    showNote={sugFlags[i].n}
                    active={t.active}
                    enter={t.enter}
                    forgettable={t.forgettable && t.root.rows.length > 0}
                    onPress={(from) => addTile(t, from)}
                    onForget={() => doForget(t)}
                  />
                ))}
              </View>
            </ScrollView>
          </>
        )}
        <TextInput
          ref={input}
          autoFocus
          value={q}
          onChangeText={(t) => { setQ(t); if (co) { setCo(null); setCoH(0); lastKey.current = ''; } }}
          onPressIn={() => { if (co) closeCallout(); }}
          onSubmitEditing={onEnter}
          submitBehavior="submit"
          blurOnSubmit={false}
          returnKeyType="done"
          returnKeyLabel="add"
          placeholder="Type an item, e.g. 2 l oat milk"
          placeholderTextColor="#8B958F"
          accessibilityLabel="Item to add"
          autoCorrect={false}
          autoCapitalize="none"
          style={styles.input}
        />
      </Animated.View>

      {flyItem && (
        <Animated.View pointerEvents="none" style={[styles.fly, { backgroundColor: tileOf(flyItem.catalog_key) }, flyStyle]}>
          <Illo kind={flyItem.kind} size={42} letter={letterOf(flyItem)} shape={flyItem.shape} />
        </Animated.View>
      )}

      {/* the callout dims everything except the strip tiles, the search bar, itself and the keyboard */}
      {co && (
        <Animated.View style={[styles.scrim, { top: 0, height: barTop || 0 }, scrimStyle]} pointerEvents={coOpen ? 'auto' : 'none'}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close details" onPress={closeCallout} style={{ flex: 1 }} />
        </Animated.View>
      )}
      {coOpen && onList.map((i) => {
        const r = tileRects[i.id];
        const a = co ? tileRects[co.id] : undefined;
        if (!r || r.y + r.h > barTop || r.y < scrollTop - 1 || (a && r.y > a.y + 1)) return null;
        return (
          <Pressable
            key={i.id}
            accessibilityRole="button"
            accessibilityLabel={`${shownName(i)}${i.variant ? ', ' + i.variant : ''} details`}
            onPress={() => { setLastAdded(i.id); openCallout(i.id); }}
            style={[styles.raised, { left: r.x, top: r.y, width: r.w, height: r.h, backgroundColor: tileOf(i.catalog_key), opacity: i.in_cart ? 0.35 : 1 }]}
          >
            <Illo kind={i.kind} size={Math.min(40, r.w * 0.75)} letter={letterOf(i)} shape={i.shape} />
            {i.id === lastAdded && <View pointerEvents="none" style={styles.raisedRing} />}
          </Pressable>
        );
      })}
      {co && (() => {
        const it = coItem ?? items.find((i) => i.id === co.id);
        if (!it || (q && !co.closing)) return null;
        return (
          <CalloutFade visible={coVisible || co.closing || kbOpen}>
            <Callout
              key={co.key}
              screen="add"
              item={it}
              closing={co.closing}
              ready={!!anchor && coH > 0 && !flyId}
              W={W}
              top={coTop}
              ax={coAx}
              arrow={coVisible && !(kbOpen && !!anchor && natH > 0 && barTop - coTop < natH)}
              minHeight={0}
              dock={kbOpen && natH > 0 ? barEdge : null}
              stretch={kbOpen && !!anchor && natH > 0 && barTop - coTop >= natH}
              onHeight={(h) => { setNatH((o) => (o === h ? o : h)); if (!coH) setCoH(h); }}
              onDone={closeCallout}
              onExited={() => { setCo((c) => (c && c.closing ? null : c)); setCoH(0); setNatH(0); lastKey.current = ''; }}
              onField={setField}
              onFieldDone={() => input.current?.focus()}
            />
          </CalloutFade>
        );
      })()}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 20, paddingTop: 20 },
  doneBtn: { height: 52, paddingHorizontal: 16, borderRadius: 26, backgroundColor: C.green, flexDirection: 'row', alignItems: 'center', gap: 6 },
  h: { fontFamily: F.semibold, fontSize: 13, color: C.muted },
  hint: { fontFamily: F.regular, fontSize: 12, color: C.muted },
  bar: { zIndex: 21, paddingTop: 20, paddingHorizontal: 20, backgroundColor: C.ground, borderTopWidth: 1, borderTopColor: C.line, gap: 8 },
  input: {
    height: 52, paddingHorizontal: 16, borderRadius: 26, borderWidth: 1.5, borderColor: C.green, backgroundColor: C.white,
    fontFamily: F.regular, fontSize: 17, color: C.ink,
  },
  banner: { minHeight: 44, paddingVertical: 4, paddingLeft: 16, paddingRight: 4, borderRadius: 22, backgroundColor: C.ink, flexDirection: 'row', alignItems: 'center', gap: 10 },
  undo: { height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: C.white, flexDirection: 'row', alignItems: 'center', gap: 6 },
  fly: {
    position: 'absolute', zIndex: 30, width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    shadowColor: C.ink, shadowOffset: { width: 0, height: 12 },
  },
  scrim: { position: 'absolute', left: 0, right: 0, zIndex: 20, backgroundColor: C.scrim },
  raised: { position: 'absolute', zIndex: 21, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  raisedRing: { position: 'absolute', top: -2, left: -2, right: -2, bottom: -2, borderRadius: 16, borderWidth: 2, borderColor: C.green },
});
