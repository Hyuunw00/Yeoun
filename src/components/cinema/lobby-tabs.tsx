import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CinemaColors, CinemaFonts } from './theme';

export type LobbyFilter = 'all' | 'movie' | 'series';

const TABS: { value: LobbyFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'movie', label: '영화' },
  { value: 'series', label: '시리즈' },
];

type Props = {
  value: LobbyFilter;
  onChange: (value: LobbyFilter) => void;
};

// Directory-sign style tabs: the active one in brass with an underline
export function LobbyTabs({ value, onChange }: Props) {
  return (
    <View style={styles.tabs}>
      {TABS.map((tab) => {
        const active = tab.value === value;
        return (
          <Pressable
            key={tab.value}
            hitSlop={8}
            onPress={() => {
              if (active) return;
              Haptics.selectionAsync();
              onChange(tab.value);
            }}>
            <Text style={[styles.label, active && styles.active]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 28,
  },
  label: {
    paddingBottom: 6,
    fontFamily: CinemaFonts.serif,
    fontSize: 14,
    color: CinemaColors.textDim,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  active: {
    fontFamily: CinemaFonts.serifBold,
    color: CinemaColors.brass,
    borderBottomColor: CinemaColors.brass,
  },
});
