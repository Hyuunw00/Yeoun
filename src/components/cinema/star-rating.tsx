import * as Haptics from 'expo-haptics';
import { useRef } from 'react';
import { StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';

import { CinemaColors } from './theme';

const STAR_COUNT = 5;

type Props = {
  value: number | null;
  size?: number;
  filledColor?: string;
  emptyColor?: string;
  // Omit to render read-only
  onChange?: (value: number | null) => void;
};

type StarProps = { fill: number; size: number; filledColor: string; emptyColor: string };

function Star({ fill, size, filledColor, emptyColor }: StarProps) {
  const glyph = { width: size, fontSize: size, lineHeight: size };
  return (
    <View style={{ width: size, height: size }}>
      <Text style={[styles.star, glyph, { color: emptyColor }]}>★</Text>
      {fill > 0 && (
        <View style={[styles.fillClip, { width: size * fill, height: size }]}>
          <Text style={[styles.star, glyph, { color: filledColor }]}>★</Text>
        </View>
      )}
    </View>
  );
}

// Tap or drag across the stars to rate in half steps. Tapping the current value clears it.
export function StarRating({
  value,
  size = 28,
  filledColor = CinemaColors.brass,
  emptyColor = CinemaColors.hairline,
  onChange,
}: Props) {
  // Value as of the last change within the current gesture
  const lastValue = useRef<number | null>(value);

  const valueAt = (e: GestureResponderEvent) => {
    const halves = Math.ceil(e.nativeEvent.locationX / (size / 2));
    return Math.min(STAR_COUNT, Math.max(0.5, halves / 2));
  };

  const update = (next: number | null) => {
    if (next === lastValue.current) return;
    lastValue.current = next;
    Haptics.selectionAsync();
    onChange?.(next);
  };

  const stars = (
    // Children ignore touches so locationX is always relative to the whole row
    <View style={styles.row} pointerEvents="none">
      {Array.from({ length: STAR_COUNT }, (_, i) => (
        <Star
          key={i}
          size={size}
          fill={Math.min(1, Math.max(0, (value ?? 0) - i))}
          filledColor={filledColor}
          emptyColor={emptyColor}
        />
      ))}
    </View>
  );

  if (!onChange) return stars;

  return (
    <View
      hitSlop={10}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={(e) => {
        lastValue.current = value;
        const next = valueAt(e);
        update(next === value ? null : next);
      }}
      onResponderMove={(e) => update(valueAt(e))}>
      {stars}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
  star: {
    position: 'absolute',
    textAlign: 'center',
  },
  fillClip: {
    position: 'absolute',
    overflow: 'hidden',
  },
});
