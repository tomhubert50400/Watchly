import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react-native';
import { randomUUID } from 'expo-crypto';
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { ViewingHistoryDate, ViewingHistoryItem } from '../api/viewings';
import { BottomActionSheet, BottomActionSheetScrollView } from '../components/BottomActionSheet';
import { Button } from '../components/Button';
import { colors, radii, spacing, touchTargets } from '../design/tokens';
import { localViewingDay, resizeHistoryDraft, setViewingDate, toHistoryDraft, viewingCalendarDays } from './viewingHistoryModel';

type Props = {
  history: ViewingHistoryItem[];
  title?: string;
  onClose: () => void;
  onSave: (entries: ViewingHistoryDate[]) => void;
};

export function ViewingHistorySheet({ history, title, onClose, onSave }: Props) {
  const today = localViewingDay();
  const [entries, setEntries] = useState(() => {
    const existing = toHistoryDraft(history);
    return !existing.length ? [{ id: randomUUID(), watchedDate: null }] : existing;
  });
  const [countText, setCountText] = useState(String(entries.length));
  const [selectedId, setSelectedId] = useState(entries[0]!.id);
  const selectedEntry = entries.find(entry => entry.id === selectedId) ?? entries[0]!;
  const selectedIndex = entries.indexOf(selectedEntry);
  const [showAll, setShowAll] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const firstVisibleIndex = showAll ? 0 : Math.max(0, Math.min(selectedIndex - 1, entries.length - 3));
  const visibleEntries = showAll ? entries : entries.slice(firstVisibleIndex, firstVisibleIndex + 3);
  const viewingListRef = useRef<ScrollView>(null);
  useEffect(() => {
    if (!showAll) viewingListRef.current?.scrollTo({ y: 0, animated: false });
  }, [showAll, firstVisibleIndex]);
  const [month, setMonth] = useState((selectedEntry.watchedDate ?? today).slice(0, 7));
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [yearText, setYearText] = useState(today.slice(0, 4));
  const [error, setError] = useState<string | null>(null);

  function changeCount(text: string) {
    setCountText(text);
    const next = resizeHistoryDraft(entries, Number(text), randomUUID);
    setError(next || !text ? null : 'Enter a total between 1 and 1,000.');
    if (next) {
      const selected = next.length > entries.length ? next[entries.length]! : next.find(entry => entry.id === selectedId) ?? next[0]!;
      setSelectedId(selected.id);
      setMonth((selected.watchedDate ?? today).slice(0, 7));
      setEntries(next);
    }
  }

  function moveMonth(delta: number) {
    const date = new Date(`${month}-01T12:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() + delta);
    setMonth(date.toISOString().slice(0, 7));
  }

  function selectViewing(entry: ViewingHistoryDate) {
    Keyboard.dismiss();
    setSelectedId(entry.id);
    setMonth((entry.watchedDate ?? today).slice(0, 7));
    setMonthPickerOpen(false);
    setCalendarOpen(true);
  }

  return <BottomActionSheet dragFromHandleOnly onClose={onClose} title="My viewings" visible footer={
    calendarOpen ? undefined : <Button disabled={!countText || Boolean(error) || Number(countText) !== entries.length} label={`Save ${entries.length} ${entries.length === 1 ? 'viewing' : 'viewings'}`} onPress={() => onSave(entries)} />
  }>
    <BottomActionSheetScrollView disableScrollViewPanResponder={false} scrollEnabled={!monthPickerOpen} contentContainerStyle={styles.content}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {!calendarOpen ? <>
      <View style={styles.totalRow}>
        <Text style={styles.label}>Times watched</Text>
        <View style={styles.stepper}>
          <StepButton label="One fewer viewing" disabled={entries.length <= 1} onPress={() => changeCount(String(entries.length - 1))} />
          <TextInput accessibilityLabel="Total viewings" keyboardType="number-pad" maxLength={4} onChangeText={changeCount} selectTextOnFocus style={styles.count} value={countText} />
          <StepButton label="One more viewing" plus disabled={entries.length >= 1000} onPress={() => changeCount(String(entries.length + 1))} />
        </View>
      </View>
      <View style={styles.sectionRow}>
        <Text style={styles.label}>Viewing dates</Text>
        {entries.length > 3 ? <Pressable accessibilityRole="button" accessibilityState={{ expanded: showAll }} onPress={() => setShowAll(value => !value)} style={styles.showAllButton}>
          <Text style={styles.selectedText}>{showAll ? 'Show less' : `Show all ${entries.length}`}</Text>
        </Pressable> : null}
      </View>
      <ScrollView ref={viewingListRef} nestedScrollEnabled style={styles.viewingList} keyboardShouldPersistTaps="handled">
        {visibleEntries.map((entry, visibleIndex) => {
          const index = firstVisibleIndex + visibleIndex;
          const selected = entry.id === selectedEntry.id;
          const date = entry.watchedDate ?? today;
          const label = date === today ? 'Today' : formatDate(date);
          return <Pressable key={entry.id} accessibilityRole="button" accessibilityLabel={`Edit viewing ${index + 1}, ${label}`} accessibilityState={{ selected }}
            onPress={() => selectViewing(entry)}
            style={[styles.dateRow, selected && styles.selected]}>
            <Text style={styles.dateLabel}>Viewing {index + 1}</Text>
            <Text style={selected ? styles.selectedText : styles.muted}>{label}</Text>
            <ChevronRight color={selected ? colors.accentText : colors.textMuted} size={16} />
          </Pressable>;
        })}
      </ScrollView>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      </> : <>
      <View style={styles.sectionRow}>
        <Pressable accessibilityLabel="Back to viewing dates" accessibilityRole="button" onPress={() => setCalendarOpen(false)} style={styles.backButton}><ChevronLeft color={colors.accentText} size={20} /><Text style={styles.selectedText}>Viewing dates</Text></Pressable>
        <Text style={styles.label}>Viewing {selectedIndex + 1}</Text>
      </View>
      <View style={styles.monthRow}>
        <Pressable accessibilityLabel="Previous month" accessibilityRole="button" disabled={month <= '1900-01'} onPress={() => moveMonth(-1)} style={styles.iconButton}><ChevronLeft color={colors.textMuted} size={20} /></Pressable>
        <Pressable accessibilityLabel="Choose month and year" accessibilityRole="button" onPress={() => { setMonthPickerOpen((open) => !open); setYearText(month.slice(0, 4)); }} style={styles.monthButton}><Text style={styles.label}>{formatDate(`${month}-01`, { month: 'long', year: 'numeric' })}</Text></Pressable>
        <Pressable accessibilityLabel="Next month" accessibilityRole="button" disabled={month >= today.slice(0, 7)} onPress={() => moveMonth(1)} style={[styles.iconButton, month >= today.slice(0, 7) && styles.disabled]}><ChevronRight color={colors.textMuted} size={20} /></Pressable>
      </View>
      {monthPickerOpen ? <View>
        <YearWheel year={Number(yearText)} maxYear={Number(today.slice(0, 4))} onChange={year => setYearText(String(year))} />
        <View style={styles.monthGrid}>{Array.from({ length: 12 }, (_, index) => {
          const key = `${yearText}-${String(index + 1).padStart(2, '0')}`;
          const disabled = !/^\d{4}$/.test(yearText) || key < '1900-01' || key > today.slice(0, 7);
          return <Pressable accessibilityRole="button" disabled={disabled} key={index} onPress={() => { setMonth(key); setMonthPickerOpen(false); }} style={[styles.monthCell, disabled && styles.disabled]}><Text style={styles.label}>{formatDate(`2026-${String(index + 1).padStart(2, '0')}-01`, { month: 'short' })}</Text></Pressable>;
        })}</View>
      </View> : <View>
        <View style={styles.grid}>{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => <Text key={index} style={styles.weekday}>{day}</Text>)}</View>
        <View style={styles.grid}>{viewingCalendarDays(month).map((date, index) => {
          if (!date) return <View key={`blank:${index}`} style={styles.cell} />;
          const selected = (selectedEntry.watchedDate ?? today) === date;
          const disabled = date > today;
          return <Pressable accessibilityLabel={formatDate(date)} accessibilityRole="button" accessibilityState={{ disabled, selected }} disabled={disabled} key={date} onPress={() => { setEntries(current => setViewingDate(current, selectedEntry.id, date)); setCalendarOpen(false); }} style={[styles.cell, selected && styles.selected, disabled && styles.disabled]}>
            <Text style={[styles.day, selected && styles.selectedText]}>{Number(date.slice(8))}</Text>
            {date === today ? <View style={styles.todayDot} /> : null}
          </Pressable>;
        })}</View>
      </View>}
      </>}
    </BottomActionSheetScrollView>
  </BottomActionSheet>;
}

function StepButton({ label, onPress, disabled, plus }: { label: string; onPress: () => void; disabled?: boolean; plus?: boolean }) {
  const Icon = plus ? Plus : Minus;
  return <Pressable accessibilityLabel={label} accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.iconButton, disabled && styles.disabled]}><Icon color={colors.textMuted} size={18} /></Pressable>;
}

function YearWheel({ year, maxYear, onChange }: { year: number; maxYear: number; onChange: (year: number) => void }) {
  const rowHeight = 44;
  const scrollRef = useRef<ScrollView>(null);
  const initialYear = useRef(year);
  const selectYear = (next: number) => {
    const bounded = Math.max(1900, Math.min(maxYear, next));
    onChange(bounded);
    scrollRef.current?.scrollTo({ y: (bounded - 1900) * rowHeight, animated: true });
  };
  return <View style={styles.yearWheel} accessibilityRole="adjustable" accessibilityLabel="Year"
    accessibilityValue={{ min: 1900, max: maxYear, now: year }}
    accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
    onAccessibilityAction={event => selectYear(year + (event.nativeEvent.actionName === 'increment' ? 1 : -1))}>
    <View pointerEvents="none" style={styles.yearSelection} />
    <ScrollView ref={scrollRef} nestedScrollEnabled bounces={false} showsVerticalScrollIndicator={false}
      snapToInterval={rowHeight} decelerationRate="fast" scrollEventThrottle={16}
      contentContainerStyle={{ paddingVertical: rowHeight }}
      onLayout={() => scrollRef.current?.scrollTo({ y: (initialYear.current - 1900) * rowHeight, animated: false })}
      onScroll={event => onChange(Math.max(1900, Math.min(maxYear, 1900 + Math.round(event.nativeEvent.contentOffset.y / rowHeight))))}>
      {Array.from({ length: maxYear - 1900 + 1 }, (_, index) => index + 1900).map(value =>
        <Pressable key={value} accessibilityRole="button" accessibilityLabel={String(value)} accessibilityState={{ selected: value === year }} onPress={() => selectYear(value)} style={styles.yearRow}>
          <Text style={[styles.year, value === year && styles.selectedText]}>{value}</Text>
        </Pressable>)}
    </ScrollView>
  </View>;
}

function formatDate(date: string, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { ...options, timeZone: 'UTC' });
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.md },
  title: { color: colors.textSubtle, fontSize: 12, fontWeight: '700', marginBottom: spacing.lg, textTransform: 'uppercase' },
  totalRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: spacing.lg, gap: spacing.sm },
  label: { color: colors.text, fontSize: 14, fontWeight: '600' },
  muted: { color: colors.textMuted, fontSize: 14 },
  stepper: { flexDirection: 'row', alignItems: 'center', borderRadius: radii.md, backgroundColor: colors.panelElevated },
  count: { width: 42, padding: 0, textAlign: 'center', fontSize: 21, fontWeight: '700', color: colors.text, minHeight: touchTargets.min },
  iconButton: { width: touchTargets.min, minHeight: touchTargets.min, alignItems: 'center', justifyContent: 'center' },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs },
  monthButton: { flex: 1, minHeight: touchTargets.min, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { width: '14.285714%', textAlign: 'center', color: colors.textSubtle, fontSize: 11, paddingVertical: spacing.sm },
  cell: { width: '14.285714%', minHeight: touchTargets.min, alignItems: 'center', justifyContent: 'center', borderRadius: 24 },
  day: { color: colors.text, fontSize: 14 },
  selected: { backgroundColor: colors.accentSoft },
  selectedText: { color: colors.accentText, fontWeight: '800' },
  todayDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.accentText, position: 'absolute', bottom: 4 },
  disabled: { opacity: 0.3 },
  viewingList: { maxHeight: 168 },
  showAllButton: { minHeight: touchTargets.min, justifyContent: 'center', paddingHorizontal: spacing.sm },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: touchTargets.min },
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.border, minHeight: touchTargets.min, paddingHorizontal: spacing.sm, gap: spacing.sm, borderRadius: radii.sm },
  dateLabel: { flex: 1, color: colors.text, fontSize: 13 },
  yearWheel: { height: 132, width: 140, alignSelf: 'center', overflow: 'hidden' },
  yearSelection: { position: 'absolute', top: 44, left: 0, right: 0, height: 44, borderRadius: radii.sm, backgroundColor: colors.accentSoft },
  yearRow: { height: 44, alignItems: 'center', justifyContent: 'center' },
  year: { color: colors.textMuted, fontSize: 20, textAlign: 'center' },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  monthCell: { width: '33.333333%', minHeight: touchTargets.min, alignItems: 'center', justifyContent: 'center' },
  error: { color: colors.danger, fontSize: 13, marginTop: spacing.sm },
});
