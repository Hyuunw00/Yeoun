import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CinemaFonts } from '@/components/cinema/theme';
import { findTrack, getAlbumTracks, listenLinks, type AlbumTrack } from '@/lib/itunes';

import { ListeningBoothSheet } from './listening-booth-sheet';
import { RecordColors } from './theme';
import { TracklistSheet } from './tracklist-sheet';
import { TurntableDeck } from './turntable-deck';

type Props = {
  externalId: string;
  albumTitle: string;
  artist: string | null;
  artworkUrl: string | null;
  // Track to cue first, e.g. the one that stuck in the latest record
  preferredTrack: string | null;
  size: number;
  single?: boolean;
};


// A turntable that plays the album's 30-second iTunes previews. The record spins and
// the tonearm lowers while playing; full songs open in a music app of choice.
export function TurntablePlayer({ externalId, albumTitle, artist, artworkUrl, preferredTrack, size, single = false }: Props) {
  const [tracks, setTracks] = useState<AlbumTrack[]>([]);
  const [appleMusicUrl, setAppleMusicUrl] = useState<string | null>(null);
  const [selected, setSelected] = useState<AlbumTrack | null>(null);
  const [sheet, setSheet] = useState<'tracks' | 'listen' | null>(null);
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const playing = status.playing;

  useEffect(() => {
    // Play even with the ringer switch on silent, like a music app
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    getAlbumTracks(externalId, controller.signal)
      .then((result) => {
        setTracks(result.tracks);
        setAppleMusicUrl(result.appleMusicUrl);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [externalId]);

  const favorite = findTrack(tracks, preferredTrack);
  // The cued track: picked by hand, else the record's favorite, else the first with a preview
  const cued = selected ?? favorite ?? tracks.find((t) => t.previewUrl) ?? null;

  // Back to the start once a preview ends, ready to play again
  useEffect(() => {
    if (status.didJustFinish) player.seekTo(0);
  }, [player, status.didJustFinish]);

  function cue(track: AlbumTrack, autoplay: boolean) {
    setSelected(track);
    if (!track.previewUrl) return;
    player.replace({ uri: track.previewUrl });
    if (autoplay) player.play();
  }

  function togglePlay() {
    if (!cued?.previewUrl) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (playing) {
      player.pause();
      return;
    }
    if (!status.isLoaded || selected !== cued) cue(cued, true);
    else player.play();
  }

  function pickTrack(track: AlbumTrack) {
    setSheet(null);
    Haptics.selectionAsync();
    cue(track, true);
  }

  const links = listenLinks([artist, cued?.name ?? albumTitle].filter(Boolean).join(' '), appleMusicUrl);


  return (
    <View style={styles.container}>
      <TurntableDeck size={size} artworkUrl={artworkUrl} playing={playing} onToggle={togglePlay} single={single} />

      <View style={styles.controls}>
        <Pressable onPress={togglePlay} disabled={!cued?.previewUrl} style={styles.playButton} hitSlop={8}>
          <Text style={styles.playIcon}>{playing ? '❚❚' : '▶'}</Text>
        </Pressable>
        <Pressable onPress={() => setSheet('tracks')} disabled={tracks.length === 0} style={styles.trackInfo}>
          <Text style={styles.previewLabel}>{single ? '30초 미리듣기' : '30초 미리듣기 · 곡 바꾸기'}</Text>
          <Text style={styles.trackName} numberOfLines={1}>
            {cued ? cued.name : tracks.length === 0 ? '수록곡을 불러오는 중…' : '미리듣기가 없어요'}
          </Text>
        </Pressable>
        <Pressable onPress={() => setSheet('listen')} hitSlop={8}>
          <Text style={styles.full}>전곡 듣기</Text>
        </Pressable>
      </View>

      <TracklistSheet
        visible={sheet === 'tracks'}
        albumTitle={albumTitle}
        artworkUrl={artworkUrl}
        tracks={tracks}
        current={cued}
        favorite={favorite}
        onPick={pickTrack}
        onClose={() => setSheet(null)}
      />
      <ListeningBoothSheet
        visible={sheet === 'listen'}
        trackName={cued?.name ?? null}
        albumTitle={albumTitle}
        links={links}
        onClose={() => setSheet(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 16,
  },
  controls: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 4,
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RecordColors.neon,
  },
  playIcon: {
    fontSize: 15,
    color: RecordColors.wall,
  },
  trackInfo: {
    flex: 1,
    gap: 2,
  },
  previewLabel: {
    fontFamily: CinemaFonts.serif,
    fontSize: 10,
    letterSpacing: 1,
    color: RecordColors.textDim,
  },
  trackName: {
    fontFamily: CinemaFonts.serifBold,
    fontSize: 14,
    color: RecordColors.text,
  },
  full: {
    fontFamily: CinemaFonts.serif,
    fontSize: 13,
    color: RecordColors.neon,
  },
});
