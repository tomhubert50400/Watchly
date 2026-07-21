import { Star, Trash2 } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  GestureResponderEvent,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { BottomActionSheet } from '../components/BottomActionSheet';
import { Button } from '../components/Button';
import { useAuthSession } from '../auth/AuthSessionContext';
import { SignInSheet } from '../auth/SignInRequired';
import { colors, radii, shadows, spacing, touchTargets, typography } from '../design/tokens';
import { hapticConfirm, hapticError, hapticSelection } from '../feedback/haptics';
import { useToast } from '../notifications/ToastContext';
import {
  MAX_REVIEW_LENGTH,
  OpinionOperation,
  OpinionState,
  applyOperationFailure,
  applyOperationSuccess,
  beginOpinionOperations,
  buildClearPlan,
  buildDeleteReviewPlan,
  buildSavePlan,
  canSaveOpinion,
  createOpinionState,
  getRatingFromTrackPosition,
  getRatingAccessibilityValue,
  isOpinionDirty,
  resetOpinionDraft,
} from './opinionState';
import { resolveOpinionTriggerLayout } from './opinionTriggerLayout';

const STAR_TARGET_SIZE = 52;
const STAR_ICON_SIZE = 34;
const STAR_GAP = 2;
const STAR_VALUES = [1, 2, 3, 4, 5] as const;
const STAR_TRACK_WIDTH = STAR_TARGET_SIZE * STAR_VALUES.length + STAR_GAP * (STAR_VALUES.length - 1);

type LoadedOpinion = {
  rating: number | null;
  review: string | null;
};

type OpinionSheetProps = {
  isSignedIn: boolean;
  load: () => Promise<LoadedOpinion>;
  mediaLabel: string;
  mediaMeta?: string | null;
  onChanged: () => void;
  ownerKey?: string | null;
  perform: (operation: OpinionOperation) => Promise<void>;
  posterUrl?: string | null;
  resourceKey?: string;
  signedOutMessage: string;
};

export function OpinionSheet({
  isSignedIn,
  load,
  mediaLabel,
  mediaMeta,
  onChanged,
  ownerKey,
  perform,
  posterUrl,
  resourceKey,
  signedOutMessage,
}: OpinionSheetProps) {
  const { currentUser } = useAuthSession();
  const { showToast } = useToast();
  const { fontScale } = useWindowDimensions();
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [opinion, setOpinion] = useState<OpinionState>(() => createOpinionState(null, null));
  const requestScope = JSON.stringify([ownerKey ?? currentUser?.id ?? null, resourceKey ?? mediaLabel, isSignedIn]);
  const draftRatingRef = useRef(opinion.draftRating);
  const ratingTrackWidthRef = useRef(STAR_TRACK_WIDTH);
  const requestRef = useRef({ scope: requestScope, version: 0 });
  const triggerLayout = resolveOpinionTriggerLayout(Boolean(loadError), fontScale);
  draftRatingRef.current = opinion.draftRating;

  if (requestRef.current.scope !== requestScope) {
    requestRef.current = { scope: requestScope, version: requestRef.current.version + 1 };
  }

  const loadOpinion = useCallback(async () => {
    const scope = requestScope;
    const version = requestRef.current.version + 1;
    requestRef.current = { scope, version };
    const isCurrent = () => requestRef.current.scope === scope && requestRef.current.version === version;

    if (!isSignedIn) {
      setIsLoading(false);
      setOpinion(createOpinionState(null, null));
      setLoadError(null);
      return;
    }

    setIsLoading(true);
    setLoadError(null);
    try {
      const loaded = await load();
      if (!isCurrent()) return;
      setOpinion(createOpinionState(loaded.rating, loaded.review));
    } catch {
      if (!isCurrent()) return;
      setLoadError('Could not load your opinion.');
    } finally {
      if (isCurrent()) setIsLoading(false);
    }
  }, [isSignedIn, load, requestScope]);

  useEffect(() => {
    setIsOpen(false);
    setIsSaving(false);
    setIsSignInOpen(false);
    setOpinion(createOpinionState(null, null));
    void loadOpinion();
  }, [loadOpinion, requestScope]);

  const summary = useMemo(() => {
    if (!isSignedIn) return signedOutMessage;
    if (isLoading) return 'Loading your opinion…';
    if (loadError) return loadError;
    if (opinion.savedRating === null) return 'Add a half-star rating and an optional written review.';
    return opinion.savedReview
      ? `${opinion.savedRating}/5 · Review added`
      : `${opinion.savedRating}/5 · No written review`;
  }, [isLoading, isSignedIn, loadError, opinion.savedRating, opinion.savedReview, signedOutMessage]);

  function closeSheet() {
    if (isSaving) return;
    setOpinion((current) => resetOpinionDraft(current));
    setIsOpen(false);
  }

  function selectDraftRating(draftRating: number | null) {
    if (draftRating === draftRatingRef.current) return;
    draftRatingRef.current = draftRating;
    hapticSelection();
    setOpinion((current) => ({ ...current, draftRating, error: null }));
  }

  function selectRatingAtTouch(event: GestureResponderEvent) {
    selectDraftRating(getRatingFromTrackPosition(
      event.nativeEvent.locationX,
      ratingTrackWidthRef.current,
    ));
  }

  async function runOperations(operations: OpinionOperation[]) {
    if (operations.length === 0 || isSaving) return false;

    const scope = requestScope;
    const version = requestRef.current.version + 1;
    requestRef.current = { scope, version };
    const isCurrent = () => requestRef.current.scope === scope && requestRef.current.version === version;
    let next = beginOpinionOperations(opinion);
    setOpinion(next);
    setIsSaving(true);
    let changed = false;

    try {
      for (const operation of operations) {
        try {
          await perform(operation);
          if (!isCurrent()) return false;
          next = applyOperationSuccess(next, operation);
          changed = true;
          setOpinion(next);
        } catch {
          if (!isCurrent()) return false;
          next = applyOperationFailure(next, operation, operationError(operation));
          setOpinion(next);
          hapticError();
          return false;
        }
      }
      if (changed) hapticConfirm();
      return true;
    } finally {
      if (isCurrent()) {
        setIsSaving(false);
        if (changed) onChanged();
      }
    }
  }

  async function save() {
    const succeeded = await runOperations(buildSavePlan(opinion));
    if (!succeeded) return;

    setIsOpen(false);
    setOpinion((current) => resetOpinionDraft(current));
    showToast('Your opinion was saved.', 'success');
  }

  function confirmDeleteReview() {
    Alert.alert(
      'Delete review?',
      'Your rating will be kept. This cannot be undone.',
      [
        { style: 'cancel', text: 'Cancel' },
        {
          onPress: () => {
            void (async () => {
              const succeeded = await runOperations(buildDeleteReviewPlan(opinion));
              if (succeeded) showToast('Your review was deleted.', 'success');
            })();
          },
          style: 'destructive',
          text: 'Delete review',
        },
      ],
    );
  }

  function confirmClearRating() {
    const alsoDeletesReview = opinion.savedReview !== null;
    Alert.alert(
      'Clear rating?',
      alsoDeletesReview
        ? 'Your written review must also be deleted because a review requires a rating. This cannot be undone.'
        : 'This cannot be undone.',
      [
        { style: 'cancel', text: 'Cancel' },
        {
          onPress: () => {
            void (async () => {
              const succeeded = await runOperations(buildClearPlan(opinion));
              if (!succeeded) return;
              setIsOpen(false);
              showToast('Your rating was cleared.', 'success');
            })();
          },
          style: 'destructive',
          text: 'Clear rating',
        },
      ],
    );
  }

  return (
    <View style={styles.triggerPanel}>
      <Text style={styles.triggerTitle}>Your opinion</Text>
      <View style={[styles.triggerContent, triggerLayout.contentStacked ? styles.triggerContentStacked : null]}>
        <Text style={[styles.triggerBody, loadError ? styles.errorText : null]}>{summary}</Text>
        <View style={[
          styles.triggerAction,
          triggerLayout.contentStacked ? styles.triggerActionStacked : null,
          { maxWidth: triggerLayout.actionMaxWidth },
        ]}>
          {isLoading ? <ActivityIndicator color={colors.rating} /> : null}
          {isSignedIn && !loadError ? (
            <Button
              compact
              disabled={isLoading}
              label={opinion.savedRating === null ? 'Rate & review' : 'Edit opinion'}
              onPress={() => setIsOpen(true)}
            />
          ) : null}
          {!isSignedIn ? <Button compact label="Sign in here" onPress={() => setIsSignInOpen(true)} /> : null}
          {loadError && isSignedIn ? <Button compact label="Retry" onPress={() => void loadOpinion()} variant="ghost" /> : null}
        </View>
      </View>

      <BottomActionSheet onClose={closeSheet} title="Your opinion" visible={isOpen}>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.identity}>
            {posterUrl ? (
              <Image
                accessibilityIgnoresInvertColors
                accessibilityLabel={`${mediaLabel} poster`}
                source={{ uri: posterUrl }}
                style={styles.poster}
              />
            ) : null}
            <View style={styles.identityCopy}>
              <Text numberOfLines={2} style={styles.mediaTitle}>{mediaLabel}</Text>
              {mediaMeta ? <Text style={styles.meta}>{mediaMeta}</Text> : null}
            </View>
          </View>

          <View style={styles.scoreZone}>
            <View
              accessibilityActions={[
                { label: 'Increase rating by half a star', name: 'increment' },
                { label: 'Decrease rating by half a star', name: 'decrement' },
              ]}
              accessibilityLabel="Rating"
              accessibilityRole="adjustable"
              accessibilityState={{ disabled: isSaving }}
              accessibilityValue={getRatingAccessibilityValue(opinion.draftRating)}
              onAccessibilityAction={(event) => {
                const value = draftRatingRef.current ?? 0;
                const nextRating = event.nativeEvent.actionName === 'increment'
                  ? Math.min(5, value + 0.5)
                  : value <= 0.5
                    ? null
                    : value - 0.5;
                selectDraftRating(nextRating);
              }}
              onLayout={(event) => { ratingTrackWidthRef.current = event.nativeEvent.layout.width; }}
              onMoveShouldSetResponder={() => !isSaving}
              onResponderGrant={selectRatingAtTouch}
              onResponderMove={selectRatingAtTouch}
              onResponderTerminationRequest={() => true}
              onStartShouldSetResponder={() => !isSaving}
              style={styles.stars}
            >
              {STAR_VALUES.map((star) => (
                <RatingStar
                  key={star}
                  score={opinion.draftRating}
                  star={star}
                />
              ))}
            </View>
            <Text accessibilityLiveRegion="polite" style={styles.scoreLabel}>
              {opinion.draftRating === null ? 'Tap to rate' : `${opinion.draftRating} / 5`}
            </Text>
            <Text style={styles.help}>Tap or slide across the stars. With VoiceOver, swipe up or down to adjust.</Text>
          </View>

          <View style={styles.reviewHeader}>
            <Text style={styles.reviewLabel}>Optional written review</Text>
            <Text style={styles.counter}>{opinion.draftReview.length} / {MAX_REVIEW_LENGTH}</Text>
          </View>
          <TextInput
            accessibilityLabel="Written review"
            editable={!isSaving && opinion.draftRating !== null}
            maxLength={MAX_REVIEW_LENGTH}
            multiline
            onChangeText={(draftReview) => setOpinion((current) => ({ ...current, draftReview, error: null }))}
            placeholder={opinion.draftRating === null ? 'Choose a rating before writing a review' : 'Write your review'}
            placeholderTextColor={colors.textSubtle}
            style={styles.reviewInput}
            textAlignVertical="top"
            value={opinion.draftReview}
          />
          <Text style={styles.reviewHelp}>Written reviews stay private or public according to your profile privacy setting.</Text>

          {opinion.error ? <Text accessibilityLiveRegion="assertive" style={styles.operationError}>{opinion.error}</Text> : null}

          <View style={styles.destructiveActions}>
            {opinion.savedReview !== null ? (
              <Button
                disabled={isSaving}
                icon={<Trash2 color={colors.danger} size={17} />}
                label="Delete review"
                onPress={confirmDeleteReview}
                variant="ghost"
              />
            ) : null}
            {opinion.savedRating !== null ? (
              <Button disabled={isSaving} label="Clear rating" onPress={confirmClearRating} variant="ghost" />
            ) : null}
          </View>
          <View style={[styles.sheetActions, triggerLayout.actionsStacked ? styles.sheetActionsStacked : null]}>
            <View style={styles.actionButton}><Button disabled={isSaving} fullWidth label="Cancel" onPress={closeSheet} variant="secondary" /></View>
            <View style={styles.saveButton}>
              <Button
                disabled={!canSaveOpinion(opinion)}
                fullWidth
                label="Save"
                loading={isSaving}
                onPress={() => void save()}
              />
            </View>
          </View>
          {isOpinionDirty(opinion) ? <Text style={styles.unsaved}>Unsaved changes</Text> : null}
        </ScrollView>
      </BottomActionSheet>
      <SignInSheet
        body={signedOutMessage}
        onClose={() => setIsSignInOpen(false)}
        title="Sign in to rate and review"
        visible={isSignInOpen && !isSignedIn}
      />
    </View>
  );
}

function RatingStar({
  score,
  star,
}: {
  score: number | null;
  star: number;
}) {
  const fill = score === null || score <= star - 1 ? 0 : score >= star ? STAR_ICON_SIZE : STAR_ICON_SIZE / 2;

  return (
    <View
      accessible={false}
      pointerEvents="none"
      style={styles.starTarget}
    >
      <View style={styles.starFrame}>
        <Star color={colors.textSubtle} size={STAR_ICON_SIZE} strokeWidth={2} />
        <View style={[styles.starClip, { width: fill }]}>
          <Star color={colors.rating} fill={colors.rating} size={STAR_ICON_SIZE} strokeWidth={2} />
        </View>
      </View>
    </View>
  );
}

function operationError(operation: OpinionOperation) {
  switch (operation.kind) {
    case 'saveRating': return 'Could not save your rating.';
    case 'saveReview': return 'Could not save your review.';
    case 'deleteReview': return 'Could not delete your review.';
    case 'clearRating': return 'Could not clear your rating.';
  }
}

const styles = StyleSheet.create({
  actionButton: { flex: 1 },
  counter: { ...typography.meta, color: colors.textSubtle },
  destructiveActions: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: spacing.sm },
  errorText: { color: colors.danger },
  help: { ...typography.meta, color: colors.textSubtle, marginTop: spacing.xs },
  identity: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: spacing.md, paddingBottom: spacing.md },
  identityCopy: { flex: 1 },
  mediaTitle: { ...typography.title, color: colors.text },
  meta: { ...typography.meta, color: colors.textMuted, marginTop: spacing.xs },
  operationError: { ...typography.body, color: colors.danger, marginTop: spacing.md },
  poster: { backgroundColor: colors.panelSoft, borderRadius: radii.sm, height: 72, width: 48 },
  reviewHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm, marginTop: spacing.lg },
  reviewHelp: { ...typography.meta, color: colors.textSubtle, marginTop: spacing.sm },
  reviewInput: { ...typography.body, backgroundColor: colors.background, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, color: colors.text, minHeight: 120, padding: spacing.md },
  reviewLabel: { color: colors.text, fontSize: 14, fontWeight: '700' },
  saveButton: { flex: 1.45 },
  scoreLabel: { color: colors.ratingText, fontSize: 15, fontWeight: '800', marginTop: spacing.sm },
  scoreZone: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: spacing.lg },
  sheetActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  sheetActionsStacked: { flexDirection: 'column' },
  starClip: { height: STAR_ICON_SIZE, left: 0, overflow: 'hidden', position: 'absolute', top: 0 },
  starFrame: { height: STAR_ICON_SIZE, width: STAR_ICON_SIZE },
  starTarget: { alignItems: 'center', height: STAR_TARGET_SIZE, justifyContent: 'center', width: STAR_TARGET_SIZE },
  stars: { flexDirection: 'row', gap: STAR_GAP },
  triggerAction: { flexShrink: 0, width: '35%' },
  triggerActionStacked: { alignSelf: 'flex-start', width: 'auto' },
  triggerBody: { ...typography.body, color: colors.textMuted, flex: 1, minWidth: 0 },
  triggerContent: { alignItems: 'center', alignSelf: 'stretch', flexDirection: 'row', gap: spacing.md },
  triggerContentStacked: { alignItems: 'stretch', flexDirection: 'column' },
  triggerPanel: { ...shadows.panel, backgroundColor: colors.panelElevated, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, gap: spacing.md, marginBottom: spacing.md, padding: spacing.lg },
  triggerTitle: { ...typography.title, color: colors.text },
  unsaved: { ...typography.meta, color: colors.textSubtle, marginBottom: spacing.lg, marginTop: spacing.sm, textAlign: 'center' },
});
