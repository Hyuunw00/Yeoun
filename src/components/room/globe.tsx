import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { RoomColors } from './theme';

const MERIDIANS = 4;

// A meridian is an ellipse whose width follows cos(longitude), which reads as rotation
function Meridian({ index, spin, size }: { index: number; spin: SharedValue<number>; size: number }) {
  const style = useAnimatedStyle(() => {
    const angle = ((spin.get() + (index * 180) / MERIDIANS) % 180) * (Math.PI / 180);
    return { transform: [{ scaleX: Math.abs(Math.cos(angle)) }] };
  });
  return (
    <Animated.View
      style={[styles.meridian, { width: size, height: size, borderRadius: size / 2 }, style]}
    />
  );
}

// Desk globe on a brass stand, slowly turning
export function Globe({ size }: { size: number }) {
  const spin = useSharedValue(0);
  useEffect(() => {
    spin.set(withRepeat(withTiming(180, { duration: 9000, easing: Easing.linear }), -1));
  }, [spin]);

  return (
    <View style={{ width: size, alignItems: 'center' }}>
      <View style={[styles.sphere, { width: size, height: size, borderRadius: size / 2 }]}>
        <View style={[styles.continent, { width: size * 0.32, height: size * 0.22, top: size * 0.24, left: size * 0.2 }]} />
        <View style={[styles.continent, { width: size * 0.2, height: size * 0.3, top: size * 0.48, left: size * 0.52 }]} />
        {Array.from({ length: MERIDIANS }, (_, i) => (
          <Meridian key={i} index={i} spin={spin} size={size} />
        ))}
        <View style={[styles.equator, { width: size }]} />
      </View>
      <View style={styles.stem} />
      <View style={[styles.base, { width: size * 0.6 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  sphere: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RoomColors.ocean,
    borderWidth: 2,
    borderColor: '#b0925a',
  },
  continent: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: RoomColors.land,
    opacity: 0.8,
  },
  meridian: {
    position: 'absolute',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  equator: {
    position: 'absolute',
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  stem: {
    width: 3,
    height: 14,
    backgroundColor: '#b0925a',
  },
  base: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#8a6e40',
  },
});
