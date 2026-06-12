import { useCallback, useState } from 'react';
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
  const { firebaseIdToken } = useAuthSession();
  const [isSaving, setIsSaving] = useState(false);
  const loadReview = useCallback(async () => {
    if (!firebaseIdToken) {
      return null;
    }

    const review = await getEpisodeReview(firebaseIdToken, seriesTmdbId, seasonNumber, episodeNumber);

    return review?.body ?? null;
  }, [episodeNumber, firebaseIdToken, seasonNumber, seriesTmdbId]);
  const reviewState = useReviewState(loadReview);

  async function saveReview() {
    if (!firebaseIdToken || isSaving) {
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
      isDisabled={isSaving || reviewState.isLoading}
      isLoading={isSaving || reviewState.isLoading}
      isSignedIn={Boolean(firebaseIdToken)}
      onBodyChange={reviewState.setBody}
      onDelete={removeReview}
      onSave={saveReview}
      savedBody={reviewState.savedBody}
      signedOutBody="Sign in from Profile to review this episode."
      title="My episode review"
    />
  );
}
