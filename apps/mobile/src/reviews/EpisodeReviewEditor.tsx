import { useCallback, useEffect, useState } from 'react';
import { getEpisodeRating } from '../api/ratings';
import { deleteEpisodeReview, getEpisodeReview, upsertEpisodeReview } from '../api/reviews';
import { useAuthSession } from '../auth/AuthSessionContext';
import { ReviewEditor, useReviewState } from './ReviewEditor';

type EpisodeReviewEditorProps = {
  episodeNumber: number;
  seasonNumber: number;
  seriesTmdbId: number;
};

export function EpisodeReviewEditor({
  episodeNumber,
  seasonNumber,
  seriesTmdbId,
}: EpisodeReviewEditorProps) {
  const { firebaseIdToken, notifyTrackingChanged, trackingRevision } = useAuthSession();
  const [isRatingLoading, setIsRatingLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [ratingScore, setRatingScore] = useState<number | null>(null);
  const loadReview = useCallback(async () => {
    if (!firebaseIdToken) {
      return null;
    }

    const review = await getEpisodeReview(firebaseIdToken, seriesTmdbId, seasonNumber, episodeNumber);

    return review?.body ?? null;
  }, [episodeNumber, firebaseIdToken, seasonNumber, seriesTmdbId, trackingRevision]);
  const reviewState = useReviewState(loadReview);

  const loadRating = useCallback(async () => {
    if (!firebaseIdToken) {
      setRatingScore(null);
      return;
    }

    setIsRatingLoading(true);

    try {
      const rating = await getEpisodeRating(firebaseIdToken, seriesTmdbId, seasonNumber, episodeNumber);

      setRatingScore(rating?.score ?? null);
    } catch {
      setRatingScore(null);
    } finally {
      setIsRatingLoading(false);
    }
  }, [episodeNumber, firebaseIdToken, seasonNumber, seriesTmdbId, trackingRevision]);

  useEffect(() => {
    void loadRating();
  }, [loadRating]);

  async function saveReview() {
    if (!firebaseIdToken || isSaving || ratingScore === null) {
      return;
    }

    reviewState.setError(null);
    setIsSaving(true);

    try {
      const review = await upsertEpisodeReview(
        firebaseIdToken,
        seriesTmdbId,
        seasonNumber,
        episodeNumber,
        reviewState.body,
      );

      reviewState.setBody(review.body);
      reviewState.setSavedBody(review.body);
      notifyTrackingChanged();
    } catch {
      reviewState.setError('Could not save your review.');
    } finally {
      setIsSaving(false);
    }
  }

  async function removeReview() {
    if (!firebaseIdToken || isSaving || reviewState.savedBody === null) {
      return;
    }

    reviewState.setError(null);
    setIsSaving(true);

    try {
      await deleteEpisodeReview(firebaseIdToken, seriesTmdbId, seasonNumber, episodeNumber);
      reviewState.setBody('');
      reviewState.setSavedBody(null);
      notifyTrackingChanged();
    } catch {
      reviewState.setError('Could not delete your review.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <ReviewEditor
      body={reviewState.body}
      error={reviewState.error}
      isDisabled={isSaving || reviewState.isLoading || isRatingLoading}
      isLoading={isSaving || reviewState.isLoading || isRatingLoading}
      isSignedIn={Boolean(firebaseIdToken)}
      onBodyChange={reviewState.setBody}
      onDelete={removeReview}
      onSave={saveReview}
      ratingScore={ratingScore}
      savedBody={reviewState.savedBody}
      signedOutBody="Sign in from Profile to review this episode."
      title="My episode review"
    />
  );
}
