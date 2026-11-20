// All lists the signed-in person belongs to, kept fresh through realtime.
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from './auth';
import { supabase } from './supabase';
import type { Item, List, Member } from './types';

export type ListSummary = List & {
  list_members: Member[];
  items: Pick<Item, 'id' | 'catalog_key' | 'name' | 'shown_as' | 'kind' | 'shape' | 'variant' | 'on_list' | 'in_cart' | 'is_custom' | 'sort_order'>[];
};

const SELECT =
  'id, name, owner_id, invite_token, created_at, ' +
  'list_members(list_id, user_id, role, notify_shop, notify_add, profiles(id, name, color, avatar_url)), ' +
  'items(id, catalog_key, name, shown_as, kind, shape, variant, on_list, in_cart, is_custom, sort_order)';

export function useLists() {
  const { userId } = useAuth();
  const [lists, setLists] = useState<ListSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    const { data, error: e } = await supabase.from('lists').select(SELECT).order('created_at', { ascending: true });
    if (e) setError(e.message);
    else {
      setError(null);
      setLists(((data ?? []) as unknown as ListSummary[]));
    }
    setLoading(false);
  }, [userId]);

  const reloadSoon = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(load, 250);
  }, [load]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`lists-overview-${userId}-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, reloadSoon)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'list_members' }, reloadSoon)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lists' }, reloadSoon)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, reloadSoon]);

  return { lists, setLists, loading, error, reload: load };
}

export async function createList(name: string): Promise<List> {
  const { data, error } = await supabase.rpc('create_list', { p_name: name });
  if (error) throw error;
  return data as List;
}

export async function deleteList(id: string) {
  const { error } = await supabase.from('lists').delete().eq('id', id);
  if (error) throw error;
}

export async function leaveList(listId: string, userId: string) {
  const { error } = await supabase.from('list_members').delete().eq('list_id', listId).eq('user_id', userId);
  if (error) throw error;
}

export async function joinList(token: string): Promise<string> {
  const { data, error } = await supabase.rpc('join_list', { p_token: token });
  if (error) throw error;
  return data as string;
}
