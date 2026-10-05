import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { MAX_PHOTOS_PER_RECORD } from '@/lib/photos';
import type { PhotoItem } from '@/lib/use-record-editor';

type Props = {
  photos: PhotoItem[];
  picking: boolean;
  onAdd: () => void;
  onRemove: (index: number) => void;
  limit?: number;
  colors: { border: string; text: string; badge: string; badgeText: string };
  fontFamily: string;
};

// Thumbnails of attached photos with remove badges, plus an add tile up to the limit.
// Scrolls sideways once a trip's worth of photos no longer fits the width.
export function PhotoPickerRow({
  photos,
  picking,
  onAdd,
  onRemove,
  colors,
  fontFamily,
  limit = MAX_PHOTOS_PER_RECORD,
}: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.scroll}>
      {photos.map((photo, index) => (
        <View key={photo.uri} style={styles.photo}>
          <Image source={photo.uri} style={styles.image} contentFit="cover" />
          <Pressable
            style={[styles.remove, { backgroundColor: colors.badge, borderColor: colors.border }]}
            onPress={() => onRemove(index)}
            hitSlop={8}>
            <Text style={[styles.removeText, { color: colors.badgeText }]}>✕</Text>
          </Pressable>
        </View>
      ))}
      {photos.length < limit && (
        <Pressable style={[styles.photo, styles.add, { borderColor: colors.border }]} onPress={onAdd} disabled={picking}>
          {picking ? (
            <ActivityIndicator color={colors.text} />
          ) : (
            <Text style={[styles.addText, { color: colors.text, fontFamily }]}>
              사진{'\n'}
              {photos.length}/{limit}
            </Text>
          )}
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 0,
  },
  // Room for the remove badges poking out past the thumbnails
  row: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 6,
    paddingRight: 6,
  },
  photo: {
    width: 64,
    height: 64,
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 2,
    backgroundColor: '#111',
  },
  remove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  removeText: {
    fontSize: 10,
  },
  add: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  addText: {
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 16,
  },
});
