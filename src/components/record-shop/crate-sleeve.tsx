import { Pressable, StyleSheet } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import type { WorkSummary } from '@/lib/db';

import { SleeveArt } from './sleeve-art';
import { Vinyl } from './vinyl';

type Props = {
  work: WorkSummary;
  index: number;
  size: number;
  // Distance between neighboring sleeves in the scroll view
  interval: number;
  scrollX: SharedValue<number>;
  onPress: () => void;
  onLongPress: () => void;
};

// An LP sleeve standing in the crate. Sleeves away from the center lean back like
// records being flipped through, and the centered one has its record pulled up out of it.
// Singles come as 7" records, noticeably smaller than 12" LPs
const SINGLE_SCALE = 0.72;

export function CrateSleeve({ work, index, size: crateSize, interval, scrollX, onPress, onLongPress }: Props) {
  const size = work.format === 'single' ? crateSize * SINGLE_SCALE : crateSize;
  const style = useAnimatedStyle(() => {
    const position = scrollX.get() / interval - index;
    return {
      transform: [
        { perspective: 900 },
        { translateY: interpolate(Math.abs(position), [0, 1], [0, size * 0.06], Extrapolation.CLAMP) },
        { rotateY: `${interpolate(position, [-1, 0, 1], [38, 0, -38], Extrapolation.CLAMP)}deg` },
        { scale: interpolate(Math.abs(position), [0, 1], [1, 0.86], Extrapolation.CLAMP) },
      ],
      opacity: interpolate(Math.abs(position), [0, 2, 3], [1, 0.75, 0.4], Extrapolation.CLAMP),
    };
  });

  const vinylStyle = useAnimatedStyle(() => {
    const distance = Math.abs(scrollX.get() / interval - index);
    return { transform: [{ translateY: interpolate(distance, [0, 0.6], [-size * 0.26, 0], Extrapolation.CLAMP) }] };
  });

  return (
    <Animated.View style={[{ width: interval, alignItems: 'center' }, style]}>
      {/* Stands on the crate floor whatever its size */}
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        style={{ width: size, height: size, marginTop: crateSize - size }}>
        <Animated.View style={[styles.vinyl, vinylStyle]}>
          <Vinyl size={size * 0.94} artworkUrl={work.imageUrl} />
        </Animated.View>
        <SleeveArt size={size} title={work.title} imageUrl={work.imageUrl} format={work.format} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  vinyl: {
    position: 'absolute',
    top: '3%',
    left: '3%',
  },
});
