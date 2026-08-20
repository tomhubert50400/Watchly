import 'dotenv/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { PrismaPg } from '@prisma/adapter-pg';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PrismaClient } from '../generated/prisma/client';
import {
  AuthProvider,
  PrivacyVisibility,
  SharedWatchlistVisibility,
  TrackedContentType,
  UserContentStatus,
  ViewingContentType,
} from '../generated/prisma/enums';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const handle = 'maya_chen_ui';
const identityKey = {
  provider: AuthProvider.GOOGLE,
  providerUserId: '__dev_block_test_profile__',
};

async function main() {
  const storage = getStorageConfig();
  const user = await getOrCreateTestUser();
  const objectKey = `avatars/${user.id}/maya-chen-codex-v1.jpg`;

  await uploadAvatar(storage, objectKey);
  await prisma.user.update({
    data: { avatarObjectKey: objectKey },
    where: { id: user.id },
  });

  await seedTracking(user.id);
  await seedViewingHistory(user.id);

  console.log(JSON.stringify({
    avatarUrl: `${storage.publicBaseUrl}/${objectKey}`,
    displayName: 'Maya Chen',
    handle,
    movieCount: 3,
    profileVisibility: 'PUBLIC',
    seriesCount: 3,
    seriesInProgressCount: 2,
  }, null, 2));
}

async function getOrCreateTestUser() {
  const identity = await prisma.authIdentity.findUnique({
    where: { provider_providerUserId: identityKey },
  });
  const profile = {
    displayName: 'Maya Chen',
    handle,
    onboardingCompleted: true,
    profileBackdropContentType: TrackedContentType.SERIES,
    profileBackdropTmdbId: 1396,
  };
  const privacy = {
    episodeProgressVisibility: PrivacyVisibility.PUBLIC,
    profileVisibility: PrivacyVisibility.PUBLIC,
    ratingsVisibility: PrivacyVisibility.PUBLIC,
    reviewsVisibility: PrivacyVisibility.PUBLIC,
    sharedWatchlistVisibility: SharedWatchlistVisibility.MEMBERS,
    viewingHistoryVisibility: PrivacyVisibility.PUBLIC,
  };

  if (identity) {
    return prisma.user.update({
      data: {
        ...profile,
        privacySettings: {
          upsert: { create: privacy, update: privacy },
        },
      },
      where: { id: identity.userId },
    });
  }

  return prisma.user.create({
    data: {
      ...profile,
      authIdentities: { create: identityKey },
      firebaseUid: identityKey.providerUserId,
      privacySettings: { create: privacy },
    },
  });
}

async function uploadAvatar(storage: StorageConfig, objectKey: string) {
  const avatar = await readFile(resolve('src/dev/assets/maya-chen-avatar.jpg'));
  const client = new S3Client({
    credentials: {
      accessKeyId: storage.accessKeyId,
      secretAccessKey: storage.secretAccessKey,
    },
    endpoint: `https://${storage.accountId}.r2.cloudflarestorage.com`,
    region: 'auto',
  });

  await client.send(new PutObjectCommand({
    Body: avatar,
    Bucket: storage.bucketName,
    CacheControl: 'public, max-age=31536000, immutable',
    ContentType: 'image/jpeg',
    Key: objectKey,
  }));
}

async function seedTracking(userId: string) {
  const states = [
    [TrackedContentType.MOVIE, 603, UserContentStatus.WATCHED, true],
    [TrackedContentType.MOVIE, 872585, UserContentStatus.WATCHED, false],
    [TrackedContentType.MOVIE, 693134, UserContentStatus.WATCHED, true],
    [TrackedContentType.SERIES, 1396, UserContentStatus.WATCHED, true],
    [TrackedContentType.SERIES, 1399, UserContentStatus.WATCHING, false],
    [TrackedContentType.SERIES, 95396, UserContentStatus.WATCHING, false],
  ] as const;

  for (const [contentType, tmdbId, status, favorite] of states) {
    await prisma.userContentState.upsert({
      create: { contentType, favorite, status, tmdbId, userId },
      update: { favorite, status },
      where: {
        userId_contentType_tmdbId: { contentType, tmdbId, userId },
      },
    });
  }

  for (const [tmdbId, scoreHalfSteps] of [
    [603, 9],
    [872585, 8],
    [693134, 10],
  ] as const) {
    await prisma.userMovieRating.upsert({
      create: { scoreHalfSteps, tmdbId, userId },
      update: { scoreHalfSteps },
      where: { userId_tmdbId: { tmdbId, userId } },
    });
  }

  for (const [seriesTmdbId, episodeNumber] of [
    [1399, 1],
    [1399, 2],
    [1399, 3],
    [1399, 4],
    [1399, 5],
    [95396, 1],
    [95396, 2],
    [95396, 3],
  ] as const) {
    await prisma.userEpisodeProgress.upsert({
      create: { episodeNumber, seasonNumber: 1, seriesTmdbId, userId },
      update: { watchedAt: new Date() },
      where: {
        userId_seriesTmdbId_seasonNumber_episodeNumber: {
          episodeNumber,
          seasonNumber: 1,
          seriesTmdbId,
          userId,
        },
      },
    });
  }
}

async function seedViewingHistory(userId: string) {
  const [matrix, oppenheimer, gotEpisode, severanceEpisode] = await Promise.all([
    getCatalogueItem('/movies/603'),
    getCatalogueItem('/movies/872585'),
    getCatalogueItem('/series/1399/seasons/1/episodes/1'),
    getCatalogueItem('/series/95396/seasons/1/episodes/1'),
  ]);

  await prisma.viewingEvent.deleteMany({ where: { userId } });
  await prisma.viewingEvent.createMany({
    data: [
      movieViewingEvent(userId, 603, matrix, '2026-07-12T20:00:00.000Z'),
      movieViewingEvent(userId, 872585, oppenheimer, '2026-07-26T19:00:00.000Z'),
      episodeViewingEvent(
        userId,
        1399,
        'Game of Thrones',
        gotEpisode,
        ['Drama', 'Sci-Fi & Fantasy'],
        '2026-08-01T19:00:00.000Z',
      ),
      episodeViewingEvent(
        userId,
        95396,
        'Severance',
        severanceEpisode,
        ['Drama', 'Mystery', 'Sci-Fi & Fantasy'],
        '2026-08-03T19:00:00.000Z',
      ),
    ],
  });
}

function movieViewingEvent(
  userId: string,
  tmdbId: number,
  item: CatalogueItem,
  watchedAt: string,
) {
  return {
    artworkUrl: item.posterUrl ?? null,
    contentType: ViewingContentType.MOVIE,
    genres: item.genres ?? [],
    runtimeMinutes: item.runtimeMinutes ?? null,
    title: item.title ?? null,
    tmdbId,
    userId,
    watchedAt: new Date(watchedAt),
  };
}

function episodeViewingEvent(
  userId: string,
  tmdbId: number,
  title: string,
  item: CatalogueItem,
  genres: string[],
  watchedAt: string,
) {
  return {
    artworkUrl: item.stillUrl ?? null,
    contentType: ViewingContentType.EPISODE,
    episodeNumber: item.episodeNumber ?? 1,
    genres,
    runtimeMinutes: item.runtimeMinutes ?? null,
    seasonNumber: item.seasonNumber ?? 1,
    subtitle: `S${item.seasonNumber ?? 1} E${item.episodeNumber ?? 1} · ${item.title ?? ''}`,
    title,
    tmdbId,
    userId,
    watchedAt: new Date(watchedAt),
  };
}

async function getCatalogueItem(path: string): Promise<CatalogueItem> {
  const response = await fetch(`http://127.0.0.1:3000/catalog${path}`);

  if (!response.ok) {
    throw new Error(`Catalogue request failed for ${path}: ${response.status}`);
  }

  const payload = await response.json() as { item: CatalogueItem };
  return payload.item;
}

function getStorageConfig(): StorageConfig {
  const config = {
    accessKeyId: process.env.R2_ACCESS_KEY_ID?.trim(),
    accountId: process.env.R2_ACCOUNT_ID?.trim(),
    bucketName: process.env.R2_BUCKET_NAME?.trim(),
    publicBaseUrl: process.env.R2_PUBLIC_BASE_URL?.trim().replace(/\/$/, ''),
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY?.trim(),
  };

  if (Object.values(config).some((value) => !value)) {
    throw new Error('R2 avatar storage is not fully configured.');
  }

  return config as StorageConfig;
}

type CatalogueItem = {
  episodeNumber?: number;
  genres?: string[];
  posterUrl?: string | null;
  runtimeMinutes?: number | null;
  seasonNumber?: number;
  stillUrl?: string | null;
  title?: string;
};

type StorageConfig = {
  accessKeyId: string;
  accountId: string;
  bucketName: string;
  publicBaseUrl: string;
  secretAccessKey: string;
};

void main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
