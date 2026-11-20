<!-- Copied from the pink MOTION sticky on the bskt design canvas, which is the source of truth. -->

MOTION (this sticky is the source of truth for every animation)

Build every animation with the exact durations, easings, values and sequences below; "Prototype.dc.html" is the visual reference. If a platform can't reproduce a curve exactly (e.g. native springs), keep the same duration, the same direction of travel, and the same overshoot or lack of it. Anything not listed here has no animation: it changes instantly.

## Shared curves
- Standard (ease-out): cubic-bezier(0.2, 0.8, 0.2, 1). Panels, sheets, slides, the callout, the cart.
- Pop (overshoot): cubic-bezier(0.3, 1.8, 0.5, 1). Only for tiles that just received something.
- Leave (accelerate): cubic-bezier(0.5, 0, 0.75, 0); the callout closes with cubic-bezier(0.4, 0, 1, 1).
- Backdrops: ink rgba(27, 43, 34) at 55% (cart panel 45%), faded in and out.
- Reduced motion: every transition becomes an instant change and the intro loops stop; the state changes themselves still happen.

## Intro
- Slides: a horizontal track, transform 420ms Standard. During a swipe it follows the finger 1:1 (30% resistance past the first or last slide); released more than 60px away it moves to the next or previous slide, otherwise it snaps back.
- Page dots: the active dot is 24px wide, the others 8px (width and colour 260ms ease).
- Illustrations play only while their slide is showing (CSS keyframes in the prototype's <style>, names ia-*):
  - background circle grows 0.82 → 1 (700ms Standard);
  - cards and rows rise 24px while fading in (520–600ms Standard);
  - item chips and tiles pop 0.6 → 1.06 → 1 (420–480ms), staggered about 120–150ms;
  - avatars pop in, then bob 6px up and down (3.2s loop); the milk tile wiggles (3s loop); status chips pulse 1 → 1.08 (1.6s loop);
  - slide 3 loops a 6s story: the three tiles fly into the cart one after another, the counter ticks “0 of 3” → “3 of 3”, the ring fills a third each time and the cart bumps to 1.07 on each landing.

## Lists screen
- Delete list: the card fades out (260ms ease) and shrinks to 0.9 (300ms Leave); then the Undo banner appears (no animation) and hides after 5s.
- Edit list sheet, open: a white shape with the card's 28px corners grows from the list card to the sheet (left, top, width, height, corners and colour, 360ms Standard; it ends #F5F3EC with top corners only). The list name rides along and fades out (140ms). The backdrop fades 0 → 55%. At 400ms the sheet's content fades in (160ms).
- Edit list sheet, close: the content fades out (120ms); at 120ms the shape shrinks back onto the card (360ms Standard) while the name fades back in (180ms, 180ms delay) and the backdrop fades out. Gone at 490ms.

## List screen
- Add from Due soon: the picture flies from the Due soon tile to its new list tile in 480ms: left cubic-bezier(0.3, 0.7, 0.35, 1), top cubic-bezier(0.55, -0.35, 0.45, 1) (a small lift, then the fall, so it arcs), scale 1.05 → 1.33 cubic-bezier(0.3, 0.8, 0.3, 1), tilt −8° → 0, its shadow fades out and its tile-colour card fades to transparent (380ms, 100ms delay). The target tile stays hidden while it flies, then pops to 1.08 and back (transform 260ms Pop, 300ms apart).
- Tile press: under 8px of movement it is a tap. Past that, speed decides once: faster than 0.2 px/ms scrolls, slower drags. The drag target is 30% smaller than the tile (the middle 70% of its width and height): a move that starts on the outer band (15% of the tile on each side) always scrolls, however slow. Taps count anywhere on the tile.
- Drag: a 104px ghost (26px corners, tile colour, −4° tilt, shadow 0 14px 30px at 28%) follows the finger; the source tile drops to 35% opacity. Over the cart the ghost scales to 0.8.
- Cart drop zone: while dragging, the cart button (170×52, 26px corners) grows into a tray 350×206, 226 tall while a tile is over it (28px corners), 340ms Standard; its text fades in (180ms, 170ms delay). The cart icon moves from the button into the tray, under the finger's column (left 420ms, bottom and scale 340ms Standard). Let go elsewhere: it returns to the button (280ms Standard) and the tray fades out (120ms, 260ms delay).
- Drop into the cart: the picture (on a tile-colour card) falls into the cart: top 340ms cubic-bezier(0.6, 0, 0.9, 0.5), left 200ms ease, scale → 0.32 and rotation to its pile angle 340ms ease-in, card colour and shadow fade (200ms). At 420ms it lands: the cart icon dips 3px (140ms ease) and the item counts as in the cart; the tray closes at 850ms. Up to 6 pictures stay piled in fixed slots inside the cart icon.
- The screen-reader “Put in cart” action plays the same: drop zone opens under the tile (0ms), picture lifts (380ms), falls (440ms), lands (820ms), tray closes (1250ms).
- Cart panel, open: the panel starts clipped to the cart button's exact shape and colour (#A8432E), then opens to the full panel (clip-path 380ms Standard; colour → #F5F3EC 280ms ease); content fades in (200ms, 170ms delay); backdrop 0 → 45%.
- Cart panel, close: content fades out (100ms); at 110ms it clips back into the button (340ms Standard; colour back 240ms ease, 80ms delay); removed at 470ms.
- Clear: closes the cart panel as above; at 480ms the cart's items leave the list (no extra animation). The automatic clear (when the app is opened, 6 hours after anything last went into the cart) has no animation.
- Cart progress ring: fills (stroke) 500ms Standard.
- Sort menu: the chevron turns 180° (200ms ease); the menu itself appears and disappears instantly.
- Scrolling: the prototype fakes iOS physics (rubber band at the edges, spring back 420ms Standard, fling with an edge bounce). In the app use the platform's native scrolling.

## Add screen
- Add from a suggestion tile or Enter: the picture flies to its tile in the “On the list” strip in 480ms (same curves as above; scale 1.05 → 0.98, keeps its tile colour, shadow shrinks to 0 2px 6px at 15%). The strip tile stays hidden while it flies, then pops to 1.18 and back (260ms Pop) and gets its 2px green ring (box-shadow 200ms ease).
- Enter target: the outlined suggestion's border and ring change over 160ms ease.
- Due soon fades out and in (opacity 160ms ease) when the callout stretches with the keyboard.
- Trash badge, “removed from suggestions” banner: no animation; the banner hides after 5s.

## Quick-edit callout (both screens)
- Open: pops out of its tile: scale 0.6 → 1 from the arrow tip (transform-origin at the arrow; at the bottom edge when it points down), transform 240ms Standard, no overshoot, while fading in (opacity 140ms ease). The backdrop fades 0 → 55% (280ms ease).
- Close (Done, tap outside, typing a new search, dragging a tile, Remove): shrinks back to 0.6 towards the arrow tip while fading out (180ms, cubic-bezier(0.4, 0, 1, 1); opacity 160ms ease), then is removed; the backdrop fades out (280ms). Switching screens removes it instantly.
- Moving to another item plays the open pop from the new tile.
- Auto-scroll to fit it (see the SPEC sticky): 260ms, ease-out cubic (1 − (1 − t)³).
- While its tile is scrolled out of view it fades out and back in (140ms ease).
- Must buy fill and text colour: 160ms ease. Type dropdown chevron: rotates 180° (200ms ease). Type list and picture picker dropdowns appear instantly.

## Small things
- Scrollbars are hidden until a scroll; they fade back out 900ms after it stops.
- Buttons, switches, fields, password reveal: no animation.

## Haptics
Named by what happened, not by how it feels. Android uses the system's own haptic effects (they follow the phone's touch-feedback setting); iOS uses the closest feedback generator (in brackets).
- Pick up: a tile is picked up to drag → drag start (light impact).
- Over target: a dragged tile moves onto the cart (once, on entering) → segment tick (selection).
- Done: a tile lands in the cart (at the landing, 420ms after letting go); an item is added (search tile, Enter, Due soon); Clear empties the cart (as the items leave, 480ms after the panel closes) → confirm (success).
- Tick: quantity + / −, picking a unit, a type or a picture, putting an item back from the cart, Undo after Forget → clock tick (selection).
- Must buy: on → toggle on (medium impact); off → toggle off (light impact).
- Remove: Remove, Forget, deleting a list → context click (medium impact).
- No: it can't be done: Enter on something already on the list, − at the smallest amount, picking or typing a type that's already on the list, a save that fails → reject (error).
- No haptics on taps that only open or close something (tiles, the callout, the cart panel, sheets), on scrolling, on typing, or on the automatic clear.
