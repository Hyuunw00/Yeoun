import { Canvas, Fill, RadialGradient, Rect, vec } from '@shopify/react-native-skia';
import { StyleSheet, useWindowDimensions } from 'react-native';

import { CinemaColors } from './theme';

// Pitch-dark theater with faint light spilling from the screen at the top
export function ScreenLight() {
  const { width, height } = useWindowDimensions();

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Fill color={CinemaColors.theater} />
      <Rect x={0} y={0} width={width} height={height}>
        <RadialGradient
          c={vec(width / 2, height * 0.12)}
          r={width * 0.95}
          colors={['rgba(255, 236, 205, 0.13)', 'rgba(255, 236, 205, 0)']}
        />
      </Rect>
    </Canvas>
  );
}
