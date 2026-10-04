export const homeCategories = [
  { id: 'trending', title: 'Trending this week' },
  { id: 'all-time', title: 'All-time favorites' },
  { id: 'comedy', title: 'Comedy' },
  { id: 'local', title: 'Local cinema', moviesOnly: true },
  { id: 'recent', title: 'Recent releases' },
  { id: 'crime', title: 'Crime & mystery' },
  { id: 'sci-fi', title: 'Sci-fi & fantasy' },
  { id: 'animation', title: 'Animation' },
  { id: 'blockbusters', title: 'Blockbusters', moviesOnly: true },
  { id: '2000s', title: 'Back to the 2000s' },
  { id: 'action', title: 'Action & adventure' },
  { id: 'horror', title: 'Horror', moviesOnly: true },
  { id: 'romance', title: 'Romance', moviesOnly: true },
  { id: 'documentary', title: 'Documentaries' },
  { id: '1990s', title: 'Back to the 90s' },
  { id: 'short', title: 'Under 90 minutes', moviesOnly: true },
] as const;

export type HomeCategoryId = typeof homeCategories[number]['id'];

export function selectHomeCategories(country?: string, now = new Date()) {
  const cycle = Math.floor(now.getTime() / (3 * 24 * 60 * 60 * 1000));
  const fixed = homeCategories.filter(category => category.id === 'trending' || category.id === 'all-time' || (category.id === 'local' && country));
  const rotating = homeCategories.filter(category => !['trending', 'all-time', 'local'].includes(category.id));
  const count = 9 - fixed.length;
  return [...fixed, ...Array.from({ length: count }, (_, index) => rotating[(cycle * 6 + index) % rotating.length])];
}

export function homeCategoryQuery(id: HomeCategoryId, type: 'movie' | 'series', page: number, country?: string, now = new Date()) {
  const dateField = type === 'movie' ? 'primary_release_date' : 'first_air_date';
  const params: Record<string, string> = {
    include_adult: 'false', page: String(page), sort_by: 'popularity.desc',
    [`${dateField}.lte`]: now.toISOString().slice(0, 10), 'vote_count.gte': '100',
  };
  const genres: Partial<Record<HomeCategoryId, string>> = {
    comedy: '35', crime: '80|9648', animation: '16', documentary: '99',
    'sci-fi': type === 'movie' ? '878|14' : '10765',
    action: type === 'movie' ? '28|12' : '10759', horror: '27', romance: '10749',
  };
  if (genres[id]) params.with_genres = genres[id];
  if (id === 'all-time') {
    params.sort_by = 'vote_average.desc';
    params['vote_count.gte'] = type === 'movie' ? '2000' : '500';
  }
  if (id === 'local' && country) {
    params.with_origin_country = country;
  }
  if (id === 'blockbusters') params.sort_by = 'revenue.desc';
  if (id === 'recent') {
    const start = new Date(now);
    start.setUTCMonth(start.getUTCMonth() - 6);
    params[`${dateField}.gte`] = start.toISOString().slice(0, 10);
    params['vote_count.gte'] = '20';
  }
  if (id === '1990s' || id === '2000s') {
    const decade = id === '1990s' ? 1990 : 2000;
    params[`${dateField}.gte`] = `${decade}-01-01`;
    params[`${dateField}.lte`] = `${decade + 9}-12-31`;
  }
  if (id === 'short') {
    params['with_runtime.gte'] = '1';
    params['with_runtime.lte'] = '89';
  }
  return { path: id === 'trending' ? `trending/${type === 'movie' ? 'movie' : 'tv'}/week` : `discover/${type === 'movie' ? 'movie' : 'tv'}`, params };
}
