import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../components/Button';
import { colors, radii, shadows, spacing, typography } from '../design/tokens';
import { useToast } from '../notifications/ToastContext';

type ReviewEditorProps = {
  body: string;
  error: string | null;
  isDisabled: boolean;
  isLoading: boolean;
  isSignedIn: boolean;
  onBodyChange: (body: string) => void;
  onDelete: () => void;
  onSave: () => void;
  ratingScore: number | null;
  savedBody: string | null;
  signedOutBody: string;
  title: string;
};

const MAX_REVIEW_LENGTH = 5000;

export function ReviewEditor({
  body,
  error,
  isDisabled,
  isLoading,
  isSignedIn,
  onBodyChange,
  onDelete,
  onSave,
  ratingScore,
  savedBody,
  signedOutBody,
  title,
}: ReviewEditorProps) {
  const { showToast } = useToast();
  const lastErrorRef = useRef<string | null>(null);
  const trimmedBody = body.trim();
  const hasRating = ratingScore !== null;
  const canSave =
    isSignedIn &&
    hasRating &&
    !isDisabled &&
    trimmedBody.length > 0 &&
    body.length <= MAX_REVIEW_LENGTH;
  const canDelete = isSignedIn && !isDisabled && savedBody !== null;

  useEffect(() => {
    if (error && lastErrorRef.current !== error) {
      showToast(error);
    }

    lastErrorRef.current = error;
  }, [error, showToast]);

  return (
    <View style={styles.panel}>
      <View style={styles.headerRow}>
        <View style={styles.copy}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.body}>
            {isSignedIn
              ? hasRating
                ? `Review attached to your ${ratingScore}/5 rating.`
                : 'Add a rating before writing a review.'
              : signedOutBody}
          </Text>
        </View>
        {isLoading ? <ActivityIndicator color={colors.accent} /> : null}
      </View>

      {isSignedIn ? (
        <>
          <TextInput
            accessibilityLabel={title}
            editable={!isDisabled && hasRating}
            maxLength={MAX_REVIEW_LENGTH}
            multiline
            onChangeText={onBodyChange}
            placeholder="Write your review"
            placeholderTextColor={colors.muted}
            style={styles.input}
            textAlignVertical="top"
            value={body}
          />
          <View style={styles.footerRow}>
            <Text style={styles.counter}>{body.length}/{MAX_REVIEW_LENGTH}</Text>
            <View style={styles.actions}>
              {savedBody !== null ? (
                <Button disabled={!canDelete} label="Delete" onPress={onDelete} variant="secondary" />
              ) : null}
              <Button disabled={!canSave} label="Save" onPress={onSave} />
            </View>
          </View>
        </>
      ) : null}

      {savedBody !== null && !isSignedIn ? <Text style={styles.savedText}>{savedBody}</Text> : null}
    </View>
  );
}

export function useReviewState(loadReview: () => Promise<string | null>) {
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [savedBody, setSavedBody] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setIsLoading(true);

    try {
      const nextBody = await loadReview();

      setBody(nextBody ?? '');
      setSavedBody(nextBody);
    } catch {
      setError('Could not load your review.');
    } finally {
      setIsLoading(false);
    }
  }, [loadReview]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    body,
    error,
    isLoading,
    savedBody,
    setBody,
    setError,
    setIsLoading,
    setSavedBody,
  };
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  body: {
    ...typography.body,
    color: colors.muted,
    marginTop: spacing.xs,
  },
  copy: {
    flex: 1,
  },
  counter: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0,
  },
  footerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  input: {
    ...typography.body,
    backgroundColor: colors.panelSoft,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.text,
    marginTop: spacing.lg,
    minHeight: 142,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
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
  savedText: {
    ...typography.body,
    color: colors.text,
    marginTop: spacing.lg,
  },
  sectionTitle: {
    ...typography.title,
    color: colors.text,
  },
});
