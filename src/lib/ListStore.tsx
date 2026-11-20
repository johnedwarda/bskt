// One list's live state (items, purchase history, members) plus every action on it.
// Changes are applied locally first, then written to Supabase; realtime keeps
// everyone else's screen in step.
import * as Crypto from 'expo-crypto';
import { haptic } from '@/lib/haptics';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState } from 'react-native';
import { useAuth } from './auth';
import { groupPurchases } from './rhythm';
import { supabase } from './supabase';
import { type AddSpec, familyKey, vk } from './addSearch';
import type { Invite, Item, List, Member, Purchase } from './types';

const HISTORY_DAYS = 365;
const TRIP_WINDOW_MS = 90 * 60 * 1000;
export const AUTO_CLEAR_MS = 6 * 3600e3;

// when something last went into the cart (null if it's empty)
export function latestCarted(items: Item[]): number | null {
  const t = items.filter((i) => i.on_list && i.in_cart && i.carted_at).map((i) => Date.parse(i.carted_at!));
  return t.length ? Math.max(...t) : null;
}

type Store = {
  listId: string;
  list: List | null;
  items: Item[];
  byId: Record<string, Item>;
  purchases: Purchase[];
  purchasesByItem: Map<string, Purchase[]>;
  members: Member[];
  invites: Invite[];
  loading: boolean;
  me: string;
  nameOf: (userId: string | null | undefined) => string;
  shoppingNow: (userId: string) => boolean;

  updateItem: (id: string, patch: Partial<Item>) => void;
  add: (spec: AddSpec) => string;          // golden rule: reuses the item+type's record if there is one
  putOnList: (id: string, patch?: Partial<Item>) => void;
  putInCart: (id: string) => void;
  putBack: (id: string) => void;
  removeFromList: (id: string) => void;
  forget: (id: string) => void;
  unforget: (id: string) => void;
  checkout: () => void;

  renameList: (name: string) => void;
  invite: (email: string) => Promise<'added' | 'invited'>;
  cancelInvite: (id: string) => void;
  setNotify: (key: 'notify_shop' | 'notify_add', value: boolean) => void;
  reload: () => Promise<void>;
};

const Ctx = createContext<Store | null>(null);

export function useList() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useList must be used inside <ListProvider>');
  return v;
}

const report = (what: string) => (e: { message?: string } | null) => {
  if (e) haptic.no();
  if (e) Alert.alert(`Couldn't ${what}`, e.message ?? 'Please try again.');
};

export function ListProvider({ listId, children }: { listId: string; children: React.ReactNode }) {
  const { userId } = useAuth();
  const me = userId ?? '';
  const [list, setList] = useState<List | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);

  const itemsRef = useRef(items);
  itemsRef.current = items;
  const purchasesRef = useRef(purchases);
  purchasesRef.current = purchases;

  const loadMembers = useCallback(async () => {
    const [m, inv] = await Promise.all([
      supabase.from('list_members').select('list_id, user_id, role, notify_shop, notify_add, profiles(id, name, color, avatar_url)').eq('list_id', listId),
      supabase.from('list_invites').select('id, list_id, email, accepted_at').eq('list_id', listId).is('accepted_at', null),
    ]);
    if (m.data) setMembers(m.data as unknown as Member[]);
    if (inv.data) setInvites(inv.data as Invite[]);
  }, [listId]);

  const reload = useCallback(async () => {
    const since = new Date(Date.now() - HISTORY_DAYS * 864e5).toISOString();
    const [l, it, pu] = await Promise.all([
      supabase.from('lists').select('*').eq('id', listId).maybeSingle(),
      supabase.from('items').select('*').eq('list_id', listId),
      supabase.from('purchases').select('*').eq('list_id', listId).gte('bought_at', since).order('bought_at', { ascending: false }).limit(5000),
    ]);
    if (l.data) setList(l.data as List);
    if (it.data) setItems(it.data as Item[]);
    if (pu.data) setPurchases(pu.data as Purchase[]);
    await loadMembers();
    setLoading(false);
  }, [listId, loadMembers]);

  useEffect(() => {
    reload();
    const ch = supabase
      .channel(`list-${listId}-${Crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items', filter: `list_id=eq.${listId}` }, (p) => {
        if (p.eventType === 'DELETE') {
          const old = p.old as Partial<Item>;
          setItems((xs) => xs.filter((x) => x.id !== old.id));
        } else {
          const row = p.new as Item;
          setItems((xs) => (xs.some((x) => x.id === row.id) ? xs.map((x) => (x.id === row.id ? row : x)) : [...xs, row]));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'purchases', filter: `list_id=eq.${listId}` }, (p) => {
        if (p.eventType === 'DELETE') {
          const old = p.old as Partial<Purchase>;
          setPurchases((xs) => xs.filter((x) => x.id !== old.id));
        } else {
          const row = p.new as Purchase;
          setPurchases((xs) => (xs.some((x) => x.id === row.id) ? xs : [row, ...xs]));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'list_members', filter: `list_id=eq.${listId}` }, () => loadMembers())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'lists', filter: `id=eq.${listId}` }, (p) => setList(p.new as List))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [listId, reload, loadMembers]);

  // ---------- item actions ----------

  const patchLocal = (id: string, patch: Partial<Item>) =>
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const updateItem = useCallback((id: string, patch: Partial<Item>) => {
    patchLocal(id, patch);
    supabase.from('items').update(patch).eq('id', id).then(({ error }) => report('save that change')(error));
  }, []);

  const deleteRow = (id: string) => {
    setItems((xs) => xs.filter((x) => x.id !== id));
    supabase.from('items').delete().eq('id', id).then(({ error }) => report('save that change')(error));
  };

  // Two records of one item+type in the same place (both to get, or both in the cart): fold them into one.
  // Quantities add up when the units match (otherwise the newer copy's amount wins); the more recently
  // written note is kept; Must buy if either had it. The original record (with the history) is kept.
  const mergeTwins = (id: string, patch: Partial<Item>) => {
    const all = itemsRef.current.map((x) => (x.id === id ? { ...x, ...patch } : x));
    const it = all.find((x) => x.id === id);
    if (!it || !it.on_list) return false;
    const tw = all.find((c) => c.id !== id && c.on_list && c.in_cart === it.in_cart && familyKey(c) === familyKey(it) && vk(c.variant) === vk(it.variant));
    if (!tw) return false;
    const keep = it.copy_of && !tw.copy_of ? tw : it;
    const drop = keep === it ? tw : it;
    const same = keep.unit === drop.unit;
    const tk = keep.note_at ? Date.parse(keep.note_at) : 0, td = drop.note_at ? Date.parse(drop.note_at) : 0;
    const note = td > tk ? drop.note : tk > td ? keep.note : drop.note || keep.note;
    const units = [...keep.units, ...drop.units.filter((u) => !keep.units.includes(u))];
    const merged: Partial<Item> = {
      on_list: true, in_cart: it.in_cart, cart_by: it.cart_by, carted_at: it.carted_at,
      qty: same ? keep.qty + drop.qty : drop.qty, unit: same ? keep.unit : drop.unit, units, note,
      note_at: (td > tk ? drop.note_at : keep.note_at) ?? null, must_buy: keep.must_buy || drop.must_buy,
    };
    deleteRow(drop.id);
    updateItem(keep.id, merged);
    return true;
  };

  // Golden rule: one record of an item+type on the list and at most one in the cart. While it's in the
  // cart, adding it again puts a second copy on the list, linked to the one in the cart.
  const add = useCallback((spec: AddSpec) => {
    const fk = familyKey(spec);
    const fam = itemsRef.current.filter((i) => familyKey(i) === fk && vk(i.variant) === vk(spec.variant));
    const onList = fam.find((i) => i.on_list && !i.in_cart);
    if (onList) return onList.id;
    const inCart = fam.find((i) => i.on_list && i.in_cart);
    const reuse = !inCart && fam.find((i) => !i.on_list);
    if (reuse) {
      const units = reuse.units.includes(spec.unit) ? reuse.units : [spec.unit, ...reuse.units];
      updateItem(reuse.id, {
        on_list: true, in_cart: false, cart_by: null, carted_at: null, added_by: me, forgotten: false,
        qty: spec.qty, unit: spec.unit, units, shown_as: spec.shown_as,
      });
      return reuse.id;
    }
    const id = Crypto.randomUUID();
    const now = new Date().toISOString();
    const row: Item = {
      id, list_id: listId, ...spec, shape: inCart?.shape ?? '', note: '', must_buy: false, on_list: true, in_cart: false,
      added_by: me, cart_by: null, carted_at: null, forgotten: false, copy_of: inCart?.id ?? null, note_at: null,
      created_at: now, updated_at: now,
      ...(inCart ? { sort_order: inCart.sort_order + 0.001, kind: inCart.kind, name: inCart.name } : {}),
    };
    setItems((xs) => [...xs, row]);
    const { created_at: _c, updated_at: _u, ...insert } = row;
    supabase.from('items').insert(insert).then(({ error }) => {
      if (error) { setItems((xs) => xs.filter((x) => x.id !== id)); report('add that item')(error); }
    });
    return id;
  }, [listId, me, updateItem]);

  const putOnList = useCallback((id: string, patch?: Partial<Item>) => {
    updateItem(id, { on_list: true, in_cart: false, cart_by: null, carted_at: null, added_by: me, ...patch });
  }, [updateItem, me]);

  // Learns the shopping order: what goes into the cart moves towards just after whatever went in before it.
  const putInCart = useCallback((id: string) => {
    const item = itemsRef.current.find((i) => i.id === id);
    if (!item || item.in_cart) return;
    const now = Date.now();
    const prev = itemsRef.current
      .filter((i) => i.id !== id && i.carted_at && now - new Date(i.carted_at).getTime() < TRIP_WINDOW_MS)
      .sort((a, b) => b.carted_at!.localeCompare(a.carted_at!))[0];
    const patch: Partial<Item> = { in_cart: true, cart_by: me, carted_at: new Date(now).toISOString() };
    if (prev) patch.sort_order = Math.round((item.sort_order * 0.6 + (prev.sort_order + 0.05) * 0.4) * 1000) / 1000;
    if (!mergeTwins(id, patch)) updateItem(id, patch);
  }, [updateItem, me]); // eslint-disable-line react-hooks/exhaustive-deps

  // Putting the first one back while a second copy is on the list: the two become one list item again.
  const putBack = useCallback((id: string) => {
    const patch = { in_cart: false, cart_by: null, carted_at: null };
    if (!mergeTwins(id, patch)) updateItem(id, patch);
  }, [updateItem]); // eslint-disable-line react-hooks/exhaustive-deps

  // Remove: off the list; not a purchase, history kept. A second copy has no history: it just goes.
  const removeFromList = useCallback((id: string) => {
    const it = itemsRef.current.find((x) => x.id === id);
    if (it?.copy_of) { deleteRow(id); return; }
    updateItem(id, { on_list: false, in_cart: false, cart_by: null, carted_at: null });
  }, [updateItem]); // eslint-disable-line react-hooks/exhaustive-deps

  const forget = useCallback((id: string) => updateItem(id, { forgotten: true }), [updateItem]);
  const unforget = useCallback((id: string) => updateItem(id, { forgotten: false }), [updateItem]);

  // Clear ("checkout"): everything in the cart comes off the list
  // and counts as bought. A second copy still on the list then folds back into the item's own record.
  // `auto`: the automatic clear (purchases dated when each item went into the cart)
  const clearCart = useCallback((auto = false) => {
    const before = auto ? Infinity : undefined;
    const cart = itemsRef.current.filter((i) => i.on_list && i.in_cart);
    if (!cart.length) return;
    const now = new Date().toISOString();
    const ps: Purchase[] = cart.map((i) => ({
      id: Crypto.randomUUID(), item_id: i.id, list_id: listId, bought_by: i.cart_by ?? me,
      bought_at: before !== undefined && i.carted_at ? i.carted_at : now, qty: i.qty, unit: i.unit,
    }));
    const ids = cart.map((i) => i.id);
    setPurchases((xs) => [...ps, ...xs]);
    setItems((xs) => xs.map((x) => (ids.includes(x.id) ? { ...x, on_list: false, in_cart: false, cart_by: null } : x)));
    Promise.all([
      supabase.from('purchases').insert(ps),
      supabase.from('items').update({ on_list: false, in_cart: false, cart_by: null }).in('id', ids),
    ]).then(([a, b]) => report('clear the cart')(a.error ?? b.error));
    // copies waiting on the list move back into their original record
    for (const c of itemsRef.current.filter((x) => x.copy_of && ids.includes(x.copy_of))) {
      const o = itemsRef.current.find((x) => x.id === c.copy_of);
      if (!o || familyKey(o) !== familyKey(c) || vk(o.variant) !== vk(c.variant)) { updateItem(c.id, { copy_of: null }); continue; }
      deleteRow(c.id);
      if (c.on_list) updateItem(o.id, {
        on_list: true, in_cart: c.in_cart, cart_by: c.cart_by, carted_at: c.carted_at, qty: c.qty, unit: c.unit,
        units: c.units, note: c.note, note_at: c.note_at, must_buy: c.must_buy, shown_as: c.shown_as, added_by: c.added_by,
      });
    }
  }, [listId, me, updateItem]); // eslint-disable-line react-hooks/exhaustive-deps
  const checkout = useCallback(() => clearCart(false), [clearCart]);

  // Auto clear: when the app is opened (or comes back to the front), a cart that nothing has gone into
  // for 6 hours is cleared, as if Clear had been pressed (purchases dated when each item went in).
  useEffect(() => {
    if (loading) return;
    const check = () => {
      const latest = latestCarted(itemsRef.current);
      if (latest != null && Date.now() - latest >= AUTO_CLEAR_MS) clearCart(true);
    };
    check();
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') check(); });
    return () => sub.remove();
  }, [loading, clearCart]);

  // ---------- list actions ----------

  const renameList = useCallback((name: string) => {
    setList((l) => (l ? { ...l, name } : l));
    supabase.from('lists').update({ name }).eq('id', listId).then(({ error }) => report('rename the list')(error));
  }, [listId]);

  const invite = useCallback(async (email: string) => {
    const { data, error } = await supabase.rpc('invite_to_list', { p_list: listId, p_email: email });
    if (error) throw error;
    await loadMembers();
    return data as 'added' | 'invited';
  }, [listId, loadMembers]);

  const cancelInvite = useCallback((id: string) => {
    setInvites((xs) => xs.filter((x) => x.id !== id));
    supabase.from('list_invites').delete().eq('id', id).then(({ error }) => report('cancel the invite')(error));
  }, []);

  const setNotify = useCallback((key: 'notify_shop' | 'notify_add', value: boolean) => {
    setMembers((ms) => ms.map((m) => (m.user_id === me ? { ...m, [key]: value } : m)));
    supabase.from('list_members').update({ [key]: value }).eq('list_id', listId).eq('user_id', me)
      .then(({ error }) => report('save that setting')(error));
  }, [listId, me]);

  // ---------- derived ----------

  const value = useMemo<Store>(() => {
    const byId = Object.fromEntries(items.map((i) => [i.id, i]));
    const names = new Map(members.map((m) => [m.user_id, m.profiles?.name || 'Someone']));
    // "Shopping now": put something in the cart in the last 30 minutes
    const recent = new Set(items.filter((i) => i.carted_at && Date.now() - new Date(i.carted_at).getTime() < 30 * 60e3).map((i) => i.cart_by));
    return {
      listId, list, items, byId, purchases, purchasesByItem: groupPurchases(purchases), members, invites, loading, me,
      nameOf: (uid) => (!uid ? 'someone' : uid === me ? 'you' : names.get(uid) ?? 'someone'),
      shoppingNow: (uid) => recent.has(uid),
      updateItem, add, putOnList, putInCart, putBack, removeFromList, forget, unforget, checkout,
      renameList, invite, cancelInvite, setNotify, reload,
    };
  }, [listId, list, items, purchases, members, invites, loading, me, updateItem, add, putOnList, putInCart, putBack,
    removeFromList, forget, unforget, checkout, renameList, invite, cancelInvite, setNotify, reload]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
