import type {
  CatalogueDiscoveryItem,
  CatalogueMovieSectionsResponse,
  CatalogueSearchItem,
  CatalogueSearchType,
} from '../api/catalogue';

export type ExploreSection = 'trending' | 'announced';
export type ExploreMediaType = CatalogueSearchItem['mediaType'];

export type ExploreSections = Record<ExploreSection, Record<ExploreMediaType, CatalogueSearchItem[]>>;

type ExploreViewStateInput = {
  activeSection: ExploreSection;
  error: string | null;
  isLoading: boolean;
  itemCount: number;
  query: string;
};

export type ExploreViewState = {
  emptyBody: string;
  emptyTitle: string;
  errorTitle: string;
  isSearching: boolean;
  loadingLabel: string;
  title: string;
};

function mediaKey(item: CatalogueSearchItem) {
  return `${item.mediaType}:${item.tmdbId}`;
}

export function deduplicateMediaItems<T extends CatalogueSearchItem>(items: readonly T[]) {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = mediaKey(item);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export function buildExploreSections(
  sections: Pick<
    CatalogueMovieSectionsResponse,
    'announced' | 'announcedSeries' | 'trending' | 'trendingSeries'
  >,
): ExploreSections {
  return {
    announced: {
      movie: deduplicateMediaItems(sections.announced),
      series: deduplicateMediaItems(sections.announcedSeries),
    },
    trending: {
      movie: deduplicateMediaItems(sections.trending),
      series: deduplicateMediaItems(sections.trendingSeries),
    },
  };
}

export function interleaveMediaItems<T extends CatalogueSearchItem>(
  movies: readonly T[],
  series: readonly T[],
) {
  const items: T[] = [];
  const itemCount = Math.max(movies.length, series.length);

  for (let index = 0; index < itemCount; index += 1) {
    if (movies[index]) items.push(movies[index]);
    if (series[index]) items.push(series[index]);
  }

  return deduplicateMediaItems(items);
}

export function groupDiscoveryItemsByGenre(items: readonly CatalogueDiscoveryItem[]) {
  const groups = new Map<string, CatalogueDiscoveryItem[]>();

  deduplicateMediaItems(items).forEach((item) => {
    const genres = item.genres.length > 0 ? [...new Set(item.genres)] : ['Other'];

    genres.forEach((genre) => {
      const group = groups.get(genre) ?? [];
      group.push(item);
      groups.set(genre, group);
    });
  });

  return [...groups.entries()]
    .map(([genre, genreItems]) => ({ genre, items: genreItems }))
    .sort((left, right) => right.items.length - left.items.length || left.genre.localeCompare(right.genre));
}

export function groupSearchResults(items: readonly CatalogueSearchItem[]) {
  const uniqueItems = deduplicateMediaItems(items);

  return {
    movies: uniqueItems.filter((item) => item.mediaType === 'movie'),
    series: uniqueItems.filter((item) => item.mediaType === 'series'),
  };
}

export function filterSearchResults(
  items: readonly CatalogueSearchItem[],
  type: CatalogueSearchType,
) {
  return type === 'all' ? items : items.filter((item) => item.mediaType === type);
}

export function getExploreViewState({ activeSection, query }: ExploreViewStateInput): ExploreViewState {
  const normalizedQuery = query.trim();
  const isSearching = normalizedQuery.length >= 2;

  if (isSearching) {
    return {
      emptyBody: 'Try another movie, TV show or person.',
      emptyTitle: `No results for “${normalizedQuery}”`,
      errorTitle: 'Search could not be completed',
      isSearching: true,
      loadingLabel: `Searching for “${normalizedQuery}”`,
      title: 'Search results',
    };
  }

  if (activeSection === 'announced') {
    return {
      emptyBody: 'New release dates will appear here as they are announced.',
      emptyTitle: 'No upcoming titles yet',
      errorTitle: 'Upcoming titles could not be updated',
      isSearching: false,
      loadingLabel: 'Loading upcoming titles',
      title: 'Coming soon',
    };
  }

  return {
    emptyBody: 'Fresh picks are on their way.',
    emptyTitle: 'No trending titles yet',
    errorTitle: 'Trending could not be updated',
    isSearching: false,
    loadingLabel: 'Loading trending',
    title: 'Trending now',
  };
}
