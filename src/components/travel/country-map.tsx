import { Canvas, Fill, Group, Path } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useDerivedValue } from 'react-native-reanimated';

import { projectIn, type CountryData } from './countries';
import {
  arcFor,
  HomeMarker,
  PaperFibers,
  Pin,
  RouteLayer,
  routeLayers,
  svgPath,
  type MapPin,
  type MapRoute,
  useReveal,
} from './map-parts';
import { MapColors } from './theme';
import { useMapGestures } from './use-map-gestures';
import { bowedCurve } from './world';

// How far in past the whole-country view one can zoom: enough for neighboring cities
const MAX_ZOOM = 12;
// Room around the country when fully zoomed out, as a share of the view
const MARGIN = 0.08;

type LatLng = { latitude: number; longitude: number };

type Props = {
  country: CountryData;
  width: number;
  height: number;
  pins: MapPin[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  routes: MapRoute[];
  home: LatLng | null;
};

// The home country up close, province by province: provinces with a visited city are
// inked in, and trips within the country run from home as on the world map
export function CountryMap({ country, width, height, pins, selectedId, onSelect, routes, home }: Props) {
  const { width: mapWidth, height: mapHeight } = country.meta;
  // The whole country fits the view with a little paper around it
  const minScale = Math.min(width / mapWidth, height / mapHeight) * (1 - MARGIN * 2);

  const regions = useMemo(() => country.regions.map((r) => svgPath(r.path)), [country]);
  const land = useMemo(() => svgPath(country.regions.map((r) => r.path).join('')), [country]);
  const points = useMemo(
    () => pins.map((p) => ({ id: p.id, ...projectIn(country, p.latitude, p.longitude) })),
    [country, pins],
  );
  // A province is visited when a pinned city lies inside it
  const visited = useMemo(
    () => regions.filter((region) => points.some((p) => region.contains(p.x, p.y))),
    [regions, points],
  );
  const layers = useMemo(
    () =>
      routeLayers(
        routes.map((r) => ({
          transport: r.transport,
          curve: bowedCurve(
            projectIn(country, r.from.latitude, r.from.longitude),
            projectIn(country, r.to.latitude, r.to.longitude),
            arcFor(r.transport),
          ),
        })),
      ),
    [country, routes],
  );
  const homePoint = useMemo(() => (home ? projectIn(country, home.latitude, home.longitude) : null), [country, home]);

  const reveal = useReveal();
  const { gesture, transform, scale } = useMapGestures({
    width,
    height,
    mapWidth,
    mapHeight,
    minScale,
    maxScale: minScale * MAX_ZOOM,
    wrap: false,
    start: { x: mapWidth / 2, y: mapHeight / 2, scale: minScale },
    focusKey: country.meta.name,
    points,
    onSelect,
  });
  const borderWidth = useDerivedValue(() => 0.6 / scale.get());
  const coastWidth = useDerivedValue(() => 1 / scale.get());

  return (
    <GestureHandlerRootView style={{ width, height }}>
      <GestureDetector gesture={gesture}>
        <View style={{ width, height }}>
          <Canvas style={StyleSheet.absoluteFill}>
            <Fill color={MapColors.sea} />
            <Group transform={transform}>
              <Path path={land} color={MapColors.land} />
              {visited.map((region, i) => (
                <Path key={i} path={region} color={MapColors.visited} />
              ))}
              {regions.map((region, i) => (
                <Path key={i} path={region} color={MapColors.coast} style="stroke" strokeWidth={borderWidth} />
              ))}
              <Path path={land} color={MapColors.coast} style="stroke" strokeWidth={coastWidth} />
              {layers.map((layer) => (
                <RouteLayer key={layer.key} path={layer.path} dash={layer.dash} scale={scale} reveal={reveal} />
              ))}
              {homePoint && <HomeMarker x={homePoint.x} y={homePoint.y} scale={scale} />}
              {points.map((p, i) => (
                <Pin
                  key={p.id}
                  x={p.x}
                  y={p.y}
                  scale={scale}
                  selected={p.id === selectedId}
                  reveal={reveal}
                  // Pins come latest first; the oldest drops first
                  order={points.length - 1 - i}
                  count={points.length}
                  haptic
                />
              ))}
            </Group>
            <PaperFibers />
          </Canvas>
        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}
