import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CinemaFonts } from '@/components/cinema/theme';
import type { ListenLink } from '@/lib/itunes';

import { RecordColors } from './theme';

type Props = {
  visible: boolean;
  trackName: string | null;
  albumTitle: string;
  links: ListenLink[];
  onClose: () => void;
};

// A listening booth in the shop: pick where to keep listening to the full song
export function ListeningBoothSheet({ visible, trackName, albumTitle, links, onClose }: Props) {
  const insets = useSafeAreaInsets();

  function open(link: ListenLink) {
    onClose();
    Linking.openURL(link.url).catch(() => {});
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      {visible && (
        <Animated.View entering={SlideInDown.duration(320)} style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.handle} />
          <Text style={styles.label}>LISTENING BOOTH</Text>
          <Text style={styles.headline}>어디서 이어 들을까요?</Text>
          <Text style={styles.now} numberOfLines={1}>
            {[trackName, albumTitle].filter(Boolean).join('  ·  ')}
          </Text>

          <View style={styles.booths}>
            {links.map((link) => (
              <Pressable
                key={link.label}
                onPress={() => open(link)}
                style={({ pressed }) => [styles.booth, pressed && styles.boothPressed]}>
                <Text style={styles.boothText}>{link.label}</Text>
                <Text style={styles.arrow}>→</Text>
              </Pressable>
            ))}
          </View>

          <Pressable onPress={onClose} hitSlop={10} style={styles.cancel}>
            <Text style={styles.cancelText}>닫기</Text>
          </Pressable>
        </Animated.View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingTop: 10,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    backgroundColor: RecordColors.wall,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: RecordColors.hairline,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    marginBottom: 18,
    borderRadius: 2,
    backgroundColor: RecordColors.hairline,
  },
  label: {
    fontFamily: CinemaFonts.sign,
    fontSize: 13,
    letterSpacing: 5,
    color: RecordColors.textDim,
  },
  headline: {
    marginTop: 4,
    fontFamily: CinemaFonts.serifBold,
    fontSize: 22,
    color: RecordColors.neon,
    textShadowColor: RecordColors.neonGlow,
    textShadowRadius: 10,
    textShadowOffset: { width: 0, height: 0 },
  },
  now: {
    marginTop: 6,
    fontFamily: CinemaFonts.serif,
    fontSize: 13,
    color: RecordColors.textDim,
  },
  booths: {
    gap: 10,
    marginTop: 22,
  },
  // Neon-outlined booth doors
  booth: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 15,
    borderWidth: 1,
    borderColor: RecordColors.neon,
    borderRadius: 4,
    shadowColor: RecordColors.neonGlow,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  boothPressed: {
    backgroundColor: 'rgba(255, 138, 101, 0.12)',
  },
  boothText: {
    fontFamily: CinemaFonts.sign,
    fontSize: 20,
    letterSpacing: 2,
    color: RecordColors.text,
  },
  arrow: {
    fontSize: 16,
    color: RecordColors.neon,
  },
  cancel: {
    alignSelf: 'center',
    marginTop: 18,
  },
  cancelText: {
    fontFamily: CinemaFonts.serif,
    fontSize: 14,
    color: RecordColors.textDim,
  },
});
