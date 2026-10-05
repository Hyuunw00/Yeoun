import { StyleSheet, Text, View } from 'react-native';

import { CinemaColors, CinemaFonts } from '@/components/cinema/theme';

// Placeholder for a space that hasn't been built yet
export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: CinemaColors.theater,
  },
  title: {
    fontFamily: CinemaFonts.serifBold,
    fontSize: 20,
    color: CinemaColors.text,
  },
  description: {
    fontFamily: CinemaFonts.serif,
    fontSize: 13,
    color: CinemaColors.textDim,
  },
});
