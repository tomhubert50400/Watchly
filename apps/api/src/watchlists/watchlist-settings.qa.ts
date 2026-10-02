import 'reflect-metadata';
import assert from 'node:assert/strict';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { validate } from 'class-validator';
import { AuthenticatedIdentity } from '../auth/auth.types';
import { UpdateWatchlistSettingsDto } from './watchlists.dto';
import { WatchlistsService } from './watchlists.service';

async function run() {
  for (const field of ['removeWatchedMovies', 'showOnHome']) {
    for (const value of [true, false]) {
      assert.equal((await validate(Object.assign(new UpdateWatchlistSettingsDto(), { [field]: value }))).length, 0);
    }
    for (const value of [null, 'true', 'false', 0, 1]) {
      assert.ok((await validate(Object.assign(new UpdateWatchlistSettingsDto(), { [field]: value }))).length);
    }
  }
  let owned = true;
  let systemKey: string | null = null;
  let saved = { removeWatchedMovies: false, showOnHome: true };
  const service = new WatchlistsService({ getOrCreateUser: async () => ({ id: 'owner' }) } as never, {
    withConnectionRetry: (operation: () => unknown) => operation(),
    personalWatchlist: {
      findFirst: async ({ where }: { where: { id: string; userId: string } }) => {
        assert.deepEqual(where, { id: 'list', userId: 'owner' });
        return owned ? { id: 'list', systemKey } : null;
      },
      update: async ({ data }: { data: UpdateWatchlistSettingsDto }) => {
        saved = { ...saved, ...data };
        return saved;
      },
    },
  } as never);
  const identity = {} as AuthenticatedIdentity;
  await assert.rejects(service.updateSettings(identity, 'list', {}), BadRequestException);
  assert.deepEqual(await service.updateSettings(identity, 'list', { removeWatchedMovies: true }), { removeWatchedMovies: true, showOnHome: true });
  assert.deepEqual(await service.updateSettings(identity, 'list', { showOnHome: false }), { removeWatchedMovies: true, showOnHome: false }, 'Changing Home visibility preserves movie removal');
  owned = false;
  await assert.rejects(service.updateSettings(identity, 'list', { showOnHome: true }), NotFoundException);
  assert.deepEqual(saved, { removeWatchedMovies: true, showOnHome: false }, 'A non-owner cannot change the setting');
  owned = true;
  systemKey = 'planned';
  await assert.rejects(service.updateSettings(identity, 'list', { removeWatchedMovies: false }), BadRequestException);
  assert.deepEqual(saved, { removeWatchedMovies: true, showOnHome: false }, 'Planned cannot override its automatic behavior');
  systemKey = null;
  assert.deepEqual(await service.updateSettings(identity, 'list', { removeWatchedMovies: false }), { removeWatchedMovies: false, showOnHome: false }, 'Changing movie removal preserves Home visibility');
  assert.deepEqual(await service.updateSettings(identity, 'list', { showOnHome: true }), { removeWatchedMovies: false, showOnHome: true });
  console.log('Watchlist settings validation and ownership QA passed.');
}

void run().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
