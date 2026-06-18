import { useCallback, useEffect, useState } from 'react';
import { deleteEpisodeRating, getEpisodeRating, upsertEpisodeRating } from '../api/ratings';
import { useAuthSession } from '../auth/AuthSessionContext';
import { StarRatingPanel } from './StarRatingPanel';

type EpisodeRatingControlProps = {
  episodeNumber: number;
  seasonNumber: number;
  seriesTmdbId: number;
};

export function EpisodeRatingControl({
  episodeNumber,
  seasonNumber,
  seriesTmdbId,
}: EpisodeRatingControlProps) {
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
      const rating = await getEpisodeRating(firebaseIdToken, seriesTmdbId, seasonNumber, episodeNumber);

      setScore(rating?.score ?? null);
    } catch {
      setError('Could not load your episode rating.');
    } finally {
      setIsLoading(false);
    }
  }, [episodeNumber, firebaseIdToken, seasonNumber, seriesTmdbId]);

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
      const rating = await upsertEpisodeRating(
        firebaseIdToken,
        seriesTmdbId,
        seasonNumber,
        episodeNumber,
        nextScore,
      );

      setScore(rating.score);
      notifyTrackingChanged();
    } catch {
      setError('Could not save your episode rating.');
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
      await deleteEpisodeRating(firebaseIdToken, seriesTmdbId, seasonNumber, episodeNumber);
      setScore(null);
      notifyTrackingChanged();
    } catch {
      setError('Could not clear your episode rating.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <StarRatingPanel
      body={
        firebaseIdToken
          ? 'Rate this episode from 0.5 to 5 stars.'
          : 'Sign in from Profile to rate this episode.'
      }
      error={error}
      isDisabled={isSaving}
      isLoading={isLoading || isSaving}
      isSignedIn={Boolean(firebaseIdToken)}
      onClear={clearRating}
      onSelect={(nextScore) => void saveRating(nextScore)}
      score={score}
      title="My episode rating"
    />
  );
}
