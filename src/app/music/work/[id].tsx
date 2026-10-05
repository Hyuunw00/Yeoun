import * as Haptics from 'expo-haptics';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActionSheetIOS, Alert, FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FilmGrain } from '@/components/cinema/film-grain';
import { StarRating } from '@/components/cinema/star-rating';
import { CinemaFonts } from '@/components/cinema/theme';
import { Polaroids } from '@/components/library/polaroids';
import { RecordColors } from '@/components/record-shop/theme';
import { TurntablePlayer } from '@/components/record-shop/turntable-player';
import { useDb } from '@/lib/database';
import { deleteRecord, getWork, listRecords, setWorkFormat, type RecordEntry, type Work } from '@/lib/db';
import { getAlbumTracks, type MusicResult } from '@/lib/itunes';

const formatDate = (date: string) => date.replaceAll('-', '.');

// The album playing on a turntable, with each listening written up as liner notes
export default function AlbumScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDb();
  const { width } = useWindowDimensions();
  const [work, setWork] = useState<Work | null>(null);
  const [records, setRecords] = useState<RecordEntry[]>([]);

  const load = useCallback(() => {
    const workId = Number(id);
    getWork(db, workId)
      .then(async (loaded) => {
        setWork(loaded);
        // Albums saved before formats were stored: look it up once from iTunes
        if (!loaded || loaded.format) return;
        const { format } = await getAlbumTracks(loaded.externalId);
        if (!format) return;
        await setWorkFormat(db, workId, format);
        setWork(await getWork(db, workId));
      })
      .catch(() => {});
    listRecords(db, workId).then(setRecords);
  }, [db, id]);

  useFocusEffect(load);

  function editRecord(record: RecordEntry) {
    if (!work) return;
    router.push({
      pathname: '/music/write',
      params: { id: work.externalId, recordId: record.id, workId: work.id },
    });
  }

  function confirmDelete(record: RecordEntry) {
    Alert.alert('이 기록을 지울까요?', '지운 기록은 되돌릴 수 없어요', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            const workRemoved = await deleteRecord(db, record.id);
            // The album leaves the crate with its last record
            if (workRemoved) router.back();
            else load();
          } catch {
            Alert.alert('지우지 못했어요', '잠시 후 다시 시도해주세요');
          }
        },
      },
    ]);
  }

  function openRecordMenu(record: RecordEntry) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    ActionSheetIOS.showActionSheetWithOptions(
      { options: ['수정', '삭제', '취소'], destructiveButtonIndex: 1, cancelButtonIndex: 2 },
      (index) => {
        if (index === 0) editRecord(record);
        else if (index === 1) confirmDelete(record);
      },
    );
  }

  // Listening again starts a new record from the saved album, shaped like a search result
  function listenAgain() {
    if (!work) return;
    const music: MusicResult = {
      kind: 'album',
      format: (work.format as MusicResult['format']) ?? 'album',
      externalId: work.externalId,
      albumTitle: work.title,
      artist: work.subtitle ?? '',
      trackName: null,
      releaseDate: work.releaseDate,
      artworkUrl: work.imageUrl,
    };
    router.push({ pathname: '/music/write', params: { id: work.externalId, music: JSON.stringify(music), from: 'work' } });
  }

  const platter = width * 0.62;
  // The track that stuck in the most recent listening gets cued first
  const latestTrack = [...records].reverse().find((r) => r.track)?.track ?? null;

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.flex} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.headerButton}>상자로</Text>
          </Pressable>
        </View>

        <FlatList
          data={records}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            work && (
              <Animated.View entering={FadeIn.duration(700)} style={styles.top}>
                <View style={styles.player}>
                  <TurntablePlayer
                    externalId={work.externalId}
                    albumTitle={work.title}
                    artist={work.subtitle}
                    artworkUrl={work.imageUrl}
                    preferredTrack={latestTrack}
                    size={platter}
                    single={work.format === 'single'}
                  />
                </View>
                <Text style={styles.title}>{work.title}</Text>
                <Text style={styles.artist}>
                  {[work.subtitle, work.year].filter(Boolean).join('  ·  ')}
                </Text>
              </Animated.View>
            )
          }
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(250 + index * 140).duration(600)}>
              <Pressable style={styles.notes} onPress={() => editRecord(item)} onLongPress={() => openRecordMenu(item)}>
                <View style={styles.notesHead}>
                  <Text style={styles.side}>SIDE {String.fromCharCode(65 + (index % 26))}</Text>
                  <Text style={styles.notesDate}>
                    {index + 1}번째 재생 · {formatDate(item.experiencedOn)}
                  </Text>
                </View>
                {item.rating !== null && (
                  <StarRating value={item.rating} size={13} filledColor="#c0612f" emptyColor={RecordColors.rule} />
                )}
                {!!item.track && <Text style={styles.track}>♪ {item.track}</Text>}
                {!!item.moment && <Text style={styles.moment}>— {item.moment}</Text>}
                {!!item.body && <Text style={styles.body}>{item.body}</Text>}
                {item.photos.length > 0 && <Polaroids photos={item.photos} />}
              </Pressable>
            </Animated.View>
          )}
          ListFooterComponent={
            work && (
              <Pressable onPress={listenAgain} style={styles.again}>
                <Text style={styles.againText}>다시 듣고 기록하기</Text>
              </Pressable>
            )
          }
        />
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
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerButton: {
    fontFamily: CinemaFonts.serif,
    fontSize: 14,
    color: RecordColors.textDim,
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 80,
  },
  top: {
    alignItems: 'center',
    gap: 8,
    paddingBottom: 32,
  },
  player: {
    alignSelf: 'stretch',
    marginBottom: 20,
  },
  title: {
    textAlign: 'center',
    fontFamily: CinemaFonts.serifBold,
    fontSize: 20,
    color: RecordColors.text,
  },
  artist: {
    fontFamily: CinemaFonts.serif,
    fontSize: 13,
    color: RecordColors.textDim,
  },
  // Liner notes: a cream paper insert per listening
  notes: {
    gap: 10,
    marginBottom: 16,
    padding: 18,
    backgroundColor: RecordColors.paper,
    borderRadius: 2,
  },
  notesHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  side: {
    fontFamily: CinemaFonts.sign,
    fontSize: 16,
    letterSpacing: 3,
    color: RecordColors.ink,
  },
  notesDate: {
    fontFamily: CinemaFonts.serif,
    fontSize: 11,
    color: RecordColors.inkDim,
  },
  track: {
    fontFamily: CinemaFonts.serifBold,
    fontSize: 14,
    color: RecordColors.ink,
  },
  moment: {
    fontFamily: CinemaFonts.serif,
    fontSize: 13,
    fontStyle: 'italic',
    color: RecordColors.inkDim,
  },
  body: {
    fontFamily: CinemaFonts.serif,
    fontSize: 15,
    lineHeight: 26,
    color: RecordColors.ink,
  },
  again: {
    alignSelf: 'center',
    marginTop: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: RecordColors.neon,
  },
  againText: {
    fontFamily: CinemaFonts.serifBold,
    fontSize: 13,
    color: RecordColors.neon,
  },
});
