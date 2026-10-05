import {
  Circle,
  ColorMatrix,
  DashPathEffect,
  Fill,
  FractalNoise,
  Group,
  Path,
  Rect,
  Skia,
  type SkPath,
} from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

import { MapColors } from './theme';
import { TRANSPORT_ORDER, TRANSPORTS, type Transport } from './transport';

// Pieces shared by the world map and the home-country map. Sizes are in screen points:
// drawn inside the zoomed group, so each one divides by the current scale.
const PIN_RADIUS = 5;
const HOME_SIZE = 9;
const ROUTE_WIDTH = 1.6;
// Routes without a transport
const DEFAULT_DASH: [number, number] = [5, 4];
export const DEFAULT_ARC = 0.15;
// Brown-tinted fibers at low alpha for old paper
const PAPER_GRAIN = [0.2, 0.2, 0.2, 0, 0.3, 0.16, 0.16, 0.16, 0, 0.22, 0.1, 0.1, 0.1, 0, 0.12, 0, 0, 0, 0, 0.1];

type LatLng = { latitude: number; longitude: number };
export type MapPin = { id: number; latitude: number; longitude: number };
export type MapRoute = { id: number; from: LatLng; to: LatLng; transport: Transport | null };
export type Curve = { x1: number; y1: number; cx: number; cy: number; x2: number; y2: number };

export function svgPath(path: string): SkPath {
  return Skia.Path.MakeFromSVGString(path) ?? Skia.Path.Make();
}

export function arcFor(transport: Transport | null) {
  return transport ? TRANSPORTS[transport].arc : DEFAULT_ARC;
}

// Routes grouped into one path per transport (and one for trips without one)
export function routeLayers(routes: { transport: Transport | null; curve: Curve }[]) {
  const groups = new Map<Transport | null, ReturnType<typeof Skia.PathBuilder.Make>>();
  for (const { transport, curve: c } of routes) {
    const builder = groups.get(transport) ?? Skia.PathBuilder.Make();
    builder.moveTo(c.x1, c.y1).quadTo(c.cx, c.cy, c.x2, c.y2);
    groups.set(transport, builder);
  }
  return [...TRANSPORT_ORDER, null]
    .filter((t) => groups.has(t))
    .map((t) => ({ key: t ?? 'none', path: groups.get(t)!.detach(), dash: t ? TRANSPORTS[t].dash : DEFAULT_DASH }));
}

export function Pin({
  x,
  y,
  scale,
  selected,
}: {
  x: number;
  y: number;
  scale: SharedValue<number>;
  selected: boolean;
}) {
  const r = useDerivedValue(() => (selected ? PIN_RADIUS * 1.5 : PIN_RADIUS) / scale.get());
  const ring = useDerivedValue(() => r.get() * 1.9);
  const stroke = useDerivedValue(() => 1.5 / scale.get());
  return (
    <Group>
      {selected && <Circle cx={x} cy={y} r={ring} color={MapColors.pinHalo} />}
      <Circle cx={x} cy={y} r={r} color={MapColors.pin} />
      <Circle cx={x} cy={y} r={r} color={MapColors.paper} style="stroke" strokeWidth={stroke} />
    </Group>
  );
}

// All routes of one transport in a single path, dashed in that transport's pattern
export function RouteLayer({
  path,
  dash,
  scale,
}: {
  path: SkPath;
  dash: [number, number];
  scale: SharedValue<number>;
}) {
  const width = useDerivedValue(() => ROUTE_WIDTH / scale.get());
  const intervals = useDerivedValue(() => [dash[0] / scale.get(), dash[1] / scale.get()]);
  return (
    <Path path={path} color={MapColors.route} style="stroke" strokeWidth={width} strokeCap="round">
      <DashPathEffect intervals={intervals} />
    </Path>
  );
}

// The home city: a small square, like a capital on old maps
export function HomeMarker({ x, y, scale }: { x: number; y: number; scale: SharedValue<number> }) {
  const size = useDerivedValue(() => HOME_SIZE / scale.get());
  const half = useDerivedValue(() => size.get() / 2);
  const left = useDerivedValue(() => x - half.get());
  const top = useDerivedValue(() => y - half.get());
  const stroke = useDerivedValue(() => 1.5 / scale.get());
  return (
    <Group>
      <Rect x={left} y={top} width={size} height={size} color={MapColors.ink} />
      <Rect x={left} y={top} width={size} height={size} color={MapColors.paper} style="stroke" strokeWidth={stroke} />
    </Group>
  );
}

// Paper fibers over everything, fixed to the screen like the sheet itself
export function PaperFibers() {
  return (
    <Fill>
      <FractalNoise freqX={0.9} freqY={0.9} octaves={2} />
      <ColorMatrix matrix={PAPER_GRAIN} />
    </Fill>
  );
}
