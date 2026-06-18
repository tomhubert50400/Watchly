import { useEffect, useRef } from 'react';
import { Star } from 'lucide-react-native';
import { ActivityIndicator, GestureResponderEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { colors, radii, shadows, spacing, typography } from '../design/tokens';
import { useToast } from '../notifications/ToastContext';

type StarRatingPanelProps = {
  body: string;
  clearLabel?: string;
  error: string | null;
  isDisabled: boolean;
  isLoading: boolean;
  isSignedIn: boolean;
  onClear: () => void;
  onSelect: (score: number) => void;
  score: number | null;
  title: string;
};

const STAR_BUTTON_SIZE = 48;
const STAR_ICON_SIZE = 30;
const starValues = [1, 2, 3, 4, 5] as const;

export function StarRatingPanel({
  body,
  clearLabel = 'Clear',
  error,
  isDisabled,
  isLoading,
  isSignedIn,
  onClear,
  onSelect,
  score,
  title,
}: StarRatingPanelProps) {
  const { showToast } = useToast();
  const lastErrorRef = useRef<string | null>(null);

  useEffect(() => {
    if (error && lastErrorRef.current !== error) {
      showToast(error);
    }

    lastErrorRef.current = error;
  }, [error, showToast]);

  function selectFromStarTap(starValue: number, event: GestureResponderEvent) {
    const nextScore = event.nativeEvent.locationX <= STAR_BUTTON_SIZE / 2 ? starValue - 0.5 : starValue;

    onSelect(nextScore);
  }

  return (
    <View style={styles.panel}>
      <View style={styles.headerRow}>
        <View style={styles.copy}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.body}>{body}</Text>
        </View>
        {isLoading ? <ActivityIndicator color={colors.accent} /> : null}
      </View>

      {isSignedIn ? (
        <View style={styles.ratingRow}>
          {starValues.map((value) => {
            const fillWidth = getStarFillWidth(score, value);
            const selectedLabel = score === value || score === value - 0.5;

            return (
              <Pressable
                accessibilityLabel={`Rate ${value - 0.5} or ${value} out of 5`}
                accessibilityRole="button"
                accessibilityState={{ selected: selectedLabel }}
                disabled={isDisabled}
                key={value}
                onPress={(event) => selectFromStarTap(value, event)}
                style={({ pressed }) => [
                  styles.starButton,
                  pressed && !isDisabled ? styles.pressed : null,
                  isDisabled ? styles.disabled : null,
                ]}
              >
                <View style={styles.starIconFrame}>
                  <Star color={colors.text} size={STAR_ICON_SIZE} strokeWidth={2} />
                  <View style={[styles.starFillClip, { width: fillWidth }]}>
                    <Star
                      color={colors.accent}
                      fill={colors.accent}
                      size={STAR_ICON_SIZE}
                      strokeWidth={2}
                    />
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {score !== null ? (
        <View style={styles.ratingFooter}>
          <Text style={styles.ratingText}>Rating {score}/5</Text>
          <Button disabled={isDisabled} label={clearLabel} onPress={onClear} variant="secondary" />
        </View>
      ) : null}
    </View>
  );
}

function getStarFillWidth(score: number | null, starValue: number) {
  if (score === null || score <= starValue - 1) {
    return 0;
  }

  if (score >= starValue) {
    return STAR_ICON_SIZE;
  }

  return STAR_ICON_SIZE / 2;
}

const styles = StyleSheet.create({
  body: {
    ...typography.body,
    color: colors.muted,
    marginTop: spacing.xs,
  },
  copy: {
    flex: 1,
  },
  disabled: {
    opacity: 0.52,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
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
  pressed: {
    opacity: 0.78,
  },
  ratingFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  ratingRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  ratingText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0,
  },
  sectionTitle: {
    ...typography.title,
    color: colors.text,
  },
  starButton: {
    alignItems: 'center',
    backgroundColor: colors.panelSoft,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    height: STAR_BUTTON_SIZE,
    justifyContent: 'center',
    width: STAR_BUTTON_SIZE,
  },
  starFillClip: {
    height: STAR_ICON_SIZE,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    top: 0,
  },
  starIconFrame: {
    height: STAR_ICON_SIZE,
    width: STAR_ICON_SIZE,
  },
});
