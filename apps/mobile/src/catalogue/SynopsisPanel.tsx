import { useState } from 'react';
import {
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  TextLayoutEventData,
  View,
} from 'react-native';
import { colors, radii, shadows, spacing, touchTargets, typography } from '../design/tokens';

const collapsedLineCount = 5;

type SynopsisPanelProps = {
  overview: string | null;
};

export function SynopsisPanel({ overview }: SynopsisPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);
  const synopsis = overview || 'No synopsis available yet.';

  function handleTextLayout(event: NativeSyntheticEvent<TextLayoutEventData>) {
    setCanExpand(event.nativeEvent.lines.length > collapsedLineCount);
  }

  return (
    <View style={styles.panel}>
      <Text style={styles.sectionTitle}>Synopsis</Text>
      <Text
        numberOfLines={isExpanded ? undefined : collapsedLineCount}
        onTextLayout={handleTextLayout}
        style={styles.body}
      >
        {synopsis}
      </Text>
      {canExpand ? (
        <Pressable
          accessibilityLabel={isExpanded ? 'Collapse full synopsis' : 'Show full synopsis'}
          accessibilityRole="button"
          onPress={() => setIsExpanded((current) => !current)}
          style={({ pressed }) => [styles.expandButton, pressed && styles.expandButtonPressed]}
        >
          <Text style={styles.expandLabel}>{isExpanded ? 'Show less' : 'Show more'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  expandButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentBorder,
    borderRadius: radii.sm,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: spacing.md,
    minHeight: touchTargets.min,
    paddingHorizontal: spacing.md,
  },
  expandButtonPressed: {
    opacity: 0.84,
    transform: [{ scale: 0.98 }],
  },
  expandLabel: {
    color: colors.accentText,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
  },
  panel: {
    ...shadows.panel,
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: spacing.md,
    padding: spacing.lg,
  },
  sectionTitle: {
    ...typography.title,
    color: colors.text,
  },
});
