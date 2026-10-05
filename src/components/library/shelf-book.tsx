import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { WorkSummary } from '@/lib/db';

import { LibraryColors, LibraryFonts } from './theme';

type Props = {
  work: WorkSummary;
  width: number;
  onPress: () => void;
  onLongPress?: () => void;
};

const COVER_RATIO = 1.45;

// A book standing face-out on the shelf: cover, a shaded spine edge and page edges
export function ShelfBook({ work, width, onPress, onLongPress }: Props) {
  const height = width * COVER_RATIO;

  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} style={[styles.book, { width, height }]}>
      {work.imageUrl ? (
        <Image source={work.imageUrl} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.blank]}>
          <Text style={styles.blankTitle} numberOfLines={4}>
            {work.title}
          </Text>
        </View>
      )}
      {/* Rounded spine catching the light on the left */}
      <LinearGradient
        style={styles.spine}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        colors={['rgba(0, 0, 0, 0.45)', 'rgba(255, 255, 255, 0.12)', 'rgba(0, 0, 0, 0)']}
        locations={[0, 0.35, 1]}
      />
      <View style={styles.pages} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  book: {
    borderRadius: 2,
    backgroundColor: '#3a2a1e',
    shadowColor: '#000',
    shadowOpacity: 0.55,
    shadowRadius: 6,
    shadowOffset: { width: 3, height: 2 },
  },
  blank: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    backgroundColor: '#5a3e2a',
  },
  blankTitle: {
    textAlign: 'center',
    fontFamily: LibraryFonts.serifBold,
    fontSize: 12,
    color: LibraryColors.paper,
  },
  spine: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 10,
  },
  pages: {
    position: 'absolute',
    right: -2,
    top: 2,
    bottom: 2,
    width: 2,
    backgroundColor: LibraryColors.paperEdge,
  },
});
