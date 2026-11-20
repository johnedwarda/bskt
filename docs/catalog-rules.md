<!-- Copied from the purple CATALOG RULES sticky on the bskt design canvas, which is the source of truth. -->

CATALOG RULES (this sticky is the source of truth)

The catalog is the list of items bskt knows out of the box. Data: "data/catalog.json". Pictures: "data/illustrations.json". On the design canvas it is shown on two artboards, "Catalog.dc.html" (all items on one page) and "CatalogBrowser.dc.html" (a phone browser with search).

## Shape of an item ("data/catalog.json")

- "id": Stable id, also the illustration key in "data/illustrations.json".
- "name": Display name, plural where people buy several (Bananas, Bin bags).
- "aisle": One of the 12 aisles below.
- "defaultQty": Amount suggested the first time, e.g. "500 g", "1 pack", "6 pcs". After the item has been bought, the suggestion becomes the most common amount over its last 5 purchases.
- "tile": Pastel background colour of the item's tile.
- "shopOrder": Position in a typical walk through the shop (aisle order, then item order). Used until a household's own shopping order has been learned.
- "aliases": Other names search also matches (see below). Can be empty.
- "suggestedTypes": Optional. Types offered for the item before anyone has used one (e.g. Milk: Oat, Lactose-free, Whole…).

Aisles, in shopping order: Produce, Dairy, Meat & fish, Bakery, Deli & ready meals, Pantry, Frozen, Snacks, Drinks, Household, Personal care, Baby & pets.

## Items and types

- An item is one product you'd pick off the shelf. A type is a variant of that same product: Oat milk, Greek yogurt, Rye bread.
- A different product is never a type. There is no "Nuts" item with a "Peanut" type: Peanuts, Almonds and Cashews are items of their own. The same goes for Strawberries (not a type of "Berries"), Basil (not a type of "Herbs") and Paprika (not a type of "Spices"). Compost bags are their own item, not a type of Bin bags.
- Group words are not items. Avoid entries like Nuts, Berries, Spices or Herbs. A few existing entries are borderline (Frozen veg, Frozen berries, Soft drinks, White fish, Painkillers, Tinned beans) and may be split later.
- Never two records of the same item+type. See the SPEC sticky.

## Aliases

- Aliases are other names for the same item that search matches: US/UK names (Courgette: *zucchini*), everyday names (Bin bags: *trash bags*, *bin liners*), and common varieties that aren't types (Wine: *prosecco*).
- Singular forms of "-ies" plurals are included (*cherry* for Cherries), because word-prefix search can't reach them from the plural.
- Shown under the name that was typed. An item found through an alias is shown with that alias ("Trash bags") on the suggestion tile, and keeps that name on the list and in its callout. It stays the same item and record, so it can't be added twice under different names. See the SPEC sticky.
- One alias, one item. No alias belongs to two items. A word that names two different products (*chips*: crisps or fries) is left out, so search shows both.
- Aliases never repeat a type. *Spaghetti* is a suggested type of Pasta, so it is not also an alias.
- English only for now. Other languages (Finnish first) come later as per-language name and alias lists when the app goes multilingual.

## Illustrations

- Every catalog item has its own SVG in "data/illustrations.json", keyed by "id", drawn on a 64×64 grid with a 2px dark outline ("#1B2B22"), rounded joins and flat fills. They scale to any size.
- "generic" (a shopping bag) is the fallback picture.
- A user-typed item that isn't in the catalog shows its first letter instead: Bricolage Grotesque Bold, about 62% of the tile picture size, colour "#2E6B4A".
- Its picture can be changed to a generic container: Pack (a crimped chips bag), Bag, Box, Carton, Bottle, Jar, Can, Tub, Tube, Cubes (soft-cornered 3D cubes), Blocks (a single soft-cornered 3D block), Grains or Granules (scattered loosely around a round white label), or Powder (a bowl heaped with flour) (same 64×64 style, each with a white label area for the letter). The first letter then sits in the middle of the label, about 30% of the picture size, same font and colour. Stored on the item record as "shape" (empty = letter only) and used everywhere the item's picture shows.

## Keeping things in sync

When the catalog changes, update all of these together: this sticky, "data/catalog.json", "data/illustrations.json" (new pictures), "Illo.dc.html", "Catalog.dc.html", "CatalogBrowser.dc.html" and the catalog copy inside "Prototype.dc.html".
