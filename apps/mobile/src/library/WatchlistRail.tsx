import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Trash2, Users } from 'lucide-react-native';
import { PosterStack } from '../components/PosterStack';
import { colors, radii, spacing } from '../design/tokens';
import type { LibraryListItem } from './useLibraryData';

export function WatchlistRail({ lists, onDelete, onOpen }: { lists: LibraryListItem[]; onDelete: (list: LibraryListItem) => void; onOpen: (list: LibraryListItem) => void }) {
  return <ScrollView contentContainerStyle={styles.rail} horizontal showsHorizontalScrollIndicator={false}>
    {lists.map((list) => <View key={list.key} style={styles.card}>
      <Pressable accessibilityLabel={`Open ${list.name}`} accessibilityRole="button" onPress={() => onOpen(list)} style={({ pressed }) => [styles.open, pressed && styles.pressed]}>
        <PosterStack accessibilityLabel={`${list.name} poster preview`} posterUrls={list.posterUrls.length ? list.posterUrls : [null, null, null]} />
        <View style={styles.titleRow}><Text numberOfLines={1} style={styles.title}>{list.name}</Text>{list.kind === 'shared' ? <Users color={colors.textSubtle} size={14} /> : null}</View>
        <Text style={styles.meta}>{list.itemCount} {list.itemCount === 1 ? 'title' : 'titles'} · {list.kind === 'shared' ? `${list.memberCount ?? 0} members` : 'Private'}</Text>
      </Pressable>
      {list.isOwner ? <Pressable accessibilityLabel={`Delete ${list.name}`} accessibilityRole="button" hitSlop={8} onPress={() => onDelete(list)} style={styles.delete}><Trash2 color={colors.danger} size={16} /></Pressable> : null}
    </View>)}
  </ScrollView>;
}
const styles = StyleSheet.create({ rail: { gap: spacing.sm, paddingRight: spacing.xl }, card: { backgroundColor: colors.panel, borderColor: colors.border, borderRadius: radii.lg, borderWidth: 1, minHeight: 160, width: 172 }, open: { flex: 1, padding: spacing.sm }, titleRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm }, title: { color: colors.text, flex: 1, fontSize: 14, fontWeight: '800' }, meta: { color: colors.textSubtle, fontSize: 11, marginTop: 2 }, delete: { alignItems: 'center', justifyContent: 'center', minHeight: 44, minWidth: 44, position: 'absolute', right: 0, top: 0 }, pressed: { opacity: 0.78 } });
