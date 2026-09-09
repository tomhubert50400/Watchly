import { useState } from 'react';
import { ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react-native';
import { randomUUID } from 'expo-crypto';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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

  return <BottomActionSheet onClose={onClose} title="My viewings" visible footer={
    <Button disabled={!countText || Boolean(error) || Number(countText) !== entries.length} label={`Save ${entries.length} ${entries.length === 1 ? 'viewing' : 'viewings'}`} onPress={() => onSave(entries)} />
  }>
    <BottomActionSheetScrollView contentContainerStyle={styles.content}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      <View style={styles.totalRow}>
        <Text style={styles.label}>Times watched</Text>
        <View style={styles.stepper}>
          <StepButton label="One fewer viewing" disabled={entries.length <= 1} onPress={() => changeCount(String(entries.length - 1))} />
          <TextInput accessibilityLabel="Total viewings" keyboardType="number-pad" maxLength={4} onChangeText={changeCount} selectTextOnFocus style={styles.count} value={countText} />
          <StepButton label="One more viewing" plus disabled={entries.length >= 1000} onPress={() => changeCount(String(entries.length + 1))} />
        </View>
      </View>
      <View style={styles.sectionRow}><Text style={styles.label}>Viewing dates</Text></View>
      <ScrollView nestedScrollEnabled style={styles.viewingList} keyboardShouldPersistTaps="handled">
        {entries.map((entry, index) => {
          const selected = entry.id === selectedEntry.id;
          const date = entry.watchedDate ?? today;
          const label = date === today ? 'Today' : formatDate(date);
          return <Pressable key={entry.id} accessibilityRole="button" accessibilityLabel={`Edit viewing ${index + 1}, ${label}`} accessibilityState={{ selected }}
            onPress={() => { setSelectedId(entry.id); setMonth(date.slice(0, 7)); setMonthPickerOpen(false); }}
            style={[styles.dateRow, selected && styles.selected]}>
            <Text style={styles.dateLabel}>Viewing {index + 1}</Text>
            <Text style={selected ? styles.selectedText : styles.muted}>{label}</Text>
            <ChevronRight color={selected ? colors.accentText : colors.textMuted} size={16} />
          </Pressable>;
        })}
      </ScrollView>
      <View style={styles.sectionRow}><Text accessibilityLiveRegion="polite" style={styles.label}>Date for viewing {selectedIndex + 1}</Text></View>
      <View style={styles.monthRow}>
        <Pressable accessibilityLabel="Previous month" accessibilityRole="button" disabled={month <= '1900-01'} onPress={() => moveMonth(-1)} style={styles.iconButton}><ChevronLeft color={colors.textMuted} size={20} /></Pressable>
        <Pressable accessibilityLabel="Choose month and year" accessibilityRole="button" onPress={() => { setMonthPickerOpen((open) => !open); setYearText(month.slice(0, 4)); }} style={styles.monthButton}><Text style={styles.label}>{formatDate(`${month}-01`, { month: 'long', year: 'numeric' })}</Text></Pressable>
        <Pressable accessibilityLabel="Next month" accessibilityRole="button" disabled={month >= today.slice(0, 7)} onPress={() => moveMonth(1)} style={[styles.iconButton, month >= today.slice(0, 7) && styles.disabled]}><ChevronRight color={colors.textMuted} size={20} /></Pressable>
      </View>
      {monthPickerOpen ? <View>
        <TextInput accessibilityLabel="Year" keyboardType="number-pad" maxLength={4} onChangeText={setYearText} selectTextOnFocus style={styles.year} value={yearText} />
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
          return <Pressable accessibilityLabel={formatDate(date)} accessibilityRole="button" accessibilityState={{ disabled, selected }} disabled={disabled} key={date} onPress={() => setEntries(current => setViewingDate(current, selectedEntry.id, date))} style={[styles.cell, selected && styles.selected, disabled && styles.disabled]}>
            <Text style={[styles.day, selected && styles.selectedText]}>{Number(date.slice(8))}</Text>
            {date === today ? <View style={styles.todayDot} /> : null}
          </Pressable>;
        })}</View>
      </View>}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </BottomActionSheetScrollView>
  </BottomActionSheet>;
}

function StepButton({ label, onPress, disabled, plus }: { label: string; onPress: () => void; disabled?: boolean; plus?: boolean }) {
  const Icon = plus ? Plus : Minus;
  return <Pressable accessibilityLabel={label} accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.iconButton, disabled && styles.disabled]}><Icon color={colors.textMuted} size={18} /></Pressable>;
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
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.border, minHeight: touchTargets.min, paddingHorizontal: spacing.sm, gap: spacing.sm, borderRadius: radii.sm },
  dateLabel: { flex: 1, color: colors.text, fontSize: 13 },
  year: { color: colors.text, fontSize: 20, textAlign: 'center', minHeight: touchTargets.min },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  monthCell: { width: '33.333333%', minHeight: touchTargets.min, alignItems: 'center', justifyContent: 'center' },
  error: { color: colors.danger, fontSize: 13, marginTop: spacing.sm },
});
