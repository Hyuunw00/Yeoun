import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { RoomColors } from './theme';

export const TURNTABLE_SIZE = { width: 130, height: 104 };

// Record player on a low cabinet; the platter turns at a lazy 33⅓
export function Turntable() {
  const spin = useSharedValue(0);
  useEffect(() => {
    spin.set(withRepeat(withTiming(360, { duration: 1800, easing: Easing.linear }), -1));
  }, [spin]);
  const recordStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.get()}deg` }] }));

  return (
    <View style={TURNTABLE_SIZE}>
      <View style={styles.deck}>
        <Animated.View style={[styles.record, recordStyle]}>
          <View style={[styles.groove, { width: 52, height: 52, borderRadius: 26 }]} />
          <View style={[styles.groove, { width: 38, height: 38, borderRadius: 19 }]} />
          <View style={styles.label}>
            <View style={styles.labelMark} />
          </View>
        </Animated.View>
        <View style={styles.arm} />
      </View>
      <View style={styles.cabinet} />
    </View>
  );
}

const styles = StyleSheet.create({
  deck: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    borderRadius: 4,
    backgroundColor: RoomColors.wood,
    borderWidth: 1,
    borderColor: RoomColors.woodLight,
    // Viewed slightly from above
    transform: [{ perspective: 300 }, { rotateX: '35deg' }],
  },
  record: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111',
  },
  groove: {
    position: 'absolute',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#2c2c2c',
  },
  label: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#8a3a2a',
  },
  labelMark: {
    width: 8,
    height: 2,
    marginTop: 5,
    marginLeft: 4,
    backgroundColor: '#e8d5b0',
  },
  arm: {
    width: 3,
    height: 46,
    marginLeft: 22,
    borderRadius: 2,
    backgroundColor: '#c9c2b6',
    transform: [{ rotate: '18deg' }],
  },
  cabinet: {
    height: 40,
    marginHorizontal: 4,
    backgroundColor: RoomColors.woodDark,
    borderTopWidth: 2,
    borderTopColor: RoomColors.woodLight,
  },
});
