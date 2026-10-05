import { Canvas, ColorMatrix, Fill, FractalNoise } from '@shopify/react-native-skia';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useDerivedValue, withTiming } from 'react-native-reanimated';

import { CinemaFonts } from '@/components/cinema/theme';

import { Vinyl } from './vinyl';

type Props = {
  size: number; // vinyl diameter
  artworkUrl: string | null;
  playing: boolean;
  onToggle: () => void;
  single?: boolean;
};

// Tonearm angles around its pivot: parked beside the record, and lowered onto it
const ARM_REST = -3;
const ARM_PLAYING = 30;
// A 7" record is smaller, so the arm swings further in to reach its outer groove
const ARM_PLAYING_SINGLE = 45;

const SILVER = ['#f1f1f1', '#a9a9a9', '#dcdcdc', '#8c8c8c'] as const;

// A wooden turntable: metal platter with a felt mat, a tonearm with counterweight and
// headshell that swings onto the record while playing, a start button and a power light.
// A 7" single on a 12" platter
const SINGLE_RATIO = 0.62;

export function TurntableDeck({ size, artworkUrl, playing, onToggle, single = false }: Props) {
  const record = single ? size * SINGLE_RATIO : size;
  const pad = size * 0.07;
  const platter = size * 1.05;
  const width = platter + size * 0.34 + pad * 2;
  const height = platter + pad * 2;
  const pivot = { x: width - size * 0.13, y: pad + size * 0.1 };
  const armLength = size * 0.74;

  const playAngle = single ? ARM_PLAYING_SINGLE : ARM_PLAYING;
  const angle = useDerivedValue(() => withTiming(playing ? playAngle : ARM_REST, { duration: 700 }));
  const armStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${angle.get()}deg` }] }));

  return (
    <Pressable onPress={onToggle} style={[styles.plinth, { width, height }]}>
      {/* Walnut veneer: warm gradient plus long vertical grain */}
      <LinearGradient
        style={[StyleSheet.absoluteFill, styles.rounded]}
        colors={['#73492b', '#5a381f', '#4a2c18']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <Canvas style={[StyleSheet.absoluteFill, styles.rounded]} pointerEvents="none">
        <Fill>
          <FractalNoise freqX={0.01} freqY={0.45} octaves={3} />
          <ColorMatrix matrix={[0.3, 0, 0, 0, 0.08, 0.18, 0, 0, 0, 0.04, 0.08, 0, 0, 0, 0.01, 0, 0, 0, 0, 0.28]} />
        </Fill>
      </Canvas>
      <View style={[StyleSheet.absoluteFill, styles.bevel]} pointerEvents="none" />

      {/* Platter: brushed metal rim, felt mat, then the record */}
      <View style={{ position: 'absolute', left: pad, top: pad, width: platter, height: platter }}>
        <LinearGradient
          style={[StyleSheet.absoluteFill, { borderRadius: platter / 2 }]}
          colors={SILVER}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
        />
        <View
          style={[
            styles.mat,
            { left: platter * 0.015, top: platter * 0.015, width: platter * 0.97, height: platter * 0.97, borderRadius: platter },
          ]}
        />
        <View style={{ position: 'absolute', left: (platter - record) / 2, top: (platter - record) / 2 }}>
          <Vinyl size={record} artworkUrl={artworkUrl} spinning={playing} single={single} />
        </View>
      </View>

      {/* Tonearm, rotating around its pivot */}
      <Animated.View
        style={[styles.arm, { left: pivot.x - 15, top: pivot.y, height: armLength }, armStyle]}
        pointerEvents="none">
        <View style={styles.counterweight} />
        <LinearGradient style={styles.tube} colors={SILVER} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
        <View style={styles.headshell}>
          <View style={styles.cartridge} />
        </View>
      </Animated.View>
      <View style={[styles.pivot, { left: pivot.x - 17, top: pivot.y - 17 }]} pointerEvents="none">
        <LinearGradient style={StyleSheet.absoluteFill} colors={SILVER} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
        <View style={styles.pivotCap} />
      </View>

      {/* Controls along the front edge */}
      <View style={[styles.controls, { right: pad, bottom: pad * 0.8 }]} pointerEvents="none">
        <View style={[styles.led, playing && styles.ledOn]} />
        <Text style={[styles.speed, single && styles.speedOff]}>33</Text>
        <Text style={[styles.speed, !single && styles.speedOff]}>45</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  plinth: {
    borderRadius: 8,
    shadowColor: '#000',
    shadowOpacity: 0.65,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  rounded: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  bevel: {
    borderRadius: 8,
    borderTopWidth: 1.5,
    borderLeftWidth: 1,
    borderTopColor: 'rgba(255, 220, 180, 0.25)',
    borderLeftColor: 'rgba(255, 220, 180, 0.12)',
  },
  mat: {
    position: 'absolute',
    backgroundColor: '#262628',
  },
  arm: {
    position: 'absolute',
    width: 30,
    alignItems: 'center',
    transformOrigin: 'top',
  },
  counterweight: {
    position: 'absolute',
    top: -34,
    width: 18,
    height: 24,
    borderRadius: 4,
    backgroundColor: '#3a3a3c',
    borderWidth: 1,
    borderColor: '#5a5a5d',
  },
  tube: {
    width: 5,
    flex: 1,
    borderRadius: 3,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 3,
    shadowOffset: { width: 3, height: 4 },
  },
  headshell: {
    width: 16,
    height: 26,
    marginTop: -4,
    alignItems: 'center',
    justifyContent: 'flex-end',
    borderRadius: 3,
    backgroundColor: '#2c2c2e',
    transform: [{ rotate: '18deg' }],
  },
  cartridge: {
    width: 10,
    height: 9,
    marginBottom: 2,
    borderRadius: 2,
    backgroundColor: '#c9a24a',
  },
  pivot: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 17,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 4,
    shadowOffset: { width: 2, height: 3 },
  },
  pivotCap: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#3a3a3c',
  },
  controls: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  led: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#3a1a14',
  },
  ledOn: {
    backgroundColor: '#ff5e3a',
    shadowColor: '#ff5e3a',
    shadowOpacity: 1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
  speed: {
    fontFamily: CinemaFonts.sign,
    fontSize: 11,
    letterSpacing: 1,
    color: 'rgba(255, 235, 210, 0.75)',
  },
  speedOff: {
    opacity: 0.4,
  },
});
