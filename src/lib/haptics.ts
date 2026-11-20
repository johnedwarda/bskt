// Haptic feedback, named by what happened rather than how it feels, so every screen uses the same
// vocabulary. On Android these are the system's own haptic constants (crisp, short, and they follow the
// phone's "touch feedback" setting); on iOS the closest UIKit feedback generators.
import * as H from 'expo-haptics';
import { Platform } from 'react-native';

const A = H.AndroidHaptics;
const run = (android: H.AndroidHaptics, ios: () => Promise<void>) => {
  (Platform.OS === 'android' ? H.performAndroidHapticsAsync(android) : ios()).catch(() => {});
};

export const haptic = {
  /** a tile is picked up to drag */
  pickUp: () => run(A.Drag_Start, () => H.impactAsync(H.ImpactFeedbackStyle.Light)),
  /** a dragged tile moves over the cart: letting go now puts it in */
  overTarget: () => run(A.Segment_Tick, () => H.selectionAsync()),
  /** it landed: in the cart, on the list, or the cart was cleared */
  done: () => run(A.Confirm, () => H.notificationAsync(H.NotificationFeedbackType.Success)),
  /** a small step: quantity, unit, type, shape, putting something back */
  tick: () => run(A.Clock_Tick, () => H.selectionAsync()),
  /** a switch turned on / off (Must buy) */
  on: () => run(A.Toggle_On, () => H.impactAsync(H.ImpactFeedbackStyle.Medium)),
  off: () => run(A.Toggle_Off, () => H.impactAsync(H.ImpactFeedbackStyle.Light)),
  /** something taken away: Remove, Forget, deleting a list */
  remove: () => run(A.Context_Click, () => H.impactAsync(H.ImpactFeedbackStyle.Medium)),
  /** that can't be done: already on the list, can't go lower, a type clash, an error */
  no: () => run(A.Reject, () => H.notificationAsync(H.NotificationFeedbackType.Error)),
};
