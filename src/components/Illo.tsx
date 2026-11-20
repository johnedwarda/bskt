// Item pictures from the design canvas (data/illustrations.json, 64x64 grid, 2px ink outline).
// Custom items show their first letter: plain (Bricolage Bold, 62% of the size, green) or on a
// container picture, sitting in its label at 30% of the size.
import React, { memo } from 'react';
import { Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import illos from '@/data/illos.json';
import shapes from '@/data/shapes.json';
import { C, F } from '@/theme';

const ILLOS = illos as Record<string, string>;
const SHAPES = shapes as { svgs: Record<string, string>; labelY: Record<string, number>; labelX: Record<string, number> };

export const SHAPE_OPTIONS: [string, string][] = [
  ['', 'Letter'], ['pack', 'Pack'], ['bag', 'Bag'], ['box', 'Box'], ['carton', 'Carton'], ['bottle', 'Bottle'], ['jar', 'Jar'],
  ['can', 'Can'], ['tub', 'Tub'], ['tube', 'Tube'], ['cubes', 'Cubes'], ['blocks', 'Blocks'], ['grains', 'Grains'], ['granules', 'Granules'], ['powder', 'Powder'],
];

export type IlloKind = string;

export const hasIllo = (kind: string) => !!ILLOS[kind];

type Props = { kind: string; size?: number; letter?: string; shape?: string };

export const Illo = memo(function Illo({ kind, size = 56, letter, shape }: Props) {
  const l = (letter || '').trim().charAt(0).toUpperCase();
  if (l && shape && SHAPES.svgs[shape]) {
    const dx = (((SHAPES.labelX[shape] ?? 32) - 32) / 64) * size;
    const dy = (((SHAPES.labelY[shape] ?? 32) - 32) / 64) * size;
    const fs = Math.round(size * 0.3);
    return (
      <View style={{ width: size, height: size }} accessible={false}>
        <SvgXml xml={SHAPES.svgs[shape]} width={size} height={size} />
        <View style={{ position: 'absolute', left: 0, top: 0, width: size, height: size, alignItems: 'center', justifyContent: 'center', transform: [{ translateX: dx }, { translateY: dy }] }}>
          <Text allowFontScaling={false} style={{ fontFamily: F.display, fontSize: fs, lineHeight: fs * 1.15, color: C.green }}>{l}</Text>
        </View>
      </View>
    );
  }
  if (l) {
    const fs = Math.round(size * 0.62);
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} accessible={false}>
        <Text allowFontScaling={false} style={{ fontFamily: F.display, fontSize: fs, lineHeight: Math.round(size * 0.8), color: C.green }}>{l}</Text>
      </View>
    );
  }
  return <SvgXml xml={ILLOS[kind] ?? ILLOS.generic} width={size} height={size} />;
});
