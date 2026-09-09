import { getEpisodeDetails, type MovieDetails, type SeriesDetails } from '../api/catalogue';
import type { ProfileOpinion } from '../api/profile';
import type { HydratedProfileOpinion } from './profileOpinionHydration';

export type ProfileReview = Extract<ProfileOpinion, { body: string }>;
export type SearchableProfileReview = Extract<HydratedProfileOpinion, { body: string }> & {
  searchText: string;
  metadataUnavailable: boolean;
};

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function matchesProfileReview(item: SearchableProfileReview, query: string) {
  const text = normalize(`${item.body} ${item.contentTitle} ${item.seriesTitle ?? ''} ${item.searchText}`);
  return normalize(query).trim().split(/\s+/).every((word) => text.includes(word));
}

export function reviewFallback(item: ProfileReview): SearchableProfileReview {
  const episode = item.content.contentType === 'episode' ? item.content : null;
  return {
    ...item,
    contentImageUrl: null,
    contentTitle: episode ? `Episode ${episode.episodeNumber}` : 'Movie',
    contentSubtitle: episode ? `Season ${episode.seasonNumber} · Episode ${episode.episodeNumber}` : 'Movie',
    seriesTitle: null,
    searchText: '',
    metadataUnavailable: true,
  };
}

export async function hydrateSearchableReview(
  item: ProfileReview,
  loadMovie: (id: number) => Promise<MovieDetails>,
  loadSeries: (id: number) => Promise<SeriesDetails>,
  loadEpisode = getEpisodeDetails,
): Promise<SearchableProfileReview> {
  const fallback = reviewFallback(item);
  try {
    if (item.content.contentType === 'movie') {
      const movie = await loadMovie(item.content.tmdbId);
      return {
        ...fallback,
        contentImageUrl: movie.posterUrl,
        contentTitle: movie.title,
        searchText: [movie.originalTitle, ...(movie.castNames ?? movie.cast.map((person) => person.name)), ...movie.directors, ...movie.keywords].join(' '),
        metadataUnavailable: false,
      };
    }
    const content = item.content;
    const series = await loadSeries(content.seriesTmdbId);
    const episode = await loadEpisode(content.seriesTmdbId, content.seasonNumber, content.episodeNumber)
      .then((response) => response.item).catch(() => null);
    return {
      ...fallback,
      contentImageUrl: series.posterUrl,
      contentTitle: episode?.title ?? fallback.contentTitle,
      seriesTitle: series.title,
      searchText: [series.originalTitle, ...(series.castNames ?? series.cast.map((person) => person.name)), ...(episode?.cast ?? []).map((person) => person.name), ...series.createdBy, ...series.keywords].join(' '),
      metadataUnavailable: !episode,
    };
  } catch {
    return fallback;
  }
}
