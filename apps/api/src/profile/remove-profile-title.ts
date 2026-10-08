import type { Prisma } from '../generated/prisma/client';

export async function removeProfileTitleData(tx: Prisma.TransactionClient, userId: string, contentType: 'movie' | 'series', tmdbId: number) {
  if (contentType === 'movie') {
    await tx.userMovieReview.deleteMany({ where: { userId, tmdbId } });
    await tx.userMovieRating.deleteMany({ where: { userId, tmdbId } });
  } else {
    const where = { userId, seriesTmdbId: tmdbId };
    await tx.userEpisodeReview.deleteMany({ where });
    await tx.userEpisodeRating.deleteMany({ where });
    await tx.userSeriesRating.deleteMany({ where });
    await tx.userEpisodeProgress.deleteMany({ where });
  }
  const trackedType = contentType === 'movie' ? 'MOVIE' : 'SERIES';
  await tx.viewingEvent.deleteMany({ where: { userId, tmdbId, contentType: contentType === 'movie' ? 'MOVIE' : 'EPISODE' } });
  await tx.releaseAlertSubscription.deleteMany({ where: { userId, tmdbId, contentType: trackedType } });
  await tx.userContentState.deleteMany({ where: { userId, tmdbId, contentType: trackedType } });
  await tx.user.updateMany({
    where: { id: userId, profileBackdropContentType: trackedType, profileBackdropTmdbId: tmdbId },
    data: { profileBackdropContentType: null, profileBackdropTmdbId: null },
  });
}
