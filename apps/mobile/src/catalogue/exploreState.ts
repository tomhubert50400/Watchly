import type { CatalogueSearchItem } from '../api/catalogue';

export type ExploreSection = 'trending' | 'announced';

export type ExploreSections = Record<ExploreSection, CatalogueSearchItem[]>;

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

export function deduplicateMediaItems(items: readonly CatalogueSearchItem[]) {
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

export function buildExploreSections(sections: ExploreSections): ExploreSections {
  return {
    announced: deduplicateMediaItems(sections.announced),
    trending: deduplicateMediaItems(sections.trending),
  };
}

export function groupSearchResults(items: readonly CatalogueSearchItem[]) {
  const uniqueItems = deduplicateMediaItems(items);

  return {
    movies: uniqueItems.filter((item) => item.mediaType === 'movie'),
    series: uniqueItems.filter((item) => item.mediaType === 'series'),
  };
}

export function getExploreViewState({ activeSection, query }: ExploreViewStateInput): ExploreViewState {
  const normalizedQuery = query.trim();
  const isSearching = normalizedQuery.length >= 2;

  if (isSearching) {
    return {
      emptyBody: 'Try another film or series title.',
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
