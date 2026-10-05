import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActionSheetIOS, Alert, FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FilmGrain } from '@/components/cinema/film-grain';
import { FilmStrip } from '@/components/cinema/film-strip';
import { ScreenLight } from '@/components/cinema/screen-light';
import { CinemaColors, CinemaFonts } from '@/components/cinema/theme';
import { TicketStub } from '@/components/cinema/ticket-stub';
import { useDb } from '@/lib/database';
import { deleteRecord, getWork, listRecords, setWorkDetails, type RecordEntry, type Work } from '@/lib/db';
import { backdropUrl, getTitleDetails, isSeries, parseExternalId, type Credits } from '@/lib/tmdb';

const CREDIT_STAGGER_MS = 180;
// Cinemascope bars above and below the picture
const LETTERBOX = 34;
const TICKET_TILTS = [-3, 2, -1.5, 3];

function parseCredits(json: string | null): Credits | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed?.directors) && Array.isArray(parsed?.cast) ? (parsed as Credits) : null;
  } catch {
    return null;
  }
}

export default function MovieWorkScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDb();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [work, setWork] = useState<Work | null>(null);
  const [records, setRecords] = useState<RecordEntry[]>([]);
  // Avoids a second TMDB request when the screen refocuses before the first returns
  const fetchingDetails = useRef(false);

  const load = useCallback(() => {
    const workId = Number(id);
    getWork(db, workId)
      .then(async (loaded) => {
        setWork(loaded);
        // Fetch the wide still and credits from TMDB once, then keep them in the DB
        if (!loaded || loaded.credits !== null || fetchingDetails.current) return;
        fetchingDetails.current = true;
        try {
          const { mediaType, id: tmdbId } = parseExternalId(loaded.externalId);
          const details = await getTitleDetails(mediaType, tmdbId).catch(() => null);
          if (!details) return;
          await setWorkDetails(db, workId, {
            releaseDate: details.releaseDate,
            backdropUrl: details.backdropPath ? backdropUrl(details.backdropPath) : null,
            credits: JSON.stringify(details.credits),
          });
          // Re-read rather than patching the snapshot, which may be stale by now
          setWork(await getWork(db, workId));
        } finally {
          fetchingDetails.current = false;
        }
      })
      .catch(() => {});
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

  const series = !!work && isSeries(work.externalId);
  const credits = parseCredits(work?.credits ?? null);
  const screenWidth = width - 32;

  return (
    <View style={styles.container}>
      <ScreenLight />

      <FlatList
        data={records}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={[
          styles.credits,
          { paddingTop: insets.top + LETTERBOX + 16, paddingBottom: LETTERBOX + 80 },
        ]}
        ListHeaderComponent={
          work && (
            <Animated.View entering={FadeIn.duration(900)} style={styles.screen}>
              {/* The wide still fills the screen; fall back to the poster */}
              {work.backdropUrl ? (
                <Image
                  source={work.backdropUrl}
                  style={[styles.backdrop, { width: screenWidth, height: (screenWidth * 9) / 16 }]}
                  contentFit="cover"
                  transition={400}
                />
              ) : work.imageUrl ? (
                <Image source={work.imageUrl} style={[styles.poster, { width: width * 0.5 }]} contentFit="cover" />
              ) : (
                <View style={[styles.poster, { width: width * 0.5 }]} />
              )}
              <Text style={styles.title}>{work.title}</Text>
              <Text style={styles.subtitle}>
                {[
                  series && 'SERIES',
                  work.subtitle,
                  work.releaseDate
                    ? `${series ? '첫 방영' : '개봉'} ${work.releaseDate.replaceAll('-', '.')}`
                    : work.year,
                ]
                  .filter(Boolean)
                  .join('  ·  ')}
              </Text>
            </Animated.View>
          )
        }
        // Each viewing is a ticket stub followed by what I wrote, rolling up like an end credit
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(400 + index * CREDIT_STAGGER_MS).duration(800)}>
            <Pressable
              style={styles.credit}
              onPress={() => editRecord(item)}
              onLongPress={() => openRecordMenu(item)}>
              <TicketStub
                label={series ? `${index + 1}번째` : `${index + 1}회차`}
                date={item.experiencedOn}
                episode={item.episode}
                rating={item.rating}
                tilt={TICKET_TILTS[index % TICKET_TILTS.length]}
              />
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
              {credits && credits.directors.length > 0 && (
                <View style={styles.role}>
                  <Text style={styles.roleTitle}>{series ? '크리에이터' : '감독'}</Text>
                  {credits.directors.map((name) => (
                    <Text key={name} style={styles.roleName}>
                      {name}
                    </Text>
                  ))}
                </View>
              )}
              {credits && credits.cast.length > 0 && (
                <View style={styles.role}>
                  <Text style={styles.roleTitle}>출연</Text>
                  {/* Character on the left, actor on the right, like real end credits */}
                  {credits.cast.map((c, i) => (
                    <View key={`${i}-${c.name}`} style={styles.castRow}>
                      <Text style={styles.castCharacter} numberOfLines={1}>
                        {c.character}
                      </Text>
                      <Text style={styles.castName} numberOfLines={1}>
                        {c.name}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
              <Text style={styles.theEnd}>THE END</Text>
              <Pressable onPress={rerecord} style={styles.rerecord}>
                <Text style={styles.rerecordText}>다시 기록하기</Text>
              </Pressable>
            </Animated.View>
          )
        }
      />

      <FilmGrain opacity={0.06} />

      {/* Letterbox bars; the top one also holds the way back */}
      <View style={[styles.bar, { top: 0, height: insets.top + LETTERBOX }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
          <Text style={styles.headerButton}>로비로</Text>
        </Pressable>
      </View>
      <View style={[styles.bar, { bottom: 0, height: LETTERBOX }]} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CinemaColors.theater,
  },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    justifyContent: 'flex-end',
    backgroundColor: '#000',
  },
  back: {
    alignSelf: 'flex-start',
    marginLeft: 20,
    marginBottom: 9,
  },
  headerButton: {
    fontFamily: CinemaFonts.serif,
    fontSize: 14,
    color: CinemaColors.textDim,
  },
  credits: {
    paddingHorizontal: 16,
  },
  screen: {
    alignItems: 'center',
    paddingBottom: 48,
  },
  backdrop: {
    backgroundColor: '#111',
    shadowColor: CinemaColors.screenLight,
    shadowOpacity: 0.35,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 0 },
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
    gap: 22,
    marginBottom: 56,
    paddingHorizontal: 16,
  },
  creditBody: {
    textAlign: 'center',
    fontFamily: CinemaFonts.serif,
    fontSize: 16,
    lineHeight: 28,
    color: CinemaColors.text,
  },
  creditPhotos: {
    alignSelf: 'stretch',
  },
  footer: {
    alignItems: 'center',
    marginTop: 8,
    gap: 28,
  },
  role: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: 6,
  },
  roleTitle: {
    marginBottom: 4,
    fontFamily: CinemaFonts.serif,
    fontSize: 11,
    letterSpacing: 3,
    color: CinemaColors.textDim,
  },
  roleName: {
    fontFamily: CinemaFonts.serifBold,
    fontSize: 15,
    color: CinemaColors.text,
  },
  castRow: {
    flexDirection: 'row',
    gap: 16,
  },
  castCharacter: {
    flex: 1,
    textAlign: 'right',
    fontFamily: CinemaFonts.serif,
    fontSize: 13,
    color: CinemaColors.textDim,
  },
  castName: {
    flex: 1,
    fontFamily: CinemaFonts.serif,
    fontSize: 13,
    color: CinemaColors.text,
  },
  theEnd: {
    marginTop: 16,
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
