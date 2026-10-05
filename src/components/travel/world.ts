import data from './data/world.json';

// Natural Earth countries pre-projected by scripts/build-world-map.py
type WorldData = {
  meta: { unitsPerDegree: number; top: number; bottom: number; width: number; height: number };
  countries: { code: string | null; name: string; path: string }[];
};

export const WORLD = data as WorldData;

// Equirectangular, matching the build script
export function project(latitude: number, longitude: number) {
  const { unitsPerDegree, top } = WORLD.meta;
  return { x: (longitude + 180) * unitsPerDegree, y: (top - latitude) * unitsPerDegree };
}

type LatLng = { latitude: number; longitude: number };
type Point = { x: number; y: number };

// A quadratic curve from a to b bowed toward the north (up on screen), like flight paths
export function bowedCurve(a: Point, b: Point, arc: number) {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  // Perpendicular to the route, flipped to point up
  let nx = dy;
  let ny = -dx;
  if (ny > 0) {
    nx = -nx;
    ny = -ny;
  }
  return { x1: a.x, y1: a.y, cx: mx + nx * arc, cy: my + ny * arc, x2: b.x, y2: b.y };
}

// A route on the world map. The destination may be shifted by a world width so the route
// takes the short way (Seoul → Vancouver crosses the Pacific instead of the whole map);
// the map repeats sideways, so a route past the edge continues in the neighboring copy.
export function routeCurve(from: LatLng, to: LatLng, arc: number) {
  const a = project(from.latitude, from.longitude);
  const b = project(to.latitude, to.longitude);
  const world = WORLD.meta.width;
  if (b.x - a.x > world / 2) b.x -= world;
  else if (a.x - b.x > world / 2) b.x += world;
  return bowedCurve(a, b, arc);
}
