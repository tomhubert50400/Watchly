export type HomeHeroItem = {
  backdropUrl: string | null;
  genres: string[];
  posterUrl: string | null;
  releaseDate: string | null;
  runtimeMinutes: number | null;
  title: string;
  tmdbId: number;
};

export type HomeTrendingItem = {
  mediaType: 'movie' | 'series';
  posterUrl: string | null;
  releaseDate: string | null;
  title: string;
  tmdbId: number;
  voteAverage: number | null;
};

export type HomeCatalogueData = {
  hero: HomeHeroItem | null;
  trending: HomeTrendingItem[];
};

export type HomeProgressItem = {
  backdropUrl: string | null;
  episodeNumber: number;
  episodeTitle: string;
  seasonNumber: number;
  seriesTitle: string;
  seriesTmdbId: number;
  watchedEpisodeCount: number;
};

export type HomeFeedTarget =
  | { contentType: 'movie'; tmdbId: number }
  | {
      contentType: 'episode';
      episodeNumber: number;
      seasonNumber: number;
      seriesTitle: string;
      seriesTmdbId: number;
    };

export type HomeFeedItem = {
  authorDisplayName: string | null;
  authorId: string;
  body: string;
  contentImageUrl: string | null;
  contentTitle: string;
  id: string;
  likeCount: number;
  likedByViewer: boolean;
  rating: number;
  target: HomeFeedTarget;
  type: 'episodeReview' | 'movieReview';
  updatedAt: string;
};

export type HomeResource<T> = {
  data: T | null;
  error: string | null;
};

export type HomeCompositionInput = {
  catalogue: HomeResource<HomeCatalogueData>;
  feed: HomeResource<HomeFeedItem[]>;
  isSignedIn: boolean;
  progress: HomeResource<HomeProgressItem[]>;
};

export type HomeSection =
  | { item: HomeHeroItem; kind: 'hero' }
  | { error: string | null; items: HomeProgressItem[]; kind: 'continueWatching' }
  | { error: string | null; items: HomeFeedItem[]; kind: 'socialActivity' }
  | { error: string | null; items: HomeTrendingItem[]; kind: 'trending' };

export function buildHomeSections({
  catalogue,
  feed,
  isSignedIn,
  progress,
}: HomeCompositionInput): HomeSection[] {
  const sections: HomeSection[] = [];

  if (catalogue.data?.hero) {
    sections.push({ item: catalogue.data.hero, kind: 'hero' });
  }

  if (isSignedIn && ((progress.data?.length ?? 0) > 0 || progress.error)) {
    sections.push({
      error: progress.error,
      items: progress.data ?? [],
      kind: 'continueWatching',
    });
  }

  if (isSignedIn && ((feed.data?.length ?? 0) > 0 || feed.error)) {
    sections.push({
      error: feed.error,
      items: feed.data ?? [],
      kind: 'socialActivity',
    });
  }

  sections.push({
    error: catalogue.error,
    items: catalogue.data?.trending ?? [],
    kind: 'trending',
  });

  return sections;
}
