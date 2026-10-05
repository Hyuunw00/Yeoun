import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { CinemaColors } from './theme';

const BULB_SIZE = 6;
const BULB_SPACING = 16;
const BULB_INSET = 8;
// Every third bulb lights up, and the pattern walks around the frame
const CHASE_GROUP = 3;
const CHASE_STEP_MS = 320;

type Point = { x: number; y: number };

// Bulb centers in clockwise order so the chase runs around the frame
function perimeterPoints(width: number, height: number): Point[] {
  const left = BULB_INSET;
  const top = BULB_INSET;
  const right = width - BULB_INSET;
  const bottom = height - BULB_INSET;
  const points: Point[] = [];

  const edge = (from: Point, to: Point) => {
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    const count = Math.max(1, Math.round(length / BULB_SPACING));
    for (let i = 0; i < count; i++) {
      const t = i / count;
      points.push({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t });
    }
  };

  edge({ x: left, y: top }, { x: right, y: top });
  edge({ x: right, y: top }, { x: right, y: bottom });
  edge({ x: right, y: bottom }, { x: left, y: bottom });
  edge({ x: left, y: bottom }, { x: left, y: top });
  return points;
}

function Bulb({ point, index, tick }: { point: Point; index: number; tick: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const lit = (Math.floor(tick.get()) + index) % CHASE_GROUP === 0;
    return { opacity: lit ? 1 : 0.3 };
  });

  return (
    <Animated.View
      style={[
        styles.bulb,
        { left: point.x - BULB_SIZE / 2, top: point.y - BULB_SIZE / 2 },
        style,
      ]}
    />
  );
}

export function MarqueeSign({ children }: { children: ReactNode }) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const tick = useSharedValue(0);

  useEffect(() => {
    tick.set(
      withRepeat(
        withTiming(CHASE_GROUP, { duration: CHASE_STEP_MS * CHASE_GROUP, easing: Easing.linear }),
        -1,
      ),
    );
  }, [tick]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ width, height });
  };

  const points = size.width ? perimeterPoints(size.width, size.height) : [];

  return (
    <View style={styles.sign} onLayout={onLayout}>
      {points.map((point, i) => (
        <Bulb key={i} point={point} index={points.length - i} tick={tick} />
      ))}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  sign: {
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 22,
    borderWidth: 1,
    borderColor: CinemaColors.plaqueBorder,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  bulb: {
    position: 'absolute',
    width: BULB_SIZE,
    height: BULB_SIZE,
    borderRadius: BULB_SIZE / 2,
    backgroundColor: CinemaColors.marquee,
    shadowColor: CinemaColors.marqueeGlow,
    shadowOpacity: 0.9,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
});
