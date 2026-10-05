import { Image } from 'expo-image';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CinemaFonts } from '@/components/cinema/theme';
import { formatDuration, type AlbumTrack } from '@/lib/itunes';

import { RecordColors } from './theme';

type Props = {
  visible: boolean;
  albumTitle: string;
  artworkUrl: string | null;
  tracks: AlbumTrack[];
  // The track cued on the turntable, and the one that stuck in a record
  current: AlbumTrack | null;
  favorite: AlbumTrack | null;
  onPick: (track: AlbumTrack) => void;
  onClose: () => void;
};

// Layout estimates for sizing the sheet
const HEADER_HEIGHT = 120;
const ROW_HEIGHT = 30;
const SIDE_HEADER_HEIGHT = 44;

// The album's back cover: tracks split into Side A and Side B with dot leaders and lengths
export function TracklistSheet({ visible, albumTitle, artworkUrl, tracks, current, favorite, onPick, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const half = Math.ceil(tracks.length / 2);
  const sides = tracks.length > 1 ? [tracks.slice(0, half), tracks.slice(half)] : [tracks];

  // Sized from the track count rather than left to auto layout, which didn't grow when
  // the tracks arrived after the sheet opened; long lists scroll inside 75% of the screen
  const contentHeight =
    HEADER_HEIGHT + tracks.length * ROW_HEIGHT + (sides.length > 1 ? sides.length * SIDE_HEADER_HEIGHT : 0);
  const sheetHeight = Math.min(screenHeight * 0.75, contentHeight + insets.bottom + 16);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      {visible && (
        <Animated.View
          entering={SlideInDown.duration(320)}
          style={[styles.sheet, { height: sheetHeight, paddingBottom: insets.bottom + 16 }]}>
          {/* Faded cover art printed behind the list, like a back cover */}
          {artworkUrl && (
            <Image source={artworkUrl} style={styles.art} contentFit="cover" blurRadius={18} />
          )}
          <View style={styles.handle} />
          <Text style={styles.label}>TRACKLIST</Text>
          <Text style={styles.album} numberOfLines={1}>
            {albumTitle}
          </Text>

          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {sides.map((side, s) => (
              <View key={s} style={styles.side}>
                {sides.length > 1 && <Text style={styles.sideLabel}>SIDE {s === 0 ? 'A' : 'B'}</Text>}
                {side.map((track) => {
                  const playable = !!track.previewUrl;
                  const isCurrent = current?.number === track.number && current?.name === track.name;
                  const isFavorite = favorite?.number === track.number && favorite?.name === track.name;
                  return (
                    <Pressable
                      key={`${track.number}-${track.name}`}
                      style={styles.row}
                      disabled={!playable}
                      onPress={() => onPick(track)}>
                      <Text style={[styles.number, !playable && styles.unplayable]}>{track.number}.</Text>
                      <Text style={[styles.name, !playable && styles.unplayable]} numberOfLines={1}>
                        {track.name}
                        {isFavorite && <Text style={styles.favorite}>  ♪</Text>}
                      </Text>
                      <Text style={styles.leader} numberOfLines={1}>
                        {'·'.repeat(60)}
                      </Text>
                      {isCurrent && <View style={styles.playingDot} />}
                      <Text style={styles.duration}>{formatDuration(track.durationMs)}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </ScrollView>
        </Animated.View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    paddingHorizontal: 24,
    paddingTop: 10,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    backgroundColor: RecordColors.paper,
  },
  art: {
    ...StyleSheet.absoluteFill,
    opacity: 0.12,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    marginBottom: 16,
    borderRadius: 2,
    backgroundColor: RecordColors.rule,
  },
  label: {
    fontFamily: CinemaFonts.sign,
    fontSize: 13,
    letterSpacing: 5,
    color: RecordColors.inkDim,
  },
  album: {
    marginTop: 2,
    fontFamily: CinemaFonts.serifBold,
    fontSize: 18,
    color: RecordColors.ink,
  },
  list: {
    flex: 1,
    marginTop: 16,
  },
  listContent: {
    gap: 20,
    paddingBottom: 8,
  },
  side: {
    gap: 10,
  },
  sideLabel: {
    paddingBottom: 4,
    fontFamily: CinemaFonts.sign,
    fontSize: 15,
    letterSpacing: 3,
    color: RecordColors.ink,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: RecordColors.rule,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    paddingVertical: 2,
  },
  number: {
    width: 22,
    fontFamily: CinemaFonts.serif,
    fontSize: 13,
    color: RecordColors.inkDim,
  },
  name: {
    flexShrink: 1,
    fontFamily: CinemaFonts.serif,
    fontSize: 15,
    color: RecordColors.ink,
  },
  favorite: {
    color: '#c0612f',
  },
  unplayable: {
    opacity: 0.4,
  },
  leader: {
    flex: 1,
    fontSize: 11,
    letterSpacing: 2,
    color: RecordColors.rule,
  },
  playingDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    alignSelf: 'center',
    backgroundColor: RecordColors.neonGlow,
    shadowColor: RecordColors.neonGlow,
    shadowOpacity: 0.9,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
  duration: {
    fontFamily: CinemaFonts.serif,
    fontSize: 12,
    color: RecordColors.inkDim,
  },
});
