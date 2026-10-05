import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { KakaoBook } from '@/lib/kakao';

import { PaperGrain } from './paper-grain';
import { LibraryColors, LibraryFonts } from './theme';

const HEADING_RULE = 'rgba(178, 58, 46, 0.55)';
const LINE_RULE = 'rgba(92, 128, 170, 0.18)';
const RULED_LINES = 3;
const HOLE = 12;
const PULL_MS = 260;

type Props = {
  book: KakaoBook;
  onPick: (book: KakaoBook) => void;
};

// A search result typed on a library catalogue card, filed under its author.
// Picking it pulls the card up out of the drawer before moving on to writing about it.
export function CatalogCard({ book, onPick }: Props) {
  const pulled = useSharedValue(0);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -pulled.get() * 16 }, { rotate: `${-pulled.get() * 1.5}deg` }],
  }));

  function pick() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    pulled.set(
      withSequence(
        withTiming(1, { duration: PULL_MS, easing: Easing.out(Easing.cubic) }, (finished) => {
          if (finished) scheduleOnRN(onPick, book);
        }),
        // File it back while the next screen covers this one
        withDelay(400, withTiming(0, { duration: 0 })),
      ),
    );
  }

  const author = book.authors.join(', ') || '저자 미상';
  const year = book.publishedDate?.slice(0, 4);

  return (
    <Pressable onPress={pick}>
      <Animated.View style={[styles.card, cardStyle]}>
        <PaperGrain opacity={0.1} />
        <View style={styles.heading}>
          <Text style={styles.author} numberOfLines={1}>
            {author}
          </Text>
          {year && <Text style={styles.year}>{year}</Text>}
        </View>

        <View style={styles.entry}>
          <View style={styles.lines}>
            <Text style={styles.title} numberOfLines={2}>
              {book.title}
            </Text>
            {!!book.publisher && (
              <Text style={styles.publisher} numberOfLines={1}>
                {book.publisher}
              </Text>
            )}
            {/* Faint ruled lines left blank below the entry */}
            {Array.from({ length: RULED_LINES }, (_, i) => (
              <View key={i} style={styles.ruled} />
            ))}
          </View>
          {book.coverUrl ? (
            <Image source={book.coverUrl} style={styles.cover} contentFit="cover" />
          ) : (
            <View style={styles.cover} />
          )}
        </View>

        {/* Hole for the drawer rod */}
        <View style={styles.hole} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 22,
    borderRadius: 3,
    backgroundColor: LibraryColors.paper,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
    paddingBottom: 6,
    borderBottomWidth: 1.5,
    borderBottomColor: HEADING_RULE,
  },
  author: {
    flex: 1,
    fontFamily: LibraryFonts.serifBold,
    fontSize: 13,
    color: LibraryColors.ink,
  },
  year: {
    fontFamily: LibraryFonts.serif,
    fontSize: 12,
    color: LibraryColors.inkDim,
  },
  entry: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 10,
  },
  lines: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontFamily: LibraryFonts.serifBold,
    fontSize: 16,
    lineHeight: 22,
    color: LibraryColors.ink,
  },
  publisher: {
    fontFamily: LibraryFonts.serif,
    fontSize: 12,
    color: LibraryColors.inkDim,
  },
  ruled: {
    height: 14,
    borderBottomWidth: 1,
    borderBottomColor: LINE_RULE,
  },
  cover: {
    width: 50,
    height: 72,
    backgroundColor: LibraryColors.paperEdge,
  },
  hole: {
    position: 'absolute',
    bottom: 6,
    alignSelf: 'center',
    width: HOLE,
    height: HOLE,
    borderRadius: HOLE / 2,
    backgroundColor: LibraryColors.wall,
  },
});
