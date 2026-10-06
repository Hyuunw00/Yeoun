import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { CinemaFonts } from '@/components/cinema/theme';
import { LibraryFonts } from '@/components/library/theme';
import { photoUri } from '@/lib/photos';

import { MapColors } from './theme';

const FLIP_MS = 650;
const POSTMARK_INK = 'rgba(47, 79, 122, 0.75)';

type Props = {
  city: string;
  // Photo file for the front; a blank card shows the city name on plain paper
  cover: string | null;
  // The line written on the back, and the day it was posted
  note: string | null;
  postedOn: string | null;
  countryCode: string;
};

// A city kept as a postcard. Tap to turn it over: the back carries what stayed with me,
// written by hand, under a stamp and a postmark from the day of the visit.
export function Postcard({ city, cover, note, postedOn, countryCode }: Props) {
  const [showingBack, setShowingBack] = useState(false);
  const turn = useSharedValue(0);

  function flip() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = !showingBack;
    setShowingBack(next);
    turn.set(withTiming(next ? 1 : 0, { duration: FLIP_MS, easing: Easing.inOut(Easing.cubic) }));
  }

  const front = useAnimatedStyle(() => ({
    transform: [{ perspective: 1200 }, { rotateY: `${turn.get() * 180}deg` }],
  }));
  const back = useAnimatedStyle(() => ({
    transform: [{ perspective: 1200 }, { rotateY: `${turn.get() * 180 + 180}deg` }],
  }));

  return (
    <Pressable
      onPress={flip}
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel={showingBack ? '엽서 앞면 보기' : '엽서 뒷면 보기'}>
      <Animated.View style={[styles.face, front]}>
        {cover ? (
          <Image source={photoUri(cover)} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.blankFront]} />
        )}
        <View style={styles.greeting}>
          <Text style={[styles.greetingSmall, !cover && styles.onPaper]}>Greetings from</Text>
          <Text style={[styles.greetingName, !cover && styles.onPaper]} numberOfLines={1} adjustsFontSizeToFit>
            {city}
          </Text>
        </View>
      </Animated.View>

      <Animated.View style={[styles.face, styles.back, back]}>
        <View style={styles.message}>
          {note ? (
            <Text style={styles.note} numberOfLines={5} adjustsFontSizeToFit minimumFontScale={0.7}>
              {note}
            </Text>
          ) : (
            <Text style={styles.empty}>아직 적지 않은 엽서예요.{'\n'}다음 기록에 남은 장면을 적어보세요.</Text>
          )}
        </View>

        <View style={styles.divider} />

        <View style={styles.addressSide}>
          <View style={styles.stamp}>
            <View style={styles.stampInner}>
              <Text style={styles.stampCode}>{countryCode || 'POST'}</Text>
              <Text style={styles.stampValue}>YEOUN</Text>
            </View>
          </View>
          {!!postedOn && (
            <View style={styles.postmark}>
              <Text style={styles.postmarkCity} numberOfLines={1} adjustsFontSizeToFit>
                {city}
              </Text>
              <Text style={styles.postmarkDate}>{postedOn.replaceAll('-', '.')}</Text>
            </View>
          )}
          <View style={styles.lines}>
            <Text style={styles.to} numberOfLines={1}>
              to. 그때의 나에게
            </Text>
            <View style={styles.line} />
            <View style={styles.line} />
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    aspectRatio: 3 / 2,
    transform: [{ rotate: '-1.5deg' }],
  },
  face: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    borderWidth: 8,
    borderColor: MapColors.paper,
    backgroundColor: MapColors.paper,
    backfaceVisibility: 'hidden',
    shadowColor: '#3b2c1e',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  blankFront: {
    backgroundColor: MapColors.land,
  },
  greeting: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 12,
  },
  greetingSmall: {
    fontFamily: LibraryFonts.pen,
    fontSize: 22,
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.55)',
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 1 },
  },
  greetingName: {
    fontFamily: LibraryFonts.serifBold,
    fontSize: 40,
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.55)',
    textShadowRadius: 8,
    textShadowOffset: { width: 0, height: 2 },
  },
  onPaper: {
    color: MapColors.ink,
    textShadowColor: 'transparent',
  },
  back: {
    flexDirection: 'row',
    padding: 12,
    gap: 10,
  },
  message: {
    flex: 1.15,
    justifyContent: 'center',
  },
  note: {
    fontFamily: LibraryFonts.pen,
    fontSize: 24,
    lineHeight: 28,
    color: MapColors.ink,
  },
  empty: {
    fontFamily: LibraryFonts.serif,
    fontSize: 12,
    lineHeight: 19,
    color: MapColors.inkDim,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    marginVertical: 6,
    backgroundColor: MapColors.coast,
  },
  addressSide: {
    flex: 1,
    justifyContent: 'space-between',
  },
  // Postage stamp: a dashed edge stands in for the perforation
  stamp: {
    alignSelf: 'flex-end',
    width: 50,
    height: 58,
    padding: 3,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: MapColors.coast,
    backgroundColor: '#fbf6ea',
  },
  stampInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MapColors.pin,
  },
  stampCode: {
    fontFamily: CinemaFonts.sign,
    fontSize: 20,
    letterSpacing: 1,
    color: MapColors.paper,
  },
  stampValue: {
    fontFamily: CinemaFonts.sign,
    fontSize: 9,
    letterSpacing: 1,
    color: MapColors.paper,
  },
  // Round postmark struck half over the stamp
  postmark: {
    position: 'absolute',
    top: 22,
    right: 30,
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 1.5,
    borderColor: POSTMARK_INK,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    transform: [{ rotate: '-14deg' }],
  },
  postmarkCity: {
    fontFamily: LibraryFonts.serifBold,
    fontSize: 11,
    color: POSTMARK_INK,
  },
  postmarkDate: {
    fontFamily: CinemaFonts.sign,
    fontSize: 11,
    letterSpacing: 1,
    color: POSTMARK_INK,
  },
  lines: {
    gap: 12,
  },
  to: {
    fontFamily: LibraryFonts.pen,
    fontSize: 18,
    color: MapColors.ink,
  },
  line: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: MapColors.coast,
  },
});
