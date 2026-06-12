import { useCallback, useEffect, useState } from 'react';
import { deleteMovieRating, getMovieRating, upsertMovieRating } from '../api/ratings';
import { useAuthSession } from '../auth/AuthSessionContext';
import { StarRatingPanel } from './StarRatingPanel';

type MovieRatingControlProps = {
  tmdbId: number;
};

export function MovieRatingControl({ tmdbId }: MovieRatingControlProps) {
  const { firebaseIdToken, notifyTrackingChanged } = useAuthSession();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [score, setScore] = useState<number | null>(null);

  const loadRating = useCallback(async () => {
    if (!firebaseIdToken) {
      setScore(null);
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const rating = await getMovieRating(firebaseIdToken, tmdbId);

      setScore(rating?.score ?? null);
    } catch {
      setError('Could not load your rating.');
    } finally {
      setIsLoading(false);
    }
  }, [firebaseIdToken, tmdbId]);

  useEffect(() => {
    void loadRating();
  }, [loadRating]);

  async function saveRating(nextScore: number) {
    if (!firebaseIdToken || isSaving) {
      return;
    }

    setError(null);
    setIsSaving(true);

    try {
      const rating = await upsertMovieRating(firebaseIdToken, tmdbId, nextScore);

      setScore(rating.score);
      notifyTrackingChanged();
    } catch {
      setError('Could not save your rating.');
    } finally {
      setIsSaving(false);
    }
  }

  async function clearRating() {
    if (!firebaseIdToken || isSaving || score === null) {
      return;
    }

    setError(null);
    setIsSaving(true);

    try {
      await deleteMovieRating(firebaseIdToken, tmdbId);
      setScore(null);
      notifyTrackingChanged();
    } catch {
      setError('Could not clear your rating.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <StarRatingPanel
      body={firebaseIdToken ? 'Rate this film from 0.5 to 5 stars.' : 'Sign in from Profile to rate this film.'}
      error={error}
      isDisabled={isSaving}
      isLoading={isLoading || isSaving}
      isSignedIn={Boolean(firebaseIdToken)}
      onClear={clearRating}
      onSelect={(nextScore) => void saveRating(nextScore)}
      score={score}
      title="My rating"
    />
  );
}
