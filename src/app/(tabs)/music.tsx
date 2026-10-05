import { Canvas, ColorMatrix, Fill, FractalNoise } from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, router, useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState } from 'react';
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
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FilmGrain } from '@/components/cinema/film-grain';
import { StarRating } from '@/components/cinema/star-rating';
import { CinemaFonts } from '@/components/cinema/theme';
import { CrateSleeve } from '@/components/record-shop/crate-sleeve';
import { RecordColors } from '@/components/record-shop/theme';
import { useDb } from '@/lib/database';
import { deleteWork, listWorks, type WorkSummary } from '@/lib/db';

const SEARCH_DEBOUNCE_MS = 200;
const FORMAT_LABELS: Record<string, string> = { single: '싱글', ep: 'EP', album: '정규' };
// Tints noise into dark brown wood grain at low alpha
const WOOD_GRAIN = [0.3, 0, 0, 0, 0.08, 0.18, 0, 0, 0, 0.04, 0.08, 0, 0, 0, 0.01, 0, 0, 0, 0, 0.28];

export default function RecordShopScreen() {
  const db = useDb();
  const { width } = useWindowDimensions();
  const [works, setWorks] = useState<WorkSummary[]>([]);
  const [centered, setCentered] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const listRef = useRef<FlatList<WorkSummary>>(null);

  const sleeveSize = width * 0.56;
  // Wider than a sleeve so neighbors never cover the one being pulled out
  const interval = sleeveSize * 1.06;
  // Room above the sleeves for the record sliding up out of the centered one
  const pullRoom = sleeveSize * 0.3;
  const sidePadding = (width - interval) / 2;

  const scrollX = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollX.set(e.contentOffset.x);
  });

  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const loadWorks = useCallback(() => {
    listWorks(db, 'music', searchQuery).then(setWorks);
  }, [db, searchQuery]);

  useFocusEffect(loadWorks);

  const current = works[Math.min(centered, works.length - 1)];

  function closeSearch() {
    setSearchOpen(false);
    setQuery('');
  }

  function onSleevePress(index: number) {
    if (index !== centered) {
      // Flip to it first; a second tap pulls it out
      listRef.current?.scrollToOffset({ offset: index * interval, animated: true });
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: '/music/work/[id]', params: { id: works[index].id } });
  }

  function openSleeveMenu(work: WorkSummary) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    ActionSheetIOS.showActionSheetWithOptions(
      { title: work.title, options: ['상자에서 빼기', '취소'], destructiveButtonIndex: 0, cancelButtonIndex: 1 },
      (index) => {
        if (index !== 0) return;
        Alert.alert('상자에서 뺄까요?', '이 앨범의 기록이 모두 지워지고 되돌릴 수 없어요', [
          { text: '취소', style: 'cancel' },
          {
            text: '빼기',
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteWork(db, work.id);
                loadWorks();
              } catch {
                Alert.alert('빼지 못했어요', '잠시 후 다시 시도해주세요');
              }
            },
          },
        ]);
      },
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.flex} edges={['top']}>
        <View style={styles.header}>
          <Pressable style={styles.settings} onPress={() => router.push('/settings')} hitSlop={12}>
            <SymbolView name="gearshape" tintColor={RecordColors.textDim} size={20} />
          </Pressable>
          {/* Neon shop sign */}
          <Text style={styles.signSmall}>YEOUN</Text>
          <Text style={styles.sign}>RECORDS</Text>

          <View style={styles.headerRow}>
            <Text style={styles.count}>상자 속 {works.length}장</Text>
            <View style={styles.actions}>
              {!searchOpen && (
                <Pressable onPress={() => setSearchOpen(true)} hitSlop={8}>
                  <Text style={styles.action}>찾기</Text>
                </Pressable>
              )}
              <Link href="/music/search" style={styles.add}>
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
                placeholder="앨범, 아티스트, 감상으로 찾기"
                placeholderTextColor={RecordColors.textDim}
                selectionColor={RecordColors.neon}
                keyboardAppearance="dark"
                returnKeyType="search"
                autoFocus
              />
              <Pressable onPress={closeSearch} hitSlop={8}>
                <Text style={styles.action}>닫기</Text>
              </Pressable>
            </View>
          )}
        </View>

        {works.length === 0 ? (
          <Text style={styles.empty}>
            {searchQuery.trim() ? `'${searchQuery.trim()}'에 맞는 앨범이 없어요` : '아직 상자가 비어 있어요'}
          </Text>
        ) : (
          <View style={styles.crateArea}>
            <Animated.FlatList
              ref={listRef}
              data={works}
              keyExtractor={(item) => String(item.id)}
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={interval}
              decelerationRate="fast"
              style={{ flexGrow: 0, height: sleeveSize + pullRoom }}
              contentContainerStyle={{ paddingHorizontal: sidePadding, paddingTop: pullRoom }}
              onScroll={onScroll}
              scrollEventThrottle={16}
              onMomentumScrollEnd={(e) => {
                const index = Math.round(e.nativeEvent.contentOffset.x / interval);
                if (index !== centered) Haptics.selectionAsync();
                setCentered(index);
              }}
              renderItem={({ item, index }) => (
                <CrateSleeve
                  work={item}
                  index={index}
                  size={sleeveSize}
                  interval={interval}
                  scrollX={scrollX}
                  onPress={() => onSleevePress(index)}
                  onLongPress={() => openSleeveMenu(item)}
                />
              )}
            />
            {/* Front panel of the wooden crate, hiding the bottom of the sleeves */}
            <View
              style={[styles.crate, { height: sleeveSize * 0.3, marginTop: -sleeveSize * 0.24 }]}
              pointerEvents="none">
              {/* Same walnut as the turntable: gradient plus long grain */}
              <LinearGradient
                style={StyleSheet.absoluteFill}
                colors={['#73492b', '#5a381f', '#4a2c18']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <Canvas style={StyleSheet.absoluteFill}>
                <Fill>
                  <FractalNoise freqX={0.45} freqY={0.01} octaves={3} />
                  <ColorMatrix matrix={WOOD_GRAIN} />
                </Fill>
              </Canvas>
              <View style={styles.crateSlat} />
              <Text style={styles.crateStamp}>YEOUN · NEW ARRIVALS</Text>
            </View>

            {current && (
              <View style={styles.info}>
                <Text style={styles.title} numberOfLines={2}>
                  {current.title}
                </Text>
                <Text style={styles.artist}>
                  {[current.format && FORMAT_LABELS[current.format], current.subtitle].filter(Boolean).join('  ·  ')}
                </Text>
                <Text style={styles.meta}>마지막으로 들은 날 {current.lastExperiencedOn.replaceAll('-', '.')}</Text>
                {current.lastRating !== null && (
                  <StarRating value={current.lastRating} size={14} filledColor={RecordColors.neon} emptyColor={RecordColors.hairline} />
                )}
              </View>
            )}
          </View>
        )}
      </SafeAreaView>
      <FilmGrain opacity={0.05} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: RecordColors.wall,
  },
  flex: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  settings: {
    alignSelf: 'flex-end',
  },
  signSmall: {
    fontFamily: CinemaFonts.sign,
    fontSize: 13,
    letterSpacing: 6,
    color: RecordColors.textDim,
  },
  sign: {
    fontFamily: CinemaFonts.sign,
    fontSize: 54,
    letterSpacing: 6,
    color: RecordColors.neon,
    textShadowColor: RecordColors.neonGlow,
    textShadowRadius: 18,
    textShadowOffset: { width: 0, height: 0 },
  },
  headerRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
  },
  count: {
    fontFamily: CinemaFonts.serif,
    fontSize: 12,
    color: RecordColors.textDim,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  action: {
    fontFamily: CinemaFonts.serif,
    fontSize: 13,
    color: RecordColors.textDim,
  },
  add: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: RecordColors.neon,
    fontFamily: CinemaFonts.serifBold,
    fontSize: 13,
    color: RecordColors.neon,
  },
  searchRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 14,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 8,
    fontFamily: CinemaFonts.serif,
    fontSize: 15,
    color: RecordColors.text,
    borderBottomWidth: 1,
    borderBottomColor: RecordColors.hairline,
  },
  crateArea: {
    flex: 1,
    marginTop: 8,
  },
  // Full width so leaning neighbors at the edges still sit inside the crate
  crate: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    backgroundColor: RecordColors.crate,
    borderTopWidth: 3,
    borderTopColor: RecordColors.crateEdge,
    shadowColor: '#000',
    shadowOpacity: 0.7,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
  },
  crateSlat: {
    alignSelf: 'stretch',
    height: 2,
    marginHorizontal: 12,
    backgroundColor: RecordColors.crateDark,
  },
  crateStamp: {
    fontFamily: CinemaFonts.sign,
    fontSize: 12,
    letterSpacing: 4,
    color: 'rgba(0, 0, 0, 0.35)',
  },
  info: {
    alignItems: 'center',
    gap: 6,
    marginTop: 22,
    paddingHorizontal: 32,
  },
  title: {
    textAlign: 'center',
    fontFamily: CinemaFonts.serifBold,
    fontSize: 18,
    color: RecordColors.text,
  },
  artist: {
    fontFamily: CinemaFonts.serif,
    fontSize: 13,
    color: RecordColors.textDim,
  },
  meta: {
    fontFamily: CinemaFonts.serif,
    fontSize: 11,
    color: RecordColors.textDim,
  },
  empty: {
    marginTop: 120,
    textAlign: 'center',
    fontFamily: CinemaFonts.serif,
    color: RecordColors.textDim,
  },
});
