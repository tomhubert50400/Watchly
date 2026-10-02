import 'reflect-metadata';
import assert from 'node:assert/strict';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { validate } from 'class-validator';
import { AuthenticatedIdentity } from '../auth/auth.types';
import { UpdateWatchlistSettingsDto } from './watchlists.dto';
import { WatchlistsService } from './watchlists.service';

async function run() {
  for (const removeWatchedMovies of [true, false]) {
    assert.equal((await validate(Object.assign(new UpdateWatchlistSettingsDto(), { removeWatchedMovies }))).length, 0);
  }
  for (const removeWatchedMovies of [undefined, null, 'true', 'false', 0, 1]) {
    assert.ok((await validate(Object.assign(new UpdateWatchlistSettingsDto(), { removeWatchedMovies }))).length);
  }
  let owned = true;
  let systemKey: string | null = null;
  let saved = false;
  const service = new WatchlistsService({ getOrCreateUser: async () => ({ id: 'owner' }) } as never, {
    withConnectionRetry: (operation: () => unknown) => operation(),
    personalWatchlist: {
      findFirst: async ({ where }: { where: { id: string; userId: string } }) => {
        assert.deepEqual(where, { id: 'list', userId: 'owner' });
        return owned ? { id: 'list', systemKey } : null;
      },
      update: async ({ data }: { data: { removeWatchedMovies: boolean } }) => {
        saved = data.removeWatchedMovies;
        return { removeWatchedMovies: saved };
      },
    },
  } as never);
  const identity = {} as AuthenticatedIdentity;
  assert.deepEqual(await service.updateSettings(identity, 'list', true), { removeWatchedMovies: true });
  owned = false;
  await assert.rejects(service.updateSettings(identity, 'list', false), NotFoundException);
  assert.equal(saved, true, 'A non-owner cannot change the setting');
  owned = true;
  systemKey = 'planned';
  await assert.rejects(service.updateSettings(identity, 'list', false), BadRequestException);
  assert.equal(saved, true, 'Planned cannot override its automatic behavior');
  systemKey = null;
  assert.deepEqual(await service.updateSettings(identity, 'list', false), { removeWatchedMovies: false });
  console.log('Watchlist settings validation and ownership QA passed.');
}

void run().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
