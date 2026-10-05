import { useEffect } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { cancelAnimation, useDerivedValue, useSharedValue, withDecay, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

// Glide after a flick; closer to 1 slides farther
const DECELERATION = 0.997;
const PIN_HIT_RADIUS = 22;
// A tap allows no more travel than this; otherwise a quick drag counts as a tap and
// two quick drags as a double tap zoom (the default allows any distance)
const TAP_SLOP = 10;

type Options = {
  // View size in points
  width: number;
  height: number;
  // Map size in map units
  mapWidth: number;
  mapHeight: number;
  minScale: number;
  maxScale: number;
  // The world map repeats sideways; other maps stop at their edges
  wrap: boolean;
  // Where and how close to start: re-applied when `focusKey` changes
  start: { x: number; y: number; scale: number };
  focusKey: string;
  points: { id: number; x: number; y: number }[];
  onSelect: (id: number | null) => void;
};

// Pinch to zoom, drag (with a flick glide) to pan, tap a pin to pick it, double tap to
// zoom in. Returns the map's transform for a Skia group, and its scale for sizing marks.
export function useMapGestures({
  width,
  height,
  mapWidth,
  mapHeight,
  minScale,
  maxScale,
  wrap,
  start,
  focusKey,
  points,
  onSelect,
}: Options) {
  const scale = useSharedValue(start.scale);
  // With wrap, tx is unbounded and folded into one world width only when drawing
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  // Set when a drag turned into a pinch; lifting the fingers then shouldn't fling the map
  const pinched = useSharedValue(false);

  // Edges stay on screen; a map smaller than the view sits centered
  function range(view: number, size: number, s: number) {
    'worklet';
    const extra = view - size * s;
    return extra >= 0 ? [extra / 2, extra / 2] : [extra, 0];
  }
  function clampX(x: number, s: number) {
    'worklet';
    if (wrap) return x;
    const [min, max] = range(width, mapWidth, s);
    return Math.min(max, Math.max(min, x));
  }
  function clampY(y: number, s: number) {
    'worklet';
    const [min, max] = range(height, mapHeight, s);
    return Math.min(max, Math.max(min, y));
  }
  // tx folded into (-world, 0], so a copy drawn one world to the right fills the rest
  function wrapX(x: number, s: number) {
    'worklet';
    if (!wrap) return x;
    const world = mapWidth * s;
    const w = x % world;
    return w > 0 ? w - world : w;
  }

  useEffect(() => {
    scale.set(start.scale);
    tx.set(clampX(width / 2 - start.x * start.scale, start.scale));
    ty.set(clampY(height / 2 - start.y * start.scale, start.scale));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey, width, height]);

  // Pinch and pan run together, so both apply per-frame changes rather than offsets from
  // a shared starting point, which made the map jump when the second finger landed
  const pinch = Gesture.Pinch()
    .onStart(() => {
      pinched.set(true);
      cancelAnimation(tx);
      cancelAnimation(ty);
    })
    .onChange((e) => {
      const from = scale.get();
      const s = Math.min(maxScale, Math.max(minScale, from * e.scaleChange));
      // Zoom around the fingers
      const k = s / from;
      scale.set(s);
      tx.set(clampX(e.focalX - (e.focalX - tx.get()) * k, s));
      ty.set(clampY(e.focalY - (e.focalY - ty.get()) * k, s));
    });

  const pan = Gesture.Pan()
    .averageTouches(true)
    // At first touch, before a pinch could start, so the flag only covers this gesture
    .onBegin(() => {
      pinched.set(false);
    })
    .onStart(() => {
      // Catch a map that is still gliding
      cancelAnimation(tx);
      cancelAnimation(ty);
    })
    .onChange((e) => {
      tx.set(clampX(tx.get() + e.changeX, scale.get()));
      ty.set(clampY(ty.get() + e.changeY, scale.get()));
    })
    .onEnd((e) => {
      if (pinched.get()) return;
      // Keep gliding after a flick and slow down, like sliding paper across a table
      const s = scale.get();
      const xClamp = wrap ? undefined : (range(width, mapWidth, s) as [number, number]);
      tx.set(withDecay({ velocity: e.velocityX, deceleration: DECELERATION, clamp: xClamp }));
      const yClamp = range(height, mapHeight, s) as [number, number];
      ty.set(withDecay({ velocity: e.velocityY, deceleration: DECELERATION, clamp: yClamp }));
    });

  const tap = Gesture.Tap()
    .maxDistance(TAP_SLOP)
    .onEnd((e) => {
      const s = scale.get();
      let x = (e.x - tx.get()) / s;
      // Back to the original copy of the world
      if (wrap) x = ((x % mapWidth) + mapWidth) % mapWidth;
      const y = (e.y - ty.get()) / s;
      let best: number | null = null;
      let bestDistance = PIN_HIT_RADIUS / s;
      for (const p of points) {
        // On the world map a pin near the seam can be closer through the neighboring copy
        const dx = wrap ? Math.min(Math.abs(p.x - x), mapWidth - Math.abs(p.x - x)) : Math.abs(p.x - x);
        const d = Math.hypot(dx, p.y - y);
        if (d < bestDistance) {
          best = p.id;
          bestDistance = d;
        }
      }
      scheduleOnRN(onSelect, best);
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDistance(TAP_SLOP)
    .onEnd((e) => {
      const from = scale.get();
      const s = Math.min(maxScale, from * 2.5);
      const k = s / from;
      scale.set(withTiming(s, { duration: 250 }));
      tx.set(withTiming(clampX(e.x - (e.x - tx.get()) * k, s), { duration: 250 }));
      ty.set(withTiming(clampY(e.y - (e.y - ty.get()) * k, s), { duration: 250 }));
    });

  const gesture = Gesture.Simultaneous(pinch, pan, Gesture.Exclusive(doubleTap, tap));

  const transform = useDerivedValue(() => [
    { translateX: wrapX(tx.get(), scale.get()) },
    { translateY: ty.get() },
    { scale: scale.get() },
  ]);

  return { gesture, transform, scale };
}
