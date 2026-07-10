import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Trash2, Users } from 'lucide-react-native';
import { PosterStack } from '../components/PosterStack';
import { colors, radii, spacing } from '../design/tokens';
import type { LibraryListItem } from './useLibraryData';

export function WatchlistRail({ lists, onDelete, onOpen }: { lists: LibraryListItem[]; onDelete: (list: LibraryListItem) => void; onOpen: (list: LibraryListItem) => void }) {
  return <ScrollView contentContainerStyle={styles.rail} horizontal showsHorizontalScrollIndicator={false}>
    {lists.map((list) => <Pressable accessibilityLabel={`Open ${list.name}`} accessibilityRole="button" key={list.key} onPress={() => onOpen(list)} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <PosterStack accessibilityLabel={`${list.name} poster preview`} posterUrls={list.posterUrls.length ? list.posterUrls : [null, null, null]} />
      <View style={styles.titleRow}><Text numberOfLines={1} style={styles.title}>{list.name}</Text>{list.kind === 'shared' ? <Users color={colors.textSubtle} size={14} /> : null}</View>
      <Text style={styles.meta}>{list.itemCount} {list.itemCount === 1 ? 'title' : 'titles'} · {list.kind === 'shared' ? `${list.memberCount ?? 0} members` : 'Private'}</Text>
      {list.isOwner ? <Pressable accessibilityLabel={`Delete ${list.name}`} accessibilityRole="button" hitSlop={8} onPress={(event) => { event.stopPropagation(); onDelete(list); }} style={styles.delete}><Trash2 color={colors.danger} size={16} /></Pressable> : null}
    </Pressable>)}
  </ScrollView>;
}
const styles = StyleSheet.create({ rail: { gap: spacing.sm, paddingRight: spacing.xl }, card: { backgroundColor: colors.panel, borderColor: colors.border, borderRadius: radii.lg, borderWidth: 1, minHeight: 160, padding: spacing.sm, width: 172 }, titleRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm }, title: { color: colors.text, flex: 1, fontSize: 14, fontWeight: '800' }, meta: { color: colors.textSubtle, fontSize: 11, marginTop: 2 }, delete: { alignItems: 'center', justifyContent: 'center', minHeight: 36, minWidth: 36, position: 'absolute', right: 4, top: 4 }, pressed: { opacity: 0.78 } });
