import { useCallback, useState } from 'react';
import { deleteMovieReview, getMovieReview, upsertMovieReview } from '../api/reviews';
import { useAuthSession } from '../auth/AuthSessionContext';
import { ReviewEditor, useReviewState } from './ReviewEditor';

type MovieReviewEditorProps = {
  tmdbId: number;
};

export function MovieReviewEditor({ tmdbId }: MovieReviewEditorProps) {
  const { firebaseIdToken } = useAuthSession();
  const [isSaving, setIsSaving] = useState(false);
  const loadReview = useCallback(async () => {
    if (!firebaseIdToken) {
      return null;
    }

    const review = await getMovieReview(firebaseIdToken, tmdbId);

    return review?.body ?? null;
  }, [firebaseIdToken, tmdbId]);
  const reviewState = useReviewState(loadReview);

  async function saveReview() {
    if (!firebaseIdToken || isSaving) {
      return;
    }

    reviewState.setError(null);
    setIsSaving(true);

    try {
      const review = await upsertMovieReview(firebaseIdToken, tmdbId, reviewState.body);

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
      await deleteMovieReview(firebaseIdToken, tmdbId);
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
      signedOutBody="Sign in from Profile to review this film."
      title="My review"
    />
  );
}
