// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
import { buildHomeSections, type HomeCompositionInput } from './homeData';

const catalogue = {
  hero: {
    backdropUrl: 'https://image.test/hero.jpg',
    genres: ['Adventure'],
    posterUrl: 'https://image.test/poster.jpg',
    releaseDate: '2026-07-01',
    runtimeMinutes: 101,
    title: 'Real catalogue title',
    tmdbId: 11,
  },
  trending: [
    {
      mediaType: 'movie' as const,
      posterUrl: 'https://image.test/next.jpg',
      releaseDate: '2026-06-02',
      title: 'Another real title',
      tmdbId: 12,
      voteAverage: 8.2,
    },
  ],
};
const progress = [
  {
    backdropUrl: 'https://image.test/series.jpg',
    episodeNumber: 5,
    episodeTitle: 'The next episode',
    seasonNumber: 1,
    seriesTitle: 'A real series',
    seriesTmdbId: 21,
    watchedEpisodeCount: 4,
  },
];
const feed = [
  {
    authorDisplayName: 'A real person',
    authorId: 'person-1',
    body: 'A real review from the API.',
    contentImageUrl: 'https://image.test/review.jpg',
    contentTitle: 'A reviewed movie',
    id: 'review-1',
    target: { contentType: 'movie' as const, tmdbId: 31 },
    updatedAt: '2026-07-10T12:00:00.000Z',
  },
];

function input(overrides: Partial<HomeCompositionInput> = {}): HomeCompositionInput {
  return {
    catalogue: { data: catalogue, error: null },
    feed: { data: null, error: null },
    isSignedIn: false,
    progress: { data: null, error: null },
    ...overrides,
  };
}

{
  const sections = buildHomeSections(input());

  assert.deepEqual(sections.map((section) => section.kind), ['hero', 'trending']);
  assert.equal(sections[0]?.kind === 'hero' && sections[0].item.title, 'Real catalogue title');
}

{
  const sections = buildHomeSections(input({
    feed: { data: feed, error: null },
    isSignedIn: true,
    progress: { data: progress, error: null },
  }));

  assert.deepEqual(sections.map((section) => section.kind), [
    'hero',
    'continueWatching',
    'socialActivity',
    'trending',
  ]);
}

{
  const sections = buildHomeSections(input({
    feed: { data: feed, error: null },
    isSignedIn: true,
    progress: { data: null, error: 'Progress is unavailable.' },
  }));
  const continueWatching = sections.find((section) => section.kind === 'continueWatching');

  assert.equal(continueWatching?.kind, 'continueWatching');
  assert.equal(continueWatching?.error, 'Progress is unavailable.');
  assert.equal(sections.some((section) => section.kind === 'socialActivity'), true);
  assert.equal(sections.some((section) => section.kind === 'trending'), true);
}

{
  const sections = buildHomeSections(input({
    feed: { data: [], error: null },
    isSignedIn: true,
    progress: { data: progress, error: null },
  }));

  assert.equal(sections.some((section) => section.kind === 'socialActivity'), false);
  assert.equal(sections.some((section) => section.kind === 'continueWatching'), true);
  assert.equal(sections.some((section) => section.kind === 'trending'), true);
}

console.log('Home data QA passed.');
