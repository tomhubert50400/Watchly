import type { ReactNode } from 'react';
import { SectionList, StyleSheet, Text } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '../design/tokens';
import { JournalEntryCard } from './JournalEntryCard';
import type { HydratedJournalEntry } from './JournalScreen';
import type { JournalMonth } from './journalModel';

export function JournalTimeline({ children, groups, onOpen, onEdit, onRefresh, refreshing = false, overlays }: {
  children: ReactNode;
  groups: JournalMonth[];
  onOpen: (entry: HydratedJournalEntry) => void;
  onEdit?: (entry: HydratedJournalEntry) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  overlays?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return <SafeAreaView edges={['top']} style={styles.screen}>
    <SectionList
      sections={groups.map((group) => ({ key: group.key, data: group.entries as HydratedJournalEntry[] }))}
      keyExtractor={(entry) => entry.key}
      renderItem={({ item }) => <JournalEntryCard entry={item} onPress={() => onOpen(item)} onEdit={onEdit ? () => onEdit(item) : undefined} />}
      renderSectionHeader={({ section }) => <Text style={styles.month}>{new Date(`${section.key}-01T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</Text>}
      ListHeaderComponent={<>{children}</>}
      contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl + insets.bottom }}
      initialNumToRender={8}
      maxToRenderPerBatch={8}
      windowSize={5}
      stickySectionHeadersEnabled={false}
      showsVerticalScrollIndicator={false}
      onRefresh={onRefresh}
      refreshing={refreshing}
    />
    {overlays}
  </SafeAreaView>;
}

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.background }, month: { ...typography.eyebrow, color: colors.accentText, marginTop: spacing.sm, marginBottom: spacing.md } });
