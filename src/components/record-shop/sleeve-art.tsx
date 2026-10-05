import { Canvas, ColorMatrix, Fill, FractalNoise } from '@shopify/react-native-skia';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import { CinemaFonts } from '@/components/cinema/theme';

import { RecordColors } from './theme';

// Pale, low-alpha fibers so the printed cover reads as cardboard
const CARDBOARD = [0.3, 0.3, 0.3, 0, 0.35, 0.3, 0.3, 0.3, 0, 0.3, 0.3, 0.3, 0.3, 0, 0.25, 0, 0, 0, 0, 0.08];
const STICKERS: Record<string, string> = { single: 'SINGLE', ep: 'EP', album: 'LP' };

type Props = {
  size: number;
  title: string;
  imageUrl: string | null;
  format: string | null;
};

// A worn cardboard LP sleeve with the cover printed on it and a price-sticker format label
export function SleeveArt({ size, title, imageUrl, format }: Props) {
  return (
    <View style={styles.sleeve}>
      {imageUrl ? (
        <Image source={imageUrl} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} />
      ) : (
        <View style={styles.blank}>
          <Text style={styles.blankTitle} numberOfLines={3}>
            {title}
          </Text>
        </View>
      )}
      {/* Ring wear: the record's outline rubbed into the cardboard from years in the sleeve */}
      <View
        style={[
          styles.ring,
          { width: size * 0.86, height: size * 0.86, borderRadius: size * 0.43, left: size * 0.07, top: size * 0.07 },
        ]}
      />
      {/* Cardboard fibers */}
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        <Fill>
          <FractalNoise freqX={0.9} freqY={0.9} octaves={2} />
          <ColorMatrix matrix={CARDBOARD} />
        </Fill>
      </Canvas>
      {/* Soft gloss from the shop light, across the top corner */}
      <LinearGradient
        style={StyleSheet.absoluteFill}
        colors={['rgba(255,255,255,0.16)', 'rgba(255,255,255,0)', 'rgba(255,255,255,0)']}
        locations={[0, 0.35, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        pointerEvents="none"
      />
      {/* Worn edges and the open side of the sleeve */}
      <View style={styles.wear} />
      <View style={styles.opening} />
      {format && (
        <View style={styles.sticker}>
          <Text style={styles.stickerText}>{STICKERS[format] ?? 'LP'}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sleeve: {
    flex: 1,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: RecordColors.wallLight,
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  blank: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  blankTitle: {
    textAlign: 'center',
    fontFamily: CinemaFonts.serifBold,
    fontSize: 16,
    color: RecordColors.text,
  },
  ring: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  wear: {
    ...StyleSheet.absoluteFill,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 245, 230, 0.14)',
    borderRadius: 2,
  },
  // Price-sticker style label in the corner, like in a record shop bin
  sticker: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
    backgroundColor: '#f1d356',
    transform: [{ rotate: '-6deg' }],
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  stickerText: {
    fontFamily: CinemaFonts.sign,
    fontSize: 11,
    letterSpacing: 1.5,
    color: '#2a2018',
  },
  opening: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
});
