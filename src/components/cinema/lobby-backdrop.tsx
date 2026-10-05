import { Canvas, Fill, RadialGradient, Rect, vec } from '@shopify/react-native-skia';
import { StyleSheet, useWindowDimensions } from 'react-native';

import { CinemaColors } from './theme';

// Dark lobby wall lit warmly from the ceiling, fading into a vignette
export function LobbyBackdrop() {
  const { width, height } = useWindowDimensions();

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Fill color={CinemaColors.wall} />
      <Rect x={0} y={0} width={width} height={height}>
        <RadialGradient
          c={vec(width / 2, -height * 0.1)}
          r={width * 1.2}
          colors={['rgba(255, 214, 160, 0.16)', 'rgba(255, 214, 160, 0)']}
        />
      </Rect>
      <Rect x={0} y={0} width={width} height={height}>
        <RadialGradient
          c={vec(width / 2, height / 2)}
          r={Math.max(width, height) * 0.75}
          colors={['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0.65)']}
        />
      </Rect>
    </Canvas>
  );
}
