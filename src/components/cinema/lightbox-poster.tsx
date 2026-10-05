import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { WorkSummary } from '@/lib/db';
import { isSeries } from '@/lib/tmdb';

import { Spotlight } from './spotlight';
import { CinemaColors, CinemaFonts } from './theme';

type Props = {
  work: WorkSummary;
  width: number;
  onPress: () => void;
  onLongPress?: () => void;
};

const LAMP_GAP = 22;
const FRAME_PADDING = 6;

// A lit poster frame under a picture lamp, with a small brass plaque underneath
export function LightboxPoster({ work, width, onPress, onLongPress }: Props) {
  const frameHeight = (width - FRAME_PADDING * 2) * 1.5 + FRAME_PADDING * 2;

  return (
    <Pressable style={[styles.container, { width }]} onPress={onPress} onLongPress={onLongPress}>
      <Spotlight width={width} height={LAMP_GAP + frameHeight + 70} />
      <View style={styles.frame}>
        {work.imageUrl ? (
          <Image source={work.imageUrl} style={styles.poster} contentFit="cover" transition={300} />
        ) : (
          <View style={[styles.poster, styles.posterEmpty]}>
            <Text style={styles.posterTitle} numberOfLines={4}>
              {work.title}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.plaque}>
        <Text style={styles.plaqueTitle} numberOfLines={1}>
          {work.title}
        </Text>
        <Text style={styles.plaqueDate}>
          {isSeries(work.externalId) && <Text style={styles.series}>SERIES  </Text>}
          {work.lastExperiencedOn.replaceAll('-', '.')}
          {work.lastRating !== null && <Text style={styles.rating}>{`  ★ ${work.lastRating.toFixed(1)}`}</Text>}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingTop: LAMP_GAP,
  },
  frame: {
    width: '100%',
    padding: FRAME_PADDING,
    borderRadius: 2,
    backgroundColor: CinemaColors.frame,
    borderWidth: 1,
    borderColor: CinemaColors.frameBorder,
    shadowColor: CinemaColors.glow,
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  poster: {
    width: '100%',
    aspectRatio: 2 / 3,
    backgroundColor: '#000',
  },
  posterEmpty: {
    justifyContent: 'center',
    padding: 12,
  },
  posterTitle: {
    textAlign: 'center',
    fontFamily: CinemaFonts.serifBold,
    fontSize: 16,
    color: CinemaColors.brass,
  },
  plaque: {
    maxWidth: '90%',
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignItems: 'center',
    backgroundColor: CinemaColors.plaque,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: CinemaColors.plaqueBorder,
  },
  plaqueTitle: {
    fontFamily: CinemaFonts.serifBold,
    fontSize: 13,
    color: CinemaColors.brass,
  },
  plaqueDate: {
    marginTop: 2,
    fontFamily: CinemaFonts.serif,
    fontSize: 10,
    color: CinemaColors.brassDim,
  },
  rating: {
    color: CinemaColors.brass,
  },
  series: {
    fontFamily: CinemaFonts.sign,
    fontSize: 10,
    letterSpacing: 1.5,
    color: CinemaColors.brass,
  },
});
