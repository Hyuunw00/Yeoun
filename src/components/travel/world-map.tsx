import { Canvas, Fill, Group, Path, Skia, type SkPath } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useDerivedValue } from 'react-native-reanimated';

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
} from './map-parts';
import { MapColors } from './theme';
import { useMapGestures } from './use-map-gestures';
import { project, routeCurve, WORLD } from './world';

// How far in past the height-fitted view one can zoom
const MAX_ZOOM = 40;
const GRID_STEP_DEGREES = 30;

type LatLng = { latitude: number; longitude: number };

type Props = {
  width: number;
  height: number;
  pins: MapPin[];
  // ISO codes of countries with a visited city, inked in
  visitedCodes: Set<string>;
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  // Where to center first, e.g. the latest city
  focus: LatLng | null;
  routes: MapRoute[];
  home: LatLng | null;
};

function graticule(): SkPath {
  const { width, height, unitsPerDegree, top } = WORLD.meta;
  const builder = Skia.Path.Make();
  for (let lon = -180; lon <= 180; lon += GRID_STEP_DEGREES) {
    const x = (lon + 180) * unitsPerDegree;
    builder.moveTo(x, 0).lineTo(x, height);
  }
  for (let lat = 60; lat > -60; lat -= GRID_STEP_DEGREES) {
    const y = (top - lat) * unitsPerDegree;
    builder.moveTo(0, y).lineTo(width, y);
  }
  return builder;
}

// An old paper world map drawn with Skia: countries with a visited city are inked in,
// each city gets a pin and routes run from home. It repeats sideways without an edge.
export function WorldMap({ width, height, pins, visitedCodes, selectedId, onSelect, focus, routes, home }: Props) {
  const { width: mapWidth, height: mapHeight } = WORLD.meta;
  // Zooming out shows the whole world across the screen's width
  const minScale = width / mapWidth;
  // The map filling the screen's height: the usual reading zoom
  const fitHeight = height / mapHeight;

  const land = useMemo(() => svgPath(WORLD.countries.map((c) => c.path).join('')), []);
  const visited = useMemo(
    () =>
      svgPath(
        WORLD.countries
          .filter((c) => c.code && visitedCodes.has(c.code))
          .map((c) => c.path)
          .join(''),
      ),
    [visitedCodes],
  );
  const grid = useMemo(() => graticule(), []);
  const points = useMemo(() => pins.map((p) => ({ id: p.id, ...project(p.latitude, p.longitude) })), [pins]);
  const layers = useMemo(
    () =>
      routeLayers(
        routes.map((r) => ({ transport: r.transport, curve: routeCurve(r.from, r.to, arcFor(r.transport)) })),
      ),
    [routes],
  );
  const homePoint = useMemo(() => (home ? project(home.latitude, home.longitude) : null), [home]);

  // Open on the focus city at a zoom where its region reads clearly, else the whole world
  const start = focus
    ? { ...project(focus.latitude, focus.longitude), scale: fitHeight * 1.6 }
    : { x: mapWidth / 2, y: mapHeight / 2, scale: minScale };
  const { gesture, transform, scale } = useMapGestures({
    width,
    height,
    mapWidth,
    mapHeight,
    minScale,
    maxScale: fitHeight * MAX_ZOOM,
    wrap: true,
    start,
    focusKey: focus ? `${focus.latitude},${focus.longitude}` : '',
    points,
    onSelect,
  });
  const coastWidth = useDerivedValue(() => 0.8 / scale.get());
  const gridWidth = useDerivedValue(() => 0.6 / scale.get());

  // One world drawn twice side by side; with tx wrapped into one world width, the two
  // always cover the screen even fully zoomed out. Routes can run past either edge into
  // the neighboring copy, so they get a third copy on the left.
  const drawLand = (offset: number) => (
    <Group key={offset} transform={[{ translateX: offset }]}>
      <Path path={grid} color={MapColors.grid} style="stroke" strokeWidth={gridWidth} />
      <Path path={land} color={MapColors.land} />
      <Path path={visited} color={MapColors.visited} />
      <Path path={land} color={MapColors.coast} style="stroke" strokeWidth={coastWidth} />
    </Group>
  );
  const drawRoutes = (offset: number) => (
    <Group key={offset} transform={[{ translateX: offset }]}>
      {layers.map((layer) => (
        <RouteLayer key={layer.key} path={layer.path} dash={layer.dash} scale={scale} />
      ))}
    </Group>
  );
  const drawMarkers = (offset: number) => (
    <Group key={offset} transform={[{ translateX: offset }]}>
      {homePoint && <HomeMarker x={homePoint.x} y={homePoint.y} scale={scale} />}
      {points.map((p) => (
        <Pin key={p.id} x={p.x} y={p.y} scale={scale} selected={p.id === selectedId} />
      ))}
    </Group>
  );

  return (
    <GestureHandlerRootView style={{ width, height }}>
      <GestureDetector gesture={gesture}>
        <View style={{ width, height }}>
          <Canvas style={StyleSheet.absoluteFill}>
            <Fill color={MapColors.sea} />
            <Group transform={transform}>
              {[0, mapWidth].map(drawLand)}
              {[-mapWidth, 0, mapWidth].map(drawRoutes)}
              {[0, mapWidth].map(drawMarkers)}
            </Group>
            <PaperFibers />
          </Canvas>
        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}
