import { BlurMask, Canvas, LinearGradient, Path, RadialGradient, Rect, Skia, vec } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { CinemaColors } from './theme';

const LAMP_WIDTH = 34;
const LAMP_HEIGHT = 5;
// How far the cone spreads past the poster on each side
const SPREAD = 0.22;

type Props = {
  width: number;
  height: number;
};

// A small brass picture lamp with a cone of warm light washing down the wall.
// Sized to the poster column; overflows sideways so the cone can spread.
export function Spotlight({ width, height }: Props) {
  const canvasWidth = width * (1 + SPREAD * 2);
  const center = canvasWidth / 2;

  const cone = useMemo(() => {
    return Skia.PathBuilder.Make()
      .moveTo(center - LAMP_WIDTH / 2, LAMP_HEIGHT)
      .lineTo(center + LAMP_WIDTH / 2, LAMP_HEIGHT)
      .lineTo(canvasWidth, height)
      .lineTo(0, height)
      .close()
      .detach();
  }, [center, canvasWidth, height]);

  return (
    <View style={[styles.container, { width: canvasWidth, height, left: -width * SPREAD }]} pointerEvents="none">
      <Canvas style={StyleSheet.absoluteFill}>
        <Path path={cone}>
          <LinearGradient
            start={vec(0, LAMP_HEIGHT)}
            end={vec(0, height)}
            colors={['rgba(255, 220, 170, 0.22)', 'rgba(255, 220, 170, 0.06)', 'rgba(255, 220, 170, 0)']}
            positions={[0, 0.55, 1]}
          />
          <BlurMask blur={14} style="normal" />
        </Path>
        {/* Hot spot where the light first hits the wall */}
        <Rect x={0} y={0} width={canvasWidth} height={height * 0.4}>
          <RadialGradient
            c={vec(center, LAMP_HEIGHT)}
            r={width * 0.45}
            colors={['rgba(255, 228, 185, 0.28)', 'rgba(255, 228, 185, 0)']}
          />
        </Rect>
      </Canvas>
      <View style={[styles.lamp, { left: center - LAMP_WIDTH / 2 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
  },
  lamp: {
    position: 'absolute',
    top: 0,
    width: LAMP_WIDTH,
    height: LAMP_HEIGHT,
    borderRadius: 2,
    backgroundColor: CinemaColors.brassDim,
    borderBottomWidth: 1,
    borderBottomColor: CinemaColors.marquee,
    shadowColor: CinemaColors.marqueeGlow,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
});
