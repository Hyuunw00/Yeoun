import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { CinemaFonts } from '@/components/cinema/theme';
import type { MusicResult } from '@/lib/itunes';

import { SleeveArt } from './sleeve-art';
import { RecordColors } from './theme';
import { Vinyl } from './vinyl';

// Same proportion as the singles in the crate
const SINGLE_SCALE = 0.72;
const PULL_MS = 260;

type Props = {
  item: MusicResult;
  // Width of the grid cell; LPs fill it, singles stand smaller on the bin floor
  size: number;
  onPick: (item: MusicResult) => void;
};

// A search result filed in the shop's bin. Picking it slides the record up out of
// the sleeve before moving on to writing about it.
export function BinSleeve({ item, size: cellSize, onPick }: Props) {
  const size = item.format === 'single' ? cellSize * SINGLE_SCALE : cellSize;
  const pulled = useSharedValue(0);

  const vinylStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -pulled.get() * size * 0.3 }],
  }));

  function pick() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    pulled.set(
      withSequence(
        withTiming(1, { duration: PULL_MS, easing: Easing.out(Easing.cubic) }, (finished) => {
          if (finished) scheduleOnRN(onPick, item);
        }),
        // Slip the record back in while the next screen covers this one
        withDelay(400, withTiming(0, { duration: 0 })),
      ),
    );
  }

  const isSong = item.kind === 'song';
  // "Ditto" from "Ditto - Single" says nothing new, so only name the album when it differs
  const albumName = item.albumTitle.replace(/ - (Single|EP)$/i, '');
  const showAlbum = isSong && albumName.toLowerCase() !== item.trackName?.toLowerCase();

  return (
    <Pressable onPress={pick} style={{ width: cellSize }}>
      <View style={[styles.floor, { height: cellSize }]}>
        <View style={{ width: size, height: size }}>
          <Animated.View style={[styles.vinyl, vinylStyle]}>
            <Vinyl size={size * 0.94} artworkUrl={item.artworkUrl} />
          </Animated.View>
          <SleeveArt size={size} title={item.albumTitle} imageUrl={item.artworkUrl} format={item.format} />
        </View>
      </View>
      <View style={styles.caption}>
        <Text style={styles.kind}>{isSong ? 'TRACK' : 'ALBUM'}</Text>
        <Text style={styles.title} numberOfLines={2}>
          {isSong ? item.trackName : item.albumTitle}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {[item.artist, item.releaseDate?.slice(0, 4)].filter(Boolean).join(' · ')}
        </Text>
        {showAlbum && (
          <Text style={styles.meta} numberOfLines={1}>
            {item.albumTitle} 수록
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  floor: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  vinyl: {
    position: 'absolute',
    top: '3%',
    left: '3%',
  },
  caption: {
    marginTop: 10,
    gap: 2,
  },
  kind: {
    fontFamily: CinemaFonts.sign,
    fontSize: 11,
    letterSpacing: 2,
    color: RecordColors.neon,
  },
  title: {
    fontFamily: CinemaFonts.serifBold,
    fontSize: 14,
    color: RecordColors.text,
  },
  meta: {
    fontFamily: CinemaFonts.serif,
    fontSize: 11,
    color: RecordColors.textDim,
  },
});
