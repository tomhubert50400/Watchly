export type ViewingStatsEvent = {
  artworkUrl: string | null;
  contentType: 'MOVIE' | 'EPISODE';
  episodeNumber: number | null;
  genres: string[];
  runtimeMinutes: number | null;
  seasonNumber: number | null;
  subtitle: string | null;
  title: string | null;
  tmdbId: number;
  watchedAt: Date | null;
};

export type ViewingRating = {
  scoreHalfSteps: number;
};

export type ViewingStatsWatchedTitle = {
  artworkUrl: string | null;
  contentType: 'MOVIE' | 'SERIES';
  genres: string[];
  runtimeMinutes: number | null;
  title: string | null;
  tmdbId: number;
};

export function buildViewingStats(
  events: ViewingStatsEvent[],
  ratings: ViewingRating[],
  watchedTitles: ViewingStatsWatchedTitle[] = [],
) {
  const movieKeys = new Set<string>();
  const episodeKeys = new Set<string>();
  const seriesKeys = new Set<number>();
  const genreCounts = new Map<string, number>();
  const weekdayCounts = new Map<number, number>();
  const highlightGroups = new Map<
    string,
    {
      artworkUrl: string | null;
      contentType: 'movie' | 'series';
      minutes: number;
      title: string | null;
      tmdbId: number;
      views: number;
    }
  >();
  let missingRuntimeCount = 0;
  let watchedTitleViewCount = 0;
  let watchMinutes = 0;

  events.forEach((event) => {
    const isMovie = event.contentType === 'MOVIE';
    const mediaKey = isMovie
      ? `movie:${event.tmdbId}`
      : `episode:${event.tmdbId}:${event.seasonNumber}:${event.episodeNumber}`;

    if (isMovie) {
      movieKeys.add(mediaKey);
    } else {
      episodeKeys.add(mediaKey);
      seriesKeys.add(event.tmdbId);
    }

    if (event.runtimeMinutes === null) {
      missingRuntimeCount += 1;
    } else {
      watchMinutes += event.runtimeMinutes;
    }

    event.genres.forEach((genre) => {
      genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
    });

    if (event.watchedAt) {
      const weekday = event.watchedAt.getUTCDay();
      weekdayCounts.set(weekday, (weekdayCounts.get(weekday) ?? 0) + 1);
    }

    const highlightKey = `${isMovie ? 'movie' : 'series'}:${event.tmdbId}`;
    const current = highlightGroups.get(highlightKey);
    highlightGroups.set(highlightKey, {
      artworkUrl: current?.artworkUrl ?? event.artworkUrl,
      contentType: isMovie ? 'movie' : 'series',
      minutes: (current?.minutes ?? 0) + (event.runtimeMinutes ?? 0),
      title: current?.title ?? event.title,
      tmdbId: event.tmdbId,
      views: (current?.views ?? 0) + 1,
    });
  });

  const eventUniqueViewCount = movieKeys.size + episodeKeys.size;

  watchedTitles.forEach((item) => {
    const isMovie = item.contentType === 'MOVIE';
    const alreadyRepresented = isMovie
      ? movieKeys.has(`movie:${item.tmdbId}`)
      : seriesKeys.has(item.tmdbId);

    if (alreadyRepresented) return;

    watchedTitleViewCount += 1;
    if (isMovie) {
      movieKeys.add(`movie:${item.tmdbId}`);
      if (item.runtimeMinutes === null) {
        missingRuntimeCount += 1;
      } else {
        watchMinutes += item.runtimeMinutes;
      }
    } else {
      seriesKeys.add(item.tmdbId);
      missingRuntimeCount += 1;
    }

    item.genres.forEach((genre) => {
      genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
    });

    highlightGroups.set(`${isMovie ? 'movie' : 'series'}:${item.tmdbId}`, {
      artworkUrl: item.artworkUrl,
      contentType: isMovie ? 'movie' : 'series',
      minutes: item.runtimeMinutes ?? 0,
      title: item.title,
      tmdbId: item.tmdbId,
      views: 1,
    });
  });

  const ratingCounts = new Map<number, number>();
  const totalRatingHalfSteps = ratings.reduce((total, rating) => {
    ratingCounts.set(rating.scoreHalfSteps, (ratingCounts.get(rating.scoreHalfSteps) ?? 0) + 1);
    return total + rating.scoreHalfSteps;
  }, 0);
  const mostUsedHalfSteps = pickMostUsedRating(ratingCounts);
  const totalViewCount = events.length + watchedTitleViewCount;

  return {
    highlights: Array.from(highlightGroups.values())
      .filter((item) => Boolean(item.title))
      .sort((left, right) => right.views - left.views || right.minutes - left.minutes)
      .slice(0, 6),
    more: {
      averageRating: ratings.length
        ? Math.round((totalRatingHalfSteps / ratings.length / 2) * 10) / 10
        : null,
      favoriteWatchDay: pickFavoriteWeekday(weekdayCounts),
      mostUsedRating: mostUsedHalfSteps === null ? null : mostUsedHalfSteps / 2,
      ratingCount: ratings.length,
      rewatchCount: Math.max(0, events.length - eventUniqueViewCount),
    },
    summary: {
      episodeCount: episodeKeys.size,
      movieCount: movieKeys.size,
      seriesCount: seriesKeys.size,
      totalViewCount,
      watchMinutes,
      watchTimeIsEstimated: missingRuntimeCount > 0,
    },
    taste: Array.from(genreCounts.entries())
      .map(([genre, count]) => ({ count, genre }))
      .sort((left, right) => right.count - left.count || left.genre.localeCompare(right.genre))
      .slice(0, 3),
  };
}

function pickFavoriteWeekday(counts: Map<number, number>) {
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  let favorite: number | null = null;
  let favoriteCount = 0;

  counts.forEach((count, weekday) => {
    if (count > favoriteCount) {
      favorite = weekday;
      favoriteCount = count;
    }
  });

  return favorite === null ? null : weekdays[favorite];
}

function pickMostUsedRating(counts: Map<number, number>) {
  let mostUsed: number | null = null;
  let mostUsedCount = 0;

  counts.forEach((count, scoreHalfSteps) => {
    if (count > mostUsedCount || (count === mostUsedCount && scoreHalfSteps > (mostUsed ?? 0))) {
      mostUsed = scoreHalfSteps;
      mostUsedCount = count;
    }
  });

  return mostUsed;
}
