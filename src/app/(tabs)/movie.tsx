import * as Haptics from 'expo-haptics';
import { Link, router, useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useDb } from '@/lib/database';
import { useCallback, useEffect, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { FilmGrain } from '@/components/cinema/film-grain';
import { LightboxPoster } from '@/components/cinema/lightbox-poster';
import { MarqueeSign } from '@/components/cinema/marquee-sign';
import { LobbyTabs, type LobbyFilter } from '@/components/cinema/lobby-tabs';
import { LobbyBackdrop } from '@/components/cinema/lobby-backdrop';
import { CinemaColors, CinemaFonts } from '@/components/cinema/theme';
import { deleteWork, listWorks, type WorkSummary } from '@/lib/db';
import { isSeries } from '@/lib/tmdb';

const COLUMNS = 2;
const SIDE_PADDING = 24;
const COLUMN_GAP = 20;
const LIGHTS_OFF_MS = 380;
const LIGHTS_ON_MS = 450;
const SEARCH_DEBOUNCE_MS = 200;

const EMPTY_MESSAGES: Record<LobbyFilter, string> = {
  all: '아직 걸린 포스터가 없어요',
  movie: '아직 걸린 영화가 없어요',
  series: '아직 걸린 시리즈가 없어요',
};

export default function CinemaLobbyScreen() {
  const db = useDb();
  const { width } = useWindowDimensions();
  const [works, setWorks] = useState<WorkSummary[]>([]);
  const [filter, setFilter] = useState<LobbyFilter>('all');
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const darkness = useSharedValue(0);

  const visibleWorks =
    filter === 'all'
      ? works
      : works.filter((work) => isSeries(work.externalId) === (filter === 'series'));

  const posterWidth = (width - SIDE_PADDING * 2 - COLUMN_GAP * (COLUMNS - 1)) / COLUMNS;

  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const loadWorks = useCallback(() => {
    listWorks(db, 'movie', searchQuery).then(setWorks);
  }, [db, searchQuery]);

  useFocusEffect(loadWorks);

  useFocusEffect(
    useCallback(() => {
      // Lights come back on when returning to the lobby
      darkness.set(withTiming(0, { duration: LIGHTS_ON_MS }));
    }, [darkness]),
  );

  function closeSearch() {
    setSearchOpen(false);
    setQuery('');
  }

  const openWork = useCallback((id: number) => {
    router.push({ pathname: '/movie/work/[id]', params: { id } });
  }, []);

  function openPosterMenu(work: WorkSummary) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    ActionSheetIOS.showActionSheetWithOptions(
      { title: work.title, options: ['포스터 내리기', '취소'], destructiveButtonIndex: 0, cancelButtonIndex: 1 },
      (index) => {
        if (index !== 0) return;
        Alert.alert('포스터를 내릴까요?', '이 작품의 기록이 모두 지워지고 되돌릴 수 없어요', [
          { text: '취소', style: 'cancel' },
          {
            text: '내리기',
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteWork(db, work.id);
                loadWorks();
              } catch {
                Alert.alert('내리지 못했어요', '잠시 후 다시 시도해주세요');
              }
            },
          },
        ]);
      },
    );
  }

  // Dim the lobby like theater lights going down, then enter
  function enterWork(id: number) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
    darkness.set(
      withTiming(1, { duration: LIGHTS_OFF_MS }, (finished) => {
        if (finished) scheduleOnRN(openWork, id);
      }),
    );
  }

  const darknessStyle = useAnimatedStyle(() => ({ opacity: darkness.get() }));

  return (
    <View style={styles.container}>
      <LobbyBackdrop />

      <SafeAreaView style={styles.flex} edges={['top']}>
        <FlatList
          data={visibleWorks}
          keyExtractor={(item) => String(item.id)}
          numColumns={COLUMNS}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.row}
          ListHeaderComponent={
            <View style={styles.header}>
              <Pressable style={styles.settings} onPress={() => router.push('/settings')} hitSlop={12}>
                <SymbolView name="gearshape" tintColor={CinemaColors.brassDim} size={20} />
              </Pressable>
              <MarqueeSign>
                <Text style={styles.venue}>YEOUN CINEMA</Text>
                <Text style={styles.marquee}>NOW SHOWING</Text>
              </MarqueeSign>
              <LobbyTabs value={filter} onChange={setFilter} />
              <View style={styles.headerRow}>
                <Text style={styles.count}>상영작 {visibleWorks.length}편</Text>
                <View style={styles.actions}>
                  {!searchOpen && (
                    <Pressable onPress={() => setSearchOpen(true)} hitSlop={8}>
                      <Text style={styles.find}>찾기</Text>
                    </Pressable>
                  )}
                  <Link href="/movie/search" style={styles.ticket}>
                    기록하기
                  </Link>
                </View>
              </View>
              {searchOpen && (
                <View style={styles.searchRow}>
                  <TextInput
                    style={styles.searchInput}
                    value={query}
                    onChangeText={setQuery}
                    placeholder="제목이나 기록 속 문장으로 찾기"
                    placeholderTextColor={CinemaColors.textDim}
                    selectionColor={CinemaColors.brass}
                    keyboardAppearance="dark"
                    returnKeyType="search"
                    autoFocus
                  />
                  <Pressable onPress={closeSearch} hitSlop={8}>
                    <Text style={styles.find}>닫기</Text>
                  </Pressable>
                </View>
              )}
            </View>
          }
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <Text style={styles.empty}>
              {searchQuery.trim() ? `'${searchQuery.trim()}'에 맞는 기록이 없어요` : EMPTY_MESSAGES[filter]}
            </Text>
          }
          renderItem={({ item }) => (
            <LightboxPoster
              work={item}
              width={posterWidth}
              onPress={() => enterWork(item.id)}
              onLongPress={() => openPosterMenu(item)}
            />
          )}
        />
      </SafeAreaView>

      <FilmGrain />
      <Animated.View style={[styles.darkness, darknessStyle]} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CinemaColors.wall,
  },
  flex: {
    flex: 1,
  },
  grid: {
    paddingHorizontal: SIDE_PADDING,
    paddingBottom: 60,
    gap: 36,
  },
  row: {
    gap: COLUMN_GAP,
  },
  settings: {
    alignSelf: 'flex-end',
    marginBottom: -8,
  },
  header: {
    paddingTop: 16,
    paddingBottom: 8,
    gap: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  find: {
    fontFamily: CinemaFonts.serif,
    fontSize: 13,
    color: CinemaColors.brassDim,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 8,
    fontFamily: CinemaFonts.serif,
    fontSize: 15,
    color: CinemaColors.text,
    borderBottomWidth: 1,
    borderBottomColor: CinemaColors.plaqueBorder,
  },
  count: {
    fontFamily: CinemaFonts.serif,
    fontSize: 12,
    color: CinemaColors.brassDim,
  },
  venue: {
    fontFamily: CinemaFonts.sign,
    fontSize: 14,
    letterSpacing: 4,
    color: CinemaColors.brassDim,
  },
  marquee: {
    fontFamily: CinemaFonts.sign,
    fontSize: 46,
    letterSpacing: 2,
    color: CinemaColors.marquee,
    textShadowColor: CinemaColors.marqueeGlow,
    textShadowRadius: 14,
    textShadowOffset: { width: 0, height: 0 },
  },
  ticket: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: CinemaColors.brass,
    fontFamily: CinemaFonts.serifBold,
    fontSize: 13,
    color: CinemaColors.brass,
  },
  empty: {
    marginTop: 120,
    textAlign: 'center',
    fontFamily: CinemaFonts.serif,
    color: CinemaColors.brassDim,
  },
  darkness: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000',
  },
});
