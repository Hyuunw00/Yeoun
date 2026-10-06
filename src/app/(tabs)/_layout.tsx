import * as Haptics from 'expo-haptics';
import { Tabs } from 'expo-router';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import type { ColorValue } from 'react-native';

import { CinemaColors, CinemaFonts } from '@/components/cinema/theme';

function tabIcon(name: SFSymbol) {
  function TabIcon({ color }: { color: ColorValue }) {
    return <SymbolView name={name} tintColor={color} size={22} />;
  }
  return TabIcon;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: CinemaColors.brass,
        tabBarInactiveTintColor: CinemaColors.textDim,
        tabBarStyle: {
          backgroundColor: CinemaColors.theater,
          borderTopColor: CinemaColors.hairline,
        },
        tabBarLabelStyle: {
          fontFamily: CinemaFonts.serif,
          fontSize: 11,
        },
      }}
      screenListeners={{
        tabPress: () => Haptics.selectionAsync(),
      }}>
      <Tabs.Screen name="movie" options={{ title: '영화', tabBarIcon: tabIcon('film') }} />
      <Tabs.Screen name="book" options={{ title: '책', tabBarIcon: tabIcon('book.closed') }} />
      <Tabs.Screen name="music" options={{ title: '음악', tabBarIcon: tabIcon('opticaldisc') }} />
      <Tabs.Screen name="travel" options={{ title: '여행', tabBarIcon: tabIcon('globe.asia.australia') }} />
    </Tabs>
  );
}
