import { useCallback } from 'react';
import { deleteMovieRating, getMovieRating, upsertMovieRating } from '../api/ratings';
import { deleteMovieReview, getMovieReview, upsertMovieReview } from '../api/reviews';
import { useAuthSession } from '../auth/AuthSessionContext';
import { OpinionSheet } from '../opinions/OpinionSheet';
import { OpinionOperation } from '../opinions/opinionState';

type MovieRatingControlProps = {
  mediaTitle?: string;
  posterUrl?: string | null;
  tmdbId: number;
};

export function MovieRatingControl({ mediaTitle = 'This film', posterUrl, tmdbId }: MovieRatingControlProps) {
  const { firebaseIdToken, notifyTrackingChanged } = useAuthSession();
  const load = useCallback(async () => {
    if (!firebaseIdToken) return { rating: null, review: null };
    const [rating, review] = await Promise.all([
      getMovieRating(firebaseIdToken, tmdbId),
      getMovieReview(firebaseIdToken, tmdbId),
    ]);
    return { rating: rating?.score ?? null, review: review?.body ?? null };
  }, [firebaseIdToken, tmdbId]);

  const perform = useCallback(async (operation: OpinionOperation) => {
    if (!firebaseIdToken) throw new Error('Sign in required.');
    switch (operation.kind) {
      case 'saveRating':
        await upsertMovieRating(firebaseIdToken, tmdbId, operation.score);
        return;
      case 'saveReview':
        await upsertMovieReview(firebaseIdToken, tmdbId, operation.body);
        return;
      case 'deleteReview':
        await deleteMovieReview(firebaseIdToken, tmdbId);
        return;
      case 'clearRating':
        await deleteMovieRating(firebaseIdToken, tmdbId);
    }
  }, [firebaseIdToken, tmdbId]);

  return (
    <OpinionSheet
      isSignedIn={Boolean(firebaseIdToken)}
      load={load}
      mediaLabel={mediaTitle}
      onChanged={notifyTrackingChanged}
      perform={perform}
      posterUrl={posterUrl}
      signedOutMessage="Sign in from Profile to rate or review this film."
    />
  );
}
