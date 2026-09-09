import type { ProfileOpinion } from '../api/profile';
import type { MovieRating } from '../api/ratings';
import type { JournalViewing } from '../api/viewings';

export type JournalFilter = 'all' | 'movies' | 'reviews' | 'series';
export type JournalEpisode = { id: string; episodeNumber: number; seasonNumber: number; watchedAt: string };
export type JournalEntry = {
  date: string;
  episodes: JournalEpisode[];
  key: string;
  kind: 'movie' | 'series';
  ratingScore: number | null;
  reviewBody: string | null;
  tmdbId: number;
};
export type JournalModel = { averageRating: number | null; entries: JournalEntry[]; reviewCount: number };
export type JournalMonth = { entries: JournalEntry[]; key: string };

type BuildJournalInput = {
  movieRatings: MovieRating[];
  opinions: ProfileOpinion[];
  viewings: JournalViewing[];
};

export function buildJournal(input: BuildJournalInput): JournalModel {
  const movieIds = new Set<number>();
  input.viewings.filter((viewing) => viewing.contentType === 'movie').forEach((viewing) => movieIds.add(viewing.tmdbId));
  input.movieRatings.forEach((rating) => movieIds.add(rating.tmdbId));
  input.opinions.forEach((opinion) => {
    if (opinion.content.contentType === 'movie') movieIds.add(opinion.content.tmdbId);
  });

  const movieEntries = [...movieIds].flatMap((tmdbId): JournalEntry[] => {
    const viewings = input.viewings.filter((item) => item.contentType === 'movie' && item.tmdbId === tmdbId);
    const rating = input.movieRatings.find((item) => item.tmdbId === tmdbId);
    const review = input.opinions.find((item): item is Extract<ProfileOpinion, { type: 'movieReview' }> => item.type === 'movieReview' && item.content.tmdbId === tmdbId);
    const opinionRating = input.opinions.find((item): item is Extract<ProfileOpinion, { type: 'movieRating' }> => item.type === 'movieRating' && item.content.tmdbId === tmdbId);
    const opinion = {
      ratingScore: rating?.score ?? opinionRating?.score ?? review?.score ?? null,
      reviewBody: review?.body ?? null, tmdbId,
    };
    return viewings.length ? viewings.map((viewing) => ({
      ...opinion, date: viewing.watchedAt, episodes: [], key: `viewing:${viewing.id}`, kind: 'movie',
    })) : [{
      ...opinion, date: latestDate([rating?.updatedAt, review?.updatedAt, opinionRating?.updatedAt]),
      episodes: [], key: `movie:${tmdbId}`, kind: 'movie',
    }];
  });

  const viewingsBySeries = new Map<string, JournalViewing[]>();
  input.viewings.filter((viewing) => viewing.contentType === 'episode').forEach((viewing) => {
    const key = `series:${viewing.tmdbId}:${viewing.watchedAt.slice(0, 10)}`;
    viewingsBySeries.set(key, [...(viewingsBySeries.get(key) ?? []), viewing]);
  });
  const seriesEntries = [...viewingsBySeries.entries()].map(([key, episodes]): JournalEntry => {
    const tmdbId = episodes[0]!.tmdbId;
    const opinions = input.opinions.filter((opinion) => {
      const content = opinion.content;
      return content.contentType === 'episode' && content.seriesTmdbId === tmdbId &&
        episodes.some((episode) => episode.seasonNumber === content.seasonNumber && episode.episodeNumber === content.episodeNumber);
    });
    const scores = opinions.flatMap((opinion) => opinion.score === null ? [] : [opinion.score]);
    const reviews = opinions.filter((opinion) => opinion.type === 'episodeReview');
    const orderedEpisodes = episodes
      .filter((episode): episode is JournalViewing & { episodeNumber: number; seasonNumber: number } =>
        episode.episodeNumber !== null && episode.seasonNumber !== null
      )
      .sort((a, b) => a.seasonNumber - b.seasonNumber || a.episodeNumber - b.episodeNumber);
    return {
      date: latestDate(episodes.map((episode) => episode.watchedAt)),
      episodes: orderedEpisodes.map(({ id, episodeNumber, seasonNumber, watchedAt }) => ({ id, episodeNumber, seasonNumber, watchedAt })),
      key, kind: 'series',
      ratingScore: scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null,
      reviewBody: reviews.length ? reviews.map((review) => review.body).join('\n') : null,
      tmdbId,
    };
  });
  const entries = [...movieEntries, ...seriesEntries].filter((entry) => entry.date).sort((a, b) => b.date.localeCompare(a.date));
  const ratedTitles = [...new Map(entries.map((entry) => [`${entry.kind}:${entry.tmdbId}`, entry])).values()];
  const scores = ratedTitles.flatMap((entry) => {
    if (entry.kind === 'movie') return entry.ratingScore === null ? [] : [entry.ratingScore];
    const episodeScores = input.opinions.filter((opinion) => opinion.content.contentType === 'episode' && opinion.content.seriesTmdbId === entry.tmdbId)
      .flatMap((opinion) => opinion.score === null ? [] : [opinion.score]);
    return episodeScores.length ? [episodeScores.reduce((sum, score) => sum + score, 0) / episodeScores.length] : [];
  });
  return {
    averageRating: scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null,
    entries,
    reviewCount: new Set(entries.filter((entry) => Boolean(entry.reviewBody)).map((entry) => `${entry.kind}:${entry.tmdbId}`)).size,
  };
}

export function filterJournalEntries(entries: JournalEntry[], filter: JournalFilter) {
  if (filter === 'movies') return entries.filter((entry) => entry.kind === 'movie');
  if (filter === 'series') return entries.filter((entry) => entry.kind === 'series');
  if (filter === 'reviews') return entries.filter((entry) => Boolean(entry.reviewBody));
  return entries;
}

export function filterJournalEntriesByDate(entries: JournalEntry[], dateKey: string | null) {
  if (!dateKey) return entries;
  return entries.filter((entry) => entry.date.slice(0, 10) === dateKey);
}

export function getJournalMonthKeys(entries: JournalEntry[]) {
  return [...new Set(entries.map((entry) => entry.date.slice(0, 7)))].sort((a, b) => b.localeCompare(a));
}

export function groupJournalEntriesByMonth(entries: JournalEntry[]): JournalMonth[] {
  const groups = new Map<string, JournalEntry[]>();
  entries.forEach((entry) => {
    const key = entry.date.slice(0, 7);
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  });
  return [...groups.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([key, groupedEntries]) => ({ entries: groupedEntries, key }));
}

function latestDate(values: Array<string | undefined>) {
  return values.filter((value): value is string => Boolean(value)).sort().at(-1) ?? '';
}
