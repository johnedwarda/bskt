// Small text helpers for the Add screen. The search itself lives in addSearch.ts.

const UNIT_MAP: Record<string, string> = {
  l: 'L', ml: 'ml', g: 'g', kg: 'kg', pcs: 'pcs', pc: 'pcs', x: 'pcs',
  pack: 'pack', packs: 'pack', cups: 'cups', bag: 'bag', bags: 'bag', loaf: 'loaf',
};

export const cap = (t: string) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : '');

export const displayName = (i: { name: string; variant?: string }) =>
  i.variant ? `${i.variant} ${i.name.toLowerCase()}` : i.name;

export const qtyText = (i: { qty: number; unit: string }) => `${formatNum(i.qty)} ${i.unit}`;

export function formatNum(n: number) {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

// A leading quantity is read first and removed: "2 l oat milk" -> 2 L, "oat milk".
export function parseAmount(q: string): { amount: number | null; unit: string; text: string } {
  const raw = q.trim();
  const m = raw.match(/^(\d+(?:[.,]\d+)?)\s*(kg|ml|l|g|pcs|pc|x|packs|pack|cups|bags|bag|loaf)?\s+(.+)$/i);
  if (!m) return { amount: null, unit: '', text: raw };
  return { amount: Number(m[1].replace(',', '.')), unit: UNIT_MAP[(m[2] || '').toLowerCase()] || '', text: m[3] };
}
