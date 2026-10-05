import { Canvas, ColorMatrix, Fill, FractalNoise, RadialGradient, Rect, vec } from '@shopify/react-native-skia';
import { StyleSheet, useWindowDimensions } from 'react-native';

import { LibraryColors } from './theme';

// Dark wood panelling behind the shelves, lit by a desk lamp from the upper left
export function StudyBackdrop() {
  const { width, height } = useWindowDimensions();

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Fill color={LibraryColors.wall} />
      {/* Long vertical wood grain */}
      <Fill>
        <FractalNoise freqX={0.02} freqY={0.6} octaves={3} />
        <ColorMatrix
          matrix={[0.25, 0, 0, 0, 0.05, 0.15, 0, 0, 0, 0.03, 0.08, 0, 0, 0, 0.01, 0, 0, 0, 0, 0.35]}
        />
      </Fill>
      <Rect x={0} y={0} width={width} height={height}>
        <RadialGradient
          c={vec(width * 0.2, height * 0.05)}
          r={height * 0.8}
          colors={['rgba(255, 196, 120, 0.2)', 'rgba(255, 196, 120, 0)']}
        />
      </Rect>
      <Rect x={0} y={0} width={width} height={height}>
        <RadialGradient
          c={vec(width / 2, height / 2)}
          r={Math.max(width, height) * 0.75}
          colors={['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0.55)']}
        />
      </Rect>
    </Canvas>
  );
}
