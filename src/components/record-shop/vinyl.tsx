import {
  Canvas,
  Circle,
  FillType,
  Path,
  RadialGradient,
  Skia,
  SweepGradient,
  vec,
} from '@shopify/react-native-skia';
import { Image } from 'expo-image';
import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

// 33⅓ rpm
const REVOLUTION_MS = 1800;
const LABEL_RATIO = 0.34;
const GROOVE_START = 0.37;
const GROOVE_END = 0.97;
// Wider gaps between songs, as fractions of the radius
const TRACK_GAPS = [0.48, 0.58, 0.69, 0.8, 0.89];

type Props = {
  size: number;
  artworkUrl: string | null;
  spinning?: boolean;
  // 7" single: big center hole with a metal 45 adapter
  single?: boolean;
};

// A vinyl record drawn with Skia: dense fine grooves with gaps between songs, a rim, and
// the album art as the center label. The reflection is drawn on a separate, non-rotating
// layer, so while the record spins the light stays put like it does on a real turntable.
export function Vinyl({ size, artworkUrl, spinning = false, single = false }: Props) {
  const rotation = useSharedValue(0);
  const r = size / 2;

  useEffect(() => {
    if (spinning) {
      // Continue from wherever the record stopped
      const from = rotation.get() % 360;
      rotation.set(from);
      rotation.set(withRepeat(withTiming(from + 360, { duration: REVOLUTION_MS, easing: Easing.linear }), -1));
    } else {
      cancelAnimation(rotation);
    }
  }, [rotation, spinning]);

  const spinStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.get()}deg` }] }));

  const { grooves, gaps, grooveBand } = useMemo(() => {
    const step = Math.max(1.1, size / 260);
    const groovePath = Skia.PathBuilder.Make();
    for (let rr = r * GROOVE_START; rr < r * GROOVE_END; rr += step) {
      groovePath.addCircle(r, r, rr);
    }
    const gapPath = Skia.PathBuilder.Make();
    for (const g of TRACK_GAPS) gapPath.addCircle(r, r, r * g);
    // The grooved ring between the label and the rim, where reflections show
    const band = Skia.PathBuilder.Make()
      .addCircle(r, r, r * GROOVE_END)
      .addCircle(r, r, r * GROOVE_START)
      .setFillType(FillType.EvenOdd);
    return { grooves: groovePath.detach(), gaps: gapPath.detach(), grooveBand: band.detach() };
  }, [r, size]);

  const label = size * LABEL_RATIO;

  return (
    <View style={{ width: size, height: size }}>
      <Animated.View style={[StyleSheet.absoluteFill, spinStyle]}>
        <Canvas style={StyleSheet.absoluteFill}>
          <Circle cx={r} cy={r} r={r}>
            <RadialGradient c={vec(r, r)} r={r} colors={['#1b1b1e', '#111113', '#0a0a0b']} positions={[0, 0.7, 1]} />
          </Circle>
          <Path path={grooves} style="stroke" strokeWidth={0.6} color="rgba(255, 255, 255, 0.045)" />
          <Path path={gaps} style="stroke" strokeWidth={Math.max(1.5, size / 160)} color="rgba(0, 0, 0, 0.75)" />
          <Circle cx={r} cy={r} r={r - 1} style="stroke" strokeWidth={1.5} color="rgba(255, 255, 255, 0.1)" />
          {/* Smooth run-out area around the label */}
          <Circle cx={r} cy={r} r={r * 0.36} color="#141416" />
        </Canvas>
        <View
          style={[
            styles.label,
            { width: label, height: label, borderRadius: label / 2, left: r - label / 2, top: r - label / 2 },
          ]}>
          {artworkUrl ? (
            <Image source={artworkUrl} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.blankLabel]} />
          )}
          {/* Printed edge ring and spindle hole (or the 45 adapter on a single) */}
          <View style={[styles.labelRing, { borderRadius: label / 2 }]} />
          {single ? (
            <View style={[styles.adapter, { width: label * 0.42, height: label * 0.42, borderRadius: label }]}>
              <View style={styles.spindle} />
            </View>
          ) : (
            <View style={styles.spindle} />
          )}
        </View>
      </Animated.View>

      {/* Fixed reflections: two soft light wedges across the grooves */}
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        <Path path={grooveBand}>
          <SweepGradient
            c={vec(r, r)}
            colors={[
              'rgba(255,255,255,0)',
              'rgba(255,255,255,0.13)',
              'rgba(255,255,255,0)',
              'rgba(255,255,255,0)',
              'rgba(255,255,255,0.09)',
              'rgba(255,255,255,0)',
              'rgba(255,255,255,0)',
            ]}
            positions={[0.04, 0.12, 0.2, 0.52, 0.62, 0.7, 1]}
          />
        </Path>
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  blankLabel: {
    backgroundColor: '#8a3a2a',
  },
  labelRing: {
    ...StyleSheet.absoluteFill,
    borderWidth: 2,
    borderColor: 'rgba(0, 0, 0, 0.25)',
  },
  adapter: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#c9c6bf',
    borderWidth: 2,
    borderColor: '#8f8c86',
  },
  spindle: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#d9d4cc',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.3)',
  },
});
