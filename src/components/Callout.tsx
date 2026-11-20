// The quick-edit callout (canvas SPEC: "Editing items: the quick-edit callout").
// Full width, directly below its tile with an arrow pointing up at it. Opens by popping out of the tile
// (scale 60% -> 100% from the arrow tip, 240ms standard ease, no overshoot; fade in 140ms); closes by shrinking
// back towards the arrow tip (to 60%, 180ms ease-in; fade out 160ms). Moving to another item pops it
// out of the new tile. Reduced motion: no animation. Edits apply as they're made.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { haptic } from '@/lib/haptics';
import { type LayoutChangeEvent, Pressable, ScrollView, StyleSheet, Text, TextInput, type TextInputInstance, View } from 'react-native';
import Animated, { interpolateColor, ReduceMotion, type SharedValue, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import Svg, { Path } from 'react-native-svg';
import { displayName, familyKey, shownName, vk } from '@/lib/addSearch';
import { CATALOG_BY_ID, deepen, tileOf } from '@/lib/catalog';
import { byOrder, letterOf } from '@/lib/derive';
import { useList } from '@/lib/ListStore';
import { CSS_EASE, EASE, MS, SHRINK } from '@/lib/motion';
import { cap, formatNum } from '@/lib/parse';
import { rhythmOf, statusOf } from '@/lib/rhythm';
import type { Item } from '@/lib/types';
import { C, F } from '@/theme';
import { IconCheck, IconChevron, IconClock, IconPerson, IconPlus, IconRoute, IconStar, IconTrash } from './icons';
import { Illo, SHAPE_OPTIONS } from './Illo';
import { EditBadge } from './Tiles';

export type Rect = { x: number; y: number; w: number; h: number };

type Props = {
  screen: 'add' | 'list';
  item: Item;                 // the item it's open on
  closing: boolean;           // play the close animation, then onExited
  ready: boolean;             // placed and allowed to show (e.g. after a fly-in lands)
  W: number;
  top: number;                // y of the callout's top edge (screen root coordinates)
  ax: number;                 // x of the arrow tip
  arrow: boolean;             // arrow showing (tile in view, not docked on the keyboard)
  minHeight: number;          // stretch down to the search area (Add screen, keyboard open)
  dock?: SharedValue<number> | null; // docked: where its bottom edge sits, measured up from the screen's bottom
  stretch?: boolean;          // with dock: also keep its top under the tile, so it fills the space between
  onHeight: (h: number) => void;
  onDone: () => void;         // Done
  onExited: () => void;
  onField: (f: 'type' | 'note' | null) => void;
  onFieldDone?: () => void;   // keyboard "done" in Type / Note
};

export function Callout(p: Props) {
  const { items, purchasesByItem, updateItem, removeFromList, nameOf } = useList();
  const reduce = useReducedMotion();
  const it = p.item;
  const op = useSharedValue(0), sc = useSharedValue(0.6);
  const started = useRef(false);

  // open: pop out of the tile once placed
  useEffect(() => {
    if (!p.ready || started.current || p.closing) return;
    started.current = true;
    const rm = reduce ? ReduceMotion.Always : ReduceMotion.System;
    op.value = withTiming(1, { duration: MS.calloutFade, easing: CSS_EASE, reduceMotion: rm });
    sc.value = withTiming(1, { duration: MS.calloutIn, easing: EASE, reduceMotion: rm });
  }, [p.ready, p.closing]); // eslint-disable-line react-hooks/exhaustive-deps
  // close: shrink back towards the arrow tip
  useEffect(() => {
    if (!p.closing) return;
    if (!started.current) { p.onExited(); return; }
    op.value = withTiming(0, { duration: MS.calloutFadeOut, easing: CSS_EASE });
    sc.value = withTiming(0.6, { duration: MS.calloutOut, easing: SHRINK }, (done) => { if (done) scheduleOnRN(p.onExited); });
  }, [p.closing]); // eslint-disable-line react-hooks/exhaustive-deps

  const anim = useAnimatedStyle(() => ({ opacity: op.value, transform: [{ scale: sc.value }] }));
  // docked: its bottom edge sits exactly on the keyboard's top edge, following it as it moves
  const dockV = p.dock;
  const dockStyle = useAnimatedStyle(() => (dockV ? { bottom: dockV.value } : {}));

  // ---------- fields ----------
  const [typeText, setTypeText] = useState(it.variant);
  const [note, setNote] = useState(it.note);
  const [typesOpen, setTypesOpen] = useState(false);
  const [shapesOpen, setShapesOpen] = useState(false);
  const [focus, setFocus] = useState<'type' | 'note' | null>(null);
  const openedType = useRef(it.variant);
  const typeT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noteT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noteRef = useRef<TextInputInstance>(null);

  const fk = familyKey(it);
  const family = useMemo(() => items.filter((x) => familyKey(x) === fk && x.id !== it.id), [items, fk, it.id]);
  const v = typeText.replace(/^\s+/, '').replace(/\s{2,}/g, ' ');
  const vCap = v ? cap(v) : '';
  // a type that would duplicate an active item+type ("Plain" = no type)
  const clash = family.find((x) => x.on_list && !x.in_cart && vk(x.variant) === vk(vCap)) ?? null;

  const known = useMemo(() => {
    const out: string[] = [];
    const add = (t: string) => { if (vk(t) && !out.some((x) => vk(x) === vk(t))) out.push(t); };
    family.forEach((x) => add(x.variant));
    (it.catalog_key ? CATALOG_BY_ID[it.catalog_key]?.types ?? [] : []).forEach(add);
    return out;
  }, [family, it.catalog_key]);
  // while typing, narrow to word-prefix matches
  const tq = vk(vCap);
  const shownTypes = tq && !known.some((n) => vk(n) === tq) ? known.filter((n) => (' ' + n.toLowerCase()).includes(' ' + tq)) : known;

  const commitType = (val: string, now = false) => {
    if (typeT.current) clearTimeout(typeT.current);
    const go = () => {
      const c = cap(val.trim());
      const dup = family.find((x) => x.on_list && !x.in_cart && vk(x.variant) === vk(c));
      if (!dup && vk(c) !== vk(it.variant)) updateItem(it.id, { variant: vk(c) ? c : '' });
    };
    if (now) go(); else typeT.current = setTimeout(go, 400);
  };
  // a type that's already on the list: a short buzz as the warning appears
  useEffect(() => { if (clash) haptic.no(); }, [!!clash]); // eslint-disable-line react-hooks/exhaustive-deps
  const flush = () => {
    if (typeT.current) { clearTimeout(typeT.current); typeT.current = null; }
    if (noteT.current) { clearTimeout(noteT.current); noteT.current = null; if (note !== it.note) updateItem(it.id, { note, note_at: new Date().toISOString() }); }
    if (clash) { if (vk(it.variant) !== vk(openedType.current)) updateItem(it.id, { variant: openedType.current }); }
    else if (vk(vCap) !== vk(it.variant)) updateItem(it.id, { variant: vk(vCap) ? vCap : '' });
  };
  // flush pending edits when the callout closes or moves on
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => { if (p.closing) flushRef.current(); }, [p.closing]);
  useEffect(() => () => flushRef.current(), []);

  const setField = (f: 'type' | 'note' | null) => { setFocus(f); p.onField(f); };

  // ---------- info (List screen only) ----------
  const r = rhythmOf(it, purchasesByItem);
  const st = statusOf(r);
  const onList = items.filter((x) => x.on_list).sort(byOrder);
  const pos = onList.findIndex((x) => x.id === it.id);
  const lastText = it.is_custom && r.count === 0 && !it.in_cart ? 'Never bought before'
    : r.lastDays === 0 ? `Ticked off today by ${nameOf(r.lastBy)}` : `Last ticked off ${r.lastDays} days ago by ${nameOf(r.lastBy)}`;
  const orderText = it.is_custom && r.count === 0 ? 'We’ll learn its place in your trip' : `Usually #${pos + 1} in your trip`;

  const tint = tileOf(it.catalog_key);
  const deep = deepen(tint);
  const must = it.must_buy;
  const mustK = useSharedValue(must ? 1 : 0);
  useEffect(() => { mustK.value = withTiming(must ? 1 : 0, { duration: 160, easing: CSS_EASE }); }, [must]); // eslint-disable-line react-hooks/exhaustive-deps
  const mustStyle = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(mustK.value, [0, 1], ['rgba(255,255,255,0)', deep]) }));
  const chevK = useSharedValue(0);
  useEffect(() => { chevK.value = withTiming(typesOpen ? 180 : 0, { duration: MS.chevron, easing: CSS_EASE }); }, [typesOpen]); // eslint-disable-line react-hooks/exhaustive-deps
  const chevStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${chevK.value}deg` }] }));
  const hints = (it.catalog_key ? CATALOG_BY_ID[it.catalog_key]?.types ?? [] : []).filter((t) => vk(t) && vk(t) !== vk(it.variant));
  const errText = clash ? (vCap ? `${displayName({ ...it, variant: vCap })} is already ${clash.in_cart ? 'in the cart' : 'on the list'}.` : `${shownName(it)} is already ${clash.in_cart ? 'in the cart' : 'on the list'}. Pick a type to add another.`) : '';

  // reports its natural height (what its content needs), even while stretched: the stretch is the
  // space between the marker after the content and the Remove · Done row
  const lay = useRef({ card: 0, mark: -1, row: -1 });
  const report = () => {
    const l = lay.current;
    if (!l.card || l.mark < 0 || l.row < 0) return;
    p.onHeight(Math.round(l.card - Math.max(0, l.row - l.mark - 8)));
  };
  const onLayout = (e: LayoutChangeEvent) => { lay.current.card = e.nativeEvent.layout.height; report(); };

  return (
    <Animated.View
      onLayout={onLayout}
      accessibilityRole="none"
      accessibilityLabel={`Details for ${shownName(it)}`}
      pointerEvents={p.closing ? 'none' : 'auto'}
      style={[styles.card, p.dock ? (p.stretch ? { top: p.top, width: p.W, transformOrigin: [p.ax, 0, 0] } : { width: p.W }) : { top: p.top, width: p.W, minHeight: p.minHeight || undefined, transformOrigin: [p.ax, 0, 0] }, anim, dockStyle]}
    >
      {p.arrow && (
        <Svg width={24} height={12} viewBox="0 0 24 12" style={{ position: 'absolute', top: -11, left: p.ax - 13 }} accessible={false}>
          <Path d="M0 12 L12 0.7 L24 12" fill={C.ground} stroke={C.line} strokeWidth={1} />
        </Svg>
      )}

      {/* picture, name, Must buy */}
      <View style={{ zIndex: 3, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {it.is_custom ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Change picture"
            accessibilityState={{ expanded: shapesOpen }}
            onPress={() => { setShapesOpen(!shapesOpen); setTypesOpen(false); }}
            style={[styles.pic, { backgroundColor: tint, borderWidth: shapesOpen ? 1.5 : 0, borderColor: C.green }]}
          >
            <Illo kind={it.kind} size={32} letter={letterOf(it)} shape={it.shape} />
            <EditBadge />
          </Pressable>
        ) : (
          <View style={[styles.pic, { backgroundColor: tint }]}><Illo kind={it.kind} size={32} /></View>
        )}
        <Text style={styles.name} numberOfLines={1}>{shownName(it)}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: must }}
          onPress={() => { (must ? haptic.off : haptic.on)(); updateItem(it.id, { must_buy: !must }); }}
          style={[styles.must, { borderColor: deep }]}
        >
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: 22 }, mustStyle]} />
          <IconStar size={15} fill={must ? C.white : 'none'} color={must ? C.white : deep} />
          <Text style={{ fontFamily: F.bold, fontSize: 13, color: must ? C.white : deep }}>Must buy</Text>
        </Pressable>
        {shapesOpen && (
          <View accessibilityRole="list" style={styles.shapes}>
            {SHAPE_OPTIONS.map(([val, label]) => {
              const sel = (it.shape || '') === val;
              return (
                <Pressable
                  key={label}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  accessibilityState={{ selected: sel }}
                  onPress={() => { haptic.tick(); setShapesOpen(false); updateItem(it.id, { shape: val }); }}
                  style={[styles.shapeOpt, sel && { backgroundColor: C.soft, borderWidth: 1.5, borderColor: C.green }]}
                >
                  <Illo kind="generic" size={44} letter={it.name} shape={val} />
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      {/* Type */}
      <View style={{ zIndex: 2, gap: 4 }}>
        <View style={[styles.field, { borderColor: clash ? C.cart : focus === 'type' ? C.green : C.line2, borderWidth: clash || focus === 'type' ? 1.5 : 1, paddingRight: 4 }]}>
          <Text style={styles.fieldLabel}>Type</Text>
          <TextInput
            accessibilityLabel="Type"
            accessibilityHint={errText || undefined}
            value={typeText}
            onChangeText={(t) => { setTypeText(t); setTypesOpen(true); commitType(t); }}
            onFocus={() => { setField('type'); setTypesOpen(true); setShapesOpen(false); }}
            onBlur={() => setField(null)}
            onSubmitEditing={() => { commitType(typeText, true); setTypesOpen(false); p.onFieldDone?.(); }}
            returnKeyType="done"
            placeholder={`e.g. ${hints[0] || 'Organic'}`}
            placeholderTextColor="#8B958F"
            autoCorrect={false}
            style={styles.input}
          />
          <Pressable accessibilityRole="button" accessibilityLabel="Show types" accessibilityState={{ expanded: typesOpen }} onPress={() => { setTypesOpen(!typesOpen); setShapesOpen(false); }} style={styles.chev}>
            <Animated.View style={chevStyle}><IconChevron size={16} color={C.ink} width={2.2} /></Animated.View>
          </Pressable>
        </View>
        {!!errText && <Text accessibilityLiveRegion="polite" style={styles.err}>{errText}</Text>}
        {typesOpen && shownTypes.length > 0 && (
          <View style={styles.typeList}>
            <ScrollView style={{ maxHeight: 200 }} keyboardShouldPersistTaps="always" nestedScrollEnabled>
              {shownTypes.map((t) => {
                const sel = vk(vCap) === vk(t);
                const other = family.find((x) => x.on_list && !x.in_cart && vk(x.variant) === vk(t));
                return (
                  <Pressable
                    key={t}
                    accessibilityRole="button"
                    accessibilityState={{ selected: sel, disabled: !!other }}
                    onPress={() => { if (other) { haptic.no(); return; } haptic.tick(); setTypeText(t); setTypesOpen(false); commitType(t, true); }}
                    style={[styles.typeOpt, sel && { backgroundColor: C.soft }]}
                  >
                    <Text style={{ flex: 1, fontFamily: sel ? F.semibold : F.medium, fontSize: 14, color: other ? C.dash : C.ink }}>{t}</Text>
                    {other && <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.muted }}>on list</Text>}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}
      </View>

      {/* Note */}
      <View style={[styles.field, { borderColor: focus === 'note' ? C.green : C.line2, borderWidth: focus === 'note' ? 1.5 : 1 }]}>
        <Text style={styles.fieldLabel}>Note</Text>
        <TextInput
          ref={noteRef}
          accessibilityLabel="Note"
          value={note}
          onChangeText={(t) => {
            setNote(t);
            if (noteT.current) clearTimeout(noteT.current);
            noteT.current = setTimeout(() => { noteT.current = null; updateItem(it.id, { note: t, note_at: new Date().toISOString() }); }, 400);
          }}
          onFocus={() => { setField('note'); setTypesOpen(false); setShapesOpen(false); }}
          onBlur={() => setField(null)}
          onSubmitEditing={() => p.onFieldDone?.()}
          returnKeyType="done"
          placeholder="Brand, size, anything"
          placeholderTextColor="#8B958F"
          style={styles.input}
        />
      </View>

      {/* quantity and unit */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View accessibilityLabel="Quantity" style={styles.stepper}>
          <Pressable accessibilityRole="button" accessibilityLabel="Decrease quantity" onPress={() => { if (it.qty <= (it.step || 1)) { haptic.no(); return; } haptic.tick(); updateItem(it.id, { qty: Math.max(it.step || 1, it.qty - (it.step || 1)) }); }} style={[styles.stepBtn, { backgroundColor: C.soft }]}>
            <Text style={{ fontFamily: F.semibold, fontSize: 20, color: C.ink, marginTop: -2 }}>−</Text>
          </Pressable>
          <Text accessibilityLiveRegion="polite" style={{ minWidth: 44, textAlign: 'center', fontFamily: F.semibold, fontSize: 16, color: C.ink }}>{formatNum(it.qty)}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Increase quantity" onPress={() => { haptic.tick(); updateItem(it.id, { qty: it.qty + (it.step || 1) }); }} style={[styles.stepBtn, { backgroundColor: C.green }]}>
            <IconPlus size={16} color={C.white} />
          </Pressable>
        </View>
        <View style={styles.seg}>
          {(it.units.length ? it.units : [it.unit]).map((u) => {
            const on = u === it.unit;
            return (
              <Pressable key={u} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => { if (!on) haptic.tick(); updateItem(it.id, { unit: u }); }} style={[styles.segBtn, on && { backgroundColor: C.white }]}>
                <Text numberOfLines={1} style={{ fontFamily: on ? F.semibold : F.medium, fontSize: 13, color: on ? C.ink : C.muted }}>{u}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* info box: List screen only */}
      {p.screen === 'list' && (
        <View style={styles.info}>
          <Row icon={<IconPerson size={16} color={C.greenText} />} text={`Added by ${nameOf(it.added_by)}`} />
          {r.every != null && (
            <Row icon={<IconClock size={16} color={C.greenText} />} text={`You buy this every ${r.every} days`}
              chip={st ? <Text style={[styles.chip, { color: st.fg, backgroundColor: st.bg }]}>{st.label}</Text> : null} />
          )}
          {(r.count > 0 || it.in_cart) && <Row icon={<IconCheck size={16} color={C.greenText} width={2} />} text={lastText} />}
          <Row icon={<IconRoute size={16} color={C.greenText} />} text={orderText} />
        </View>
      )}

      <View pointerEvents="none" style={{ height: 0, marginTop: -8 }} onLayout={(e) => { lay.current.mark = e.nativeEvent.layout.y; report(); }} />
      {/* Remove · Done */}
      <View onLayout={(e) => { lay.current.row = e.nativeEvent.layout.y; report(); }} style={{ flexDirection: 'row', gap: 8, marginTop: 'auto' }}>
        <Pressable accessibilityRole="button" onPress={() => { haptic.remove(); removeFromList(it.id); p.onDone(); }} style={styles.remove}>
          <IconTrash size={16} color={C.danger} width={2.2} />
          <Text style={{ fontFamily: F.semibold, fontSize: 14, color: C.danger }}>Remove</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={p.onDone} style={styles.done}>
          <IconCheck size={16} color={C.white} width={2.2} />
          <Text style={{ fontFamily: F.semibold, fontSize: 14, color: C.white }}>Done</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

function Row({ icon, text, chip }: { icon: React.ReactNode; text: string; chip?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 22 }}>
      {icon}
      <Text style={{ flex: 1, fontFamily: F.regular, fontSize: 13, color: C.ink }}>{text}</Text>
      {chip}
    </View>
  );
}

const styles = StyleSheet.create({
  // 42px corners and 20px padding, so the 44px controls inside are concentric
  card: {
    position: 'absolute', left: 0, zIndex: 22, backgroundColor: C.ground, borderWidth: 1, borderColor: C.line, borderRadius: 42,
    padding: 20, gap: 8,
  },
  pic: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  name: { flex: 1, fontFamily: F.semibold, fontSize: 15, color: C.ink },
  must: { height: 44, paddingLeft: 10, paddingRight: 12, borderRadius: 22, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', gap: 5 },
  shapes: {
    position: 'absolute', top: 52, left: 0, right: 0, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 22, padding: 6,
    flexDirection: 'row', flexWrap: 'wrap', gap: 4,
    shadowColor: C.ink, shadowOpacity: 0.16, shadowRadius: 14, shadowOffset: { width: 0, height: 12 }, elevation: 8,
  },
  shapeOpt: { width: '18.6%', height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  field: { height: 44, borderRadius: 22, backgroundColor: C.white, flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 16, gap: 10 },
  fieldLabel: { width: 40, fontFamily: F.semibold, fontSize: 13, color: C.muted },
  input: { flex: 1, height: '100%', fontFamily: F.regular, fontSize: 15, color: C.ink, padding: 0 },
  chev: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.ground, alignItems: 'center', justifyContent: 'center' },
  err: { fontFamily: F.medium, fontSize: 12, color: C.danger, paddingHorizontal: 16 },
  typeList: {
    position: 'absolute', top: 48, left: 0, right: 0, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 22, padding: 4,
    shadowColor: C.ink, shadowOpacity: 0.16, shadowRadius: 14, shadowOffset: { width: 0, height: 12 }, elevation: 8,
  },
  typeOpt: { height: 40, paddingHorizontal: 14, borderRadius: 17, flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepper: { width: 132, height: 44, padding: 4, borderRadius: 22, backgroundColor: C.white, borderWidth: 1, borderColor: C.line2, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  seg: { flex: 1, height: 44, padding: 4, borderRadius: 22, backgroundColor: C.segBg, flexDirection: 'row' },
  segBtn: { flex: 1, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  info: { backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 22, paddingVertical: 10, paddingHorizontal: 16, gap: 6 },
  chip: { fontFamily: F.semibold, fontSize: 12, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, overflow: 'hidden' },
  remove: {
    width: 132, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: C.outline, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  done: { flex: 1, height: 44, borderRadius: 22, backgroundColor: C.green, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
});

// Fades the callout out and back in (140ms) while its tile is scrolled out of view.
export function CalloutFade({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  const o = useSharedValue(visible ? 1 : 0);
  useEffect(() => { o.value = withTiming(visible ? 1 : 0, { duration: 140, easing: CSS_EASE }); }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps
  const st = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View pointerEvents={visible ? 'box-none' : 'none'} style={[StyleSheet.absoluteFill, { zIndex: 22 }, st]}>{children}</Animated.View>;
}
