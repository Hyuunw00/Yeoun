import { Image } from 'expo-image';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { photoUri } from '@/lib/photos';

import { CinemaColors } from './theme';

const SPROCKET_COUNT = 14;
const FRAME_HEIGHT = 72;

function Sprockets() {
  return (
    <View style={styles.sprockets}>
      {Array.from({ length: SPROCKET_COUNT }, (_, i) => (
        <View key={i} style={styles.sprocket} />
      ))}
    </View>
  );
}

// Record photos shown as frames on a strip of film. Tap a frame to view it full screen.
export function FilmStrip({ photos }: { photos: string[] }) {
  const [viewing, setViewing] = useState<string | null>(null);

  return (
    <>
      <View style={styles.strip}>
        <Sprockets />
        <View style={styles.frames}>
          {photos.map((name) => (
            <Pressable key={name} style={styles.frame} onPress={() => setViewing(name)}>
              <Image source={photoUri(name)} style={styles.image} contentFit="cover" />
            </Pressable>
          ))}
        </View>
        <Sprockets />
      </View>

      <Modal visible={viewing !== null} transparent animationType="fade" onRequestClose={() => setViewing(null)}>
        <Pressable style={styles.viewer} onPress={() => setViewing(null)}>
          {viewing && <Image source={photoUri(viewing)} style={styles.fullImage} contentFit="contain" />}
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  strip: {
    alignSelf: 'stretch',
    paddingVertical: 6,
    backgroundColor: '#0c0b0a',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: CinemaColors.hairline,
  },
  sprockets: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
  },
  sprocket: {
    width: 7,
    height: 5,
    borderRadius: 1,
    backgroundColor: '#2b2621',
  },
  frames: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  frame: {
    flex: 1,
    maxWidth: FRAME_HEIGHT * 1.5,
    height: FRAME_HEIGHT,
  },
  image: {
    width: '100%',
    height: '100%',
    opacity: 0.92,
  },
  viewer: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.94)',
  },
  fullImage: {
    width: '100%',
    height: '80%',
  },
});
