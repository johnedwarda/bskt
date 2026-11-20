import { rhythmOf, statusOf, type Rhythm, type Status } from './rhythm';
import type { Item, Purchase, SortMode } from './types';

export type Group = { title: string | null; items: Item[] };

export const SORTS: [SortMode, string][] = [
  ['usual', 'shopping order'],
  ['alpha', 'alphabetical order'],
  ['category', 'category'],
  ['priority', 'must buy first'],
];

export const byOrder = (a: Item, b: Item) => a.sort_order - b.sort_order || a.name.localeCompare(b.name);
export const todoOf = (items: Item[]) => items.filter((i) => i.on_list && !i.in_cart).sort(byOrder);
export const cartOf = (items: Item[]) => items.filter((i) => i.on_list && i.in_cart).sort(byOrder);

export function groupTodo(todo: Item[], mode: SortMode): Group[] {
  if (mode === 'alpha') return [{ title: null, items: todo.slice().sort((a, b) => (a.shown_as || a.name).localeCompare(b.shown_as || b.name)) }];
  if (mode === 'category') {
    const map = new Map<string, Item[]>();
    for (const i of todo) map.set(i.grp || 'Other', [...(map.get(i.grp || 'Other') ?? []), i]);
    return [...map.entries()].map(([title, items]) => ({ title, items }));
  }
  if (mode === 'priority') {
    const must = todo.filter((i) => i.must_buy), rest = todo.filter((i) => !i.must_buy);
    return [must.length ? { title: 'Must buy', items: must } : null, rest.length ? { title: 'Everything else', items: rest } : null].filter(Boolean) as Group[];
  }
  return [{ title: null, items: todo }];
}

export type WithRhythm = { item: Item; r: Rhythm; st: Status | null };

// Due soon: bought before, not on the list, due within 3 days, most overdue first.
export function dueSoonOf(items: Item[], pbi: Map<string, Purchase[]>, within = 3): WithRhythm[] {
  return items
    .filter((i) => !i.on_list && !i.forgotten)
    .map((item) => { const r = rhythmOf(item, pbi); return { item, r, st: statusOf(r) }; })
    .filter((x) => x.r.count > 0 && x.st && x.st.due <= within)
    .sort((a, b) => a.st!.due - b.st!.due);
}

// Add screen: everything bought before that isn't on the list, closest to due first.
export function dueForAdd(items: Item[], pbi: Map<string, Purchase[]>): WithRhythm[] {
  return items
    .filter((i) => !i.on_list && !i.forgotten)
    .map((item) => { const r = rhythmOf(item, pbi); return { item, r, st: statusOf(r) }; })
    .filter((x) => x.r.count > 0)
    .sort((a, b) => (b.r.every && b.r.lastDays != null ? b.r.lastDays / b.r.every : -1) - (a.r.every && a.r.lastDays != null ? a.r.lastDays / a.r.every : -1));
}

// Custom items show their first letter (on their container picture, if they have one).
export const letterOf = (i: Pick<Item, 'is_custom' | 'name'>) => (i.is_custom ? i.name : '');
