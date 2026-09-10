// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
import { buildHomeSections, selectHomeProgress, type HomeCompositionInput } from './homeData';

const catalogue = {
  hero: {
    backdropUrl: 'https://image.test/hero.jpg',
    genres: ['Adventure'],
    logoAspectRatio: 4,
    logoUrl: 'https://image.test/logo.png',
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
    authorAvatarUrl: null,
    authorDisplayName: 'A real person',
    authorId: 'person-1',
    body: 'A real review from the API.',
    contentImageUrl: 'https://image.test/review.jpg',
    contentTitle: 'A reviewed movie',
    id: 'review-1',
    rating: 4.5,
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

async function checkProgressSelection() {
  const summaries = Array.from({ length: 62 }, (_, index) => ({
    latestEpisodeNumber: 1,
    latestSeasonNumber: 1,
    seriesTmdbId: index + 1,
    updatedAt: '2026-09-08T09:07:02.396Z',
    watchedEpisodeCount: 1,
  }));
  const item = (seriesTmdbId: number) => ({ ...progress[0]!, seriesTmdbId });
  const visited: number[] = [];
  const selected = await selectHomeProgress(summaries, async (summary) => {
    const id = summary.seriesTmdbId;
    visited.push(id);
    return id === 2 || id === 7 || id > 8 ? item(id) : null;
  });
  assert.deepEqual(selected.map((entry) => entry.seriesTmdbId), [2, 7, 9, 10, 11, 12, 13, 14]);
  assert.equal(visited.length, 14, 'Stop loading once eight cards are available.');

  assert.deepEqual(await selectHomeProgress([], async () => { throw new Error('Unexpected call'); }), []);
  assert.deepEqual(await selectHomeProgress(summaries, async () => null), []);
  const lastOnly = await selectHomeProgress(summaries, async (summary) =>
    summary.seriesTmdbId === 62 ? item(62) : null);
  assert.deepEqual(lastOnly.map((entry) => entry.seriesTmdbId), [62]);

  const afterFailures = await selectHomeProgress(summaries, async (summary) => {
    if (summary.seriesTmdbId <= 8) throw new Error('Catalogue unavailable');
    return item(summary.seriesTmdbId);
  });
  assert.deepEqual(afterFailures.map((entry) => entry.seriesTmdbId), [9, 10, 11, 12, 13, 14, 15, 16]);
  await assert.rejects(
    selectHomeProgress(summaries, async () => { throw new Error('Catalogue unavailable'); }),
    /Could not update continue watching/,
  );
  console.log('Home data QA passed.');
}

void checkProgressSelection().catch((error) => { throw error; });
