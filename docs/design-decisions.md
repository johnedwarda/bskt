<!-- Copied from the blue DESIGN DECISIONS sticky on the bskt design canvas, which is the source of truth. -->

DESIGN DECISIONS (this sticky is the source of truth)

Shared shopping lists for families and friends. The interactive prototype "Prototype.dc.html" on the design canvas is the visual reference for everything below; where this note and the prototype disagree, ask.

## Brand

- Name: bskt.
- Wordmark: "bskt" in Bricolage Grotesque ExtraBold, lowercase, set tight, no custom letter changes (option C on "WordmarkOptions.dc.html"). It replaces the word "Lists" as the title on the lists screen.
- App icon: see "Wordmark.dc.html".

## Type

- UI: Inter (400, 500, 600).
- Headings and wordmark: Bricolage Grotesque (700–800).

## Colour

- ink: "#1B2B22" — Text, outlines, dark buttons
- muted: "#4F5E55" — Secondary text
- faint: "#7A867F" — Disabled text
- background: "#F5F3EC" — Screen background
- surface: "#FFFFFF" — Cards, fields
- border: "#E2DED2" — Field and card borders
- green: "#2E6B4A" — Primary buttons, "Add an item"
- green-dark: "#245A3D" — "On list" badge fill, type lines on tiles
- green-tint: "#EEF3EF" — Selected rows
- cart: "#A8432E" — Cart button
- cart-text: "#8A2F0C" — "In cart" badge fill, errors, trash badge icon

Item tiles use the pastel colour from "data/catalog.json". The must-buy star uses a deeper shade of the tile colour: same hue, 55% saturation, 34% lightness.

## Layout

- Screen: designed at 390×844.
- Margins: 20px page margins on every screen.
- Buttons: every labelled button is 52px tall, 26px corner radius, 16px side padding. Its main icon (Done, Clear, New list, Next / Log in / Create account arrows) is 20px; small secondary icons (Undo, Invite, Delete, Cancel, Copy link) stay 16px.
- Corners: follow the project rule that nested rounded shapes are concentric where it applies. For buttons and page margins the 52/26/16 and 20px rules above win.
- Icons and pictures: SVG only.
- Add screen: the search box is a 52px pill with 16px side padding, in a bottom bar with 20px padding (the same as the New list bar). The suggestion tiles above it grow as tall as they need, up to just below the “On the list” tiles (which stay in view while searching); beyond that they scroll.
- Exception: the quick-edit callout's controls are 44px tall to keep it compact.

## Key screens and behaviour

- Intro: 3 animated slides, then log in / sign up.
- Lists: shared lists, each with members.
- People's pictures: the account button (top right of the Lists screen) and the member rows in a list's edit sheet show the person's account picture from their sign-in provider (e.g. Google), cropped to the circle. Everyone who shares a list with someone sees it. Without a picture (email sign-up, or it fails to load) it falls back to the label on a colour: “You” on green for yourself, the initial on the person's colour for others. Stored on the profile (avatar_url) and refreshed each time they sign in.
- List:
  - items as tiles in 3 columns, ordered by shopping order (see the CATALOG RULES sticky), with a sort selector;
  - drag a tile onto the cart to put it in the cart (a slow move drags, a quick flick scrolls the list; a move that starts on the tile's outer edge, outside its middle 70%, always scrolls);
  - Clear, at the bottom of the cart panel, takes everything in the cart off the list and counts as a purchase (this is “checking out” in the data). Just above the button, a small centred line (12px, muted) counts down to the automatic clear, e.g. “Auto clears in 4 hours” (whole hours, rounded up; “Auto clears in 1 hour”; once the time is up, “Auto clears next time the app opens”). Auto clear: when the app is opened (or comes back to the front), a cart that nothing has been put into for 6 hours clears itself the same way (each purchase dated when its item went into the cart), so a forgotten cart never leaks into the next trip. It never clears while the app is in use;
  - the cart panel's title is the cart icon (28px, ink #1B2B22, same as the title text) followed by “Cart” (Bricolage Grotesque 24px bold, 8px gap), with the “N of M items” count on the right; the Clear button's check icon is 20px (see Layout › Buttons);
  - when the cart is empty, the cart button drops its count (“3 of 10”) and progress ring and shows “Drag items here” (11px) on a second line under “Cart”, so it fits the half-width button; the cart panel says the same;
  - a "Due soon" section;
  - a bottom dock with the cart button (left) and "Add an item" (right), equal widths.
- Must buy: a toggle in the quick-edit callout, next to the item name, coloured from the item's tile: off = no fill, a deep-shade outline and text; on = filled with the deep shade (the same colour as the star on the tile), white text. On the tile it shows as a star in the top right corner.
- Add item: the “On the list” strip at the top shows only what's still to get (its count matches “N to get”); items in the cart aren't in it. Search with suggestion tiles, the most-due items first. A suggestion that is on the list or in the cart carries a small badge at the bottom of its tile: “On list” (green-dark #245A3D fill) or “In cart” (cart-text #8A2F0C fill), white 600-weight text (11px, 10px on the smaller search tiles), fully rounded corners. An “On list” tile is dimmed to 50% as a whole, badge included; an “In cart” tile is not dimmed (a second copy can be added; see the SPEC sticky). The Due soon and Suggestion headings carry a “tap to add” hint. The full behaviour is in the orange SPEC sticky on the canvas.
- Quick-edit callout: right after an item is added on the Add screen (except from Due soon, which adds without it), a full-width callout points at its tile in the “On the list” strip with Must buy, Type, Note and quantity (full behaviour in the orange SPEC sticky, section “Editing items”). It is the only way to edit an item, on both screens: on the Add screen tapping a strip tile or a dimmed suggestion opens it too, on the List screen tapping a list tile. It pops out of its tile when it opens and shrinks back into it when it closes. Custom items get a picture picker on their picture (see the CATALOG RULES sticky). It never blocks adding: it moves to the next item added, hides as soon as the user types a new search, and has Remove · Done (a tap outside also closes it). Edits apply as they're made; tapping anywhere outside the callout (other than the keyboard) closes it and keeps them. The keyboard stays open while adding and types into Type / Note when they're focused; it closes only on a tap outside the search area and the callout. There is no tap & hold anywhere. A Type that would duplicate an active item+type shows an error and reverts when the callout closes. On the List screen it also shows an info box (added by, how often, last ticked off, place in the trip). There is no separate item details panel.
- Default quantity: wherever a quantity is suggested (Due soon, search suggestions, adding an item), use the most common amount over the item's last 5 purchases. Before it has been bought, use "defaultQty" from the catalog.
- "Bought before" means checked out from the cart. Removing from the list never counts.
