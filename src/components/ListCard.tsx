import React, { useRef } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewInstance } from 'react-native';
import Animated, { Easing, withTiming } from 'react-native-reanimated';

const leave = () => {
  'worklet';
  return {
    initialValues: { opacity: 1, transform: [{ scale: 1 }] },
    animations: {
      opacity: withTiming(0, { duration: 260, easing: Easing.bezier(0.25, 0.1, 0.25, 1) }),
      transform: [{ scale: withTiming(0.9, { duration: 300, easing: Easing.bezier(0.5, 0, 0.75, 0) }) }],
    },
  };
};
import { tileOf } from '@/lib/catalog';
import type { ListSummary } from '@/lib/useLists';
import { C, F, R } from '@/theme';
import { IconEdit } from './icons';
import { Illo } from './Illo';
import { measure, type Origin } from './Sheet';

type Props = { list: ListSummary; me: string; hidden?: boolean; onOpen: () => void; onEdit: (origin: Origin | null) => void };

export function ListCard({ list, me, hidden, onOpen, onEdit }: Props) {
  const ref = useRef<ViewInstance>(null);
  const edit = async () => { const r = await measure(ref); onEdit(r && { ...r, r: 28, bg: C.card }); };
  const onList = list.items.filter((i) => i.on_list);
  const todo = onList.filter((i) => !i.in_cart).sort((a, b) => a.sort_order - b.sort_order);
  const cart = onList.length - todo.length;
  const pct = onList.length ? Math.round((cart / onList.length) * 100) : 0;
  const others = list.list_members.filter((m) => m.user_id !== me).map((m) => m.profiles?.name || 'Someone');
  const shared = others.length === 0 ? 'Just you' : others.length <= 2 ? others.join(', ') : `${others.slice(0, 2).join(', ')}, +${others.length - 2}`;

  return (
    <Animated.View ref={ref} exiting={leave} style={{ opacity: hidden ? 0 : 1 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${list.name}. ${todo.length} to get, ${cart} in cart. Shared with ${shared}.`}
        onPress={onOpen}
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
      >
        <View style={styles.row}>
          <Text style={styles.name} numberOfLines={1}>{list.name}</Text>
          <Text style={styles.shared} numberOfLines={1}>{shared}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, minHeight: 44 }}>
          {todo.slice(0, 4).map((i) => (
            <View key={i.id} style={[styles.bubble, { backgroundColor: tileOf(i.catalog_key) }]}>
              <Illo kind={i.kind} size={32} letter={i.is_custom ? i.name : ''} shape={i.shape} />
            </View>
          ))}
          {todo.length > 4 && (
            <View style={[styles.bubble, { backgroundColor: C.soft }]}>
              <Text style={{ fontFamily: F.semibold, fontSize: 13, color: C.greenText }}>+{todo.length - 4}</Text>
            </View>
          )}
          {onList.length === 0 && <Text style={styles.empty}>Nothing on it yet</Text>}
        </View>
        <View style={[styles.row, { gap: 10 }]}>
          <View style={styles.track}><View style={[styles.fill, { width: `${pct}%` }]} /></View>
          <Text style={styles.meta}>{todo.length} to get · {cart} in cart</Text>
        </View>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${list.name}`} onPress={edit} hitSlop={4} style={styles.edit}>
        <IconEdit size={18} color={C.ink} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12, padding: 16, borderRadius: R.card, backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { flex: 1, fontFamily: F.display, fontSize: 21, color: C.ink, minHeight: 32, textAlignVertical: 'center' },
  shared: { fontFamily: F.regular, fontSize: 13, color: C.muted, paddingLeft: 8, paddingRight: 44, maxWidth: '55%' },
  bubble: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  empty: { fontFamily: F.regular, fontSize: 13, color: C.muted, alignSelf: 'center' },
  track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: C.line2, overflow: 'hidden' },
  fill: { height: 6, backgroundColor: C.green },
  meta: { fontFamily: F.regular, fontSize: 13, color: C.muted },
  edit: { position: 'absolute', top: 6, right: 6, width: 44, height: 44, borderRadius: 22, backgroundColor: C.ground, alignItems: 'center', justifyContent: 'center' },
});
