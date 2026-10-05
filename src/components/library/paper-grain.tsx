import { Canvas, ColorMatrix, Fill, FractalNoise } from '@shopify/react-native-skia';
import { StyleSheet, View } from 'react-native';

// Warm, low-contrast fiber texture for paper. Tints the noise brown instead of grey.
const paperMatrix = (opacity: number) => [
  0.2, 0.2, 0.2, 0, 0.25,
  0.16, 0.16, 0.16, 0, 0.18,
  0.1, 0.1, 0.1, 0, 0.1,
  0, 0, 0, 0, opacity,
];

export function PaperGrain({ opacity = 0.12 }: { opacity?: number }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Canvas style={StyleSheet.absoluteFill}>
        <Fill>
          <FractalNoise freqX={1.4} freqY={0.6} octaves={2} />
          <ColorMatrix matrix={paperMatrix(opacity)} />
        </Fill>
      </Canvas>
    </View>
  );
}
