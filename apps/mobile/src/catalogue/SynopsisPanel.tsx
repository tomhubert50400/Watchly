import { useEffect, useState } from 'react';
import { BlurView } from 'expo-blur';
import { EyeOff } from 'lucide-react-native';
import {
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  TextLayoutEventData,
  View,
} from 'react-native';
import { colors, radii, spacing, touchTargets, typography } from '../design/tokens';

const collapsedLineCount = 5;

type SynopsisPanelProps = {
  accessibilityLabel?: string;
  overview: string | null;
  revealLabel?: string;
  spoilerProtected?: boolean;
  title?: string | null;
  variant?: 'card' | 'inline' | 'section';
};

export function SynopsisPanel({
  accessibilityLabel = 'Reveal episode synopsis',
  overview,
  revealLabel = 'Reveal synopsis',
  spoilerProtected = false,
  title = 'Synopsis',
  variant = 'section',
}: SynopsisPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);
  const [revealedSynopsis, setRevealedSynopsis] = useState<string | null>(null);
  const synopsis = overview || 'No synopsis available yet.';
  const isSpoilerRevealed = !spoilerProtected || revealedSynopsis === synopsis;

  useEffect(() => {
    setCanExpand(false);
    setIsExpanded(false);
  }, [overview]);

  function handleTextLayout(event: NativeSyntheticEvent<TextLayoutEventData>) {
    setCanExpand(event.nativeEvent.lines.length > collapsedLineCount);
  }

  return (
    <View
      style={[
        styles.panel,
        variant === 'card' && styles.card,
        variant === 'inline' && styles.inline,
        variant === 'card' && spoilerProtected && !isSpoilerRevealed && styles.cardBlurred,
      ]}
    >
      {title ? <Text style={[styles.sectionTitle, variant === 'card' && styles.cardTitle]}>{title}</Text> : null}
      <View style={[styles.synopsisContent, variant === 'inline' && styles.inlineContent]}>
        <View
          accessibilityElementsHidden={spoilerProtected && !isSpoilerRevealed}
          importantForAccessibility={spoilerProtected && !isSpoilerRevealed ? 'no-hide-descendants' : 'auto'}
        >
          <Text
            numberOfLines={isExpanded ? undefined : collapsedLineCount}
            onTextLayout={handleTextLayout}
            style={styles.body}
          >
            {synopsis}
          </Text>
        </View>
      </View>
      {spoilerProtected ? (
        <BlurView
          experimentalBlurMethod="dimezisBlurView"
          intensity={isSpoilerRevealed ? 0 : 80}
          pointerEvents="none"
          style={[
            styles.spoilerOverlay,
            variant === 'inline' && styles.spoilerOverlayInline,
            !isSpoilerRevealed && variant !== 'inline' && styles.spoilerOverlayHidden,
          ]}
          tint="dark"
        />
      ) : null}
      {spoilerProtected && !isSpoilerRevealed ? (
        <View pointerEvents="box-none" style={[styles.revealOverlay, variant === 'inline' && styles.revealOverlayInline]}>
          <Pressable
            accessibilityLabel={accessibilityLabel}
            accessibilityRole="button"
            onPress={() => setRevealedSynopsis(synopsis)}
            style={({ pressed }) => [styles.revealButton, pressed && styles.expandButtonPressed]}
          >
            <EyeOff color={colors.accentText} size={18} strokeWidth={2.2} />
            <Text style={styles.revealLabel}>{revealLabel}</Text>
          </Pressable>
        </View>
      ) : null}
      {isSpoilerRevealed && canExpand ? (
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
  },
  expandButton: {
    alignItems: 'flex-start',
    alignSelf: 'flex-start',
    justifyContent: 'center',
    marginTop: spacing.xs,
    minHeight: touchTargets.min,
  },
  expandButtonPressed: {
    opacity: 0.84,
    transform: [{ scale: 0.98 }],
  },
  expandLabel: {
    color: colors.textSubtle,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
  },
  inline: {
    borderBottomWidth: 0,
    paddingVertical: 0,
  },
  inlineContent: {
    marginTop: 0,
    minHeight: 64,
  },
  card: {
    backgroundColor: colors.panelElevated,
    borderColor: colors.border,
    borderCurve: 'continuous',
    borderRadius: radii.lg,
    borderWidth: 1,
    marginTop: spacing.md,
    overflow: 'hidden',
    padding: spacing.lg,
  },
  cardBlurred: {
    borderColor: 'transparent',
  },
  cardTitle: {
    ...typography.eyebrow,
    color: colors.textMuted,
    position: 'relative',
    zIndex: 2,
  },
  panel: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.xl,
    position: 'relative',
  },
  sectionTitle: {
    ...typography.title,
    color: colors.text,
  },
  revealButton: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentBorder,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: touchTargets.min,
    paddingHorizontal: spacing.md,
    zIndex: 2,
  },
  revealLabel: {
    color: colors.accentText,
    fontSize: 14,
    fontWeight: '800',
  },
  revealOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.xxl,
    zIndex: 2,
  },
  revealOverlayInline: {
    paddingTop: 0,
  },
  spoilerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    borderCurve: 'continuous',
    borderRadius: radii.lg,
    overflow: 'hidden',
    zIndex: 1,
  },
  spoilerOverlayHidden: {
    borderColor: colors.border,
    borderWidth: 1,
  },
  spoilerOverlayInline: {
    borderRadius: 0,
  },
  synopsisContent: {
    marginTop: spacing.sm,
    position: 'relative',
  },
});
