import { useRef, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { VoteTitlePicker } from './VoteTitlePicker';
import { BottomActionSheet, BottomActionSheetScrollView } from '../components/BottomActionSheet';
import { Button } from '../components/Button';
import { InlineStatusBanner } from '../components/InlineStatusBanner';
import { TextInput } from '../components/TextInput';
import { colors, radii, spacing, typography } from '../design/tokens';
import type { WatchlistDisplayItem } from './WatchlistDetailLayout';

export type SharedVoteOptions = { title: string; durationMinutes: number; isAnonymous: boolean; allowMultipleVotes: boolean; items: WatchlistDisplayItem[] };
const durations = [{ label: '15 min', value: 15 }, { label: '1 hour', value: 60 }, { label: '6 hours', value: 360 },
  { label: '1 day', value: 1440 }, { label: '3 days', value: 4320 }, { label: '7 days', value: 10080 }];

export function CreateSharedVoteSheet({ items, error, isCreating, onClose, onCreate }: {
  items: WatchlistDisplayItem[]; error: string | null; isCreating: boolean;
  onClose: () => void; onCreate: (options: SharedVoteOptions) => Promise<void>;
}) {
  const [title, setTitle] = useState('Tonight');
  const [durationMinutes, setDurationMinutes] = useState(1440);
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [allowMultipleVotes, setAllowMultipleVotes] = useState(true);
  const [selected, setSelected] = useState(() => items.slice(0, 10));
  const submitting = useRef(false);

  async function create() {
    if (submitting.current || isCreating || !title.trim() || !selected.length) return;
    submitting.current = true;
    Keyboard.dismiss();
    try { await onCreate({ title: title.trim(), durationMinutes, isAnonymous, allowMultipleVotes, items: selected }); }
    finally { submitting.current = false; }
  }
  return <BottomActionSheet title="New vote" visible onClose={onClose}
    footer={<Button label="Create vote" disabled={isCreating || !title.trim() || !selected.length}
      fullWidth onPress={() => void create()} />}>
    <BottomActionSheetScrollView keyboardShouldPersistTaps="always" contentContainerStyle={styles.content}>
      {error ? <InlineStatusBanner detail={error} tone="error" /> : null}
      <TextInput label="Vote title" maxLength={80} value={title} onChangeText={setTitle} editable={!isCreating} />
      <Text style={styles.label}>Duration</Text>
      <View style={styles.durations}>{durations.map(duration => <Pressable key={duration.value}
        accessibilityRole="radio" accessibilityState={{ checked: durationMinutes === duration.value, disabled: isCreating }}
        disabled={isCreating} onPress={() => setDurationMinutes(duration.value)}
        style={[styles.duration, durationMinutes === duration.value && styles.selected]}>
        <Text style={styles.label}>{duration.label}</Text>
      </Pressable>)}</View>
      <View style={styles.row}>
        <View style={styles.copy}><Text style={styles.label}>Anonymous votes</Text>
          <Text style={styles.caption}>{isAnonymous ? 'Members see vote counts, but not who voted.' : 'Members can see who voted for each title.'}</Text></View>
        <Switch accessibilityLabel="Anonymous votes" value={isAnonymous} onValueChange={setIsAnonymous} disabled={isCreating} />
      </View>
      <View style={styles.row}>
        <View style={styles.copy}><Text style={styles.label}>Multiple votes</Text>
          <Text style={styles.caption}>{allowMultipleVotes ? 'Each member can vote for several titles.' : 'Each member can vote for one title. A new choice replaces the previous one.'}</Text></View>
        <Switch accessibilityLabel="Multiple votes" value={allowMultipleVotes} onValueChange={setAllowMultipleVotes} disabled={isCreating} />
      </View>
      <Text style={styles.label}>Titles ({selected.length}/10)</Text>
      <Text style={styles.caption}>Choose up to 10 titles. Members can add more titles while voting is open.</Text>
      {items.length === 0 ? <Text style={styles.caption}>Search the catalogue to choose titles for this vote.</Text> : null}
      <VoteTitlePicker items={items} selected={selected} limit={10} disabled={isCreating}
        onChange={setSelected} />
    </BottomActionSheetScrollView>
  </BottomActionSheet>;
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.lg },
  label: { ...typography.body, color: colors.text, fontWeight: '600' },
  caption: { ...typography.meta, color: colors.textMuted },
  durations: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  duration: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border },
  selected: { backgroundColor: colors.accentSoft, borderColor: colors.accentText },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 48 },
  copy: { flex: 1, gap: spacing.xs },
});
