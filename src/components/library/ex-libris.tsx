import { StyleSheet, Text, View } from 'react-native';

import { LibraryFonts } from './theme';

const INK = 'rgba(158, 52, 38, 0.75)';

// Round red ownership stamp, pressed slightly crooked
export function ExLibris() {
  return (
    <View style={styles.stamp}>
      <View style={styles.inner}>
        <Text style={styles.small}>EX LIBRIS</Text>
        <Text style={styles.name}>여운의 서재</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stamp: {
    width: 72,
    height: 72,
    borderRadius: 36,
    padding: 3,
    borderWidth: 2,
    borderColor: INK,
    transform: [{ rotate: '-12deg' }],
  },
  inner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 33,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: INK,
  },
  small: {
    fontFamily: LibraryFonts.serif,
    fontSize: 7,
    letterSpacing: 1.5,
    color: INK,
  },
  name: {
    marginTop: 2,
    fontFamily: LibraryFonts.serifBold,
    fontSize: 10,
    color: INK,
  },
});
