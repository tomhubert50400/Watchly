import assert from 'node:assert/strict';
import { CHARACTER_CATALOGUE, characterReleaseTitles } from './character-catalogue';
import { NotificationsService } from './notifications.service';

async function run() {
  const subscriptions: Array<{ userId: string; characterKey: string }> = [];
  const notifications = new Map<string, Record<string, any>>();
  const pushes: string[] = [];
  let directBell = false;
  let calendarWhere: any;
  const auth = { getOrCreateUser: async (identity: { firebaseUid: string }) => ({ id: identity.firebaseUid }) };
  const prisma = {
    withConnectionRetry: async <T>(operation: () => Promise<T>) => operation(),
    characterAlertSubscription: {
      findMany: async ({ where }: any) => subscriptions.filter((item) => !where.userId || item.userId === where.userId),
      upsert: async ({ create }: any) => {
        if (!subscriptions.some((item) => item.userId === create.userId && item.characterKey === create.characterKey)) subscriptions.push(create);
        return create;
      },
      deleteMany: async ({ where }: any) => {
        const index = subscriptions.findIndex((item) => item.userId === where.userId && item.characterKey === where.characterKey);
        if (index >= 0) subscriptions.splice(index, 1);
        return { count: index >= 0 ? 1 : 0 };
      },
    },
    releaseAlertSubscription: { findMany: async () => directBell ? [{ userId: 'a', contentType: 'MOVIE', tmdbId: 1726 }] : [] },
    userContentState: { findMany: async () => [] },
    personalWatchlistItem: { findMany: async () => [] },
    userEpisodeProgress: { findMany: async () => [] },
    releaseEvent: { findMany: async ({ where }: any) => { calendarWhere = where; return []; } },
    notification: {
      findMany: async ({ where }: any) => [...notifications.values()].filter((item) =>
        item.userId === where.userId && (!where.dedupeKey || where.dedupeKey.in.includes(item.dedupeKey))),
      createMany: async ({ data }: any) => {
        let count = 0;
        for (const item of data) {
          const key = `${item.userId}:${item.dedupeKey}`;
          if (!notifications.has(key)) {
            notifications.set(key, { ...item, id: key, createdAt: new Date(), readAt: null });
            count += 1;
          }
        }
        return { count };
      },
      updateMany: async () => ({ count: 0 }),
      deleteMany: async () => ({ count: 0 }),
    },
  };
  const releaseEvents = {
    expandFollowedTitles: async (items: unknown[]) => items,
    syncAllTrackedContent: async () => undefined,
    syncContent: async (_type: string, tmdbId: number) => ({ events: tmdbId === 1726 ? [{
      id: 'fixture-event', contentType: 'MOVIE', tmdbId, title: 'Fixture film',
      type: 'MOVIE_RELEASE', status: 'ACTIVE', precision: 'DATE',
      releaseDate: new Date(Date.now() + 7 * 86400000),
    }] : [] }),
  };
  const service = new NotificationsService(auth as never, prisma as never, releaseEvents as never,
    { enqueueReleaseNotifications: async (_userId: string, rows: Array<{ id: string }>) => { pushes.push(...rows.map((row) => row.id)); } } as never,
    { getOrThrow: () => 'development' } as never);
  const a = { firebaseUid: 'a' } as never;
  const b = { firebaseUid: 'b' } as never;
  assert.equal(CHARACTER_CATALOGUE.length, new Set(CHARACTER_CATALOGUE.map((item) => item.key)).size);
  assert.ok((await service.listCharacters(a, 'movie', 338953)).items.some((item) => item.name === 'Albus Dumbledore'));
  const dumbledore = characterReleaseTitles([{ userId: 'a', characterKey: 'albus-dumbledore-wizarding-world' }]);
  assert.ok([671, 673, 338953].every((id) => dumbledore.some((item) => item.tmdbId === id)), 'Recasting must preserve the character continuity');
  assert.deepEqual((await service.listCharacters(a, 'movie', 414906)).items, [], 'The Batman reboot must not match Nolan Batman');
  assert.deepEqual((await service.listCharacters(a, 'movie', 667)).items, [], 'A different Bond continuity must not match Craig Bond');
  await assert.rejects(() => service.setCharacterAlert(a, 'unknown', true), /verified catalogue/);
  await service.setCharacterAlert(a, 'iron-man-mcu', true);
  await service.setCharacterAlert(a, 'iron-man-mcu', true);
  assert.equal(subscriptions.length, 1, 'Follow is idempotent');
  assert.equal(pushes.length, 0, 'Following must never send a backlog');
  assert.equal((await service.listCharacters(a)).items.find((item) => item.key === 'iron-man-mcu')?.enabled, true);
  assert.equal((await service.listCharacters(b)).items.find((item) => item.key === 'iron-man-mcu')?.enabled, false);
  await service.setCharacterAlert(b, 'iron-man-mcu', false);
  assert.equal(subscriptions.length, 1, 'Unfollow is scoped to the authenticated user');
  await (service as any).performScheduledSync();
  assert.equal(pushes.length, 1, 'Character-only follows must receive scheduled reminders');
  directBell = true;
  await service.sync(a);
  assert.equal(pushes.length, 1, 'A direct bell and a character follow must share the same reminder');
  await service.listReleaseCalendar(a);
  assert.ok(calendarWhere.AND[0].OR.some((item: any) => item.tmdbId === 315635), 'Character crossover appearances must enter the calendar');
  await service.setCharacterAlert(a, 'iron-man-mcu', false);
  directBell = false;
  notifications.clear();
  await (service as any).performScheduledSync();
  assert.equal(pushes.length, 1, 'Unfollowing stops future reminders without affecting other bells');
  console.log('Character alerts QA passed: continuity, recasting, ownership, opt-in, scheduling, calendar, and dedupe.');
}

void run().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
