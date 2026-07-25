import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { IconButton } from '../components/IconButton';
import { colors, radii, spacing, touchTargets, typography } from '../design/tokens';
import { getJournalMonthKeys, JournalEntry } from './journalModel';

type JournalCalendarProps = {
  entries: JournalEntry[];
  monthKey: string;
  onMonthChange: (monthKey: string) => void;
  onSelectDate: (dateKey: string) => void;
  selectedDateKey: string | null;
};

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function JournalCalendar({
  entries,
  monthKey,
  onMonthChange,
  onSelectDate,
  selectedDateKey,
}: JournalCalendarProps) {
  const monthKeys = getJournalMonthKeys(entries);
  const monthIndex = monthKeys.indexOf(monthKey);
  const olderMonthKey = monthKeys[monthIndex + 1];
  const newerMonthKey = monthIndex > 0 ? monthKeys[monthIndex - 1] : undefined;
  const entryCounts = entries.reduce<Record<string, number>>((counts, entry) => {
    const dateKey = entry.date.slice(0, 10);
    counts[dateKey] = (counts[dateKey] ?? 0) + 1;
    return counts;
  }, {});
  const [year, month] = monthKey.split('-').map(Number);
  const leadingDays = (new Date(Date.UTC(year!, month! - 1, 1)).getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year!, month!, 0)).getUTCDate();
  const days = Array.from({ length: 42 }, (_, index) => {
    const day = index - leadingDays + 1;
    return day > 0 && day <= daysInMonth ? day : null;
  });

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <IconButton
          accessibilityLabel={olderMonthKey ? `Show ${formatMonth(olderMonthKey)}` : 'No older Journal month'}
          disabled={!olderMonthKey}
          icon={<ChevronLeft color={colors.textMuted} size={20} />}
          onPress={() => olderMonthKey && onMonthChange(olderMonthKey)}
        />
        <View style={styles.heading}>
          <Text accessibilityRole="header" style={styles.month}>{formatMonth(monthKey)}</Text>
          <Text style={styles.hint}>Days with entries are selectable</Text>
        </View>
        <IconButton
          accessibilityLabel={newerMonthKey ? `Show ${formatMonth(newerMonthKey)}` : 'No newer Journal month'}
          disabled={!newerMonthKey}
          icon={<ChevronRight color={colors.textMuted} size={20} />}
          onPress={() => newerMonthKey && onMonthChange(newerMonthKey)}
        />
      </View>
      <View style={styles.week}>
        {WEEKDAYS.map((weekday) => <Text key={weekday} style={styles.weekday}>{weekday.slice(0, 1)}</Text>)}
      </View>
      <View style={styles.grid}>
        {days.map((day, index) => {
          if (!day) return <View key={`empty:${index}`} style={styles.cell} />;
          const dateKey = `${monthKey}-${String(day).padStart(2, '0')}`;
          const count = entryCounts[dateKey] ?? 0;
          const selected = selectedDateKey === dateKey;
          return (
            <View key={dateKey} style={styles.cell}>
              {count ? (
                <Pressable
                  accessibilityLabel={`${formatDate(dateKey)}, ${count} ${count === 1 ? 'entry' : 'entries'}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => onSelectDate(dateKey)}
                  style={({ pressed }) => [
                    styles.day,
                    styles.dayWithEntries,
                    selected ? styles.daySelected : null,
                    pressed ? styles.dayPressed : null,
                  ]}
                >
                  <Text style={[styles.dayText, selected ? styles.dayTextSelected : null]}>{day}</Text>
                  <View style={[styles.dot, selected ? styles.dotSelected : null]} />
                </Pressable>
              ) : (
                <View style={styles.day}>
                  <Text style={styles.dayUnavailable}>{day}</Text>
                </View>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

function formatMonth(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(Date.UTC(year!, month! - 1, 1)).toLocaleDateString(undefined, {
    month: 'long',
    timeZone: 'UTC',
    year: 'numeric',
  });
}

function formatDate(dateKey: string) {
  return new Date(`${dateKey}T00:00:00Z`).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
    year: 'numeric',
  });
}

const styles = StyleSheet.create({
  cell: {
    alignItems: 'center',
    minHeight: touchTargets.min,
    width: '14.285714%',
  },
  day: {
    alignItems: 'center',
    borderRadius: radii.md,
    height: touchTargets.min,
    justifyContent: 'center',
    width: '100%',
  },
  dayPressed: {
    opacity: 0.76,
  },
  daySelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  dayText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  dayTextSelected: {
    color: colors.textOnAccent,
  },
  dayUnavailable: {
    color: colors.textSubtle,
    fontSize: 14,
  },
  dayWithEntries: {
    backgroundColor: colors.panelElevated,
    borderColor: colors.accentBorder,
    borderWidth: 1,
  },
  dot: {
    backgroundColor: colors.accent,
    borderRadius: 2,
    bottom: 6,
    height: 4,
    position: 'absolute',
    width: 4,
  },
  dotSelected: {
    backgroundColor: colors.textOnAccent,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heading: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: spacing.sm,
  },
  hint: {
    color: colors.textSubtle,
    fontSize: 11,
    marginTop: 2,
  },
  month: {
    ...typography.meta,
    color: colors.text,
    textTransform: 'capitalize',
  },
  panel: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.sm,
    marginBottom: spacing.lg,
    padding: spacing.sm,
  },
  week: {
    flexDirection: 'row',
  },
  weekday: {
    color: colors.textSubtle,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    width: '14.285714%',
  },
});
