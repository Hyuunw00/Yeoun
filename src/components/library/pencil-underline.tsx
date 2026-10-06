import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextLayoutLine, type TextStyle } from 'react-native';

const SEGMENT = 10;

// A slightly wobbly, slightly sloped line like one drawn by hand with a pencil
function handDrawnLine(x: number, y: number, width: number, seed: number) {
  const builder = Skia.Path.Make().moveTo(x - 2, y);
  const steps = Math.max(2, Math.ceil(width / SEGMENT));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const wobble = Math.sin(i * 1.7 + seed * 3.1) * 0.7;
    builder.lineTo(x - 2 + (width + 4) * t, y + wobble + t * 1.2);
  }
  return builder;
}

// Text with a pencil line drawn under every rendered line of it
export function PencilUnderline({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const [lines, setLines] = useState<TextLayoutLine[]>([]);

  const path = useMemo(() => {
    const combined = Skia.Path.Make();
    lines.forEach((line, i) => {
      if (line.width < 1) return;
      combined.addPath(handDrawnLine(line.x, line.y + line.height - 3, line.width, i));
    });
    return combined;
  }, [lines]);

  return (
    <View>
      <Text style={style} onTextLayout={(e) => setLines(e.nativeEvent.lines)}>
        {children}
      </Text>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Canvas style={StyleSheet.absoluteFill}>
          <Path path={path} style="stroke" strokeWidth={1.2} strokeCap="round" color="rgba(70, 60, 50, 0.55)" />
        </Canvas>
      </View>
    </View>
  );
}
