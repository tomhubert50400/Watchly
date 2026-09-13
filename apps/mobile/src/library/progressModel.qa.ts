// @ts-expect-error QA runs in Node, outside the Expo type configuration.
import assert from 'node:assert/strict';
import type { SeasonDetails } from '../api/catalogue';
import { isProgressCandidate, ProgressItem, resolveProgressItem, selectRecentProgress } from './progressModel';
import type { LibraryMediaItem } from './useLibraryData';

const today = '2026-09-13';
const media = { contentType: 'series', status: 'watching', watchedEpisodeCount: 0 } as LibraryMediaItem;
const item: Omit<ProgressItem, 'next' | 'state' | 'error'> = {
  media, watched: [], viewings: [],
  series: { status: 'Returning Series', numberOfEpisodes: 4, seasons: [1, 2].map((seasonNumber) => ({ seasonNumber, airDate: '2025-01-01', episodeCount: 2, id: String(seasonNumber), name: 'Season', posterUrl: null })) },
};
const watched = (seasonNumber: number, episodeNumber: number) => ({ seasonNumber, episodeNumber, id: `${seasonNumber}:${episodeNumber}`, seriesTmdbId: 1, updatedAt: today, watchedAt: today });
const loadSeason = async (seasonNumber: number) => ({ episodes: [1, 2].map((episodeNumber) => ({ seasonNumber, episodeNumber, airDate: seasonNumber === 2 && episodeNumber === 2 ? '2027-01-01' : '2025-01-01' })) }) as SeasonDetails;

async function main() {
  assert.equal(isProgressCandidate(media), true);
  assert.equal(isProgressCandidate({ ...media, status: null, watchedEpisodeCount: 0, hasReleaseAlert: true }), false, 'a bell alone does not add a series to Progress');
  assert.equal(isProgressCandidate({ ...media, contentType: 'movie', status: 'watched' }), false);
  let current = await resolveProgressItem(item, loadSeason, today);
  assert.deepEqual(current.next, { seasonNumber: 1, episodeNumber: 1 });
  current = await resolveProgressItem({ ...item, watched: [watched(1, 1)] }, loadSeason, today);
  assert.deepEqual(current.next, { seasonNumber: 1, episodeNumber: 2 });
  current = await resolveProgressItem({ ...item, watched: [watched(1, 1), watched(1, 2)] }, loadSeason, today);
  assert.deepEqual(current.next, { seasonNumber: 2, episodeNumber: 1 }, 'advance across seasons');
  const allReleased = [watched(1, 1), watched(1, 2), watched(2, 1)];
  current = await resolveProgressItem({ ...item, watched: allReleased }, loadSeason, today);
  assert.equal(current.next, null, 'never offer an unaired episode');
  assert.equal(current.state, 'caughtUp');
  assert.equal((await resolveProgressItem({ ...item, series: { ...item.series, status: 'Ended' }, watched: allReleased }, loadSeason, today)).state, 'completed');
  const gap = await resolveProgressItem({ ...item, watched: [watched(1, 2)] }, loadSeason, today);
  assert.deepEqual(gap.next, { seasonNumber: 1, episodeNumber: 1 }, 'fill gaps before later episodes');
  const rewatch = await resolveProgressItem({ ...item, watched: allReleased, viewings: allReleased.map((episode) => ({ ...episode, viewCount: episode.seasonNumber === 1 && episode.episodeNumber === 1 ? 2 : 1, latestLoggedAt: episode.seasonNumber === 1 && episode.episodeNumber === 1 ? '2026-09-13T12:00:00Z' : '2025-01-01T12:00:00Z' })) }, loadSeason, today);
  assert.deepEqual(rewatch.next, { seasonNumber: 1, episodeNumber: 2 }, 'continue a rewatch while retaining previous watched records');
  await assert.rejects(resolveProgressItem(item, async () => { throw new Error('offline'); }, today), /offline/, 'a catalogue failure must not become Up to date');
  assert.equal(item.watched.length, 0, 'resolution must not mutate cached input');
  const recentItems = Array.from({ length: 9 }, (_, index) => ({ ...rewatch, media: { ...media, key: String(index), watchedEpisodeCount: 2, lastWatchedAt: `2026-09-${String(index + 1).padStart(2, '0')}T12:00:00Z` } }));
  const recent = selectRecentProgress([...recentItems, { ...recentItems[8]!, next: null }, { ...recentItems[8]!, error: 'offline' }]);
  assert.deepEqual(recent.map((entry) => entry.media.key), ['8', '7', '6', '5', '4', '3'], 'feature exactly six recent series that have an available next episode');
  assert.equal(recentItems[0]!.media.key, '0', 'selecting recent series must not reorder the main list');
  assert.equal(selectRecentProgress([{ ...recentItems[0]!, media: { ...media, watchedEpisodeCount: 0 } }]).length, 0, 'unstarted series do not belong in the resume rail');
  console.log('Progress episode sequencing QA passed.');
}
void main();
