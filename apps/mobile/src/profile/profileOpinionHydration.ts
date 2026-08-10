import { getEpisodeDetails, getMovieDetails, type SeriesDetails } from '../api/catalogue';
import type { ProfileOpinion } from '../api/profile';

export type HydratedProfileOpinion = ProfileOpinion & {
  contentImageUrl: string | null;
  contentSubtitle: string;
  contentTitle: string;
  seriesTitle: string | null;
};

const MAX_PROFILE_OPINION_HYDRATIONS = 24;

export async function hydrateProfileOpinions(
  items: readonly ProfileOpinion[],
  loadSeries: (tmdbId: number) => Promise<SeriesDetails>,
  previous: readonly HydratedProfileOpinion[] = [],
) {
  const hydrated = await Promise.all(items.map((item, index) => {
    const previousItem = previous.find((candidate) => candidate.id === item.id);

    return index < MAX_PROFILE_OPINION_HYDRATIONS
      ? hydrateProfileOpinion(item, loadSeries, previousItem)
      : hydrateProfileOpinionTitle(item, previousItem, loadSeries);
  }));

  return hydrated.filter(
    (item): item is HydratedProfileOpinion => item !== null,
  );
}

async function hydrateProfileOpinion(
  item: ProfileOpinion,
  loadSeries: (tmdbId: number) => Promise<SeriesDetails>,
  previous?: HydratedProfileOpinion,
): Promise<HydratedProfileOpinion | null> {
  if (item.content.contentType === 'movie') {
    try {
      const response = await withTimeout(getMovieDetails(item.content.tmdbId), 2500);

      return {
        ...item,
        contentImageUrl: response.item.posterUrl,
        contentSubtitle: 'Movie',
        contentTitle: response.item.title,
        seriesTitle: null,
      };
    } catch {
      return previous ? { ...previous, ...item } : null;
    }
  }

  try {
    const [episodeResponse, series] = await Promise.all([
      withTimeout(
        getEpisodeDetails(
          item.content.seriesTmdbId,
          item.content.seasonNumber,
          item.content.episodeNumber,
        ),
        2500,
      ),
      loadSeries(item.content.seriesTmdbId),
    ]);

    return {
      ...item,
      contentImageUrl: series.posterUrl ?? episodeResponse.item.stillUrl,
      contentSubtitle: `Season ${item.content.seasonNumber} · Episode ${item.content.episodeNumber}`,
      contentTitle: episodeResponse.item.title,
      seriesTitle: series.title,
    };
  } catch {
    return hasRealSeriesTitle(previous) ? { ...previous, ...item } : null;
  }
}

async function hydrateProfileOpinionTitle(
  item: ProfileOpinion,
  previous: HydratedProfileOpinion | undefined,
  loadSeries: (tmdbId: number) => Promise<SeriesDetails>,
): Promise<HydratedProfileOpinion | null> {
  if (item.content.contentType === 'movie') {
    return previous ? { ...previous, ...item } : null;
  }

  try {
    const series = await loadSeries(item.content.seriesTmdbId);

    return {
      ...fallbackOpinion(item),
      contentImageUrl: previous?.contentImageUrl ?? null,
      contentSubtitle: `Season ${item.content.seasonNumber} · Episode ${item.content.episodeNumber}`,
      contentTitle: previous?.contentTitle ?? `Episode ${item.content.episodeNumber}`,
      seriesTitle: series.title,
    };
  } catch {
    return hasRealSeriesTitle(previous) ? { ...previous, ...item } : null;
  }
}

function fallbackOpinion(item: ProfileOpinion): HydratedProfileOpinion {
  if (item.content.contentType === 'movie') {
    return {
      ...item,
      contentImageUrl: null,
      contentSubtitle: 'Movie',
      contentTitle: 'Movie',
      seriesTitle: null,
    };
  }

  return {
    ...item,
    contentImageUrl: null,
    contentSubtitle: `Season ${item.content.seasonNumber} · Episode ${item.content.episodeNumber}`,
    contentTitle: `Episode ${item.content.episodeNumber}`,
    seriesTitle: null,
  };
}

function hasRealSeriesTitle(
  item: HydratedProfileOpinion | undefined,
): item is HydratedProfileOpinion & { seriesTitle: string } {
  return Boolean(
    item?.seriesTitle?.trim() && !/^Series\s+\d+$/i.test(item.seriesTitle.trim()),
  );
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Catalogue enrichment timed out.')), timeoutMs);
    promise.then(resolve, reject).finally(() => clearTimeout(timeout));
  });
}
