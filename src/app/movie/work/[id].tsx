import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useDb } from '@/lib/database';
import { useCallback, useState } from 'react';
import { ActionSheetIOS, Alert, FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FilmGrain } from '@/components/cinema/film-grain';
import { FilmStrip } from '@/components/cinema/film-strip';
import { ScreenLight } from '@/components/cinema/screen-light';
import { StarRating } from '@/components/cinema/star-rating';
import { CinemaColors, CinemaFonts } from '@/components/cinema/theme';
import { deleteRecord, getWork, listRecords, setReleaseDate, type RecordEntry, type Work } from '@/lib/db';
import { getTitle, isSeries, parseExternalId } from '@/lib/tmdb';

const CREDIT_STAGGER_MS = 180;

export default function MovieWorkScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDb();
  const { width } = useWindowDimensions();
  const [work, setWork] = useState<Work | null>(null);
  const [records, setRecords] = useState<RecordEntry[]>([]);

  const load = useCallback(() => {
    const workId = Number(id);
    getWork(db, workId).then(async (loaded) => {
      setWork(loaded);
      // Works saved before release dates were stored: fill it in once from TMDB
      if (loaded && !loaded.releaseDate) {
        const { mediaType, id: tmdbId } = parseExternalId(loaded.externalId);
        const title = await getTitle(mediaType, tmdbId).catch(() => null);
        if (title?.releaseDate) {
          await setReleaseDate(db, workId, title.releaseDate);
          setWork({ ...loaded, releaseDate: title.releaseDate });
        }
      }
    });
    listRecords(db, workId).then(setRecords);
  }, [db, id]);

  useFocusEffect(load);

  function confirmDelete(record: RecordEntry) {
    Alert.alert('이 기록을 지울까요?', '지운 기록은 되돌릴 수 없어요', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            const workRemoved = await deleteRecord(db, record.id);
            // The poster comes off the wall with its last record
            if (workRemoved) router.back();
            else load();
          } catch {
            Alert.alert('지우지 못했어요', '잠시 후 다시 시도해주세요');
          }
        },
      },
    ]);
  }

  function editRecord(record: RecordEntry) {
    if (!work) return;
    router.push({
      pathname: '/movie/write',
      params: { id: work.externalId, recordId: record.id, workId: work.id },
    });
  }

  function openRecordMenu(record: RecordEntry) {
    if (!work) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    ActionSheetIOS.showActionSheetWithOptions(
      { options: ['수정', '삭제', '취소'], destructiveButtonIndex: 1, cancelButtonIndex: 2 },
      (index) => {
        if (index === 0) {
          editRecord(record);
        } else if (index === 1) {
          confirmDelete(record);
        }
      },
    );
  }

  const rerecord = () =>
    work && router.push({ pathname: '/movie/write', params: { id: work.externalId, from: 'work' } });

  return (
    <View style={styles.container}>
      <ScreenLight />

      <SafeAreaView style={styles.flex} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.headerButton}>로비로</Text>
          </Pressable>
        </View>

        <FlatList
          data={records}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.credits}
          ListHeaderComponent={
            work && (
              <Animated.View entering={FadeIn.duration(900)} style={styles.screen}>
                {work.imageUrl ? (
                  <Image
                    source={work.imageUrl}
                    style={[styles.poster, { width: width * 0.5 }]}
                    contentFit="cover"
                  />
                ) : (
                  <View style={[styles.poster, { width: width * 0.5 }]} />
                )}
                <Text style={styles.title}>{work.title}</Text>
                <Text style={styles.subtitle}>
                  {[
                    isSeries(work.externalId) && 'SERIES',
                    work.subtitle,
                    work.releaseDate
                      ? `${isSeries(work.externalId) ? '첫 방영' : '개봉'} ${work.releaseDate.replaceAll('-', '.')}`
                      : work.year,
                  ]
                    .filter(Boolean)
                    .join('  ·  ')}
                </Text>
              </Animated.View>
            )
          }
          // Each record rolls up like an end credit
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(400 + index * CREDIT_STAGGER_MS).duration(800)}>
              <Pressable
                style={styles.credit}
                onPress={() => editRecord(item)}
                onLongPress={() => openRecordMenu(item)}>
                <Text style={styles.creditLabel}>
                  {isSeries(work?.externalId ?? '') ? `${index + 1}번째 기록` : `${index + 1}회차 관람`}
                </Text>
                <Text style={styles.creditDate}>{item.experiencedOn.replaceAll('-', '.')}</Text>
                {!!item.episode && <Text style={styles.creditEpisode}>{item.episode}</Text>}
                {item.rating !== null && (
                  <View style={styles.creditRating}>
                    <StarRating value={item.rating} size={14} />
                  </View>
                )}
                {!!item.body && <Text style={styles.creditBody}>{item.body}</Text>}
                {item.photos.length > 0 && (
                  <View style={styles.creditPhotos}>
                    <FilmStrip photos={item.photos} />
                  </View>
                )}
              </Pressable>
            </Animated.View>
          )}
          ListFooterComponent={
            work && (
              <Animated.View
                entering={FadeIn.delay(400 + records.length * CREDIT_STAGGER_MS).duration(800)}
                style={styles.footer}>
                <Text style={styles.theEnd}>THE END</Text>
                <Pressable onPress={rerecord} style={styles.rerecord}>
                  <Text style={styles.rerecordText}>다시 기록하기</Text>
                </Pressable>
              </Animated.View>
            )
          }
        />
      </SafeAreaView>

      <FilmGrain opacity={0.06} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CinemaColors.theater,
  },
  flex: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerButton: {
    fontFamily: CinemaFonts.serif,
    fontSize: 14,
    color: CinemaColors.textDim,
  },
  credits: {
    paddingHorizontal: 32,
    paddingBottom: 80,
  },
  screen: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 56,
  },
  poster: {
    aspectRatio: 2 / 3,
    backgroundColor: '#111',
    shadowColor: CinemaColors.screenLight,
    shadowOpacity: 0.35,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 0 },
  },
  title: {
    marginTop: 28,
    textAlign: 'center',
    fontFamily: CinemaFonts.serifBold,
    fontSize: 22,
    color: CinemaColors.text,
  },
  subtitle: {
    marginTop: 8,
    textAlign: 'center',
    fontFamily: CinemaFonts.serif,
    fontSize: 12,
    color: CinemaColors.textDim,
  },
  credit: {
    alignItems: 'center',
    marginBottom: 56,
  },
  creditLabel: {
    fontFamily: CinemaFonts.serif,
    fontSize: 11,
    letterSpacing: 3,
    color: CinemaColors.textDim,
  },
  creditDate: {
    marginTop: 4,
    fontFamily: CinemaFonts.sign,
    fontSize: 22,
    letterSpacing: 2,
    color: CinemaColors.brass,
  },
  creditEpisode: {
    marginTop: 4,
    fontFamily: CinemaFonts.serif,
    fontSize: 12,
    color: CinemaColors.brassDim,
  },
  creditRating: {
    marginTop: 8,
  },
  creditBody: {
    marginTop: 18,
    textAlign: 'center',
    fontFamily: CinemaFonts.serif,
    fontSize: 16,
    lineHeight: 28,
    color: CinemaColors.text,
  },
  creditPhotos: {
    alignSelf: 'stretch',
    marginTop: 20,
  },
  footer: {
    alignItems: 'center',
    marginTop: 8,
    gap: 28,
  },
  theEnd: {
    fontFamily: CinemaFonts.sign,
    fontSize: 28,
    letterSpacing: 6,
    color: CinemaColors.textDim,
  },
  rerecord: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: CinemaColors.brass,
  },
  rerecordText: {
    fontFamily: CinemaFonts.serifBold,
    fontSize: 13,
    color: CinemaColors.brass,
  },
});
