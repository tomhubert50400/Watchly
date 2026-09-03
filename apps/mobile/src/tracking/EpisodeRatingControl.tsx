import { useCallback } from 'react';
import { deleteEpisodeRating, getEpisodeRating, upsertEpisodeRating } from '../api/ratings';
import { deleteEpisodeReview, getEpisodeReview, upsertEpisodeReview } from '../api/reviews';
import { useAuthSession } from '../auth/AuthSessionContext';
import { notifyUserDataChanged } from '../sync/userDataEvents';
import { OpinionSheet } from '../opinions/OpinionSheet';
import { OpinionOperation } from '../opinions/opinionState';
import { buildEpisodeOpinionResourceKey } from './episodeOpinionScope';

type EpisodeRatingControlProps = {
  episodeNumber: number;
  mediaTitle?: string;
  posterUrl?: string | null;
  seasonNumber: number;
  seriesTmdbId: number;
  variant?: 'activity' | 'default';
};

export function EpisodeRatingControl({
  episodeNumber,
  mediaTitle = `Episode ${episodeNumber}`,
  posterUrl,
  seasonNumber,
  seriesTmdbId,
  variant = 'default',
}: EpisodeRatingControlProps) {
  const { currentUser, firebaseIdToken } = useAuthSession();
  const resourceKey = buildEpisodeOpinionResourceKey(
    currentUser?.id,
    seriesTmdbId,
    seasonNumber,
    episodeNumber,
  );
  const load = useCallback(async () => {
    if (!firebaseIdToken) return { rating: null, review: null };
    const [rating, review] = await Promise.all([
      getEpisodeRating(firebaseIdToken, seriesTmdbId, seasonNumber, episodeNumber),
      getEpisodeReview(firebaseIdToken, seriesTmdbId, seasonNumber, episodeNumber),
    ]);
    return { rating: rating?.score ?? null, review: review?.body ?? null };
  }, [episodeNumber, firebaseIdToken, seasonNumber, seriesTmdbId]);

  const perform = useCallback(async (operation: OpinionOperation) => {
    if (!firebaseIdToken) throw new Error('Sign in required.');
    switch (operation.kind) {
      case 'saveRating':
        await upsertEpisodeRating(firebaseIdToken, seriesTmdbId, seasonNumber, episodeNumber, operation.score);
        return;
      case 'saveReview':
        await upsertEpisodeReview(firebaseIdToken, seriesTmdbId, seasonNumber, episodeNumber, operation.body);
        return;
      case 'deleteReview':
        await deleteEpisodeReview(firebaseIdToken, seriesTmdbId, seasonNumber, episodeNumber);
        return;
      case 'clearRating':
        await deleteEpisodeRating(firebaseIdToken, seriesTmdbId, seasonNumber, episodeNumber);
    }
  }, [episodeNumber, firebaseIdToken, seasonNumber, seriesTmdbId]);

  return (
    <OpinionSheet
      isSignedIn={Boolean(firebaseIdToken)}
      load={load}
      mediaLabel={mediaTitle}
      mediaMeta={`Season ${seasonNumber} · Episode ${episodeNumber}`}
      onChanged={() => notifyUserDataChanged('opinions')}
      ownerKey={currentUser?.id}
      perform={perform}
      posterUrl={posterUrl}
      resourceKey={resourceKey}
      signedOutMessage="You need to be signed in to rate or review this episode. Sign in here to continue."
      triggerVariant={variant}
    />
  );
}
