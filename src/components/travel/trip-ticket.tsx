import { SymbolView } from 'expo-symbols';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { CinemaFonts } from '@/components/cinema/theme';
import { LibraryFonts } from '@/components/library/theme';

import { MapColors } from './theme';
import { TRANSPORTS, type Transport } from './transport';

const NOTCH = 16;
// Deterministic bar widths for the boarding pass barcode
const BARS = [2, 1, 3, 1, 1, 2, 3, 1, 2, 1, 1, 3, 2, 1, 2, 3, 1, 1, 2, 1, 3, 1, 2];

type Props = {
  transport: Transport | null;
  from: string | null;
  to: string;
  toCode: string | null;
  dates: string;
  length?: string | null;
  // Written below the tear line, e.g. the record's notes and photos
  children?: ReactNode;
  // Screen color behind the ticket, for the punched notches
  background?: string;
};

// A trip printed as the ticket for how it was made: a boarding pass for a flight,
// a rail ticket for a train, and so on
export function TripTicket({
  transport,
  from,
  to,
  toCode,
  dates,
  length,
  children,
  background = MapColors.sea,
}: Props) {
  const style = transport ? TRANSPORTS[transport] : null;
  const band = style?.color ?? MapColors.ink;

  return (
    <View style={styles.ticket}>
      <View style={[styles.band, { backgroundColor: band }]}>
        <View style={styles.bandTitle}>
          {style && <SymbolView name={style.symbol} tintColor={MapColors.paper} size={13} />}
          <Text style={styles.bandText}>{style?.ticketTitle ?? 'TICKET'}</Text>
        </View>
        <Text style={styles.bandText}>YEOUN</Text>
      </View>

      <View style={styles.route}>
        <View style={styles.end}>
          <Text style={styles.label}>FROM</Text>
          <Text style={[styles.from, !from && styles.unknown]} numberOfLines={1}>
            {from ?? '—'}
          </Text>
        </View>
        <SymbolView name={style?.symbol ?? 'arrow.right'} tintColor={band} size={18} />
        <View style={[styles.end, styles.endRight]}>
          <Text style={styles.label}>TO{toCode ? ` · ${toCode}` : ''}</Text>
          <Text style={styles.to} numberOfLines={1} adjustsFontSizeToFit>
            {to}
          </Text>
        </View>
      </View>

      <View style={styles.details}>
        <View>
          <Text style={styles.label}>DATE</Text>
          <Text style={styles.value}>{dates}</Text>
        </View>
        {!!length && (
          <View>
            <Text style={styles.label}>STAY</Text>
            <Text style={styles.value}>{length}</Text>
          </View>
        )}
        {transport === 'plane' && (
          <View style={styles.barcode}>
            {BARS.map((w, i) => (
              <View key={i} style={[styles.bar, { width: w }]} />
            ))}
          </View>
        )}
        {transport === 'train' && <View style={[styles.punch, { backgroundColor: background }]} />}
      </View>

      {!!children && (
        <>
          {/* Tear line with notches punched into both edges */}
          <View style={styles.tear}>
            <View style={[styles.notch, styles.notchLeft, { backgroundColor: background }]} />
            <View style={styles.dashes} />
            <View style={[styles.notch, styles.notchRight, { backgroundColor: background }]} />
          </View>
          <View style={styles.stub}>{children}</View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  ticket: {
    overflow: 'hidden',
    borderRadius: 6,
    backgroundColor: MapColors.paper,
    shadowColor: '#3b2c1e',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  band: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  bandTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bandText: {
    fontFamily: CinemaFonts.sign,
    fontSize: 13,
    letterSpacing: 2,
    color: MapColors.paper,
  },
  route: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  end: {
    flex: 1,
    gap: 2,
  },
  endRight: {
    alignItems: 'flex-end',
  },
  label: {
    fontFamily: CinemaFonts.sign,
    fontSize: 11,
    letterSpacing: 1.5,
    color: MapColors.inkDim,
  },
  from: {
    fontFamily: LibraryFonts.serifBold,
    fontSize: 16,
    color: MapColors.ink,
  },
  unknown: {
    color: MapColors.inkDim,
  },
  to: {
    fontFamily: LibraryFonts.serifBold,
    fontSize: 24,
    color: MapColors.ink,
  },
  details: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
  },
  value: {
    fontFamily: CinemaFonts.sign,
    fontSize: 16,
    letterSpacing: 1,
    color: MapColors.ink,
  },
  barcode: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'stretch',
    gap: 1.5,
    height: 26,
  },
  bar: {
    backgroundColor: MapColors.ink,
  },
  punch: {
    marginLeft: 'auto',
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  tear: {
    height: NOTCH,
    justifyContent: 'center',
  },
  dashes: {
    marginHorizontal: NOTCH,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: MapColors.coast,
  },
  notch: {
    position: 'absolute',
    top: 0,
    width: NOTCH,
    height: NOTCH,
    borderRadius: NOTCH / 2,
  },
  notchLeft: {
    left: -NOTCH / 2,
  },
  notchRight: {
    right: -NOTCH / 2,
  },
  stub: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 16,
    gap: 10,
  },
});
