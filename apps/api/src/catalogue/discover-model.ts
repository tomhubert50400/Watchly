export type DiscoverMediaType = 'movie' | 'series';
export const discoverMoods = ['comfort', 'funny', 'suspense', 'mind-bending', 'emotional', 'romantic', 'adventure', 'dark'] as const;
export type DiscoverMood = typeof discoverMoods[number];

// Editorial membership is intentional: genre alone does not establish a mood.
// IDs are TMDB titles; each selection includes movies and television.
export const moodSelections: Record<DiscoverMood, Record<DiscoverMediaType, number[]>> = {
  comfort: { movie: [346648, 120467, 212778], series: [97546, 8592, 4586] },
  funny: { movie: [8363, 4638, 290250], series: [48891, 2316, 76148] },
  suspense: { movie: [146233, 1949, 210577], series: [70523, 95396, 1396] },
  'mind-bending': { movie: [27205, 329865, 77], series: [70523, 95396, 62560] },
  emotional: { movie: [965150, 38, 354912], series: [89905, 67136, 54344] },
  romantic: { movie: [76, 80, 4348], series: [89905, 124834, 91239] },
  adventure: { movie: [120, 329, 129], series: [246, 111110, 82856] },
  dark: { movie: [807, 493922, 274], series: [40008, 46648, 67744] },
};

export const discoverCollections = [
  { id: '2000s', title: 'Back to the 2000s', description: 'Movies and shows first released between 2000 and 2009.' },
  { id: 'award-winners', title: 'Award-winning stories', description: 'A selection of Best Picture Oscar winners and Emmy-winning drama and comedy series.' },
  { id: '1990s', title: 'Back to the 90s', description: 'Movies and shows first released between 1990 and 1999.' },
  { id: 'animation', title: 'Worlds of animation', description: 'Animated stories for the big screen and the small one.' },
] as const;
export type DiscoverCollectionId = typeof discoverCollections[number]['id'];
export const awardWinners: Record<DiscoverMediaType, number[]> = { movie: [496243, 545611, 376867], series: [1396, 76331, 67070] };

export type DiscoverTitle = {
  id: string;
  tmdbId: number;
  mediaType: DiscoverMediaType;
  title: string;
  overview: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  releaseDate: string | null;
  voteAverage: number | null;
  genreIds: number[];
};
export type DiscoverSeed = { item: DiscoverTitle; recommendations: DiscoverTitle[] };
export const discoverKey = (item: { mediaType: DiscoverMediaType; tmdbId: number }) => `${item.mediaType}:${item.tmdbId}`;

export function rankDiscoverTitles(candidates: DiscoverTitle[], seeds: DiscoverSeed[], excluded: Set<string>, mood: DiscoverMood | null) {
  const unique = new Map(candidates.map(item => [discoverKey(item), item]));
  const ranked = [...unique.values()].filter(item => !excluded.has(discoverKey(item))).map((item, order) => {
    const sameTypeSeeds = seeds.filter(seed => seed.item.mediaType === item.mediaType);
    const related = sameTypeSeeds.find(seed => seed.recommendations.some(candidate => discoverKey(candidate) === discoverKey(item)));
    const genreAffinity = sameTypeSeeds.reduce((score, seed) => score + item.genreIds.filter(id => seed.item.genreIds.includes(id)).length, 0);
    return {
      ...item,
      reason: related ? `Because you liked ${related.item.title}` : mood ? 'Selected for this mood' : 'A discovery from the catalogue',
      score: (related ? 100 : 0) + Math.min(genreAffinity, 10) * 3 - order / 1000,
    };
  }).sort((a, b) => b.score - a.score);
  // Keep both formats visible, without interpreting movie tastes as TV tastes.
  const movies = ranked.filter(item => item.mediaType === 'movie');
  const series = ranked.filter(item => item.mediaType === 'series');
  return Array.from({ length: Math.max(movies.length, series.length) }, (_, index) => [movies[index], series[index]])
    .flat().filter((item): item is typeof ranked[number] => Boolean(item))
    .map(({ score: _score, ...item }) => item);
}

export const browseGenres = { drama: 18, comedy: 35, crime: 80, mystery: 9648, animation: 16, documentary: 99, family: 10751, 'sci-fi-fantasy': 10765, 'action-adventure': 10759 } as const;
export function browseGenreIds(genre: keyof typeof browseGenres, type: DiscoverMediaType): number[] {
  if (type === 'movie' && genre === 'sci-fi-fantasy') return [878, 14];
  if (type === 'movie' && genre === 'action-adventure') return [28, 12];
  return [browseGenres[genre]];
}
export type BrowseFilters = { mood?: DiscoverMood; genre?: keyof typeof browseGenres; decade?: number; awards?: boolean };
export const moodGenreIds: Record<DiscoverMood, Record<DiscoverMediaType, number[]>> = {
  comfort: { movie: [35, 10751], series: [35, 10751] }, funny: { movie: [35], series: [35] },
  suspense: { movie: [53, 9648], series: [80, 9648] }, 'mind-bending': { movie: [878, 9648], series: [10765, 9648] },
  emotional: { movie: [18], series: [18] }, romantic: { movie: [10749], series: [18, 35] },
  adventure: { movie: [12, 28], series: [10759] }, dark: { movie: [27, 80, 53], series: [80, 9648] },
};
