// Add item search: suggestion tiles while typing, and what Enter does.
// Source of truth: the orange SPEC sticky on the design canvas (mirrored in docs/add-item-search.md).
import { CATALOG, CATALOG_BY_ID, type CatalogEntry, parseQty, tileOf } from './catalog';
import { cap, parseAmount } from './parse';
import { suggestedQty } from './rhythm';
import type { Item, Purchase } from './types';

export const lc = (t?: string | null) => (t || '').toLowerCase();
// type key: case-insensitive, and "Plain" is the same as no type
export const vk = (v?: string | null) => { const s = lc(v).trim(); return s === 'plain' ? '' : s; };
export const familyKey = (i: { catalog_key: string | null; name: string }) => i.catalog_key ?? `custom:${lc(i.name)}`;
export const shownName = (i: { name: string; shown_as?: string }) => i.shown_as || i.name;
export const displayName = (i: { name: string; shown_as?: string; variant?: string }) =>
  i.variant ? `${i.variant} ${shownName(i).toLowerCase()}` : shownName(i);

export type Root = {
  key: string;            // family key
  name: string;
  kind: string;
  keys: string[];         // name + aliases, lower case
  aliases: string[];
  catalog: CatalogEntry | null;
  rows: Item[];           // this item's records, one per type
  custom: boolean;
};

export type Tile = {
  id: string;
  root: Root;
  record: Item | null;
  variant: string;
  label: string;          // the name shown (an alias when found through one)
  alias: string;          // the alias it was found through ('' = by name)
  active: 'on' | 'cart' | null;
  qty: number;
  unit: string;
  enter: boolean;         // the tile Enter acts on (outlined green)
  forgettable: boolean;   // custom item not on the list: trash badge
  brandNew?: boolean;
};

export type Enter =
  | { type: 'none' }
  | { type: 'add'; root: Root; variant: string; alias: string }
  | { type: 'new'; name: string };

export type SearchResult = { tiles: Tile[]; enter: Enter; amount: number | null; unit: string; name: string };

const hitIn = (text: string, w: string) => (' ' + lc(text)).includes(' ' + w);

export function buildRoots(items: Item[]): Root[] {
  const byFam = new Map<string, Item[]>();
  // a record in the cart with a second copy waiting on the list is represented by that copy
  const shadowed = new Set(items.filter((c) => c.on_list && c.in_cart && items.some((x) => x !== c && x.on_list && !x.in_cart && familyKey(x) === familyKey(c) && vk(x.variant) === vk(c.variant))).map((c) => c.id));
  for (const i of items) if (!shadowed.has(i.id)) byFam.set(familyKey(i), [...(byFam.get(familyKey(i)) ?? []), i]);
  const roots: Root[] = [];
  // the household's own items first (in shopping order), then the rest of the catalog
  const own = [...byFam.entries()].sort((a, b) => Math.min(...a[1].map((x) => x.sort_order)) - Math.min(...b[1].map((x) => x.sort_order)));
  for (const [k, rows] of own) {
    const c = CATALOG_BY_ID[k];
    if (c) roots.push({ key: k, name: c.name, kind: c.id, keys: [lc(c.name), ...c.aliases], aliases: c.aliases, catalog: c, rows, custom: false });
    else {
      const r0 = rows[0];
      if (rows.every((r) => r.forgotten)) continue; // never suggested again
      roots.push({ key: k, name: r0.name, kind: r0.kind, keys: [lc(r0.name)], aliases: [], catalog: null, rows, custom: true });
    }
  }
  for (const c of CATALOG) if (!byFam.has(c.id)) roots.push({ key: c.id, name: c.name, kind: c.id, keys: [lc(c.name), ...c.aliases], aliases: c.aliases, catalog: c, rows: [], custom: false });
  return roots;
}

export function typesOf(r: Root): string[] {
  const out: string[] = [];
  const add = (t: string) => { if (vk(t) && !out.some((x) => vk(x) === vk(t))) out.push(t); };
  r.rows.forEach((x) => add(x.variant));
  (r.catalog?.types ?? []).forEach(add);
  return out;
}

export const recordOf = (r: Root, variant: string) => r.rows.find((x) => vk(x.variant) === vk(variant)) ?? null;
const activeOf = (rec: Item | null): Tile['active'] => (rec?.on_list ? (rec.in_cart ? 'cart' : 'on') : null);
// the other name the text matched, when it didn't match the item's own name
const aliasOf = (r: Root, text: string) => (!text || hitIn(r.name, text) ? '' : r.aliases.find((a) => hitIn(a, text)) ?? '');

export function search(q: string, items: Item[], pbi: Map<string, Purchase[]>): SearchResult {
  const { amount, unit, text } = parseAmount(q);
  const nq = lc(text).trim().replace(/\s+/g, ' ');
  const name = cap(nq);
  const none: Enter = { type: 'none' };
  if (!nq) return { tiles: [], enter: none, amount, unit, name };

  const roots = buildRoots(items);
  const bought = (rec: Item | null) => !!rec && (pbi.get(rec.id)?.length ?? 0) > 0;
  const ratio = (rec: Item | null) => {
    const ps = rec ? pbi.get(rec.id) ?? [] : [];
    if (ps.length < 2) return -1;
    const days = (Date.now() - new Date(ps[0].bought_at).getTime()) / 864e5;
    const every = (new Date(ps[0].bought_at).getTime() - new Date(ps[Math.min(ps.length, 6) - 1].bought_at).getTime()) / 864e5 / (Math.min(ps.length, 6) - 1);
    return every > 0 ? days / every : -1;
  };
  const qtyFor = (rec: Item | null, r: Root) => {
    const base = suggestedQty(rec, r.catalog?.id ?? null, pbi);
    return amount ? { qty: amount, unit: unit || base.unit } : base;
  };
  const tile = (r: Root, rec: Item | null, v: string, alias: string): Tile => {
    const active = activeOf(rec);
    const q2 = active && rec ? { qty: rec.qty, unit: rec.unit } : qtyFor(rec, r);
    const label = alias ? cap(alias) : (rec?.shown_as || r.name);
    return {
      id: rec?.id ?? `${r.key}|${vk(v)}`, root: r, record: rec, variant: rec ? rec.variant : v, label, alias, active, ...q2,
      enter: false, forgettable: r.custom && !active,
    };
  };
  const byBought = (a: Item | null, b: Item | null) => (Number(bought(b)) - Number(bought(a))) || (ratio(b) - ratio(a));

  // everything the text matches
  type Hit = { r: Root; rootHit: boolean; t: Tile; rec: Item | null };
  const hits: Hit[] = [];
  for (const r of roots) {
    const rootHit = r.keys.some((k) => hitIn(k, nq)) || hitIn(r.name, nq);
    for (const v of ['', ...typesOf(r)]) {
      if (!(rootHit || (v && (hitIn(v, nq) || hitIn(`${v} ${r.name}`, nq) || hitIn(`${r.name} ${v}`, nq))))) continue;
      const rec = recordOf(r, v);
      hits.push({ r, rootHit, rec, t: tile(r, rec, rec ? rec.variant : v, v ? '' : aliasOf(r, nq)) });
    }
  }
  hits.sort((a, b) => byBought(a.rec, b.rec));

  // which item (and type word) the text narrows to
  let found: Root | null = null, typed = '', foundText = nq;
  const words = nq.split(' ');
  const exact = (t: string) => roots.filter((r) => r.keys.includes(t) || lc(r.name) === t);
  const partial = (t: string) => roots.filter((r) => r.keys.some((k) => k.startsWith(t)) || lc(r.name).startsWith(t));
  const whole = exact(nq);
  if (whole.length) found = whole[0];
  for (let pass = 0; !found && pass < 2 && words.length > 1; pass++) {
    for (let i = 1; i < words.length && !found; i++) {
      const left = words.slice(0, i).join(' '), right = words.slice(i).join(' ');
      for (const [itemPart, typePart] of [[right, left], [left, right]]) {
        const m = pass === 0 ? exact(itemPart) : partial(itemPart);
        if (m.length === 1 || (pass === 0 && m.length)) { found = m[0]; typed = typePart; foundText = itemPart; break; }
      }
    }
  }
  if (!found && hits.length && hits.every((h) => h.r === hits[0].r && h.rootHit)) found = hits[0].r;

  let tiles: Tile[] = [];
  let enter: Enter = none;
  let enterTile: Tile | null = null;
  const fal = found ? aliasOf(found, foundText) : '';
  if (found && typed && !vk(typed)) typed = ''; // "plain yogurt" is yogurt

  if (found && typed) {
    const tlist = typesOf(found);
    const ex = tlist.find((t) => lc(t) === lc(typed));
    const pm = ex ? [ex] : tlist.filter((t) => hitIn(t, lc(typed)));
    if (pm.length === 1) {
      // State 3: one item+type. Active: dimmed, Enter does nothing.
      const rec = recordOf(found, pm[0]);
      tiles = [tile(found, rec, rec ? rec.variant : pm[0], fal)];
      // on the list: dimmed, Enter does nothing. Only in the cart: Enter adds a second copy.
      if (activeOf(rec) !== 'on') { enterTile = tiles[0]; enter = { type: 'add', root: found, variant: tiles[0].variant, alias: fal }; }
    } else if (pm.length > 1) {
      // State 2b: several types match; Enter does nothing
      tiles = pm.map((t) => ({ t, rec: recordOf(found!, t) })).sort((a, b) => byBought(a.rec, b.rec)).map(({ t, rec }) => tile(found!, rec, t, fal));
    } else {
      // State 2c: a new type; with 1-2 letters, also the item's active and bought-before types
      const v = cap(typed);
      tiles = [tile(found, null, v, fal)];
      if (typed.trim().length < 3) {
        tiles = tiles.concat(found.rows.filter((c) => c.on_list || bought(c))
          .sort((a, b) => Number(b.on_list) - Number(a.on_list) || ratio(b) - ratio(a))
          .map((c) => tile(found!, c, c.variant, fal)));
      }
      enterTile = tiles[0];
      enter = { type: 'add', root: found, variant: v, alias: fal };
    }
  } else if (found) {
    // State 2a: active types (dimmed), bought-before types, then the no-type version
    const plain = recordOf(found, '');
    const plainOn = !!plain && plain.on_list && !plain.in_cart;
    tiles = [
      ...found.rows.filter((c) => c.on_list && !(c === plain && !plainOn)).sort((a, b) => a.sort_order - b.sort_order).map((c) => tile(found!, c, c.variant, fal)),
      ...found.rows.filter((c) => !c.on_list && vk(c.variant) && bought(c)).sort((a, b) => ratio(b) - ratio(a)).map((c) => tile(found!, c, c.variant, fal)),
    ];
    if (!plainOn) {
      enterTile = tile(found, plain, '', fal);
      tiles.push(enterTile);
      enter = { type: 'add', root: found, variant: '', alias: fal };
    }
  } else {
    // State 1: not narrowed; Enter only adds when nothing matched
    tiles = hits.map((h) => h.t);
    if (!tiles.length && nq.length >= 3) {
      const r: Root = { key: `custom:${nq}`, name, kind: 'generic', keys: [nq], aliases: [], catalog: null, rows: [], custom: true };
      enterTile = { id: `new|${nq}`, root: r, record: null, variant: '', label: name, alias: '', active: null, qty: amount ?? 1, unit: amount ? unit || 'pcs' : 'pcs', enter: false, forgettable: false, brandNew: true };
      tiles = [enterTile];
      enter = { type: 'new', name };
    }
  }

  const enterOk = nq.length >= 3 || (!!found && nq.length >= 2);
  if (!enterOk) enter = none;
  tiles = tiles.map((t) => (enterOk && t === enterTile && t.active !== 'on' ? { ...t, enter: true } : t));
  return { tiles, enter, amount, unit, name };
}

// What a new or reused record looks like when an item+type goes on the list.
export type AddSpec = {
  catalog_key: string | null; name: string; shown_as: string; kind: string; variant: string;
  qty: number; unit: string; units: string[]; step: number; grp: string; sort_order: number; is_custom: boolean;
};

export function addSpecFor(r: Root, variant: string, alias: string, qty: { qty: number; unit: string }, itemsCount: number): AddSpec {
  const c = r.catalog;
  const base = c ? parseQty(c.defaultQty) : { qty: 1, unit: 'pcs' };
  const units = [qty.unit, ...(qty.unit === base.unit ? [] : [base.unit])];
  const famMax = r.rows.length ? Math.max(...r.rows.map((x) => x.sort_order)) + 0.01 : null;
  return {
    catalog_key: c?.id ?? null, name: c?.name ?? r.name, shown_as: alias ? cap(alias) : '', kind: c?.id ?? r.kind,
    variant: vk(variant) ? cap(variant.trim()) : '', qty: qty.qty, unit: qty.unit, units, step: qty.unit === 'g' || qty.unit === 'ml' ? 50 : 1,
    grp: c?.aisle ?? 'Other', sort_order: famMax ?? (c ? c.shopOrder : 1000 + itemsCount), is_custom: !c,
  };
}

export { tileOf };
