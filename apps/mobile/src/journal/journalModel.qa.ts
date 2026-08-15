// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
import {
  buildJournal,
  filterJournalEntries,
  filterJournalEntriesByDate,
  getJournalMonthKeys,
  groupJournalEntriesByMonth,
} from './journalModel';

const journal = buildJournal({
  movieRatings: [{ id: 'mr', score: 4.5, tmdbId: 10, updatedAt: '2026-07-10T12:00:00Z' }],
  opinions: [
    { body: 'Still precise.', content: { contentType: 'movie' as const, tmdbId: 10 }, id: 'review', score: 4.5, type: 'movieReview' as const, updatedAt: '2026-07-10T13:00:00Z' },
    { content: { contentType: 'episode' as const, episodeNumber: 2, seasonNumber: 1, seriesTmdbId: 20 }, id: 'er', score: 4, type: 'episodeRating' as const, updatedAt: '2026-06-29T12:00:00Z' },
  ],
  viewings: [
    { contentType: 'movie', episodeNumber: null, id: 'vm', seasonNumber: null, tmdbId: 10, watchedAt: '2026-07-10T11:00:00Z' },
    { contentType: 'episode', episodeNumber: 1, id: 'p1', seasonNumber: 1, tmdbId: 20, watchedAt: '2026-07-09T12:00:00Z' },
    { contentType: 'episode', episodeNumber: 2, id: 'p2', seasonNumber: 1, tmdbId: 20, watchedAt: '2026-07-08T12:00:00Z' },
  ],
});
assert.equal(journal.entries.length, 2, 'movie events are deduplicated and series episodes grouped');
assert.deepEqual(journal.entries.map((entry) => entry.kind), ['movie', 'series']);
assert.equal(journal.entries[0]?.reviewBody, 'Still precise.');
assert.deepEqual(journal.entries[1]?.episodes.map(({ episodeNumber }) => episodeNumber), [1, 2]);
assert.equal(journal.reviewCount, 1);
assert.equal(journal.averageRating, 4.25);
assert.deepEqual(groupJournalEntriesByMonth(journal.entries).map((group) => group.key), ['2026-07']);
assert.equal(filterJournalEntries(journal.entries, 'movies').length, 1);
assert.equal(filterJournalEntries(journal.entries, 'series').length, 1);
assert.equal(filterJournalEntries(journal.entries, 'reviews').length, 1);
assert.deepEqual(getJournalMonthKeys(journal.entries), ['2026-07']);
assert.equal(filterJournalEntriesByDate(journal.entries, '2026-07-10').length, 1);
assert.equal(filterJournalEntriesByDate(journal.entries, '2026-07-09').length, 1);
assert.equal(filterJournalEntriesByDate(journal.entries, '2026-07-08').length, 0);
assert.equal(filterJournalEntriesByDate(journal.entries, null).length, 2);

const tasteOnly = buildJournal({ movieRatings: [], opinions: [], viewings: [] });
assert.equal(tasteOnly.entries.length, 0, 'Taste states without real viewing dates must stay out of Journal');
console.log('Journal model QA passed.');
