import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../database/prisma.service';
import type { Prisma } from '../generated/prisma/client';
import { activeAccountWhere } from '../moderation/account-suspension';
import type { AvatarStorageService } from '../media/avatar-storage.service';
import { contentKey, rankCommunity, type CommunityContent, type CommunityItem } from './community-ranking';

const authorSelect = {
  id: true, displayName: true, avatarObjectKey: true,
  privacySettings: { select: { ratingsVisibility: true } },
} as const;

export async function communityFeed(prisma: PrismaService, avatar: AvatarStorageService, viewerId: string, cursor?: string) {
  const { now, offset } = readCommunityCursor(cursor);
  const since = new Date(now.getTime() - 90 * 86400000);
  const [follows, blocks, states, watchlist, alerts, history, progress] = await Promise.all([
    prisma.userFollow.findMany({ where: { followerId: viewerId, status: 'ACCEPTED' }, select: { followedUserId: true } }),
    prisma.userBlock.findMany({ where: { OR: [{ blockerId: viewerId }, { blockedUserId: viewerId }] } }),
    prisma.userContentState.findMany({ where: { userId: viewerId } }),
    prisma.personalWatchlistItem.findMany({ where: { watchlist: { userId: viewerId } }, select: { contentType: true, tmdbId: true } }),
    prisma.releaseAlertSubscription.findMany({ where: { userId: viewerId }, select: { contentType: true, tmdbId: true } }),
    prisma.viewingEvent.findMany({ where: { userId: viewerId }, select: { contentType: true, tmdbId: true, watchedAt: true } }),
    prisma.userEpisodeProgress.findMany({ where: { userId: viewerId }, select: { seriesTmdbId: true, seasonNumber: true, episodeNumber: true } }),
  ]);
  const excluded = [viewerId, ...blocks.map((b) => b.blockerId === viewerId ? b.blockedUserId : b.blockerId)];
  const followedIds = follows.map((f) => f.followedUserId).filter((id) => !excluded.includes(id));
  const followed = new Set(followedIds);
  const affinity = new Map<string, number>();
  const queued = new Set(watchlist.map((item) => `${item.contentType}:${item.tmdbId}`));
  const watchedMovies = new Set<number>();
  const watchedSeries = new Set<number>();
  const boost = (key: string, value: number) => affinity.set(key, Math.max(affinity.get(key) ?? 0, value));
  for (const state of states) {
    const key = `${state.contentType}:${state.tmdbId}`;
    if (state.favorite) boost(key, 70);
    if (state.status === 'WATCHLISTED') queued.add(key);
    if (state.status === 'WATCHING') boost(key, 35);
    if (state.status === 'WATCHED') (state.contentType === 'MOVIE' ? watchedMovies : watchedSeries).add(state.tmdbId);
  }
  for (const key of queued) boost(key, 50);
  for (const alert of alerts) boost(`${alert.contentType}:${alert.tmdbId}`, 60);
  for (const event of history) {
    if (event.contentType === 'MOVIE') watchedMovies.add(event.tmdbId);
    if (event.watchedAt && event.watchedAt <= now && now.getTime() - event.watchedAt.getTime() <= 30 * 86400000) {
      boost(`${event.contentType === 'MOVIE' ? 'MOVIE' : 'SERIES'}:${event.tmdbId}`, 40);
    }
  }
  const watchedEpisodes = new Set(progress.map((p) => `${p.seriesTmdbId}:${p.seasonNumber}:${p.episodeNumber}`));
  const interestedMovies = [...affinity.keys()].filter((key) => key.startsWith('MOVIE:')).map((key) => Number(key.split(':')[1]));
  const interestedSeries = [...affinity.keys()].filter((key) => key.startsWith('SERIES:')).map((key) => Number(key.split(':')[1]));
  const userWhere = (visibility: 'reviewsVisibility' | 'ratingsVisibility' | 'viewingHistoryVisibility'): Prisma.UserWhereInput => ({
    AND: [activeAccountWhere(now), { id: { notIn: excluded }, privacySettings: { profileVisibility: 'PUBLIC', [visibility]: 'PUBLIC' } }],
  });
  const reviewInclude = { user: { select: authorSelect }, _count: { select: { likes: true } }, likes: { where: { userId: viewerId }, select: { id: true } } } as const;
  // Separate candidate sources prevent global activity from crowding out personal interests or follows.
  const batches = await Promise.all(['followed', 'interests', 'discovery'].map(async (source) => {
    const userId = source === 'followed' ? { in: followedIds } : { notIn: [...excluded, ...followedIds] };
    const movieFilter = source === 'interests' ? { tmdbId: { in: interestedMovies } } : {};
    const seriesFilter = source === 'interests' ? { seriesTmdbId: { in: interestedSeries } } : {};
    const base = { userId, createdAt: source === 'discovery' ? { lte: now } : { gte: since, lte: now } };
    const options = { orderBy: [{ createdAt: 'desc' as const }, { id: 'asc' as const }], take: 80 };
    const [movies, episodes, movieRatings, seriesRatings, episodeRatings] = await Promise.all([
      prisma.userMovieReview.findMany({ ...options, include: reviewInclude, where: { ...base, ...movieFilter, moderationHiddenAt: null, user: userWhere('reviewsVisibility') } }),
      prisma.userEpisodeReview.findMany({ ...options, include: reviewInclude, where: { ...base, ...seriesFilter, moderationHiddenAt: null, user: userWhere('reviewsVisibility') } }),
      prisma.userMovieRating.findMany({ ...options, include: { user: { select: authorSelect } }, where: { ...base, ...movieFilter, user: userWhere('ratingsVisibility') } }),
      prisma.userSeriesRating.findMany({ ...options, include: { user: { select: authorSelect } }, where: { ...base, ...seriesFilter, user: userWhere('ratingsVisibility') } }),
      prisma.userEpisodeRating.findMany({ ...options, include: { user: { select: authorSelect } }, where: { ...base, ...seriesFilter, user: userWhere('ratingsVisibility') } }),
    ]);
    return { movies, episodes, movieRatings, seriesRatings, episodeRatings };
  }));
  const movies = batches.flatMap((b) => b.movies);
  const episodes = batches.flatMap((b) => b.episodes);
  // Fetch attached scores independently of the candidate window, respecting rating privacy.
  const [movieScores, episodeScores, viewings] = await Promise.all([
    prisma.userMovieRating.findMany({ where: { OR: movies.map((r) => ({ userId: r.userId, tmdbId: r.tmdbId })), user: userWhere('ratingsVisibility') } }),
    prisma.userEpisodeRating.findMany({ where: { OR: episodes.map((r) => ({ userId: r.userId, seriesTmdbId: r.seriesTmdbId, seasonNumber: r.seasonNumber, episodeNumber: r.episodeNumber })), user: userWhere('ratingsVisibility') } }),
    prisma.viewingEvent.findMany({
      where: { userId: { in: followedIds }, user: userWhere('viewingHistoryVisibility'), watchedAt: { gte: new Date(now.getTime() - 7 * 86400000), lte: now }, createdAt: { lte: now } },
      include: { user: { select: authorSelect } }, orderBy: [{ watchedAt: 'desc' }, { id: 'asc' }], take: 150,
    }),
  ]);
  const movieScoreMap = new Map(movieScores.map((r) => [`${r.userId}:${r.tmdbId}`, r.scoreHalfSteps / 2]));
  const episodeScoreMap = new Map(episodeScores.map((r) => [`${r.userId}:${r.seriesTmdbId}:${r.seasonNumber}:${r.episodeNumber}`, r.scoreHalfSteps / 2]));
  type Row = { id: string; userId: string; createdAt: Date; user: { id: string; displayName: string | null; avatarObjectKey: string | null } };
  const make = (row: Row, content: CommunityContent, type: CommunityItem['type'], score: number | null, body = '', likeCount = 0, likedByViewer = false): CommunityItem => ({
    id: type.endsWith('Review') ? row.id : `${type}:${row.id}`,
    author: { id: row.user.id, displayName: row.user.displayName, avatarUrl: avatar.getPublicUrl(row.user.avatarObjectKey) },
    body, content, type, score, likeCount, likedByViewer, updatedAt: row.createdAt.toISOString(), followed: followed.has(row.userId),
    viewerHasWatched: content.contentType === 'movie' ? watchedMovies.has(content.tmdbId) : content.contentType === 'series' ? watchedSeries.has(content.seriesTmdbId) : watchedEpisodes.has(`${content.seriesTmdbId}:${content.seasonNumber}:${content.episodeNumber}`),
    inWatchlist: queued.has(contentKey(content)), affinity: affinity.get(contentKey(content)) ?? 0,
  });
  const candidates: CommunityItem[] = [];
  const opinions = new Set<string>();
  const opinionKey = (userId: string, content: CommunityContent) => `${userId}:${contentKey(content)}${content.contentType === 'episode' ? `:${content.seasonNumber}:${content.episodeNumber}` : ''}`;
  for (const r of movies) {
    const content = { contentType: 'movie' as const, tmdbId: r.tmdbId };
    opinions.add(opinionKey(r.userId, content));
    candidates.push(make(r, content, 'movieReview', movieScoreMap.get(`${r.userId}:${r.tmdbId}`) ?? null, r.body, r._count.likes, r.likes.length > 0));
  }
  for (const r of episodes) {
    const content = { contentType: 'episode' as const, seriesTmdbId: r.seriesTmdbId, seasonNumber: r.seasonNumber, episodeNumber: r.episodeNumber };
    opinions.add(opinionKey(r.userId, content));
    candidates.push(make(r, content, 'episodeReview', episodeScoreMap.get(`${r.userId}:${r.seriesTmdbId}:${r.seasonNumber}:${r.episodeNumber}`) ?? null, r.body, r._count.likes, r.likes.length > 0));
  }
  for (const batch of batches) {
    const ratings = [
      ...batch.movieRatings.map((r) => make(r, { contentType: 'movie', tmdbId: r.tmdbId }, 'movieRating', r.scoreHalfSteps / 2)),
      ...batch.seriesRatings.map((r) => make(r, { contentType: 'series', seriesTmdbId: r.seriesTmdbId }, 'seriesRating', r.scoreHalfSteps / 2)),
      ...batch.episodeRatings.map((r) => make(r, { contentType: 'episode', seriesTmdbId: r.seriesTmdbId, seasonNumber: r.seasonNumber, episodeNumber: r.episodeNumber }, 'episodeRating', r.scoreHalfSteps / 2)),
    ];
    for (const rating of ratings) {
      if (!opinions.has(opinionKey(rating.author.id, rating.content))) candidates.push(rating);
    }
  }
  const activityKeys = new Set(candidates.map((item) => `${item.author.id}:${contentKey(item.content)}`));
  for (const event of viewings) {
    // Historical imports and bulk episode sessions must not become a stream of new posts.
    if (!event.watchedAt || Math.abs(event.createdAt.getTime() - event.watchedAt.getTime()) > 2 * 86400000) continue;
    const content: CommunityContent = event.contentType === 'MOVIE' ? { contentType: 'movie', tmdbId: event.tmdbId } : { contentType: 'series', seriesTmdbId: event.tmdbId };
    const key = `${event.userId}:${contentKey(content)}`;
    if (activityKeys.has(key)) continue;
    activityKeys.add(key);
    candidates.push(make({ ...event, createdAt: event.watchedAt }, content, 'viewing', null));
  }
  const ranked = rankCommunity([...new Map(candidates.map((item) => [item.id, item])).values()], now);
  const items = ranked.slice(offset, offset + 30).map(({ affinity: _affinity, ...item }) => item);
  return { items, nextCursor: offset + 30 < ranked.length ? Buffer.from(JSON.stringify({ at: now.toISOString(), offset: offset + 30 })).toString('base64url') : null };
}

export function readCommunityCursor(cursor?: string) {
  if (!cursor) return { now: new Date(), offset: 0 };
  try {
    if (cursor.length > 200) throw new Error();
    const value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    const now = new Date(value.at);
    if (!Number.isFinite(now.getTime()) || now.getTime() > Date.now() + 60000 || !Number.isInteger(value.offset) || value.offset < 0 || value.offset > 150) throw new Error();
    return { now, offset: value.offset as number };
  } catch {
    throw new BadRequestException('Invalid community cursor.');
  }
}
