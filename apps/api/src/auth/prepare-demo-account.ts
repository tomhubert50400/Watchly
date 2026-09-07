import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { open } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { getAuth } from 'firebase-admin/auth';
import { PrismaClient } from '../generated/prisma/client';
import { initializeFirebaseAdmin } from './firebase-admin-app';
import { DEMO_FIREBASE_UID, hashDemoPassword } from './demo-credentials';

async function main() {
  const [expectedProject, credentialsPath] = process.argv.slice(2);
  if (!expectedProject || !credentialsPath || expectedProject !== process.env.FIREBASE_PROJECT_ID
    || !process.env.DATABASE_URL) {
    throw new Error('Usage: pnpm demo:prepare <firebase-project-id> <new-credentials-file>. Set DATABASE_URL and Firebase credentials for the same environment.');
  }
  const file = await open(resolve(credentialsPath), 'wx', 0o600);
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  try {
    initializeFirebaseAdmin(expectedProject, process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    const auth = getAuth();
    const existing = await auth.getUser(DEMO_FIREBASE_UID).catch((error: unknown) => {
      if ((error as { code?: string }).code === 'auth/user-not-found') return null;
      throw error;
    });
    if (existing && (existing.customClaims?.watchlyDemo !== true
      || existing.customClaims?.admin === true || existing.disabled)) {
      throw new Error('The reserved Firebase UID is not an active, dedicated demo account. No account was changed.');
    }
    const databaseUser = await prisma.user.findUnique({
      where: { firebaseUid: DEMO_FIREBASE_UID }, include: { authIdentities: true },
    });
    if (databaseUser && (!databaseUser.authIdentities.some((identity) => identity.provider === 'DEMO')
      || databaseUser.suspendedAt)) {
      throw new Error('The reserved database identity is not an active demo account.');
    }
    if (!existing) {
      await auth.createUser({ uid: DEMO_FIREBASE_UID, displayName: 'Watchly Review' });
      await auth.setCustomUserClaims(DEMO_FIREBASE_UID, { watchlyDemo: true });
    }
    if (!databaseUser) {
      await prisma.user.create({ data: {
        firebaseUid: DEMO_FIREBASE_UID,
        displayName: 'Watchly Review',
        handle: 'watchly_review',
        onboardingCompleted: true,
        authIdentities: { create: { provider: 'DEMO', providerUserId: DEMO_FIREBASE_UID } },
        privacySettings: { create: { profileVisibility: 'PRIVATE', reviewsVisibility: 'PRIVATE' } },
        contentStates: { create: [
          { contentType: 'MOVIE', tmdbId: 27205, status: 'WATCHED', favorite: true },
          { contentType: 'MOVIE', tmdbId: 157336, status: 'WATCHED' },
        ] },
        movieRatings: { create: [
          { tmdbId: 27205, scoreHalfSteps: 9 },
          { tmdbId: 157336, scoreHalfSteps: 8 },
        ] },
        personalWatchlists: { create: {
          name: 'Next movie night',
          items: { create: [{ contentType: 'MOVIE', tmdbId: 693134 }] },
        } },
      } });
    }
    const password = randomBytes(24).toString('base64url');
    const passwordHash = await hashDemoPassword(password);
    await file.writeFile([
      '# Store securely. Set only DEMO_AUTH_* on the API, never on mobile or web.',
      `# Firebase project: ${expectedProject}`,
      'DEMO_AUTH_USERNAME=watchly-review',
      `DEMO_AUTH_PASSWORD_HASH=${passwordHash}`,
      '# Share this password only in App Store Connect review credentials.',
      `REVIEW_PASSWORD=${password}`,
      '',
    ].join('\n'));
    await auth.revokeRefreshTokens(DEMO_FIREBASE_UID);
    console.log(`Demo account prepared in ${expectedProject}. Credentials saved to ${resolve(credentialsPath)}. Configure the API before testing.`);
  } finally {
    await file.close();
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Demo provisioning failed.');
  process.exitCode = 1;
});
