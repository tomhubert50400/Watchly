import { useCallback } from 'react';
import {
  deleteSeriesRating,
  getSeriesRating,
  upsertSeriesRating,
} from '../api/ratings';
import { useAuthSession } from '../auth/AuthSessionContext';
import { OpinionSheet } from '../opinions/OpinionSheet';
import { OpinionOperation } from '../opinions/opinionState';
import { notifyUserDataChanged } from '../sync/userDataEvents';

type SeriesRatingControlProps = {
  posterUrl?: string | null;
  seriesTitle?: string;
  seriesTmdbId: number;
};

export function SeriesRatingControl({
  posterUrl,
  seriesTitle = 'This series',
  seriesTmdbId,
}: SeriesRatingControlProps) {
  const { currentUser, firebaseIdToken } = useAuthSession();
  const load = useCallback(async () => {
    if (!firebaseIdToken) return { rating: null, review: null };
    const rating = await getSeriesRating(firebaseIdToken, seriesTmdbId);

    return { rating: rating?.score ?? null, review: null };
  }, [firebaseIdToken, seriesTmdbId]);

  const perform = useCallback(async (operation: OpinionOperation) => {
    if (!firebaseIdToken) throw new Error('Sign in required.');

    if (operation.kind === 'saveRating') {
      await upsertSeriesRating(firebaseIdToken, seriesTmdbId, operation.score);
      return;
    }

    if (operation.kind === 'clearRating') {
      await deleteSeriesRating(firebaseIdToken, seriesTmdbId);
      return;
    }

    throw new Error('Series reviews are not supported.');
  }, [firebaseIdToken, seriesTmdbId]);

  return (
    <OpinionSheet
      isSignedIn={Boolean(firebaseIdToken)}
      key={`${currentUser?.id ?? 'signed-out'}:series:${seriesTmdbId}`}
      load={load}
      mediaLabel={seriesTitle}
      onChanged={() => notifyUserDataChanged('opinions')}
      ownerKey={currentUser?.id ?? null}
      perform={perform}
      posterUrl={posterUrl}
      resourceKey={`series:${seriesTmdbId}`}
      reviewsEnabled={false}
      signedOutMessage="You need to be signed in to rate this series. Sign in here to continue."
    />
  );
}
