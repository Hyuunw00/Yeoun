import { BlurMask, Canvas, LinearGradient, Path, Skia, vec } from '@shopify/react-native-skia';
import { Image } from 'expo-image';
import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { CinemaFonts } from '@/components/cinema/theme';

import type { Point } from './geometry';
import { RoomColors } from './theme';

type Rect = { x: number; y: number; width: number; height: number };

// Pull-down screen on the back wall with the latest poster projected onto it
export function ProjectionScreen({ rect, imageUrl }: { rect: Rect; imageUrl: string | null }) {
  return (
    <View style={[styles.screen, { left: rect.x, top: rect.y, width: rect.width, height: rect.height }]}>
      <View style={styles.screenSurface}>
        {imageUrl ? (
          <Image source={imageUrl} style={styles.projected} contentFit="contain" />
        ) : (
          <Text style={styles.screenEmpty}>NOW SHOWING</Text>
        )}
      </View>
      <View style={styles.screenBar} />
    </View>
  );
}

// Cone of light from the projector lens to the screen
export function LightBeam({ from, screen, width, height }: { from: Point; screen: Rect; width: number; height: number }) {
  const path = useMemo(
    () =>
      Skia.Path.Make()
        .moveTo(from.x - 3, from.y)
        .lineTo(screen.x, screen.y)
        .lineTo(screen.x + screen.width, screen.y)
        .lineTo(from.x + 3, from.y)
        .close(),
    [from.x, from.y, screen.x, screen.y, screen.width],
  );

  return (
    <Canvas style={[StyleSheet.absoluteFill, { width, height }]} pointerEvents="none">
      <Path path={path}>
        <LinearGradient
          start={vec(from.x, from.y)}
          end={vec(screen.x + screen.width / 2, screen.y)}
          colors={['rgba(255, 244, 220, 0.28)', RoomColors.beam, 'rgba(255, 240, 210, 0.04)']}
        />
        <BlurMask blur={8} style="normal" />
      </Path>
    </Canvas>
  );
}

function Reel({ size }: { size: number }) {
  const spin = useSharedValue(0);
  useEffect(() => {
    spin.set(withRepeat(withTiming(360, { duration: 4000, easing: Easing.linear }), -1));
  }, [spin]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.get()}deg` }] }));

  return (
    <Animated.View style={[styles.reel, { width: size, height: size, borderRadius: size / 2 }, style]}>
      <View style={styles.reelSpoke} />
      <View style={[styles.reelSpoke, { transform: [{ rotate: '60deg' }] }]} />
      <View style={[styles.reelSpoke, { transform: [{ rotate: '120deg' }] }]} />
    </Animated.View>
  );
}

// Vintage film projector with two spinning reels. `lens` is relative to its top-left.
export const PROJECTOR_SIZE = { width: 96, height: 92 };
export const PROJECTOR_LENS = { x: 48, y: 64 };

export function Projector() {
  return (
    <View style={PROJECTOR_SIZE}>
      <View style={styles.reels}>
        <Reel size={40} />
        <Reel size={34} />
      </View>
      <View style={styles.body}>
        <View style={styles.lens} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    position: 'absolute',
    alignItems: 'center',
  },
  screenSurface: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RoomColors.screen,
    shadowColor: '#fff4dc',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },
  projected: {
    width: '100%',
    height: '100%',
    opacity: 0.88,
  },
  screenEmpty: {
    fontFamily: CinemaFonts.sign,
    fontSize: 16,
    letterSpacing: 3,
    color: '#8a8070',
  },
  screenBar: {
    width: '104%',
    height: 4,
    borderRadius: 2,
    backgroundColor: RoomColors.metalLight,
  },
  reels: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    gap: 6,
    height: 44,
  },
  reel: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: RoomColors.metalLight,
    backgroundColor: RoomColors.metal,
  },
  reelSpoke: {
    position: 'absolute',
    width: '80%',
    height: 2,
    backgroundColor: RoomColors.metalLight,
  },
  body: {
    height: 40,
    marginHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    backgroundColor: RoomColors.metal,
    borderWidth: 1,
    borderColor: RoomColors.metalLight,
  },
  lens: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#fff3d6',
    borderWidth: 3,
    borderColor: RoomColors.metalLight,
    shadowColor: '#fff3d6',
    shadowOpacity: 1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
});
