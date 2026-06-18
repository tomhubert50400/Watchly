import { useCallback, useEffect, useState } from 'react';
import { getMovieRating } from '../api/ratings';
import { deleteMovieReview, getMovieReview, upsertMovieReview } from '../api/reviews';
import { useAuthSession } from '../auth/AuthSessionContext';
import { ReviewEditor, useReviewState } from './ReviewEditor';

type MovieReviewEditorProps = {
  tmdbId: number;
};

export function MovieReviewEditor({ tmdbId }: MovieReviewEditorProps) {
  const { firebaseIdToken, notifyTrackingChanged, trackingRevision } = useAuthSession();
  const [isRatingLoading, setIsRatingLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [ratingScore, setRatingScore] = useState<number | null>(null);
  const loadReview = useCallback(async () => {
    if (!firebaseIdToken) {
      return null;
    }

    const review = await getMovieReview(firebaseIdToken, tmdbId);

    return review?.body ?? null;
  }, [firebaseIdToken, tmdbId, trackingRevision]);
  const reviewState = useReviewState(loadReview);

  const loadRating = useCallback(async () => {
    if (!firebaseIdToken) {
      setRatingScore(null);
      return;
    }

    setIsRatingLoading(true);

    try {
      const rating = await getMovieRating(firebaseIdToken, tmdbId);

      setRatingScore(rating?.score ?? null);
    } catch {
      setRatingScore(null);
    } finally {
      setIsRatingLoading(false);
    }
  }, [firebaseIdToken, tmdbId, trackingRevision]);

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
      const review = await upsertMovieReview(firebaseIdToken, tmdbId, reviewState.body);

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
      await deleteMovieReview(firebaseIdToken, tmdbId);
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
      signedOutBody="Sign in from Profile to review this film."
      title="My review"
    />
  );
}
