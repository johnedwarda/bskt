// The item catalog (generated from the design canvas by scripts/gen-data.py).
import data from '@/data/catalog.json';

export type CatalogEntry = {
  id: string;
  name: string;
  aisle: string;
  defaultQty: string; // "500 g", "6 pcs"
  tile: string;       // pastel tile colour
  shopOrder: number;
  aliases: string[];
  types?: string[];   // suggested types
};

export const AISLES: string[] = data.aisles;
export const CATALOG: CatalogEntry[] = data.items as CatalogEntry[];
export const CATALOG_BY_ID: Record<string, CatalogEntry> = Object.fromEntries(CATALOG.map((c) => [c.id, c]));

export const DEFAULT_TILE = '#EEF3EF';

export function parseQty(s: string): { qty: number; unit: string } {
  const m = String(s).match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
  return m ? { qty: Number(m[1]), unit: m[2] || 'pcs' } : { qty: 1, unit: 'pcs' };
}

// Step for the quantity stepper.
export const stepFor = (unit: string) => (unit === 'g' || unit === 'ml' ? 50 : 1);

export const tileOf = (catalogKey: string | null | undefined) =>
  (catalogKey && CATALOG_BY_ID[catalogKey]?.tile) || DEFAULT_TILE;

// The must-buy star / toggle colour: the tile's pastel, same hue, 55% saturation, 34% lightness.
export function deepen(hex: string): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  return `hsl(${Math.round(h)}, ${d ? 55 : 10}%, 34%)`;
}
