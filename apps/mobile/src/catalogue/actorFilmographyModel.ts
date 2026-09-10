import type { CatalogueSearchItem, CatalogueSearchType } from '../api/catalogue';

export const filmographySortOptions = [
  { value: 'popular', label: 'Most popular' },
  { value: 'latest', label: 'Latest releases' },
  { value: 'rating', label: 'Top rated' },
] as const;

export type FilmographySort = typeof filmographySortOptions[number]['value'];

export function filterActorFilmography(
  credits: readonly CatalogueSearchItem[],
  mediaType: CatalogueSearchType,
  sort: FilmographySort,
) {
  const items = credits.filter(item => mediaType === 'all' || item.mediaType === mediaType);
  // The actor endpoint returns credits in descending TMDB popularity order.
  if (sort === 'popular') return items;
  return items.sort((left, right) => sort === 'latest'
    ? (right.releaseDate ?? '').localeCompare(left.releaseDate ?? '')
    : (right.voteAverage ?? -1) - (left.voteAverage ?? -1));
}
