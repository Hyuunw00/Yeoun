import { BlurMask, Canvas, Circle, RadialGradient, Rect, vec } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { PaperGrain } from './paper-grain';

// Deterministic pseudo-random in [0, 1) so the spots don't move between renders
function seeded(i: number) {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

const FOXING_SPOTS = 9;

// Old paper: fibers, edges yellowed with age and a few brown foxing spots
export function AgedPaper() {
  const { width, height } = useWindowDimensions();

  const spots = useMemo(
    () =>
      Array.from({ length: FOXING_SPOTS }, (_, i) => ({
        x: seeded(i) * width,
        y: seeded(i + 100) * height,
        r: 1.5 + seeded(i + 200) * 4,
      })),
    [width, height],
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <PaperGrain opacity={0.14} />
      <Canvas style={StyleSheet.absoluteFill}>
        <Rect x={0} y={0} width={width} height={height}>
          <RadialGradient
            c={vec(width / 2, height / 2)}
            r={Math.max(width, height) * 0.72}
            colors={['rgba(170, 125, 60, 0)', 'rgba(170, 125, 60, 0)', 'rgba(150, 105, 45, 0.24)']}
            positions={[0, 0.6, 1]}
          />
        </Rect>
        {spots.map((spot, i) => (
          <Circle key={i} cx={spot.x} cy={spot.y} r={spot.r} color="rgba(140, 90, 40, 0.14)">
            <BlurMask blur={2} style="normal" />
          </Circle>
        ))}
      </Canvas>
    </View>
  );
}
