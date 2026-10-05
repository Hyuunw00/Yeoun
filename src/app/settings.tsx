import type { Session } from '@supabase/supabase-js';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CinemaColors, CinemaFonts } from '@/components/cinema/theme';
import { isLinked, overwriteBackupAndLink, restoreAndLink } from '@/lib/auto-backup';
import { backupNow, getLastBackupAt, hasRemoteData } from '@/lib/backup';
import { useDb } from '@/lib/database';
import { signInWithGoogle, signOut, supabase } from '@/lib/supabase';

type BackupState = {
  linked: boolean;
  // null when the server couldn't be reached
  remoteExists: boolean | null;
  lastBackupAt: string | null;
};

function formatTime(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function loadBackupState(userId: string): Promise<BackupState> {
  const [linked, remoteExists, lastBackupAt] = await Promise.all([
    isLinked(userId),
    hasRemoteData().catch(() => null),
    getLastBackupAt(),
  ]);
  return { linked, remoteExists, lastBackupAt };
}

export default function SettingsScreen() {
  const db = useDb();
  const [session, setSession] = useState<Session | null>(null);
  const [backup, setBackup] = useState<BackupState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // Short confirmation shown after a manual backup, since it usually finishes instantly
  const [justBackedUp, setJustBackedUp] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  // Bumped to reload the backup state after an action
  const [backupVersion, setBackupVersion] = useState(0);
  const refreshBackup = useCallback(() => setBackupVersion((v) => v + 1), []);

  useEffect(() => {
    // Signed out: the backup section isn't shown, so there's nothing to load
    const userId = session?.user.id;
    if (!userId) return;
    let active = true;
    loadBackupState(userId).then((state) => {
      if (active) setBackup(state);
    });
    return () => {
      active = false;
    };
  }, [session, backupVersion]);

  async function run(label: string, task: () => Promise<unknown>, failMessage: string) {
    setBusy(label);
    try {
      await task();
    } catch (e) {
      console.warn(label, e);
      Alert.alert(failMessage, '잠시 후 다시 시도해주세요');
    } finally {
      setBusy(null);
      refreshBackup();
    }
  }

  const login = () =>
    run(
      'login',
      async () => {
        await signInWithGoogle();
        // The initial upload runs in the background; give it a moment before refreshing
        setTimeout(refreshBackup, 2500);
      },
      '로그인하지 못했어요',
    );

  const logout = () =>
    Alert.alert('로그아웃할까요?', '폰의 기록은 그대로 남고, 서버 반영만 멈춰요', [
      { text: '취소', style: 'cancel' },
      { text: '로그아웃', style: 'destructive', onPress: () => run('logout', signOut, '로그아웃하지 못했어요') },
    ]);

  const confirmRestore = () =>
    Alert.alert('서버의 기록으로 복원할까요?', '지금 폰에 있는 기록은 서버의 기록으로 모두 바뀌고, 서버에 반영되지 않은 내용은 사라져요', [
      { text: '취소', style: 'cancel' },
      {
        text: '복원',
        style: 'destructive',
        onPress: () =>
          run(
            'restore',
            async () => {
              const { failedPhotos } = await restoreAndLink(db);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              if (failedPhotos > 0) {
                Alert.alert('복원했어요', `사진 ${failedPhotos}장은 가져오지 못했어요`);
              }
            },
            '복원하지 못했어요',
          ),
      },
    ]);

  const confirmOverwrite = () =>
    Alert.alert('이 폰의 기록으로 백업할까요?', '계정에 있던 이전 백업은 이 폰의 기록으로 바뀌어요', [
      { text: '취소', style: 'cancel' },
      {
        text: '백업',
        style: 'destructive',
        onPress: () => run('overwrite', () => overwriteBackupAndLink(db), '백업하지 못했어요'),
      },
    ]);

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={styles.title}>설정</Text>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.close}>닫기</Text>
          </Pressable>
        </View>

        <Text style={styles.section}>계정</Text>
        {session ? (
          <View style={styles.card}>
            <Text style={styles.body}>{session.user.email}</Text>
            <Pressable onPress={logout} disabled={!!busy}>
              <Text style={styles.link}>로그아웃</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.body}>로그인하면 지금까지의 기록이 서버 DB로 올라가고, 앞으로의 기록도 자동으로 반영돼요.</Text>
            <Text style={styles.hint}>로그인하지 않아도 앱은 지금처럼 이 폰 안에서만 동작해요.</Text>
            <Pressable style={styles.button} onPress={login} disabled={!!busy}>
              {busy === 'login' ? (
                <ActivityIndicator color={CinemaColors.theater} />
              ) : (
                <Text style={styles.buttonText}>Google로 로그인</Text>
              )}
            </Pressable>
          </View>
        )}

        {session && backup && (
          <>
            <Text style={styles.section}>백업</Text>
            <View style={styles.card}>
              {backup.linked ? (
                <>
                  <Text style={styles.body}>
                    {backup.lastBackupAt ? `마지막 반영 ${formatTime(backup.lastBackupAt)}` : '백업 준비 중'}
                  </Text>
                  <Text style={styles.hint}>기록을 남기거나 고치거나 지울 때마다 서버 DB에 자동으로 반영돼요.</Text>
                  <Pressable
                    style={styles.button}
                    disabled={!!busy}
                    onPress={() =>
                      run(
                        'backup',
                        async () => {
                          await backupNow(db);
                          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                          setJustBackedUp(true);
                          setTimeout(() => setJustBackedUp(false), 2500);
                        },
                        '백업하지 못했어요',
                      )
                    }>
                    {busy === 'backup' ? (
                      <ActivityIndicator color={CinemaColors.theater} />
                    ) : (
                      <Text style={styles.buttonText}>{justBackedUp ? '백업했어요 ✓' : '지금 백업하기'}</Text>
                    )}
                  </Pressable>
                </>
              ) : backup.remoteExists ? (
                <>
                  <Text style={styles.body}>이 계정의 서버 DB에 이미 기록이 있어요.</Text>
                  <Text style={styles.hint}>서버의 기록을 이 폰으로 가져오거나, 이 폰의 기록으로 서버를 바꿀 수 있어요.</Text>
                  <Pressable style={styles.button} onPress={confirmRestore} disabled={!!busy}>
                    {busy === 'restore' ? (
                      <ActivityIndicator color={CinemaColors.theater} />
                    ) : (
                      <Text style={styles.buttonText}>백업에서 복원</Text>
                    )}
                  </Pressable>
                  <Pressable onPress={confirmOverwrite} disabled={!!busy}>
                    <Text style={styles.link}>이 폰의 기록으로 백업하기</Text>
                  </Pressable>
                </>
              ) : backup.remoteExists === null ? (
                <>
                  <Text style={styles.body}>서버에 연결하지 못했어요.</Text>
                  <Pressable onPress={refreshBackup} disabled={!!busy}>
                    <Text style={styles.link}>다시 시도</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={styles.body}>아직 서버에 반영되지 않았어요.</Text>
                  <Text style={styles.hint}>이 폰의 기록을 서버 DB로 올리면 이후부터 자동으로 반영돼요.</Text>
                  <Pressable style={styles.button} onPress={() => run('overwrite', () => overwriteBackupAndLink(db), '서버에 올리지 못했어요')} disabled={!!busy}>
                    {busy === 'overwrite' ? (
                      <ActivityIndicator color={CinemaColors.theater} />
                    ) : (
                      <Text style={styles.buttonText}>서버에 올리기</Text>
                    )}
                  </Pressable>
                </>
              )}
            </View>
          </>
        )}
      </SafeAreaView>
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
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  title: {
    fontFamily: CinemaFonts.serifBold,
    fontSize: 20,
    color: CinemaColors.text,
  },
  close: {
    fontFamily: CinemaFonts.serif,
    fontSize: 14,
    color: CinemaColors.textDim,
  },
  section: {
    marginTop: 20,
    marginBottom: 8,
    fontFamily: CinemaFonts.serif,
    fontSize: 12,
    letterSpacing: 2,
    color: CinemaColors.textDim,
  },
  card: {
    gap: 10,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: CinemaColors.hairline,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  body: {
    fontFamily: CinemaFonts.serif,
    fontSize: 14,
    lineHeight: 22,
    color: CinemaColors.text,
  },
  hint: {
    fontFamily: CinemaFonts.serif,
    fontSize: 12,
    lineHeight: 18,
    color: CinemaColors.textDim,
  },
  button: {
    alignItems: 'center',
    marginTop: 6,
    paddingVertical: 12,
    backgroundColor: CinemaColors.brass,
  },
  buttonText: {
    fontFamily: CinemaFonts.serifBold,
    fontSize: 14,
    color: CinemaColors.theater,
  },
  link: {
    fontFamily: CinemaFonts.serif,
    fontSize: 13,
    color: CinemaColors.brass,
  },
});
