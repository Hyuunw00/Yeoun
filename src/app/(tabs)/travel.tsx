import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CinemaFonts } from '@/components/cinema/theme';
import { LibraryFonts } from '@/components/library/theme';
import { CountryMap } from '@/components/travel/country-map';
import { countryMap, DEFAULT_COUNTRY, flag } from '@/components/travel/countries';
import type { MapPin, MapRoute } from '@/components/travel/map-parts';
import { MapColors } from '@/components/travel/theme';
import { asTransport } from '@/components/travel/transport';
import { WorldMap } from '@/components/travel/world-map';
import { useDb } from '@/lib/database';
import { formatTripDates, tripLength } from '@/lib/date';
import { listTravelRoutes, listWorks, type TravelRoute, type WorkSummary } from '@/lib/db';
import { loadHome, parseOrigin, type HomeCity } from '@/lib/home';
import { photoUri } from '@/lib/photos';

// The latest trip's dates, with its length when it spans several days
const latestTrip = (work: WorkSummary) =>
  [formatTripDates(work.lastExperiencedOn, work.lastEndedOn), tripLength(work.lastExperiencedOn, work.lastEndedOn)]
    .filter(Boolean)
    .join(' · ');

// A small photo print of the city, or its country code on blank paper
function Thumb({ work, size }: { work: WorkSummary; size: number }) {
  return (
    <View style={[styles.thumb, { width: size, height: size }]}>
      {work.photo ? (
        <Image source={photoUri(work.photo)} style={styles.thumbImage} contentFit="cover" />
      ) : (
        <View style={[styles.thumbImage, styles.thumbBlank]}>
          <Text style={styles.thumbCode}>{work.countryCode ?? '—'}</Text>
        </View>
      )}
    </View>
  );
}

function openCity(id: number) {
  router.push({ pathname: '/travel/work/[id]', params: { id } });
}

// The travel space: trips within the home country on a detailed map of it, trips abroad
// on an old paper world map, each city pinned and routes running from home
export default function TravelScreen() {
  const db = useDb();
  const [works, setWorks] = useState<WorkSummary[]>([]);
  const [trips, setTrips] = useState<TravelRoute[]>([]);
  const [home, setHome] = useState<HomeCity | null>(null);
  const [view, setView] = useState<'map' | 'list'>('map');
  const [scope, setScope] = useState<'domestic' | 'abroad'>('domestic');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  const load = useCallback(() => {
    listWorks(db, 'travel').then(setWorks);
    listTravelRoutes(db).then(setTrips);
    loadHome().then(setHome);
  }, [db]);

  useFocusEffect(load);

  // "Domestic" follows home: Korea now, Canada once home moves to Vancouver
  const domesticCode = home?.countryCode && countryMap(home.countryCode) ? home.countryCode : DEFAULT_COUNTRY;
  const domestic = countryMap(domesticCode)!;
  const inScope = useCallback(
    (code: string | null) => (scope === 'domestic') === (code === domesticCode),
    [scope, domesticCode],
  );
  const scoped = useMemo(() => works.filter((w) => inScope(w.countryCode)), [works, inScope]);

  const located = useMemo(() => scoped.filter((w) => w.latitude !== null && w.longitude !== null), [scoped]);
  const pins = useMemo<MapPin[]>(
    () => located.map((w) => ({ id: w.id, latitude: w.latitude!, longitude: w.longitude! })),
    [located],
  );
  const visitedCodes = useMemo(
    () => new Set(scoped.map((w) => w.countryCode).filter((c): c is string => !!c)),
    [scoped],
  );
  // Most recent first, so the map opens on the latest trip
  const latest = located[0];
  const focus = useMemo(() => (latest ? { latitude: latest.latitude!, longitude: latest.longitude! } : null), [latest]);
  const selected = works.find((w) => w.id === selectedId) ?? null;
  const routes = useMemo<MapRoute[]>(
    () =>
      trips.flatMap((trip) => {
        const from = parseOrigin(trip.origin);
        return from && inScope(trip.countryCode)
          ? [{ id: trip.recordId, from, to: trip, transport: asTransport(trip.transport) }]
          : [];
      }),
    [trips, inScope],
  );

  function onSelect(id: number | null) {
    if (id !== null) Haptics.selectionAsync();
    setSelectedId(id);
  }

  function switchScope(next: 'domestic' | 'abroad') {
    if (next === scope) return;
    Haptics.selectionAsync();
    setSelectedId(null);
    setScope(next);
  }

  function onLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    setSize((prev) => (prev?.width === width && prev?.height === height ? prev : { width, height }));
  }

  return (
    <View style={styles.container}>
      <View style={styles.mapArea} onLayout={onLayout}>
        {view === 'map' && size && scope === 'domestic' && (
          <CountryMap
            country={domestic}
            width={size.width}
            height={size.height}
            pins={pins}
            selectedId={selectedId}
            onSelect={onSelect}
            routes={routes}
            home={home}
          />
        )}
        {view === 'map' && size && scope === 'abroad' && (
          <WorldMap
            width={size.width}
            height={size.height}
            pins={pins}
            visitedCodes={visitedCodes}
            selectedId={selectedId}
            onSelect={onSelect}
            focus={focus}
            routes={routes}
            home={home}
          />
        )}
        {view === 'list' && (
          <FlatList
            data={scoped}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.list}
            ListEmptyComponent={<Text style={styles.empty}>아직 다녀온 도시가 없어요</Text>}
            renderItem={({ item }) => (
              <Pressable style={styles.row} onPress={() => openCity(item.id)}>
                <Thumb work={item} size={60} />
                <View style={styles.rowMain}>
                  <Text style={styles.rowName}>{item.title}</Text>
                  {!!item.subtitle && <Text style={styles.meta}>{item.subtitle}</Text>}
                  <Text style={styles.date}>{latestTrip(item)}</Text>
                </View>
                <SymbolView name="chevron.right" tintColor={MapColors.inkDim} size={14} />
              </Pressable>
            )}
          />
        )}
      </View>

      {/* Title cartouche and controls float over the map */}
      <SafeAreaView style={styles.overlay} edges={['top']} pointerEvents="box-none">
        <View style={styles.header} pointerEvents="box-none">
          <View style={styles.cartouche}>
            <Text style={styles.title}>
              {scope === 'domestic' ? `${flag(domesticCode)} ${domestic.meta.name}` : '여운 세계지도'}
            </Text>
            <Text style={styles.count}>
              {scope === 'domestic' ? `${scoped.length}개 도시` : `${visitedCodes.size}개국 · ${scoped.length}개 도시`}
            </Text>
            {/* Where trips leave from; routes on the map start here */}
            <Pressable
              onPress={() => router.push({ pathname: '/travel/search', params: { mode: 'home' } })}
              hitSlop={6}
              style={styles.home}>
              <SymbolView name="house.fill" tintColor={MapColors.ink} size={11} />
              <Text style={styles.homeText}>{home ? home.name : '사는 곳 정하기'}</Text>
            </Pressable>
          </View>
          <View style={styles.actions}>
            <Pressable
              style={styles.button}
              onPress={() => {
                setSelectedId(null);
                setView(view === 'map' ? 'list' : 'map');
              }}
              hitSlop={6}>
              <SymbolView name={view === 'map' ? 'list.bullet' : 'map'} tintColor={MapColors.ink} size={18} />
            </Pressable>
            <Pressable style={styles.button} onPress={() => router.push('/travel/search')} hitSlop={6}>
              <SymbolView name="plus" tintColor={MapColors.ink} size={18} />
            </Pressable>
          </View>
        </View>
        {/* Home country or the rest of the world */}
        <View style={styles.scopes}>
          {(['domestic', 'abroad'] as const).map((s) => (
            <Pressable key={s} onPress={() => switchScope(s)} style={[styles.scope, scope === s && styles.scopeActive]}>
              <Text style={[styles.scopeText, scope === s && styles.scopeTextActive]}>
                {s === 'domestic' ? `${flag(domesticCode)} ${domestic.meta.name}` : '🌏 해외'}
              </Text>
            </Pressable>
          ))}
        </View>
      </SafeAreaView>

      {view === 'map' && scoped.length === 0 && (
        <View style={styles.emptyCard} pointerEvents="none">
          <Text style={styles.emptyText}>
            {scope === 'domestic'
              ? '국내에서 다녀온 도시를 남기면 핀이 꽂혀요'
              : '해외에서 다녀온 도시를 남기면 핀이 꽂혀요'}
          </Text>
        </View>
      )}

      {view === 'map' && selected && (
        <Animated.View
          key={selected.id}
          entering={FadeInDown.duration(220)}
          exiting={FadeOutDown.duration(160)}
          style={styles.cardWrap}>
          <Pressable style={styles.card} onPress={() => openCity(selected.id)}>
            <Thumb work={selected} size={72} />
            <View style={styles.rowMain}>
              <Text style={styles.cardName}>{selected.title}</Text>
              {!!selected.subtitle && <Text style={styles.meta}>{selected.subtitle}</Text>}
              <Text style={styles.date}>{latestTrip(selected)}</Text>
            </View>
            <SymbolView name="chevron.right" tintColor={MapColors.inkDim} size={14} />
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: MapColors.sea,
  },
  mapArea: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  // Framed title box in the corner of an old map
  cartouche: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: MapColors.coast,
    backgroundColor: 'rgba(246, 238, 219, 0.92)',
    gap: 2,
  },
  title: {
    fontFamily: LibraryFonts.serifBold,
    fontSize: 17,
    letterSpacing: 2,
    color: MapColors.ink,
  },
  count: {
    fontFamily: LibraryFonts.serif,
    fontSize: 12,
    color: MapColors.inkDim,
  },
  home: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
    paddingTop: 5,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: MapColors.coast,
  },
  homeText: {
    fontFamily: LibraryFonts.serifBold,
    fontSize: 12,
    color: MapColors.ink,
  },
  scopes: {
    flexDirection: 'row',
    alignSelf: 'center',
    marginTop: 10,
    padding: 3,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: MapColors.coast,
    backgroundColor: 'rgba(246, 238, 219, 0.92)',
  },
  scope: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 15,
  },
  scopeActive: {
    backgroundColor: MapColors.ink,
  },
  scopeText: {
    fontFamily: LibraryFonts.serif,
    fontSize: 13,
    color: MapColors.inkDim,
  },
  scopeTextActive: {
    fontFamily: LibraryFonts.serifBold,
    color: MapColors.paper,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 19,
    borderWidth: 1,
    borderColor: MapColors.coast,
    backgroundColor: 'rgba(246, 238, 219, 0.92)',
  },
  list: {
    paddingTop: 180,
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  empty: {
    marginTop: 40,
    textAlign: 'center',
    fontFamily: LibraryFonts.serif,
    color: MapColors.inkDim,
  },
  emptyCard: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 32,
    padding: 14,
    alignItems: 'center',
    backgroundColor: 'rgba(246, 238, 219, 0.92)',
    borderWidth: 1,
    borderColor: MapColors.coast,
  },
  emptyText: {
    fontFamily: LibraryFonts.serif,
    fontSize: 13,
    color: MapColors.inkDim,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: MapColors.coast,
  },
  rowMain: {
    flex: 1,
    gap: 4,
  },
  rowName: {
    fontFamily: LibraryFonts.serifBold,
    fontSize: 17,
    color: MapColors.ink,
  },
  meta: {
    fontFamily: LibraryFonts.serif,
    fontSize: 12,
    color: MapColors.inkDim,
  },
  date: {
    marginTop: 2,
    fontFamily: LibraryFonts.serif,
    fontSize: 12,
    color: MapColors.inkDim,
  },
  cardWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 20,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: MapColors.paper,
    borderWidth: 1.5,
    borderColor: MapColors.coast,
    shadowColor: '#3b2c1e',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  // White-bordered print, like a photo pinned to the map
  thumb: {
    padding: 3,
    backgroundColor: MapColors.paper,
    transform: [{ rotate: '-2deg' }],
    shadowColor: '#3b2c1e',
    shadowOpacity: 0.25,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  thumbImage: {
    flex: 1,
  },
  thumbBlank: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MapColors.land,
  },
  thumbCode: {
    fontFamily: CinemaFonts.sign,
    fontSize: 16,
    letterSpacing: 1,
    color: MapColors.inkDim,
  },
  cardName: {
    fontFamily: LibraryFonts.serifBold,
    fontSize: 19,
    color: MapColors.ink,
  },
});
