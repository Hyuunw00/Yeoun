# Builds src/components/travel/data/countries.json: detailed maps of the countries that can
# be home, with their provinces, from Natural Earth's 1:10m admin-1 regions:
#   curl -LO https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson
#   python3 scripts/build-country-maps.py ne_10m_admin_1_states_provinces.geojson src/components/travel/data/countries.json
# Each country gets its own equirectangular projection scaled by cos(middle latitude), so
# northern countries aren't stretched sideways, and is stored as SVG path strings.
import json
import math
import sys

# Country code → (Korean name, simplification tolerance in degrees)
COUNTRIES = {'KR': ('대한민국', 0.004), 'CA': ('캐나다', 0.03)}
SIZE = 2000  # units across the wider side


def simplify(points, tolerance):
    # Ramer–Douglas–Peucker
    if len(points) < 3:
        return points
    (x1, y1), (x2, y2) = points[0], points[-1]
    dx, dy = x2 - x1, y2 - y1
    length = math.hypot(dx, dy) or 1e-12
    index, farthest = 0, 0.0
    for i in range(1, len(points) - 1):
        px, py = points[i]
        d = abs(dy * px - dx * py + x2 * y1 - y2 * x1) / length
        if d > farthest:
            index, farthest = i, d
    if farthest <= tolerance:
        return [points[0], points[-1]]
    return simplify(points[: index + 1], tolerance)[:-1] + simplify(points[index:], tolerance)


def simplify_ring(ring, tolerance):
    # A closed ring starts and ends on the same point, which RDP can't measure from;
    # simplify its two halves instead
    middle = len(ring) // 2
    return simplify(ring[: middle + 1], tolerance)[:-1] + simplify(ring[middle:], tolerance)


features = json.load(open(sys.argv[1]))['features']
out = {}
for code, (name, tolerance) in COUNTRIES.items():
    regions = [f for f in features if f['properties']['iso_a2'] == code]
    rings_by_region = []
    lons, lats = [], []
    for f in regions:
        g = f['geometry']
        polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
        rings = []
        for poly in polys:
            ring = simplify_ring(poly[0], tolerance)  # outer ring only; lakes are left out
            if len(ring) >= 4:
                rings.append(ring)
                lons += [p[0] for p in ring]
                lats += [p[1] for p in ring]
        rings_by_region.append((f['properties'].get('name_ko') or f['properties']['name'], rings))
    min_lon, max_lon, min_lat, max_lat = min(lons), max(lons), min(lats), max(lats)
    cos = math.cos(math.radians((min_lat + max_lat) / 2))
    span = max((max_lon - min_lon) * cos, max_lat - min_lat)
    k = SIZE / span
    meta = {
        'name': name,
        'minLongitude': min_lon,
        'maxLatitude': max_lat,
        'cos': cos,
        'unitsPerDegree': k,
        'width': round((max_lon - min_lon) * cos * k),
        'height': round((max_lat - min_lat) * k),
    }
    out_regions = []
    for region_name, rings in rings_by_region:
        parts = []
        for ring in rings:
            pts = []
            for lon, lat in ring:
                pt = (round((lon - min_lon) * cos * k), round((max_lat - lat) * k))
                if not pts or pts[-1] != pt:
                    pts.append(pt)
            if len(pts) < 4:
                continue
            rel, prev = [], pts[0]
            for pt in pts[1:]:
                rel.append('%d %d' % (pt[0] - prev[0], pt[1] - prev[1]))
                prev = pt
            parts.append('M%d %d' % pts[0] + 'l' + ' '.join(rel) + 'z')
        if parts:
            out_regions.append({'name': region_name, 'path': ''.join(parts)})
    out[code] = {'meta': meta, 'regions': out_regions}

json.dump(out, open(sys.argv[2], 'w'), ensure_ascii=False, separators=(',', ':'))
