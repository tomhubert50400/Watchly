import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { AuthenticatedIdentity } from '../auth/auth.types';
import { PrismaClient } from '../generated/prisma/client';
import { TrackingService } from '../tracking/tracking.service';
import { ViewingsService } from '../viewings/viewings.service';
import { WatchlistsService } from './watchlists.service';

async function run() {
  const connectionString = process.env.DATABASE_URL;
  assert.ok(connectionString, 'DATABASE_URL is required');
  assert.ok(['localhost', '127.0.0.1'].includes(new URL(connectionString).hostname), 'Run only against a local test database');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  const rollback = new Error('Rollback watchlist settings QA fixtures');
  try {
    await assert.rejects(prisma.$transaction(async (tx) => {
      const owner = await tx.user.create({ data: { firebaseUid: `watchlist-settings-${randomUUID()}` } });
      const other = await tx.user.create({ data: { firebaseUid: `watchlist-settings-other-${randomUUID()}` } });
      const database = new Proxy(tx, {
        get(target, key) {
          if (key === 'withConnectionRetry') return (operation: () => unknown) => operation();
          if (key === '$transaction') return (operation: (transaction: typeof tx) => unknown) => operation(tx);
          return Reflect.get(target, key);
        },
      });
      const auth = { getOrCreateUser: async () => owner };
      const lists = new WatchlistsService(auth as never, database as never);
      const viewings = new ViewingsService(auth as never, database as never, { getMovie: async () => ({ item: null }) } as never);
      const tracking = new TrackingService(auth as never, database as never, viewings);
      const identity = {} as AuthenticatedIdentity;
      const movie = { contentType: 'movie' as const, tmdbId: 550 };
      const series = { contentType: 'series' as const, tmdbId: movie.tmdbId };
      const removing = await lists.createWatchlist(identity, 'Remove after watching');
      const keeping = await lists.createWatchlist(identity, 'Keep after watching');
      const foreign = await tx.personalWatchlist.create({ data: { userId: other.id, name: 'Other owner', removeWatchedMovies: true } });
      const shared = await tx.sharedWatchlist.create({ data: { ownerId: owner.id, name: 'Shared list' } });
      const movieItem = { contentType: 'MOVIE' as const, tmdbId: movie.tmdbId };
      await tx.personalWatchlistItem.create({ data: { ...movieItem, watchlistId: foreign.id } });
      await tx.sharedWatchlistItem.create({ data: { ...movieItem, watchlistId: shared.id } });
      for (const list of [removing, keeping]) {
        assert.equal(list.showOnHome, true, 'New lists are included in Home by default');
        assert.equal((await lists.getWatchlist(identity, list.id)).removeWatchedMovies, false, 'Existing behavior is the default');
        await lists.addItem(identity, list.id, movie);
        await lists.addItem(identity, list.id, series);
      }
      const hasMovie = async (id: string) => (await lists.getWatchlist(identity, id)).items.some((item) => item.contentType === 'movie');
      await tracking.upsertState(identity, { ...movie, status: 'watched', favorite: true });
      assert.equal(await hasMovie(removing.id), true, 'Disabled lists retain movies when watched');
      await lists.updateSettings(identity, removing.id, { removeWatchedMovies: true });
      assert.equal((await lists.getWatchlist(identity, removing.id)).removeWatchedMovies, true, 'Preference survives a fresh read');
      assert.deepEqual(await lists.updateSettings(identity, removing.id, { showOnHome: false }), { removeWatchedMovies: true, showOnHome: false });
      assert.equal((await lists.getWatchlist(identity, removing.id)).showOnHome, false, 'Home exclusion survives a fresh detail read');
      assert.equal((await lists.listWatchlists(identity)).items.find((list) => list.id === removing.id)?.showOnHome, false, 'Home reads the saved preference from the list summary');
      assert.equal((await lists.getWatchlist(identity, keeping.id)).showOnHome, true, 'Home visibility is independent for every list');
      assert.equal((await lists.getWatchlist(identity, removing.id)).items.length, 2, 'Hiding a list from Home preserves its movies and series');
      assert.equal(await hasMovie(removing.id), true, 'Enabling is not retroactive');
      await tracking.upsertState(identity, { ...movie, status: 'watched', favorite: true });
      assert.equal(await hasMovie(removing.id), true, 'Saving the same status must not act as a new viewing');
      await viewings.logMovieViewing(identity, movie.tmdbId);
      assert.equal(await hasMovie(removing.id), false, 'A rewatch removes the movie from enabled lists');
      assert.equal(await hasMovie(keeping.id), true, 'The same movie stays in lists configured to keep it');
      assert.equal((await lists.getWatchlist(identity, removing.id)).items[0]?.contentType, 'series', 'A series with the same TMDB ID stays');
      assert.equal(await tx.personalWatchlistItem.count({ where: { watchlistId: foreign.id } }), 1, 'Other owners are isolated');
      assert.equal(await tx.sharedWatchlistItem.count({ where: { watchlistId: shared.id } }), 1, 'Shared lists are unchanged');
      assert.equal((await tracking.getState(identity, 'movie', movie.tmdbId))?.favorite, true, 'Favorites are retained');
      assert.equal((await viewings.getMovieSummary(identity, movie.tmdbId)).viewCount, 2, 'Viewing history is retained');

      await lists.addItem(identity, removing.id, movie);
      await tracking.upsertState(identity, { ...movie, status: 'watchlisted', favorite: true });
      const planned = (await lists.listWatchlists(identity)).items.find((list) => list.isPlanned)!;
      assert.equal(planned.showOnHome, true, 'Planned is included in Home by default');
      await lists.updateSettings(identity, planned.id, { showOnHome: false });
      assert.equal((await lists.getWatchlist(identity, planned.id)).showOnHome, false, 'Planned Home visibility persists');
      assert.equal(await hasMovie(planned.id), true, 'Hiding Planned does not change its membership');
      await assert.rejects(lists.updateSettings(identity, planned.id, { removeWatchedMovies: false, showOnHome: true }), BadRequestException);
      assert.equal((await lists.getWatchlist(identity, planned.id)).showOnHome, false, 'An invalid Planned change saves neither field');
      const otherLists = new WatchlistsService({ getOrCreateUser: async () => other } as never, database as never);
      await assert.rejects(otherLists.updateSettings(identity, planned.id, { showOnHome: true }), NotFoundException);
      await tracking.upsertState(identity, { ...movie, status: 'watched', favorite: true });
      assert.equal(await hasMovie(removing.id), false, 'A watched transition removes the movie even with existing history');
      assert.equal(await hasMovie(planned.id), false, 'Planned retains its own automatic rule');
      assert.equal((await lists.getWatchlist(identity, planned.id)).showOnHome, false, 'Automatic removal preserves the Home preference');
      await lists.updateSettings(identity, planned.id, { showOnHome: true });
      assert.equal((await lists.listWatchlists(identity)).items.find((list) => list.id === planned.id)?.showOnHome, true, 'Planned can be included again');
      assert.equal(await hasMovie(keeping.id), true);

      await lists.addItem(identity, removing.id, movie);
      const history = (await viewings.getMovieSummary(identity, movie.tmdbId)).history;
      const entries = history.map((item) => ({ id: item.id, watchedDate: '2026-10-01' }));
      const edited = await viewings.saveHistory(identity, { ...movie, timeZone: 'UTC', previous: history, entries });
      assert.equal(await hasMovie(removing.id), true, 'Editing viewing dates does not remove a re-added movie');
      await viewings.saveHistory(identity, {
        ...movie, timeZone: 'UTC', previous: edited.items,
        entries: [...entries, { id: randomUUID(), watchedDate: '2026-10-02' }],
      });
      assert.equal(await hasMovie(removing.id), false, 'Adding a viewing through history respects the setting');

      await lists.addItem(identity, removing.id, movie);
      await tracking.upsertState(identity, { ...series, status: 'watched' });
      await tx.viewingEvent.create({ data: { userId: owner.id, contentType: 'EPISODE', tmdbId: movie.tmdbId, seasonNumber: 1, episodeNumber: 1 } });
      assert.equal(await hasMovie(removing.id), true, 'Episode viewings cannot remove movies');
      assert.equal((await lists.getWatchlist(identity, removing.id)).items.length, 2, 'Series tracking cannot remove series');
      await lists.updateSettings(identity, removing.id, { removeWatchedMovies: false });
      assert.equal((await lists.getWatchlist(identity, removing.id)).showOnHome, false, 'Movie removal updates do not reset Home visibility');
      await lists.updateSettings(identity, removing.id, { showOnHome: true });
      assert.equal((await lists.listWatchlists(identity)).items.find((list) => list.id === removing.id)?.showOnHome, true, 'Home inclusion can be restored');
      await viewings.logMovieViewing(identity, movie.tmdbId);
      assert.equal(await hasMovie(removing.id), true, 'Disabling persists and stops future removals');

      const importedMovie = { contentType: 'movie' as const, tmdbId: 11 };
      await lists.updateSettings(identity, removing.id, { removeWatchedMovies: true });
      await lists.addItem(identity, removing.id, importedMovie);
      await tx.userContentState.create({ data: { userId: owner.id, contentType: 'MOVIE', tmdbId: importedMovie.tmdbId, status: 'WATCHED' } });
      assert.equal((await lists.getWatchlist(identity, removing.id)).items.some((item) => item.tmdbId === importedMovie.tmdbId), false, 'Direct watched inserts also respect the preference');
      throw rollback;
    }, { timeout: 30000 }), (error) => error === rollback);
    console.log('Watchlist settings database QA passed; all fixtures rolled back.');
  } finally {
    await prisma.$disconnect();
  }
}

void run().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
