import type { MovieDetails, SeriesDetails } from '../api/catalogue';
import type { ViewingStats } from '../api/viewings';

export async function hydrateViewingStatsArtwork(
  stats: ViewingStats,
  loadMovie: (tmdbId: number) => Promise<MovieDetails>,
  loadSeries: (tmdbId: number) => Promise<SeriesDetails>,
) {
  const highlights = await Promise.all(stats.highlights.map(async (highlight) => {
    try {
      const item = highlight.contentType === 'movie'
        ? await loadMovie(highlight.tmdbId)
        : await loadSeries(highlight.tmdbId);

      return {
        ...highlight,
        artworkUrl: item.backdropUrl ?? highlight.artworkUrl,
      };
    } catch {
      return highlight;
    }
  }));

  return { ...stats, highlights };
}
