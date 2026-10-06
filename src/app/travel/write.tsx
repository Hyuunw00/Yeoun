import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AutoGrowInput } from '@/components/auto-grow-input';
import { LibraryFonts } from '@/components/library/theme';
import { PhotoPickerRow } from '@/components/photo-picker-row';
import { MapPaper } from '@/components/travel/map-paper';
import { MapColors } from '@/components/travel/theme';
import { asTransport, TRANSPORT_ORDER, TRANSPORTS } from '@/components/travel/transport';
import { TripTicket } from '@/components/travel/trip-ticket';
import { formatTripDates, fromDateString, toDateString, tripLength } from '@/lib/date';
import { loadHome, parseOrigin, type HomeCity } from '@/lib/home';
import type { City } from '@/lib/places';
import { useRecordEditor } from '@/lib/use-record-editor';

const cityLine = (region: string | null, country: string | null) => [region, country].filter(Boolean).join(' · ');

// A line that fits on the back of a postcard
const MOMENT_MAX = 60;

// Writing up a trip: the ticket at the top fills in as the transport and dates are picked
export default function TravelWriteScreen() {
  // `id` is the city's external id; `city` carries the resolved city for a new record.
  // `recordId` + `workId` switch the screen to editing an existing record.
  const {
    id,
    city: cityParam,
    from,
    recordId,
    workId,
  } = useLocalSearchParams<{
    id: string;
    city?: string;
    from?: 'work';
    recordId?: string;
    workId?: string;
  }>();

  // A malformed param (e.g. from a deep link) shows an error instead of crashing the render
  const city = useMemo(() => {
    if (!cityParam) return null;
    try {
      const parsed = JSON.parse(cityParam) as Partial<City>;
      return parsed.name && typeof parsed.latitude === 'number' ? (parsed as City) : null;
    } catch {
      return null;
    }
  }, [cityParam]);

  // Reloaded on focus, so setting home from here shows up on return
  const [home, setHome] = useState<HomeCity | null>(null);
  // The geocoder may name a city in English ("Fukuoka"), so a new city's name is editable
  const [cityName, setCityName] = useState(city?.name ?? '');
  useFocusEffect(
    useCallback(() => {
      loadHome().then(setHome);
    }, []),
  );

  const editor = useRecordEditor({
    category: 'travel',
    externalId: id,
    recordId,
    workId,
    newWork:
      city && cityName.trim()
        ? {
            category: 'travel',
            externalId: id,
            title: cityName.trim(),
            subtitle: cityLine(city.region, city.country) || null,
            year: null,
            releaseDate: null,
            imageUrl: null,
            latitude: city.latitude,
            longitude: city.longitude,
            countryCode: city.countryCode,
          }
        : null,
    origin: home ? JSON.stringify(home) : null,
    onSaved: (isEdit) => {
      if (isEdit || from === 'work') router.back();
      else router.dismissTo('/travel');
    },
    onWorkRemoved: () => router.dismissTo('/travel'),
  });
  const { isEdit, savedWork, saving, canSave } = editor;

  const ready = isEdit ? !!savedWork : !!city;
  const name = (isEdit ? savedWork?.title : cityName) ?? '';
  const countryCode = (isEdit ? savedWork?.countryCode : city?.countryCode) ?? null;
  // An edited record keeps the home it left from; a new one leaves from the current home
  const origin = isEdit ? parseOrigin(editor.savedOrigin) : home;
  const transport = asTransport(editor.transport);
  const length = tripLength(editor.experiencedOn, editor.endedOn);

  function pickTransport(value: string) {
    Haptics.selectionAsync();
    editor.setTransport(editor.transport === value ? null : value);
  }

  return (
    <View style={styles.container}>
      <MapPaper />
      <SafeAreaView style={styles.flex}>
        <KeyboardAvoidingView style={styles.flex} behavior="padding">
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <Text style={styles.headerButton}>뒤로</Text>
            </Pressable>
            <View style={styles.headerActions}>
              {isEdit && (
                <Pressable onPress={editor.confirmDelete} disabled={saving} hitSlop={12}>
                  <Text style={styles.headerButton}>삭제</Text>
                </Pressable>
              )}
              <Pressable onPress={editor.save} disabled={!canSave} hitSlop={12}>
                {saving ? (
                  <ActivityIndicator color={MapColors.pin} />
                ) : (
                  <Text style={[styles.save, !canSave && styles.disabled]}>남기기</Text>
                )}
              </Pressable>
            </View>
          </View>

          {!ready ? (
            editor.recordError || (!isEdit && !city) ? (
              <Text style={styles.status}>{isEdit ? '기록을 불러오지 못했어요' : '도시 정보를 불러오지 못했어요'}</Text>
            ) : (
              <ActivityIndicator style={styles.status} color={MapColors.inkDim} />
            )
          ) : (
            <ScrollView contentContainerStyle={styles.page} keyboardDismissMode="interactive">
              <TripTicket
                transport={transport}
                from={origin?.name ?? null}
                to={name}
                toCode={countryCode}
                dates={formatTripDates(editor.experiencedOn, editor.endedOn)}
                length={length}
              />
              {!isEdit && (
                <View style={styles.nameField}>
                  <Text style={styles.label}>도시 이름</Text>
                  <TextInput
                    style={styles.nameInput}
                    value={cityName}
                    onChangeText={setCityName}
                    placeholder="도시 이름"
                    placeholderTextColor={MapColors.inkDim}
                    selectionColor={MapColors.pin}
                  />
                </View>
              )}
              {!isEdit && !home && (
                <Pressable
                  onPress={() => router.push({ pathname: '/travel/search', params: { mode: 'home' } })}
                  hitSlop={6}>
                  <Text style={styles.hint}>사는 곳을 정하면 출발지가 찍히고 지도에 길이 그려져요 ›</Text>
                </Pressable>
              )}

              <View style={styles.section}>
                <Text style={styles.label}>어떻게 갔나요</Text>
                <View style={styles.transports}>
                  {TRANSPORT_ORDER.map((t) => {
                    const active = editor.transport === t;
                    const { color, symbol, label } = TRANSPORTS[t];
                    return (
                      <Pressable
                        key={t}
                        onPress={() => pickTransport(t)}
                        style={[styles.transport, active && { backgroundColor: color, borderColor: color }]}>
                        <SymbolView name={symbol} tintColor={active ? MapColors.paper : MapColors.inkDim} size={18} />
                        <Text style={[styles.transportText, active && styles.transportTextActive]}>{label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.dates}>
                <View style={styles.field}>
                  <Text style={styles.label}>출발</Text>
                  <DateTimePicker
                    value={editor.pickerDate}
                    mode="date"
                    display="compact"
                    locale="ko-KR"
                    themeVariant="light"
                    accentColor={MapColors.pin}
                    maximumDate={new Date()}
                    onChange={(_, date) => {
                      if (!date) return;
                      const start = toDateString(date);
                      editor.setExperiencedOn(start);
                      // Keep the arrival from falling before a later departure
                      editor.setEndedOn((end) => (end && end < start ? start : end));
                    }}
                  />
                </View>
                <View style={styles.field}>
                  <Text style={styles.label}>도착</Text>
                  {editor.endedOn ? (
                    <>
                      <DateTimePicker
                        value={fromDateString(editor.endedOn)}
                        mode="date"
                        display="compact"
                        locale="ko-KR"
                        themeVariant="light"
                        accentColor={MapColors.pin}
                        minimumDate={editor.pickerDate}
                        maximumDate={new Date()}
                        onChange={(_, date) => date && editor.setEndedOn(toDateString(date))}
                      />
                      <Pressable onPress={() => editor.setEndedOn(null)} hitSlop={10}>
                        <Text style={styles.clear}>지우기</Text>
                      </Pressable>
                    </>
                  ) : (
                    // Starts on the departure day; pick the last day of the trip from there
                    <Pressable
                      onPress={() => editor.setEndedOn(editor.experiencedOn)}
                      hitSlop={8}
                      style={styles.addEnd}>
                      <Text style={styles.addEndText}>+ 도착일 (선택)</Text>
                    </Pressable>
                  )}
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.label}>남은 장면</Text>
                <TextInput
                  style={styles.moment}
                  value={editor.moment}
                  onChangeText={editor.setMoment}
                  placeholder="골목의 빵 냄새, 마지막 날의 노을… (선택)"
                  placeholderTextColor={MapColors.inkDim}
                  selectionColor={MapColors.pin}
                  maxLength={MOMENT_MAX}
                />
                <Text style={styles.momentHint}>엽서 뒷면에 손글씨로 남아요</Text>
              </View>

              <PhotoPickerRow
                photos={editor.photos}
                picking={editor.picking}
                progress={editor.pickProgress}
                onAdd={editor.addPhotos}
                onRemove={editor.removePhoto}
                limit={editor.photoLimit}
                fontFamily={LibraryFonts.serif}
                colors={{
                  border: MapColors.coast,
                  text: MapColors.inkDim,
                  badge: MapColors.paper,
                  badgeText: MapColors.ink,
                }}
              />

              <AutoGrowInput
                style={styles.body}
                minHeight={160}
                value={editor.body}
                onChangeText={editor.setBody}
                placeholder="AI의 도움 없이, 이 도시가 남긴 것을 그대로 적어보세요"
                placeholderTextColor={MapColors.inkDim}
                selectionColor={MapColors.pin}
              />
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: MapColors.sea,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 22,
  },
  headerButton: {
    fontFamily: LibraryFonts.serif,
    fontSize: 14,
    color: MapColors.inkDim,
  },
  save: {
    fontFamily: LibraryFonts.serifBold,
    fontSize: 15,
    color: MapColors.pin,
  },
  disabled: {
    opacity: 0.35,
  },
  status: {
    marginVertical: 24,
    textAlign: 'center',
    fontFamily: LibraryFonts.serif,
    color: MapColors.inkDim,
  },
  page: {
    paddingHorizontal: 20,
    paddingBottom: 80,
    gap: 18,
  },
  hint: {
    marginTop: -8,
    fontFamily: LibraryFonts.serif,
    fontSize: 12,
    color: MapColors.inkDim,
    textDecorationLine: 'underline',
  },
  nameField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  nameInput: {
    flex: 1,
    height: 32,
    paddingVertical: 0,
    fontFamily: LibraryFonts.serifBold,
    fontSize: 16,
    color: MapColors.ink,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: MapColors.coast,
  },
  section: {
    gap: 8,
  },
  transports: {
    flexDirection: 'row',
    gap: 8,
  },
  transport: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: MapColors.coast,
  },
  transportText: {
    fontFamily: LibraryFonts.serif,
    fontSize: 11,
    color: MapColors.inkDim,
  },
  transportTextActive: {
    fontFamily: LibraryFonts.serifBold,
    color: MapColors.paper,
  },
  dates: {
    gap: 10,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  label: {
    minWidth: 32,
    fontFamily: LibraryFonts.serif,
    fontSize: 12,
    letterSpacing: 1,
    color: MapColors.inkDim,
  },
  addEnd: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: MapColors.coast,
  },
  addEndText: {
    fontFamily: LibraryFonts.serif,
    fontSize: 13,
    color: MapColors.inkDim,
  },
  clear: {
    fontFamily: LibraryFonts.serif,
    fontSize: 12,
    color: MapColors.inkDim,
  },
  // Handwritten, as it will read on the back of the postcard
  moment: {
    height: 40,
    paddingVertical: 0,
    fontFamily: LibraryFonts.pen,
    fontSize: 24,
    color: MapColors.ink,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: MapColors.coast,
  },
  momentHint: {
    fontFamily: LibraryFonts.serif,
    fontSize: 11,
    color: MapColors.inkDim,
  },
  // Explicit lineHeight so AutoGrowInput can size it exactly
  body: {
    fontFamily: LibraryFonts.serif,
    fontSize: 16,
    lineHeight: 26,
    color: MapColors.ink,
    textAlignVertical: 'top',
  },
});
