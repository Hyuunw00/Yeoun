// Parked: the perspective room home screen. Not routed for now; to be revisited
// (likely with real 3D) once all spaces are done.
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  interpolate,
  SensorType,
  useAnimatedSensor,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { FilmGrain } from '@/components/cinema/film-grain';
import { CinemaFonts } from '@/components/cinema/theme';
import { createRoom } from '@/components/room/geometry';
import { Globe } from '@/components/room/globe';
import {
  LightBeam,
  ProjectionScreen,
  Projector,
  PROJECTOR_LENS,
  PROJECTOR_SIZE,
} from '@/components/room/projector';
import { RoomShell } from '@/components/room/room-shell';
import { RoomColors } from '@/components/room/theme';
import { Turntable, TURNTABLE_SIZE } from '@/components/room/turntable';
import { useDb } from '@/lib/database';
import { listWorks } from '@/lib/db';

const ZOOM_MS = 560;
const ZOOM_SCALE = 2.8;
const RETURN_MS = 420;
// Max parallax shift in px for the nearest layer
const PARALLAX = 16;

type Rect = { x: number; y: number; width: number; height: number };

// Shifts a layer by the smoothed device tilt; nearer layers (higher depth) move more
function useParallax(tiltX: SharedValue<number>, tiltY: SharedValue<number>, depth: number) {
  return useAnimatedStyle(() => ({
    transform: [
      { translateX: tiltX.get() * PARALLAX * depth },
      { translateY: tiltY.get() * PARALLAX * depth },
    ],
  }));
}

export default function RoomScreen() {
  const db = useDb();
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [latestPoster, setLatestPoster] = useState<string | null>(null);
  const [movieCount, setMovieCount] = useState(0);

  const room = useMemo(() => createRoom(W, H), [W, H]);

  // Layout of the objects in screen coordinates
  const screen: Rect = useMemo(() => {
    const width = room.back.width * 0.82;
    return {
      x: room.back.x + (room.back.width - width) / 2,
      y: room.back.y + room.back.height * 0.1,
      width,
      height: width * 0.62,
    };
  }, [room]);
  const projector = { x: W / 2 - PROJECTOR_SIZE.width / 2, y: H * 0.72 };
  const lens = { x: projector.x + PROJECTOR_LENS.x, y: projector.y + PROJECTOR_LENS.y };
  const globeSize = W * 0.17;
  const globeBase = room.project(W * 0.1, H, 0.6);
  const globe = { x: globeBase.x - globeSize / 2, y: globeBase.y - globeSize - 20 };
  const turntable = { x: W * 0.03, y: H * 0.8 };
  const shelfTop = room.project(W, H * 0.22, 0.92);
  const shelfBottom = room.project(W, H, 0.92);
  const shelfFar = room.project(W, H * 0.22, 0.64);
  const shelf: Rect = {
    x: shelfFar.x,
    y: shelfTop.y,
    width: shelfBottom.x - shelfFar.x,
    height: shelfBottom.y - shelfTop.y,
  };

  // Device tilt, low-pass filtered so the room drifts rather than jitters
  const gravity = useAnimatedSensor(SensorType.GRAVITY, { interval: 'auto' });
  const tiltX = useSharedValue(0);
  const tiltY = useSharedValue(0);
  const baseY = useSharedValue<number | null>(null);
  useFrameCallback(() => {
    const { x, y, z } = gravity.sensor.get();
    // Normalize so it works whether the sensor reports in g or m/s²
    const magnitude = Math.hypot(x, y, z);
    if (magnitude === 0) return;
    const nx = x / magnitude;
    const ny = y / magnitude;
    // Vertical tilt is relative to how the phone was held when the room opened
    if (baseY.get() === null) baseY.set(ny);
    const targetX = Math.max(-1, Math.min(1, nx * 2));
    const targetY = Math.max(-1, Math.min(1, (ny - (baseY.get() ?? ny)) * 2));
    tiltX.set(tiltX.get() + (targetX - tiltX.get()) * 0.08);
    tiltY.set(tiltY.get() + (targetY - tiltY.get()) * 0.08);
  });

  const backLayer = useParallax(tiltX, tiltY, 0.3);
  const midLayer = useParallax(tiltX, tiltY, 0.65);
  const frontLayer = useParallax(tiltX, tiltY, 1);

  const zoom = useSharedValue(0);
  const focusX = useSharedValue(W / 2);
  const focusY = useSharedValue(H / 2);

  useFocusEffect(
    useCallback(() => {
      listWorks(db, 'movie').then((works) => {
        setLatestPoster(works[0]?.imageUrl ?? null);
        setMovieCount(works.length);
      });
      // Step back out of the object when returning to the room
      zoom.set(withTiming(0, { duration: RETURN_MS }));
    }, [db, zoom]),
  );

  const enter = useCallback((href: Href) => router.push(href), []);

  function open(href: Href | null, target: Rect) {
    if (!href) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
    focusX.set(target.x + target.width / 2);
    focusY.set(target.y + target.height / 2);
    zoom.set(
      withTiming(1, { duration: ZOOM_MS }, (finished) => {
        if (finished) scheduleOnRN(enter, href);
      }),
    );
  }

  // Scale around the target's center so it stays put while the room grows around it
  const zoomStyle = useAnimatedStyle(() => {
    const k = 1 + (ZOOM_SCALE - 1) * zoom.get();
    return {
      transform: [
        { translateX: (1 - k) * (focusX.get() - W / 2) },
        { translateY: (1 - k) * (focusY.get() - H / 2) },
        { scale: k },
      ],
    };
  });

  const fadeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(zoom.get(), [0.35, 1], [0, 1], 'clamp'),
  }));

  const openMovie = () => open('/movie', screen);

  return (
    <View style={styles.container}>
      <Animated.View style={[StyleSheet.absoluteFill, zoomStyle]}>
        {/* Back: room shell, bookshelf on the right wall, projection screen */}
        <Animated.View style={[StyleSheet.absoluteFill, backLayer]}>
          <RoomShell room={room} />
          <ProjectionScreen rect={screen} imageUrl={latestPoster} />
          <Pressable
            style={[styles.hit, { left: screen.x, top: screen.y, width: screen.width, height: screen.height }]}
            onPress={openMovie}
          />
          <Pressable
            style={[styles.hit, { left: shelf.x, top: shelf.y, width: shelf.width, height: shelf.height }]}
            onPress={() => open(null, shelf)}
          />
          <Text style={[styles.label, { left: shelf.x - 12, top: shelf.y - 22 }]}>서재 · 준비 중</Text>
        </Animated.View>

        {/* Middle: projector and its beam, globe */}
        <Animated.View style={[StyleSheet.absoluteFill, midLayer]} pointerEvents="box-none">
          <LightBeam from={lens} screen={screen} width={W} height={H} />
          <Pressable
            style={[styles.object, { left: globe.x, top: globe.y }]}
            onPress={() => open(null, { ...globe, width: globeSize, height: globeSize })}>
            <Globe size={globeSize} />
            <Text style={styles.objectLabel}>여행 · 준비 중</Text>
          </Pressable>
          <Pressable style={[styles.object, { left: projector.x, top: projector.y }]} onPress={openMovie}>
            <Projector />
            <Text style={styles.objectLabel}>{movieCount ? `영화관 · ${movieCount}편` : '영화관'}</Text>
          </Pressable>
        </Animated.View>

        {/* Front: record player */}
        <Animated.View style={[StyleSheet.absoluteFill, frontLayer]} pointerEvents="box-none">
          <Pressable
            style={[styles.object, { left: turntable.x, top: turntable.y }]}
            onPress={() => open(null, { ...turntable, ...TURNTABLE_SIZE })}>
            <Turntable />
            <Text style={styles.objectLabel}>레코드 · 준비 중</Text>
          </Pressable>
        </Animated.View>

        <Text style={[styles.title, { top: insets.top + 8 }]}>여운</Text>
      </Animated.View>

      <FilmGrain opacity={0.05} />
      <Animated.View style={[styles.fade, fadeStyle]} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: RoomColors.ceiling,
  },
  title: {
    position: 'absolute',
    left: 24,
    fontFamily: CinemaFonts.serifBold,
    fontSize: 18,
    color: RoomColors.labelDim,
  },
  hit: {
    position: 'absolute',
  },
  object: {
    position: 'absolute',
    alignItems: 'center',
  },
  objectLabel: {
    marginTop: 6,
    fontFamily: CinemaFonts.serif,
    fontSize: 11,
    color: RoomColors.label,
  },
  label: {
    position: 'absolute',
    fontFamily: CinemaFonts.serif,
    fontSize: 11,
    color: RoomColors.label,
  },
  fade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000',
  },
});
