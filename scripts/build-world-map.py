# Builds src/components/travel/data/world.json from Natural Earth's 1:50m countries:
#   curl -LO https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson
#   python3 scripts/build-world-map.py ne_50m_admin_0_countries.geojson src/components/travel/data/world.json
# Countries are projected equirectangularly and stored as SVG path strings with ISO codes.
import json
import sys
K = 20          # units per degree
TOP = 84        # northern edge (lat)
BOTTOM = -58    # southern edge; Antarctica is left out
d = json.load(open(sys.argv[1]))
out = []
for f in d['features']:
    p = f['properties']
    code = p['ISO_A2'] if p['ISO_A2'] != '-99' else p['ISO_A2_EH']
    if p['ADMIN'] == 'Antarctica':
        continue
    g = f['geometry']
    polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
    parts = []
    for poly in polys:
        for ring in poly:
            pts = []
            for lon, lat in ring:
                pt = (round((lon + 180) * K), round((TOP - lat) * K))
                if not pts or pts[-1] != pt:
                    pts.append(pt)
            if len(pts) < 4:
                continue
            # Relative moves keep the numbers short
            s = 'M%d %d' % pts[0]
            prev = pts[0]
            rel = []
            for pt in pts[1:]:
                rel.append('%d %d' % (pt[0] - prev[0], pt[1] - prev[1]))
                prev = pt
            parts.append(s + 'l' + ' '.join(rel) + 'z')
    if parts:
        out.append({'code': code if code != '-99' else None, 'name': p['NAME_KO'], 'path': ''.join(parts)})
meta = {'unitsPerDegree': K, 'top': TOP, 'bottom': BOTTOM, 'width': 360 * K, 'height': (TOP - BOTTOM) * K}
json.dump({'meta': meta, 'countries': out}, open(sys.argv[2], 'w'), ensure_ascii=False, separators=(',', ':'))
