import { BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue';
import { NanumMyeongjo_400Regular, NanumMyeongjo_700Bold } from '@expo-google-fonts/nanum-myeongjo';
import { NanumPenScript_400Regular } from '@expo-google-fonts/nanum-pen-script';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { CinemaColors } from '@/components/cinema/theme';
import { startAutoBackup } from '@/lib/auto-backup';
import { database } from '@/lib/database';
import { migrate } from '@/lib/db';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    BebasNeue_400Regular,
    NanumMyeongjo_400Regular,
    NanumMyeongjo_700Bold,
    NanumPenScript_400Regular,
  });
  const [dbState, setDbState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    migrate(database)
      .then(() => {
        setDbState('ready');
        startAutoBackup(database);
      })
      .catch((e) => {
        console.error('Database migration failed', e);
        setDbState('error');
      });
  }, []);

  if (dbState === 'error') {
    return (
      <View style={styles.error}>
        <Text style={styles.errorText}>기록을 여는 중에 문제가 생겼어요.{'\n'}앱을 다시 실행해주세요.</Text>
      </View>
    );
  }

  if (!fontsLoaded || dbState === 'loading') return null;

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          // Avoid white flashes between dark screens
          contentStyle: { backgroundColor: CinemaColors.theater },
        }}>
        <Stack.Screen name="(tabs)" />
        {/* Fade in after the lobby lights go down */}
        <Stack.Screen name="movie/work/[id]" options={{ animation: 'fade' }} />
        {/* Fade in as the book comes off the shelf and opens */}
        <Stack.Screen name="book/work/[id]" options={{ animation: 'fade' }} />
        {/* Fade in as the record comes out of its sleeve */}
        <Stack.Screen name="music/work/[id]" options={{ animation: 'fade' }} />
        <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
      </Stack>
    </>
  );
}

const styles = StyleSheet.create({
  error: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: CinemaColors.theater,
  },
  errorText: {
    textAlign: 'center',
    lineHeight: 22,
    color: CinemaColors.text,
  },
});
