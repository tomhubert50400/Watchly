import { Check, Image as ImageIcon, Sparkles } from 'lucide-react-native';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ProfileBackdropSelection } from '../api/profile';
import {
  BottomActionSheet,
  BottomActionSheetScrollView,
} from '../components/BottomActionSheet';
import { MediaPoster } from '../components/MediaPoster';
import { colors, spacing, typography } from '../design/tokens';
import type { LibraryMediaItem } from '../library/useLibraryData';

type ProfileBackdropPickerSheetProps = {
  busy: boolean;
  error: string | null;
  items: LibraryMediaItem[];
  onClose: () => void;
  onSelect: (selection: ProfileBackdropSelection | null) => void;
  selected: ProfileBackdropSelection | null;
  visible: boolean;
};

export function ProfileBackdropPickerSheet({
  busy,
  error,
  items,
  onClose,
  onSelect,
  selected,
  visible,
}: ProfileBackdropPickerSheetProps) {
  const series = items.filter((item) => item.contentType === 'series');
  const movies = items.filter((item) => item.contentType === 'movie');

  return (
    <BottomActionSheet onClose={onClose} title="Profile background" visible={visible}>
      <BottomActionSheetScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>
          Choose artwork from a movie or series already shown on your profile.
        </Text>
        {error ? (
          <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>
        ) : null}
        <Pressable
          accessibilityLabel="Use an automatic profile background"
          accessibilityRole="button"
          accessibilityState={{ disabled: busy, selected: selected === null }}
          disabled={busy}
          onPress={() => onSelect(null)}
          style={({ pressed }) => [styles.automaticRow, pressed ? styles.pressed : null]}
        >
          <View style={styles.automaticArtwork}>
            <Sparkles color={colors.textMuted} size={22} strokeWidth={1.8} />
          </View>
          <View style={styles.rowCopy}>
            <Text numberOfLines={1} style={styles.rowTitle}>Automatic</Text>
            <Text style={styles.rowMeta}>Use your latest profile activity</Text>
          </View>
          {busy && selected === null ? (
            <ActivityIndicator color={colors.accentText} size="small" />
          ) : selected === null ? (
            <Check color={colors.accentText} size={21} strokeWidth={2.2} />
          ) : null}
        </Pressable>
        {items.length === 0 ? (
          <View style={styles.emptyState}>
            <ImageIcon color={colors.textSubtle} size={26} strokeWidth={1.7} />
            <Text style={styles.emptyTitle}>No artwork available yet</Text>
            <Text style={styles.emptyBody}>
              Add a favorite, set a release alert, or finish a title first.
            </Text>
          </View>
        ) : null}
        <BackdropSection
          busy={busy}
          items={series}
          onSelect={onSelect}
          selected={selected}
          title="Series"
        />
        <BackdropSection
          busy={busy}
          items={movies}
          onSelect={onSelect}
          selected={selected}
          title="Movies"
        />
      </BottomActionSheetScrollView>
    </BottomActionSheet>
  );
}

function BackdropSection({
  busy,
  items,
  onSelect,
  selected,
  title,
}: {
  busy: boolean;
  items: LibraryMediaItem[];
  onSelect: (selection: ProfileBackdropSelection) => void;
  selected: ProfileBackdropSelection | null;
  title: string;
}) {
  if (items.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>{title}</Text>
      <View>
        {items.map((item) => {
          const isSelected = selected?.contentType === item.contentType
            && selected.tmdbId === item.tmdbId;

          return (
            <Pressable
              accessibilityLabel={`Use ${item.title} as profile background`}
              accessibilityRole="button"
              accessibilityState={{ disabled: busy, selected: isSelected }}
              disabled={busy}
              key={item.key}
              onPress={() => onSelect({ contentType: item.contentType, tmdbId: item.tmdbId })}
              style={({ pressed }) => [styles.mediaRow, pressed ? styles.pressed : null]}
            >
              <MediaPoster posterUrl={item.posterUrl} style={styles.poster} />
              <View style={styles.rowCopy}>
                <Text numberOfLines={1} style={styles.rowTitle}>{item.title}</Text>
                <Text style={styles.rowMeta}>{item.contentType === 'movie' ? 'Movie' : 'Series'}</Text>
              </View>
              {busy && isSelected ? (
                <ActivityIndicator color={colors.accentText} size="small" />
              ) : isSelected ? (
                <Check color={colors.accentText} size={21} strokeWidth={2.2} />
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  automaticArtwork: {
    alignItems: 'center',
    backgroundColor: colors.panelElevated,
    height: 68,
    justifyContent: 'center',
    width: 48,
  },
  automaticRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 88,
    paddingVertical: spacing.sm,
  },
  content: {
    paddingBottom: spacing.xxxl,
  },
  emptyBody: {
    ...typography.body,
    color: colors.textSubtle,
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxxl,
  },
  emptyTitle: {
    ...typography.title,
    color: colors.text,
    marginTop: spacing.xs,
  },
  error: {
    ...typography.meta,
    color: colors.danger,
    marginTop: spacing.md,
  },
  intro: {
    ...typography.body,
    color: colors.textMuted,
    paddingBottom: spacing.md,
  },
  mediaRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 98,
    paddingVertical: spacing.sm,
  },
  poster: {
    height: 78,
    width: 52,
  },
  pressed: {
    opacity: 0.62,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
  },
  rowMeta: {
    ...typography.meta,
    color: colors.textSubtle,
    marginTop: 3,
  },
  rowTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 21,
  },
  section: {
    marginTop: spacing.xl,
  },
  sectionTitle: {
    ...typography.eyebrow,
    color: colors.textMuted,
    paddingBottom: spacing.xs,
  },
});
