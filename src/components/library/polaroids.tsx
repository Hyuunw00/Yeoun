import { Image } from 'expo-image';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { photoUri } from '@/lib/photos';

const TILTS = ['-3deg', '2deg', '-1deg'];

// Record photos as small polaroids tucked between the pages. Tap one to view it full screen.
export function Polaroids({ photos }: { photos: string[] }) {
  const [viewing, setViewing] = useState<string | null>(null);

  return (
    <>
      <View style={styles.row}>
        {photos.map((name, i) => (
          <Pressable
            key={name}
            style={[styles.polaroid, { transform: [{ rotate: TILTS[i % TILTS.length] }] }]}
            onPress={() => setViewing(name)}>
            <Image source={photoUri(name)} style={styles.image} contentFit="cover" />
          </Pressable>
        ))}
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
  row: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 6,
  },
  polaroid: {
    width: 84,
    padding: 5,
    paddingBottom: 16,
    backgroundColor: '#fbf8f1',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 3,
    shadowOffset: { width: 1, height: 2 },
  },
  image: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#ddd',
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
