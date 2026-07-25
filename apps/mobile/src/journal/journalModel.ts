import type { EpisodeProgress } from '../api/progress';
import type { ProfileOpinion } from '../api/profile';
import type { MovieRating } from '../api/ratings';
import type { TrackingState } from '../api/tracking';

export type JournalFilter = 'all' | 'movies' | 'reviews' | 'series';
export type JournalEpisode = { episodeNumber: number; seasonNumber: number; watchedAt: string };
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
  progress: EpisodeProgress[];
  trackingStates: TrackingState[];
};

export function buildJournal(input: BuildJournalInput): JournalModel {
  const movieIds = new Set<number>();
  input.trackingStates.filter((state) => state.contentType === 'movie' && state.status === 'watched').forEach((state) => movieIds.add(state.tmdbId));
  input.movieRatings.forEach((rating) => movieIds.add(rating.tmdbId));
  input.opinions.forEach((opinion) => {
    if (opinion.content.contentType === 'movie') movieIds.add(opinion.content.tmdbId);
  });

  const movieEntries = [...movieIds].map((tmdbId): JournalEntry => {
    const state = input.trackingStates.find((item) => item.contentType === 'movie' && item.tmdbId === tmdbId);
    const rating = input.movieRatings.find((item) => item.tmdbId === tmdbId);
    const review = input.opinions.find((item): item is Extract<ProfileOpinion, { type: 'movieReview' }> => item.type === 'movieReview' && item.content.tmdbId === tmdbId);
    const opinionRating = input.opinions.find((item): item is Extract<ProfileOpinion, { type: 'movieRating' }> => item.type === 'movieRating' && item.content.tmdbId === tmdbId);
    return {
      date: latestDate([state?.updatedAt, rating?.updatedAt, review?.updatedAt, opinionRating?.updatedAt]),
      episodes: [], key: `movie:${tmdbId}`, kind: 'movie',
      ratingScore: rating?.score ?? opinionRating?.score ?? review?.score ?? null,
      reviewBody: review?.body ?? null, tmdbId,
    };
  });

  const progressBySeries = new Map<number, EpisodeProgress[]>();
  input.progress.forEach((episode) => progressBySeries.set(episode.seriesTmdbId, [...(progressBySeries.get(episode.seriesTmdbId) ?? []), episode]));
  const seriesEntries = [...progressBySeries.entries()].map(([tmdbId, episodes]): JournalEntry => {
    const opinions = input.opinions.filter((opinion) => opinion.content.contentType === 'episode' && opinion.content.seriesTmdbId === tmdbId);
    const scores = opinions.map((opinion) => opinion.score);
    const reviews = opinions.filter((opinion) => opinion.type === 'episodeReview');
    const orderedEpisodes = episodes.slice().sort((a, b) => a.seasonNumber - b.seasonNumber || a.episodeNumber - b.episodeNumber);
    return {
      date: latestDate(episodes.map((episode) => episode.watchedAt || episode.updatedAt)),
      episodes: orderedEpisodes.map(({ episodeNumber, seasonNumber, watchedAt }) => ({ episodeNumber, seasonNumber, watchedAt })),
      key: `series:${tmdbId}`, kind: 'series',
      ratingScore: scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null,
      reviewBody: reviews.length ? reviews.map((review) => review.body).join('\n') : null,
      tmdbId,
    };
  });
  const entries = [...movieEntries, ...seriesEntries].filter((entry) => entry.date).sort((a, b) => b.date.localeCompare(a.date));
  const scores = entries.flatMap((entry) => entry.ratingScore === null ? [] : [entry.ratingScore]);
  return {
    averageRating: scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null,
    entries,
    reviewCount: entries.filter((entry) => Boolean(entry.reviewBody)).length,
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
