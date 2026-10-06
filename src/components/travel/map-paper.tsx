import { Canvas, ColorMatrix, Fill, FractalNoise, Group, Line, vec } from '@shopify/react-native-skia';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

// Brown-tinted fibers at low alpha, a little coarser than the library's page paper
const FIBERS = [0.2, 0.2, 0.2, 0, 0.3, 0.16, 0.16, 0.16, 0, 0.22, 0.1, 0.1, 0.1, 0, 0.12, 0, 0, 0, 0, 0.13];
// Where the sheet was folded: in half lengthwise, then in thirds
const VERTICAL_FOLDS = [0.5];
const HORIZONTAL_FOLDS = [1 / 3, 2 / 3];
const CREASE_SHADOW = 'rgba(92, 66, 38, 0.13)';
const CREASE_LIGHT = 'rgba(255, 250, 238, 0.45)';

// A road map that has been folded into a glovebox many times: paper fibers, and a
// shadowed crease with a lit edge wherever it was folded
export function MapPaper() {
  const { width, height } = useWindowDimensions();
  const creases = [
    ...VERTICAL_FOLDS.map((f) => ({ from: vec(width * f, 0), to: vec(width * f, height), dx: 1.2, dy: 0 })),
    ...HORIZONTAL_FOLDS.map((f) => ({ from: vec(0, height * f), to: vec(width, height * f), dx: 0, dy: 1.2 })),
  ];

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Canvas style={StyleSheet.absoluteFill}>
        <Fill>
          <FractalNoise freqX={1.1} freqY={0.7} octaves={2} />
          <ColorMatrix matrix={FIBERS} />
        </Fill>
        {creases.map((c, i) => (
          <Group key={i}>
            <Line p1={c.from} p2={c.to} color={CREASE_SHADOW} strokeWidth={2} />
            <Line
              p1={vec(c.from.x + c.dx, c.from.y + c.dy)}
              p2={vec(c.to.x + c.dx, c.to.y + c.dy)}
              color={CREASE_LIGHT}
              strokeWidth={1}
            />
          </Group>
        ))}
      </Canvas>
    </View>
  );
}
