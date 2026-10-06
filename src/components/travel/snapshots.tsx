import { Image } from 'expo-image';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { photoUri } from '@/lib/photos';

const TILTS = ['-2.5deg', '1.5deg', '-1deg', '3deg'];
const TAPE_TILTS = ['-6deg', '4deg', '-2deg', '7deg'];

// A trip's photos as small prints stuck into a travel journal with a strip of masking
// tape each. Tap one to view it full screen.
export function Snapshots({ photos }: { photos: string[] }) {
  const [viewing, setViewing] = useState<string | null>(null);

  return (
    <>
      <View style={styles.row}>
        {photos.map((name, i) => (
          <Pressable
            key={name}
            style={[styles.print, { transform: [{ rotate: TILTS[i % TILTS.length] }] }]}
            onPress={() => setViewing(name)}>
            <Image source={photoUri(name)} style={styles.image} contentFit="cover" />
            <View style={[styles.tape, { transform: [{ rotate: TAPE_TILTS[i % TAPE_TILTS.length] }] }]} />
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
  // Wraps onto more lines for a trip's worth of photos
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    paddingTop: 12,
    paddingBottom: 4,
  },
  print: {
    width: 82,
    padding: 3,
    backgroundColor: '#fbf6ea',
    shadowColor: '#3b2c1e',
    shadowOpacity: 0.22,
    shadowRadius: 2,
    shadowOffset: { width: 1, height: 1 },
  },
  image: {
    width: '100%',
    aspectRatio: 4 / 5,
    backgroundColor: '#d6c29a',
  },
  // Semi-clear paper tape across the top edge
  tape: {
    position: 'absolute',
    top: -7,
    alignSelf: 'center',
    width: 34,
    height: 13,
    backgroundColor: 'rgba(226, 212, 176, 0.78)',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(160, 140, 108, 0.25)',
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
