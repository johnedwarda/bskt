// How often an item is bought, whether it's due, and the amount to suggest - from checked-out purchases.
import { CATALOG_BY_ID, parseQty } from './catalog';
import type { Item, Purchase } from './types';

const DAY = 864e5;

export type Rhythm = {
  every: number | null;     // average gap in days; null until there are at least two purchases
  lastDays: number | null;  // days since last checked out (0 while in the cart)
  lastBy: string | null;
  count: number;            // purchases (= checkouts)
};
export type Status = { due: number; label: string; bg: string; fg: string };

export function groupPurchases(purchases: Purchase[]): Map<string, Purchase[]> {
  const m = new Map<string, Purchase[]>();
  for (const p of purchases.slice().sort((a, b) => b.bought_at.localeCompare(a.bought_at))) {
    const arr = m.get(p.item_id);
    if (arr) arr.push(p); else m.set(p.item_id, [p]);
  }
  return m;
}

export function rhythmOf(item: Item, pbi: Map<string, Purchase[]>, now = Date.now()): Rhythm {
  const ps = pbi.get(item.id) ?? []; // newest first
  let every: number | null = null;
  if (ps.length >= 2) {
    const t = ps.slice(0, 6).map((p) => new Date(p.bought_at).getTime());
    const gaps: number[] = [];
    for (let i = 0; i < t.length - 1; i++) { const g = (t[i] - t[i + 1]) / DAY; if (g >= 0.5) gaps.push(g); }
    if (gaps.length) every = Math.max(1, Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length));
  }
  const last = ps[0];
  const lastDays = item.in_cart ? 0 : last ? Math.floor((now - new Date(last.bought_at).getTime()) / DAY) : null;
  return { every, lastDays, lastBy: item.in_cart ? item.cart_by : last?.bought_by ?? null, count: ps.length };
}

export function statusOf(r: Rhythm): Status | null {
  if (!r.every || r.lastDays == null) return null;
  const due = r.every - r.lastDays;
  if (due < 0) return { due, label: `Overdue ${-due}d`, bg: '#FBE3D6', fg: '#8A2F0C' };
  if (due === 0) return { due, label: 'Due today', bg: '#FCEFC7', fg: '#6B4800' };
  if (due <= 2) return { due, label: `Due in ${due}d`, bg: '#FCEFC7', fg: '#6B4800' };
  return { due, label: `In ${due}d`, bg: '#E6EFE9', fg: '#245A3D' };
}

// Suggested amount: the most common amount over the last 5 purchases; before any, the catalog default.
export function suggestedQty(item: Pick<Item, 'id' | 'catalog_key' | 'qty' | 'unit'> | null, catalogKey: string | null, pbi: Map<string, Purchase[]>) {
  const ps = item ? (pbi.get(item.id) ?? []).slice(0, 5).filter((p) => p.qty != null && p.unit) : [];
  if (ps.length) {
    const count = new Map<string, number>();
    ps.forEach((p) => { const k = `${p.qty}|${p.unit}`; count.set(k, (count.get(k) ?? 0) + 1); });
    const [best] = [...count.entries()].sort((a, b) => b[1] - a[1] || 0);
    const [q, u] = best[0].split('|');
    return { qty: Number(q), unit: u };
  }
  const c = catalogKey ? CATALOG_BY_ID[catalogKey] : undefined;
  if (c) return parseQty(c.defaultQty);
  return item ? { qty: item.qty, unit: item.unit } : { qty: 1, unit: 'pcs' };
}
