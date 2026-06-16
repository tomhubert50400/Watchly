import { useState } from 'react';
import {
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  TextLayoutEventData,
  View,
} from 'react-native';
import { colors, radii, shadows, spacing, typography } from '../design/tokens';

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
          accessibilityLabel={isExpanded ? 'Masquer le synopsis complet' : 'Afficher le synopsis complet'}
          accessibilityRole="button"
          onPress={() => setIsExpanded((current) => !current)}
          style={({ pressed }) => [styles.expandButton, pressed && styles.expandButtonPressed]}
        >
          <Text style={styles.expandLabel}>{isExpanded ? 'Afficher moins' : 'Afficher plus'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    ...typography.body,
    color: colors.muted,
    marginTop: spacing.sm,
  },
  expandButton: {
    alignSelf: 'flex-start',
    marginTop: spacing.md,
    paddingVertical: spacing.xs,
  },
  expandButtonPressed: {
    opacity: 0.72,
  },
  expandLabel: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
  },
  panel: {
    ...shadows.panel,
    backgroundColor: colors.panelElevated,
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
