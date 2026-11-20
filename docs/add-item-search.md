<!-- Copied from the orange SPEC sticky on the bskt design canvas, which is the source of truth. -->

SPEC — Add item: search, suggestions and duplicates (this sticky is the source of truth)

Spec for the Add item screen: what the suggestion tiles show while the user types, what Enter does, and how items are edited (the quick-edit callout, on both the Add and List screens). The interactive prototype on the bskt design canvas ("Prototype.dc.html") implements this spec and is the visual reference.

## Terms

- Item: A product, e.g. *yogurt*, *milk*, *bananas*. Has one display name plus aliases.
- Alias: Another name for the same item, e.g. Bin bags: *trash bags*, *garbage bags*, *bin liners*; Courgette: *zucchini*. Search matches it like the name, and an item found through an alias is shown under that alias. It is still the same item and the same record.
- Shown name: The name an item is displayed with: the alias it was last added under ("Trash bags"), or its own name if it was added by name. Used on suggestion tiles, list tiles, the callout and messages.
- Type: An optional variant of an item, e.g. *Oat*, *Greek*, *Lactose-free*. Shown as "Oat yogurt".
- Item+type: One item with one type (or with no type). This is the unit that goes on the list. "Yogurt" with no type is its own item+type.
- Active: The item+type is on the list or in the cart. Wherever the rules below say an active tile is dimmed or that Enter does nothing, that applies to the list only: an item+type that is only in the cart shows undimmed with an “In cart” badge, and tapping it or Enter adds a second copy (see “Second copy while one is in the cart”).
- Bought before: The item+type has been checked out from the cart at least once. Removing it from the list never counts as a purchase.
- Known types: All types an item has ever had, plus the item's suggested type catalogue (e.g. yogurt: Greek, Oat, Strawberry, Vanilla).
- Dimmed tile: An item+type that's on the list. Tapping it opens its quick-edit callout; it can't be added again. One that's only in the cart is not dimmed (see “Second copy while one is in the cart”).
- Undimmed tile: Not active. Tap adds it to the list and opens its quick-edit callout (Due soon tiles add without opening it).
- New types: set in the callout's Type field after adding, or by typing them with the item ("coconut yogurt"). There is no separate ✎ tile for them.
- Custom item: one the user typed that isn't in the catalog (shown with its first letter, optionally on a generic container picture chosen in the callout). Its suggestion tile carries a small trash-bin badge in the top right, but only while it isn't on the list or in the cart; tapping the badge stops it from ever being suggested again (its record is kept, flagged as forgotten). A small dark banner at the top of the search bar then says “… removed from suggestions” with an Undo button; it disappears after about 5 seconds. Typing its full name and adding it brings it back.
- No drafts: every add puts the item straight on the list; edits happen afterwards, in the quick-edit callout.

## Golden rule

There is never more than one record of the same item+type. Type comparison is case-insensitive, and the type “Plain” is the same as no type, for every item: Plain yogurt and Yogurt are one item+type and can't both be on the list. “Plain” is never offered as a type, and typing “plain yogurt” reads as yogurt with no type.

- An item+type on the list can't be added again: its tile is dimmed, and Enter does nothing (tapping the tile opens its callout).
- The one exception, a second copy while one is in the cart: see the next section.
- When the user adds an item+type that was bought before (or has a record for any other reason), the existing record goes back on the list with its purchase history. A new record is never created for it.
- Aliases never create items. Bin bags, Trash bags and Garbage bags are one item. While it is active under any of those names, every one of them shows it dimmed, so it can't be added again under another name.

## Second copy while one is in the cart

While an item+type is in the cart, another copy of it may go on the list (bought one, need another).
- Its suggestion tile is not dimmed and still says “In cart”; tapping it, or Enter when it is the Enter target, puts a second copy on the list (a new record, linked to the one in the cart). The copy starts with no note and the suggested quantity. While the copy is on the list, the one in the cart is no longer offered separately: search shows the copy (dimmed, on the list).
- Type picker: a type that is only in the cart is not greyed and can be picked.
- Putting the first one back from the cart: the two become one list item again. Quantities add up when the units match (with different units the copy's amount and unit win); only the most recently written note is kept (each note remembers when it was last edited; if neither was edited in the app, the non-empty one is kept); Must buy is kept if either had it. The combined item is the original record, with its purchase history.
- Putting the copy in the cart too: the two combine in the cart the same way.
- Clear (or the automatic clear): the one in the cart is bought as usual; the copy stays on the list and folds back into the item's own record (history kept, the copy's quantity, note and Must buy).
- Remove on the copy deletes it (it has no history of its own). If its type is changed in the callout, it is simply its own item+type from then on.
- So the golden rule still holds: at most one record of an item+type on the list, and at most one in the cart.

## Enter target

The tile Enter will act on is outlined in solid green (#2E6B4A), like the just-added tile in the list strip above. When Enter does nothing, no tile is outlined.

## How typed text is read

A leading quantity is read first and removed: "2 l oat milk" → quantity 2 L, text "oat milk".

The remaining text falls into exactly one of three states:

1. Not narrowed: the text doesn't settle on a single item.
2. Narrowed to an item: the text names one item (or partially matches only one), with no type yet, or with a type word that matches several types or none.
3. Narrowed to an item+type: one item, and the type word picks out exactly one known type.

### Matching rules

- Word-prefix matching: text matches when it is the start of any word. "gr" matches *Greek yogurt* and *Grapes*. "oat m" matches *Oat milk*.
- Item match: the full item name or one of its aliases ("yogurt", "trash bags"), or a partial that matches only one item ("yog", if nothing else starts with "yog").
- Aliases count like the name: an exact alias narrows to its item exactly as the name would ("zucchini" → Courgette). A partial match on aliases follows the same word-prefix rule, so "trash" matches Bin bags (*trash bags*) and Compost bags (*bio trash bags*): two items, so it is not narrowed and both tiles show.
- Tiles use the name that was typed: a tile found through an alias is named after that alias ("trash" → "Trash bags" and "Bio trash bags"; "zucchini" → "Zucchini"). Adding from it puts the item on the list under that name: the list tile, the callout and history labels all say "Trash bags".
- Still one item: whatever name it was added under, it is the same item and the same record. Once Bin bags is on the list as "Trash bags", searching "garbage" or "bin" shows it dimmed ("Garbage bags", dimmed), so it can't be added a second time under another name; Enter does nothing. Adding it again later through another name (after it has come off the list) just changes the name it shows.
- One alias, one item: no alias belongs to two items. An alias that would name two different products (*chips* for crisps and for fries) is left out, so the word-prefix match shows both instead.
- Aliases never repeat a type: a variety that is already a suggested type of the item (*spaghetti* for Pasta, *basmati* for Rice) is a type, not an alias, so typing it finds the item+type (Spaghetti pasta) through normal type matching.
- Item + type word: the type word can come before or after the item: "oat milk" = "milk oat" = milk of type Oat.
- Item+type wins: text that could be read as two things or as an item plus a type is read as item+type. "oat milk" is *milk of type Oat*, not an item "oat" plus the word "milk".
- Exact type wins: if the type word exactly equals one known type, that type wins even when it is also the start of another type. With types *Oat* and *Oat vanilla*, "yogurt oat" narrows to *Oat yogurt*.

## State 1: Not narrowed

Tiles
- All matching items and item+types, whether or not they are on the list, in the cart or bought before.
- Bought-before ones first, the rest after them.
- Active ones are dimmed.
- No match at all:
  - 3 or more characters: show one tile named after the typed text (a brand-new item).
  - 1–2 characters: show nothing.

Enter
- Fewer than 3 characters: nothing.
- There are matches: nothing. The user picks a tile.
- No match: add a new item named after the typed text.

Example: "gr" → Cereal, Grapes, Spinach (dimmed, on list), Greek yogurt, Granny Smith apples. Enter does nothing.
Example: "zzz" → one tile "Zzz". Enter adds a new item "Zzz".
Example: "trash" → "Trash bags" (Bin bags) and "Bio trash bags" (Compost bags). Tapping "Trash bags" puts Bin bags on the list shown as "Trash bags".

## State 2: Narrowed to an item

### 2a. No type word typed (e.g. "yogurt", "yog")

Tiles, in this order:
1. Dimmed tiles for every type of this item that is on the list or in the cart, including the no-type version if it is active.
2. Undimmed tiles for types bought before that are not active.
3. An undimmed no-type tile, if the no-type version is not active (whether bought before or not).

Enter
- No-type version is not active → add it.
- No-type version is active → nothing.

Example: Oat and Vanilla yogurt on the list, Greek bought before, no plain "Yogurt" on the list.
"yogurt" → Oat (dimmed), Vanilla (dimmed), Greek, Yogurt. Enter adds "Yogurt" with no type. Pressing Enter again does nothing.

### 2b. A type word typed that matches several known types (e.g. "yogurt s" with Strawberry and Salted caramel)

Tiles
- Only the matching types, including ones never bought; bought-before ones first. Active ones are dimmed.

Enter: nothing. The user picks a tile.

### 2c. A type word typed that matches no known type (e.g. "yogurt coconut" or "coconut yogurt")

Tiles
- One undimmed tile for the new item+type, "Coconut yogurt".

Enter: add the item with the typed word as its type (Coconut yogurt).

With only 1–2 letters ("yogurt co"), the typed-type tile ("Co yogurt") comes first and Enter adds it too, followed by the item's types with purchase history plus any that are active (dimmed).

## State 3: Narrowed to an item+type

Reached when the item matches (full name, or a partial that matches one item) and the type word matches exactly one known type, fully or partially.

Tiles: only that item+type, dimmed if active.

Enter
- Not active → add it.
- Active → nothing. (Tap the dimmed tile to edit it in the callout.)

Examples
- "oat milk" / "milk oat" → Oat milk.
- "yog gr" → Greek yogurt (partial item + partial type).
- "yogurt oat" with Oat yogurt on the list → dimmed Oat yogurt. Enter does nothing.

## Editing items: the quick-edit callout

There is no item details panel. On both the Add screen and the List screen, items are edited in the quick-edit callout, which points at the item's tile: the “On the list” strip on the Add screen, the list tile on the List screen. There is no tap & hold anywhere in the app.

List screen
- Tapping a list tile opens its callout; tapping the same tile again closes it, and picking a tile up to drag it closes it too.
- Only here, the callout has an info box above Remove · Done: added by, how often it's bought (with its due status), when it was last ticked off and by whom, and its usual place in the trip.
- Everything except the item's own tile and the callout is dimmed, including the other tiles and the bottom dock (cart, Add an item); a tap anywhere dimmed closes the callout.
- Tapping Type or Note opens the keyboard (in the prototype, the same on-screen keyboard as the Add screen; its green key reads “done” and closes it). The page then scrolls so the whole callout sits flush on top of the keyboard (corners stay rounded); its tile is no longer highlighted and the arrow is hidden, and the tile may scroll out of view. When the keyboard closes, the tile scrolls back into view. The callout keeps its natural height (no stretch).
- The rules below (opens on the Add screen, placement, closing, contents) apply to both screens unless they name the Add screen.

Opens
- Right after an item is added from a suggestion tile or with Enter.
- On tapping a tile in the strip, or a dimmed (active) suggestion.
- Not when an item is added from Due soon: those add quietly. While a callout is open, tapping a Due soon tile only closes the callout and adds nothing.

Placement
- Full screen width, directly below its tile, with an arrow pointing up at the tile. While the keyboard is open it stretches down to 8px above the search area (Remove sits at its bottom) and Due soon fades out, so nothing shows around it. With the keyboard closed it keeps its natural height and Due soon stays visible below.
- It never covers the search area: when it would, the page scrolls up to make room, past its end if needed (a spacer is added while the callout is open). It also scrolls the tile into view if it is above the top.
- It scrolls on its own only when it opens, moves to another item, or the keyboard or its own size changes. When the user scrolls, it follows its tile and hides while the tile is out of view or it would overlap the search area.

Background
- While it is open, everything except the tiles in the “On the list” strip, the search bar (box and its frame), the callout and the keyboard is dimmed with a dark backdrop (ink at 55%) and inactive. A tap on the dimmed area or the search box closes the callout; the keyboard stays open, so the next item can be typed straight away.

Motion
- It pops out of its tile when it opens and shrinks back into it when it closes. Exact values: the pink MOTION sticky, section “Quick-edit callout”.

Closes (edits are kept; they apply as they're made)
- Done.
- A tap anywhere outside it, other than the on-screen keyboard.
- Typing a new search.
- Adding another item moves it to that item.

Keyboard
- Stays open while adding items; it closes only on a tap outside the search area (search box and suggestions) and the callout.
- When Type or Note is focused, the on-screen keyboard types into that field (green outline) and its add key reads “done”, which returns to the search box.

Contents, top to bottom
- Item picture (in its tile colour), name and Must buy toggle (no fill when off).
- Custom items only: the picture carries a small white edit badge (pencil, bottom right). Tapping the picture opens a dropdown grid of pictures (5 per row, no names; each has its name as its accessible label): Letter (the plain first letter), Pack, Bag, Box, Carton, Bottle, Jar, Can, Tub, Tube, Cubes, Blocks, Grains, Granules, Powder, each showing the item's first letter in the middle. The current one is outlined in green; picking one applies it and closes the dropdown. Opening the Type dropdown closes it.
- Colours: the card is the screen background colour (#F5F3EC) with a light border and no shadow; fields are white with a light border.
- Type: field with a dropdown of known types; ones on the list are greyed with “on list” (ones only in the cart can be picked). Tapping the field opens the dropdown (the chevron toggles it too). While typing, it narrows to types matching the text (word-prefix); it hides when nothing matches and closes when a type is picked or Note is tapped.
- Note: field.
- Quantity stepper (white; − on green tint, + green) and unit selector (beige track; the selected unit is a white chip).
- Remove · Done. Remove is the same width as the stepper above it (132px); Done (green) fills the rest, lining up with the unit selector.
- Controls are 44px tall in a card with 42px corners and 20px padding (concentric).

Rules
- Remove takes the item off the list (not a purchase; its history is kept).
- A Type that would duplicate an active item+type shows an error; when the callout closes or moves on, the type reverts to what it was when the callout opened.

## Type rules (callout)

- Type picker: types that are already on the list are shown greyed with "on list" and can't be picked. A type that is only in the cart can be picked (that makes a second copy; see “Second copy while one is in the cart”).
- Duplicate type: if the chosen or typed type would duplicate an item+type on the list:
  - the Type field shows an error, e.g. "Oat yogurt is already on the list.", or for no type: "Yogurt is already on the list. Pick a type to add another.";
  - when the callout closes, the type reverts.
- Closing an existing item with a clash: the type reverts to what it was when the callout opened.

## Things to watch out for when building

- Unfinished type words: a type word that matches no known type is offered as a new type at any length. "yogurt co" shows a "Co yogurt" tile (outlined; Enter adds it) plus the yogurt types bought before.
- Enter minimum: the 3-character minimum applies only to the not-narrowed state. Once text narrows to an item, Enter works from 2 characters ("yo" adds untyped yogurt if only yogurt matches).
- Single letters: one letter can narrow to an item if only that item matches it.
- Store the shown name on the record, not as a new item. Keep the item's catalog id and canonical name for matching, history and de-duplication; save the alias it was added under as a separate display field (e.g. "shownAs"). Adding by the item's own name clears it.
