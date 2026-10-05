import { Canvas, ColorMatrix, Fill, FractalNoise } from '@shopify/react-native-skia';
import { StyleSheet, View } from 'react-native';

// Desaturate the noise and set a constant alpha so only luminance varies.
// Alpha lives in the matrix because the color filter runs after paint opacity.
const grainMatrix = (opacity: number) => [
  0.33, 0.33, 0.33, 0, 0,
  0.33, 0.33, 0.33, 0, 0,
  0.33, 0.33, 0.33, 0, 0,
  0, 0, 0, 0, opacity,
];

export function FilmGrain({ opacity = 0.07 }: { opacity?: number }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Canvas style={StyleSheet.absoluteFill}>
        <Fill>
          <FractalNoise freqX={0.9} freqY={0.9} octaves={3} />
          <ColorMatrix matrix={grainMatrix(opacity)} />
        </Fill>
      </Canvas>
    </View>
  );
}
