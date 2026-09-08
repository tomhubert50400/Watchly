import type { CatalogueRelatedItem, SeasonDetails, SeriesDetails } from '../api/catalogue';
import type { EpisodeProgress } from '../api/progress';

export function getNextCollectionMovie(
  items: CatalogueRelatedItem[],
  currentTmdbId: number,
  watchedIds: ReadonlySet<number>,
  today = new Date().toISOString().slice(0, 10),
) {
  const ordered = [...new Map(items.map((item) => [item.tmdbId, item])).values()]
    .filter((item) => item.releaseDate && item.releaseDate <= today)
    .sort((a, b) => a.releaseDate!.localeCompare(b.releaseDate!) || a.tmdbId - b.tmdbId);
  const currentIndex = ordered.findIndex((item) => item.tmdbId === currentTmdbId);
  if (currentIndex < 0) return null;
  return ordered.slice(currentIndex + 1).find((item) => !watchedIds.has(item.tmdbId)) ?? null;
}

export async function findNextSeriesEpisode(
  seasons: SeriesDetails['seasons'],
  watched: Pick<EpisodeProgress, 'seasonNumber' | 'episodeNumber'>[],
  loadSeason: (seasonNumber: number) => Promise<SeasonDetails>,
  today = new Date().toISOString().slice(0, 10),
) {
  const watchedKeys = new Set(watched.map((item) => `${item.seasonNumber}:${item.episodeNumber}`));
  const ordered = [...seasons]
    .filter((season) => season.seasonNumber > 0 && season.airDate && season.airDate <= today)
    .sort((a, b) => a.seasonNumber - b.seasonNumber);
  for (const season of ordered) {
    const count = season.episodeCount ?? 0;
    if (count > 0 && Array.from({ length: count }, (_, index) => index + 1)
      .every((episode) => watchedKeys.has(`${season.seasonNumber}:${episode}`))) continue;
    const details = await loadSeason(season.seasonNumber);
    const next = [...details.episodes]
      .sort((a, b) => a.episodeNumber - b.episodeNumber)
      .find((episode) => episode.airDate && episode.airDate <= today
        && !watchedKeys.has(`${season.seasonNumber}:${episode.episodeNumber}`));
    if (next) return { episodeNumber: next.episodeNumber, seasonNumber: season.seasonNumber };
  }
  return null;
}
