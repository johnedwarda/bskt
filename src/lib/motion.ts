// Motion values copied from the design prototype (Prototype.dc.html). Keep them in sync with it.
import { Easing } from 'react-native-reanimated';

export const EASE = Easing.bezier(0.2, 0.8, 0.2, 1);          // the prototype's standard ease ("E")
export const LEAVE = Easing.bezier(0.5, 0, 0.75, 0);         // leaving (accelerate)
export const SHRINK = Easing.bezier(0.4, 0, 1, 1);            // callout closing (ease-in)
export const BOUNCE = Easing.bezier(0.3, 1.8, 0.5, 1);        // tile pop after something lands on it
export const FLY_X = Easing.bezier(0.3, 0.7, 0.35, 1);        // fly-in: horizontal
export const FLY_Y = Easing.bezier(0.55, -0.35, 0.45, 1);     // fly-in: vertical (rises, then drops = an arc)
export const FLY_S = Easing.bezier(0.3, 0.8, 0.3, 1);         // fly-in: scale / rotation
export const DROP_Y = Easing.bezier(0.6, 0, 0.9, 0.5);        // falling into the cart
export const CSS_EASE = Easing.bezier(0.25, 0.1, 0.25, 1);    // CSS "ease"
export const CSS_EASE_IN = Easing.bezier(0.42, 0, 1, 1);      // CSS "ease-in"
export const SCROLL_OUT = (k: number) => 1 - Math.pow(1 - k, 3);

export const MS = {
  calloutIn: 240, calloutFade: 140, calloutOut: 180, calloutFadeOut: 160, scrim: 280,
  cartMorphIn: 380, cartBgIn: 280, cartContentIn: 200, cartContentDelay: 170, cartBackdrop: 300,
  cartContentOut: 100, cartMorphOutDelay: 110, cartMorphOut: 340, cartBgOut: 240, cartBgOutDelay: 80,
  trayIn: 340, trayOut: 280, trayContentIn: 180, trayContentDelay: 170,
  fly: 480, flyBg: 380, flyBgDelay: 100, flyLand: 560, pop: 260, popBack: 860,
  dropStart: 30, dropFall: 340, dropX: 200, dropLand: 420, dropDone: 850,
  donut: 500, chevron: 200, dueFade: 160, outline: 160,
} as const;
