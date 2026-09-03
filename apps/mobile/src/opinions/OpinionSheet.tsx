import { SquarePen, Star, Trash2 } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  GestureResponderEvent,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  BottomActionSheet,
  BottomActionSheetScrollView,
} from '../components/BottomActionSheet';
import { Button } from '../components/Button';
import { StarRatingDisplay } from '../components/StarRatingDisplay';
import { useAuthSession } from '../auth/AuthSessionContext';
import { SignInSheet } from '../auth/SignInRequired';
import {
  getPrivateCacheKey,
  readPersistedCache,
  writePersistedCache,
} from '../cache/persistedCache';
import { colors, radii, shadows, spacing, touchTargets, typography } from '../design/tokens';
import { hapticError } from '../feedback/haptics';
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
const ACTIVITY_STAR_TRACK_WIDTH = 138;

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
  triggerVariant?: 'activity' | 'default';
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
  triggerVariant = 'default',
}: OpinionSheetProps) {
  const { currentUser } = useAuthSession();
  const { showToast } = useToast();
  const { fontScale } = useWindowDimensions();
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [opinion, setOpinion] = useState<OpinionState>(() => createOpinionState(null, null));
  const activityBatchChangedRef = useRef(false);
  const activityConfirmedRatingRef = useRef<number | null>(null);
  const activityMutationQueueRef = useRef<Promise<void>>(Promise.resolve());
  const activityPendingMutationCountRef = useRef(0);
  const activityRatingGestureActiveRef = useRef(false);
  const activityRatingTrackWidthRef = useRef(ACTIVITY_STAR_TRACK_WIDTH);
  const requestScope = JSON.stringify([ownerKey ?? currentUser?.id ?? null, resourceKey ?? mediaLabel, isSignedIn]);
  const cacheOwnerId = ownerKey ?? currentUser?.id ?? null;
  const cacheKey = cacheOwnerId
    ? getPrivateCacheKey(cacheOwnerId, `opinion:${resourceKey ?? mediaLabel}`)
    : null;
  const draftRatingRef = useRef(opinion.draftRating);
  const ratingTrackWidthRef = useRef(STAR_TRACK_WIDTH);
  const requestRef = useRef({ scope: requestScope, version: 0 });
  const triggerLayout = resolveOpinionTriggerLayout(fontScale);
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
      setOpinion(createOpinionState(null, null));
      setLoadError(null);
      return;
    }

    setLoadError(null);
    try {
      if (cacheKey) {
        const cached = await readPersistedCache<LoadedOpinion>(cacheKey).catch(() => null);
        if (cached && isCurrent()) {
          setOpinion(createOpinionState(cached.data.rating, cached.data.review));
        }
      }
      const loaded = await load();
      if (!isCurrent()) return;
      setOpinion(createOpinionState(loaded.rating, loaded.review));
      if (cacheKey) void writePersistedCache(cacheKey, loaded).catch(() => undefined);
    } catch {
      if (!isCurrent()) return;
      setLoadError('Could not load your opinion.');
    }
  }, [cacheKey, isSignedIn, load, requestScope]);

  useEffect(() => {
    setIsOpen(false);
    setIsSaving(false);
    setIsSignInOpen(false);
    setOpinion(createOpinionState(null, null));
    void loadOpinion();
  }, [loadOpinion, requestScope]);

  const summary = useMemo(() => {
    if (!isSignedIn) return signedOutMessage;
    if (loadError) return loadError;
    if (opinion.savedRating === null) return 'Add a half-star rating and an optional written review.';
    return opinion.savedReview
      ? `${opinion.savedRating}/5 · Review added`
      : `${opinion.savedRating}/5 · No written review`;
  }, [isSignedIn, loadError, opinion.savedRating, opinion.savedReview, signedOutMessage]);

  function closeSheet() {
    if (isSaving) return;
    setOpinion((current) => resetOpinionDraft(current));
    setIsOpen(false);
  }

  function selectDraftRating(draftRating: number | null) {
    if (draftRating === draftRatingRef.current) return;
    draftRatingRef.current = draftRating;
    setOpinion((current) => ({ ...current, draftRating, error: null }));
  }

  function selectRatingAtTouch(event: GestureResponderEvent) {
    selectDraftRating(getRatingFromTrackPosition(
      event.nativeEvent.locationX,
      ratingTrackWidthRef.current,
    ));
  }

  function openTrigger() {
    if (!isSignedIn) {
      setIsSignInOpen(true);
      return;
    }

    if (loadError) {
      void loadOpinion();
      return;
    }

    setIsOpen(true);
  }

  async function runOperations(operations: OpinionOperation[], baseOpinion = opinion) {
    if (operations.length === 0 || isSaving) return false;

    const scope = requestScope;
    const version = requestRef.current.version + 1;
    requestRef.current = { scope, version };
    const isCurrent = () => requestRef.current.scope === scope && requestRef.current.version === version;
    let confirmed = beginOpinionOperations(baseOpinion);
    const optimistic = operations.reduce(applyOperationSuccess, confirmed);
    setOpinion(optimistic);
    if (cacheKey) {
      void writePersistedCache(cacheKey, {
        rating: optimistic.savedRating,
        review: optimistic.savedReview,
      }).catch(() => undefined);
    }
    setIsSaving(true);
    let changed = false;

    try {
      for (const operation of operations) {
        try {
          await perform(operation);
          if (!isCurrent()) return false;
          confirmed = applyOperationSuccess(confirmed, operation);
          changed = true;
        } catch {
          if (!isCurrent()) return false;
          const failed = applyOperationFailure(confirmed, operation, operationError(operation));
          setOpinion(failed);
          if (cacheKey) {
            void writePersistedCache(cacheKey, {
              rating: failed.savedRating,
              review: failed.savedReview,
            }).catch(() => undefined);
          }
          hapticError();
          showToast(failed.error ?? operationError(operation));
          return false;
        }
      }
      setOpinion(confirmed);
      return true;
    } finally {
      if (isCurrent()) {
        setIsSaving(false);
        if (changed) onChanged();
      }
    }
  }

  async function save() {
    setIsOpen(false);
    const succeeded = await runOperations(buildSavePlan(opinion));
    if (!succeeded) {
      setIsOpen(true);
      return;
    }
    setOpinion((current) => resetOpinionDraft(current));
  }

  async function saveActivityRating(score: number) {
    if (!isSignedIn) {
      setIsSignInOpen(true);
      return;
    }

    if (loadError) {
      void loadOpinion();
      return;
    }

    if (opinion.savedRating === score) return;
    if (activityPendingMutationCountRef.current === 0) {
      activityConfirmedRatingRef.current = opinion.savedRating;
      activityBatchChangedRef.current = false;
    }
    const scope = requestScope;
    requestRef.current = { scope, version: requestRef.current.version + 1 };
    draftRatingRef.current = score;
    setOpinion((current) => {
      const optimistic = applyOperationSuccess(
        beginOpinionOperations({ ...current, draftRating: score }),
        { kind: 'saveRating', score },
      );
      if (cacheKey) {
        void writePersistedCache(cacheKey, {
          rating: optimistic.savedRating,
          review: optimistic.savedReview,
        }).catch(() => undefined);
      }
      return optimistic;
    });
    activityPendingMutationCountRef.current += 1;

    const commitMutation = async () => {
      try {
        await perform({ kind: 'saveRating', score });
        activityConfirmedRatingRef.current = score;
        activityBatchChangedRef.current = true;
      } catch {
        hapticError();
        showToast('Could not save your rating.');
      } finally {
        activityPendingMutationCountRef.current -= 1;
        if (activityPendingMutationCountRef.current === 0) {
          const confirmedRating = activityConfirmedRatingRef.current;
          if (!activityRatingGestureActiveRef.current) {
            draftRatingRef.current = confirmedRating;
          }
          setOpinion((current) => {
            const confirmed = {
              ...current,
              draftRating: activityRatingGestureActiveRef.current
                ? current.draftRating
                : confirmedRating,
              error: null,
              savedRating: confirmedRating,
              successfulOperations: [],
            };
            if (cacheKey) {
              void writePersistedCache(cacheKey, {
                rating: confirmed.savedRating,
                review: confirmed.savedReview,
              }).catch(() => undefined);
            }
            return confirmed;
          });
          if (activityBatchChangedRef.current) onChanged();
          activityBatchChangedRef.current = false;
        }
      }
    };
    const queuedMutation = activityMutationQueueRef.current.then(commitMutation, commitMutation);
    activityMutationQueueRef.current = queuedMutation.catch(() => undefined);
    await queuedMutation;
  }

  function beginActivityRatingGesture(event: GestureResponderEvent) {
    if (!isSignedIn) {
      setIsSignInOpen(true);
      return;
    }

    if (loadError) {
      void loadOpinion();
      return;
    }

    activityRatingGestureActiveRef.current = true;
    selectActivityRatingAtTouch(event);
  }

  function selectActivityRatingAtTouch(event: GestureResponderEvent) {
    if (!isSignedIn || loadError) return;
    selectDraftRating(getRatingFromTrackPosition(
      event.nativeEvent.locationX,
      activityRatingTrackWidthRef.current,
    ));
  }

  function saveActivityRatingAtRelease() {
    activityRatingGestureActiveRef.current = false;
    const score = draftRatingRef.current;
    if (score !== null) void saveActivityRating(score);
  }

  function cancelActivityRatingGesture() {
    activityRatingGestureActiveRef.current = false;
    draftRatingRef.current = opinion.savedRating;
    setOpinion((current) => ({ ...current, draftRating: current.savedRating }));
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
              await runOperations(buildDeleteReviewPlan(opinion));
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
              setIsOpen(false);
              const succeeded = await runOperations(buildClearPlan(opinion));
              if (!succeeded) setIsOpen(true);
            })();
          },
          style: 'destructive',
          text: 'Clear rating',
        },
      ],
    );
  }

  const sheetFooter = (
    <View>
      <View style={[styles.sheetActions, triggerLayout.actionsStacked ? styles.sheetActionsStacked : null]}>
        <View style={styles.actionButton}>
          <Button disabled={isSaving} fullWidth label="Cancel" onPress={closeSheet} variant="secondary" />
        </View>
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
    </View>
  );

  return (
    <View style={triggerVariant === 'activity' ? styles.activityRoot : styles.triggerPanel}>
      {triggerVariant === 'activity' ? (
        <View style={styles.activityOpinionRow}>
          <View style={styles.activityRatingCell}>
            <Text style={styles.activityLabel}>Your rating</Text>
            <View
              accessibilityActions={[
                { label: 'Increase rating by half a star', name: 'increment' },
                { label: 'Decrease rating by half a star', name: 'decrement' },
              ]}
              accessibilityLabel="Episode rating"
              accessibilityRole="adjustable"
              accessibilityState={{}}
              accessibilityValue={getRatingAccessibilityValue(opinion.savedRating)}
              onAccessibilityAction={(event) => {
                const value = opinion.savedRating ?? 0;
                const score = event.nativeEvent.actionName === 'increment'
                  ? Math.min(5, value + 0.5)
                  : Math.max(0.5, value - 0.5);
                void saveActivityRating(score);
              }}
              onLayout={(event) => {
                activityRatingTrackWidthRef.current = event.nativeEvent.layout.width;
              }}
              onMoveShouldSetResponder={() => true}
              onResponderGrant={beginActivityRatingGesture}
              onResponderMove={selectActivityRatingAtTouch}
              onResponderRelease={saveActivityRatingAtRelease}
              onResponderTerminate={cancelActivityRatingGesture}
              onResponderTerminationRequest={() => false}
              onStartShouldSetResponder={() => true}
              style={styles.activityStars}
            >
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                pointerEvents="none"
                style={styles.activityStarDisplay}
              >
                <StarRatingDisplay rating={opinion.draftRating ?? 0} size={26} spread />
              </View>
            </View>
          </View>
          <View style={styles.activityDivider} />
          <Pressable
            accessibilityLabel={opinion.savedReview ? 'Edit your review' : 'Write a review'}
            accessibilityRole="button"
            onPress={openTrigger}
            style={({ pressed }) => [styles.activityReviewCell, pressed && styles.activityPressed]}
          >
            <SquarePen color={colors.accentText} size={22} strokeWidth={2.1} />
            <Text style={styles.activityReviewLabel}>
              {opinion.savedReview ? 'Edit review' : 'Write a review'}
            </Text>
          </Pressable>
        </View>
      ) : (
        <>
          <Text style={styles.triggerTitle}>Your opinion</Text>
          <View style={styles.triggerContent}>
            <Text style={[styles.triggerBody, loadError ? styles.errorText : null]}>{summary}</Text>
            <View style={styles.triggerAction}>
              {isSignedIn && !loadError ? (
                <Button
                  fullWidth
                  label={opinion.savedRating === null ? 'Rate & review' : 'Edit opinion'}
                  onPress={() => setIsOpen(true)}
                />
              ) : null}
              {!isSignedIn ? <Button fullWidth label="Sign in here" onPress={() => setIsSignInOpen(true)} /> : null}
              {loadError && isSignedIn ? <Button fullWidth label="Retry" onPress={() => void loadOpinion()} variant="ghost" /> : null}
            </View>
          </View>
        </>
      )}

      <BottomActionSheet footer={sheetFooter} onClose={closeSheet} title="Your opinion" visible={isOpen}>
        <BottomActionSheetScrollView keyboardShouldPersistTaps="handled">
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
        </BottomActionSheetScrollView>
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
  activityDivider: { alignSelf: 'stretch', backgroundColor: colors.border, width: StyleSheet.hairlineWidth },
  activityLabel: { ...typography.meta, color: colors.textSubtle, marginBottom: spacing.xs },
  activityOpinionRow: { alignItems: 'stretch', flexDirection: 'row', minHeight: 70 },
  activityPressed: { opacity: 0.72 },
  activityRatingCell: { flex: 1, justifyContent: 'center', paddingRight: spacing.md },
  activityReviewCell: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: spacing.sm, justifyContent: 'center', paddingLeft: spacing.md },
  activityReviewLabel: { color: colors.accentText, fontSize: 14, fontWeight: '800' },
  activityRoot: { alignSelf: 'stretch' },
  activityStarDisplay: { flex: 1 },
  activityStars: { alignItems: 'center', alignSelf: 'stretch', flexDirection: 'row', minHeight: touchTargets.min },
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
  sheetActions: { flexDirection: 'row', gap: spacing.sm },
  sheetActionsStacked: { flexDirection: 'column' },
  starClip: { height: STAR_ICON_SIZE, left: 0, overflow: 'hidden', position: 'absolute', top: 0 },
  starFrame: { height: STAR_ICON_SIZE, width: STAR_ICON_SIZE },
  starTarget: { alignItems: 'center', height: STAR_TARGET_SIZE, justifyContent: 'center', width: STAR_TARGET_SIZE },
  stars: { flexDirection: 'row', gap: STAR_GAP },
  triggerAction: { alignSelf: 'stretch' },
  triggerBody: { ...typography.body, alignSelf: 'stretch', color: colors.textMuted },
  triggerContent: { alignItems: 'stretch', alignSelf: 'stretch', flexDirection: 'column', gap: spacing.md },
  triggerPanel: { ...shadows.panel, backgroundColor: colors.interactiveSurface, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, gap: spacing.md, marginBottom: spacing.md, padding: spacing.lg },
  triggerTitle: { ...typography.title, color: colors.text },
  unsaved: { ...typography.meta, color: colors.textSubtle, marginTop: spacing.sm, textAlign: 'center' },
});
