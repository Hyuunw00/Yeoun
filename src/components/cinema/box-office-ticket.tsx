import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { posterUrl, type TmdbTitle } from '@/lib/tmdb';

import { CinemaColors, CinemaFonts } from './theme';

const PAPER = '#ece0c4';
const INK = '#3a2f24';
const NOTCH = 14;
const STUB_WIDTH = 66;
const DASHES = 14;
const TEAR_MS = 280;

type Props = {
  title: TmdbTitle;
  onPick: (title: TmdbTitle) => void;
};

// A search result printed as a box-office ticket. Picking it tears the stub off
// before moving on to writing about it.
export function BoxOfficeTicket({ title, onPick }: Props) {
  const torn = useSharedValue(0);

  const stubStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: torn.get() * 18 }, { translateY: torn.get() * 6 }, { rotate: `${torn.get() * 9}deg` }],
  }));

  function pick() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    torn.set(
      withSequence(
        withTiming(1, { duration: TEAR_MS, easing: Easing.out(Easing.cubic) }, (finished) => {
          if (finished) scheduleOnRN(onPick, title);
        }),
        // Stick the stub back on while the next screen covers this one
        withDelay(400, withTiming(0, { duration: 0 })),
      ),
    );
  }

  const isSeries = title.mediaType === 'tv';
  const year = title.releaseDate?.slice(0, 4);

  return (
    <Pressable onPress={pick} style={styles.ticket}>
      <View style={styles.body}>
        {title.posterPath ? (
          <Image source={posterUrl(title.posterPath)} style={styles.poster} contentFit="cover" />
        ) : (
          <View style={styles.poster} />
        )}
        <View style={styles.info}>
          <Text style={styles.venue}>YEOUN CINEMA</Text>
          <Text style={styles.title} numberOfLines={2}>
            {title.title}
          </Text>
          {title.originalTitle !== title.title && (
            <Text style={styles.original} numberOfLines={1}>
              {title.originalTitle}
            </Text>
          )}
          <Text style={styles.admit}>ADMIT ONE</Text>
        </View>
      </View>

      <Animated.View style={[styles.stub, stubStyle]}>
        {/* Dashed tear line; iOS can't dash a single border side, so draw the dashes */}
        <View style={styles.tearLine}>
          {Array.from({ length: DASHES }, (_, i) => (
            <View key={i} style={styles.dash} />
          ))}
        </View>
        <View style={styles.stubFace}>
          <Text style={styles.stubKind}>{isSeries ? 'SERIES' : 'FILM'}</Text>
          <Text style={styles.stubYear}>{year || '—'}</Text>
          <Text style={styles.stubKind}>{isSeries ? '드라마' : '영화'}</Text>
        </View>
      </Animated.View>

      {/* Half-circle notches punched where the stub tears off, drawn over both halves */}
      <View style={[styles.notch, styles.notchTop]} />
      <View style={[styles.notch, styles.notchBottom]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ticket: {
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  body: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 10,
    backgroundColor: PAPER,
    borderTopLeftRadius: 3,
    borderBottomLeftRadius: 3,
  },
  poster: {
    width: 56,
    height: 84,
    backgroundColor: '#cbbd9e',
  },
  info: {
    flex: 1,
    justifyContent: 'center',
    gap: 2,
  },
  venue: {
    fontFamily: CinemaFonts.sign,
    fontSize: 10,
    letterSpacing: 2,
    color: INK,
    opacity: 0.55,
  },
  title: {
    fontFamily: CinemaFonts.serifBold,
    fontSize: 16,
    color: INK,
  },
  original: {
    fontFamily: CinemaFonts.serif,
    fontSize: 11,
    color: INK,
    opacity: 0.7,
  },
  admit: {
    marginTop: 4,
    fontFamily: CinemaFonts.sign,
    fontSize: 10,
    letterSpacing: 3,
    color: INK,
    opacity: 0.4,
  },
  notch: {
    position: 'absolute',
    right: STUB_WIDTH - NOTCH / 2,
    width: NOTCH,
    height: NOTCH,
    borderRadius: NOTCH / 2,
    backgroundColor: CinemaColors.theater,
  },
  notchTop: {
    top: -NOTCH / 2,
  },
  notchBottom: {
    bottom: -NOTCH / 2,
  },
  stub: {
    width: STUB_WIDTH,
    flexDirection: 'row',
    backgroundColor: PAPER,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  tearLine: {
    width: 1,
    paddingVertical: 10,
    justifyContent: 'space-between',
  },
  dash: {
    width: 1,
    height: 4,
    backgroundColor: 'rgba(58, 47, 36, 0.3)',
  },
  stubFace: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  stubKind: {
    fontFamily: CinemaFonts.sign,
    fontSize: 10,
    letterSpacing: 1.5,
    color: INK,
    opacity: 0.55,
  },
  stubYear: {
    fontFamily: CinemaFonts.sign,
    fontSize: 22,
    letterSpacing: 1,
    color: INK,
  },
});
