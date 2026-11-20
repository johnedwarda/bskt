// Stroke icons from the prototype (24x24).
import React, { useEffect } from 'react';
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

type P = { size?: number; color?: string; width?: number };

const mk = (d: string, defW = 2) =>
  function Icon({ size = 20, color = '#1B2B22', width = defW }: P) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible={false}>
        <Path d={d} stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    );
  };

export const IconBack = mk('M15 5l-7 7 7 7');
export const IconArrow = mk('M5 12h14M13 6l6 6-6 6', 2.2);
export const IconPlus = mk('M12 5v14M5 12h14', 2.5);
export const IconCheck = mk('M5 12.5l4.5 4.5L19 7.5', 2.2);
export const IconClose = mk('M6 6l12 12M18 6L6 18', 2.2);
export const IconChevron = mk('M6 9l6 6 6-6', 2);
export const IconEdit = mk('M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4zM13.5 6.5l4 4');
export const IconTrash = mk('M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6');
export const IconUndo = mk('M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11', 2.2);
export const IconCart = mk('M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.5L21 8H6.2M10 21a1 1 0 1 0 0-.01M17 21a1 1 0 1 0 0-.01');
export const IconInvite = mk('M15 19a6 6 0 0 0-12 0M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM19 8v6M16 11h6', 2.2);
export const IconLink = mk('M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1');
export const IconPerson = mk('M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20a8 8 0 0 1 16 0');
export const IconClock = mk('M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4M12 8v4l3 2');
export const IconRoute = mk('M6 19a2 2 0 1 0 0-.01M18 5a2 2 0 1 0 0-.01M6 17V11a3 3 0 0 1 3-3h6a3 3 0 0 0 3-3');
export const IconEye = mk('M2 12c1-1.5 5-6 10-6s9 4.5 10 6c-1 1.5-5 6-10 6S3 13.5 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z');
export const IconEyeOff = mk('M3 3l18 18M10.6 6.2A9.6 9.6 0 0 1 12 6c5 0 9 4.5 10 6-0.4 0.7-1.4 2-2.8 3.3M6.6 6.7C4.4 8 2.8 10 2 12c1 1.5 5 6 10 6 1.6 0 3.1-0.5 4.4-1.2M9.9 9.9a3 3 0 0 0 4.2 4.2');

export function IconStar({ size = 16, fill = 'none', color = '#1B2B22' }: { size?: number; fill?: string; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Path
        d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"
        fill={fill}
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// The little progress ring inside the cart button; its fill animates (500ms, standard ease).
const ACircle = Animated.createAnimatedComponent(Circle);
export function CartRing({ fraction, size = 20 }: { fraction: number; size?: number }) {
  const L = 50.27;
  const f = useSharedValue(fraction);
  useEffect(() => { f.value = withTiming(Math.max(0, Math.min(1, fraction)), { duration: 500, easing: Easing.bezier(0.2, 0.8, 0.2, 1) }); }, [fraction]); // eslint-disable-line react-hooks/exhaustive-deps
  const props = useAnimatedProps(() => ({ strokeDashoffset: L * (1 - f.value) }));
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={{ transform: [{ rotate: '-90deg' }] }} accessible={false}>
      <Circle cx={10} cy={10} r={8} stroke="rgba(255,255,255,0.25)" strokeWidth={3} />
      <ACircle cx={10} cy={10} r={8} stroke="#FFD27A" strokeWidth={3} strokeLinecap="round" strokeDasharray={`${L}`} animatedProps={props} />
    </Svg>
  );
}
