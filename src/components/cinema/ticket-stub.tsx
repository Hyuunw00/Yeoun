import { StyleSheet, Text, View } from 'react-native';

import { CinemaColors, CinemaFonts } from './theme';

const PAPER = '#ece0c4';
const INK = '#3a2f24';
const STAMP = 'rgba(160, 48, 36, 0.8)';
const NOTCH = 14;
const PERFORATIONS = 9;

type Props = {
  // e.g. "2회차" for a movie, "2번째" for a series (where 회차 means episodes)
  label: string;
  date: string;
  episode: string | null;
  rating: number | null;
  tilt: number;
};

// The torn-off half of a cinema ticket for one viewing, with the rating stamped on it
export function TicketStub({ label, date, episode, rating, tilt }: Props) {
  return (
    <View style={[styles.ticket, { transform: [{ rotate: `${tilt}deg` }] }]}>
      {/* Half-circle notches punched into the top and bottom edges */}
      <View style={[styles.notch, styles.notchTop]} />
      <View style={[styles.notch, styles.notchBottom]} />

      <View style={styles.body}>
        <Text style={styles.venue}>YEOUN CINEMA</Text>
        <Text style={styles.showing}>{label}</Text>
        <Text style={styles.date}>{date.replaceAll('-', '.')}</Text>
        {!!episode && <Text style={styles.detail}>{episode}</Text>}
        <Text style={styles.admit}>ADMIT ONE</Text>
      </View>

      {/* Torn perforated edge on the right */}
      <View style={styles.perforations}>
        {Array.from({ length: PERFORATIONS }, (_, i) => (
          <View key={i} style={styles.hole} />
        ))}
      </View>

      {rating !== null && (
        <View style={styles.stamp}>
          <Text style={styles.stampText}>★ {rating.toFixed(1)}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  ticket: {
    alignSelf: 'center',
    flexDirection: 'row',
    width: 220,
    backgroundColor: PAPER,
    borderRadius: 3,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  notch: {
    position: 'absolute',
    left: 150,
    width: NOTCH,
    height: NOTCH,
    borderRadius: NOTCH / 2,
    backgroundColor: CinemaColors.theater,
  },
  notchTop: {
    top: -NOTCH / 2,
  },
  notchBottom: {
    bottom: -NOTCH / 2,
  },
  body: {
    width: 157,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 2,
    borderRightWidth: 1,
    borderRightColor: 'rgba(58, 47, 36, 0.25)',
    borderStyle: 'dashed',
  },
  venue: {
    fontFamily: CinemaFonts.sign,
    fontSize: 11,
    letterSpacing: 2,
    color: INK,
    opacity: 0.6,
  },
  showing: {
    fontFamily: CinemaFonts.serifBold,
    fontSize: 18,
    color: INK,
  },
  date: {
    fontFamily: CinemaFonts.sign,
    fontSize: 20,
    letterSpacing: 1.5,
    color: INK,
  },
  detail: {
    fontFamily: CinemaFonts.serif,
    fontSize: 11,
    color: INK,
    opacity: 0.75,
  },
  admit: {
    marginTop: 4,
    fontFamily: CinemaFonts.sign,
    fontSize: 10,
    letterSpacing: 3,
    color: INK,
    opacity: 0.45,
  },
  perforations: {
    flex: 1,
    justifyContent: 'space-evenly',
    alignItems: 'flex-end',
    marginRight: -3,
  },
  hole: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: CinemaColors.theater,
  },
  stamp: {
    position: 'absolute',
    right: 18,
    top: 14,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderWidth: 1.5,
    borderColor: STAMP,
    borderRadius: 3,
    transform: [{ rotate: '-14deg' }],
  },
  stampText: {
    fontFamily: CinemaFonts.sign,
    fontSize: 14,
    letterSpacing: 1,
    color: STAMP,
  },
});
