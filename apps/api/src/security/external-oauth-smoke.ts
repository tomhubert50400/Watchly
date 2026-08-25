import 'dotenv/config';
import assert from 'node:assert/strict';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth/auth.service';
import { ExternalOAuthService } from '../auth/external-oauth.service';
import { hashOAuthSecret } from '../auth/external-oauth.provider';
import { PrismaService } from '../database/prisma.service';
import { AuthProvider } from '../generated/prisma/enums';

async function main() {
  const config = new ConfigService(process.env);
  const prisma = new PrismaService(config);
  const auth = new AuthService(prisma);
  const oauth = new ExternalOAuthService(auth, config, prisma);
  const suffix = Date.now().toString();
  const firebaseUid = `external-oauth-smoke-${suffix}`;
  const ticket = `external-oauth-ticket-${suffix}`;
  let userId: string | null = null;
  const attemptIds: string[] = [];

  try {
    const user = await auth.getOrCreateUser({
      displayName: 'External OAuth smoke user',
      emailVerified: false,
      firebaseUid,
      provider: AuthProvider.GOOGLE,
      providerUserId: `google-${suffix}`,
    });
    userId = user.id;
    const attempt = await prisma.oAuthAttempt.create({
      data: {
        appRedirectUri: 'com.tom.tvapp.dev://auth/oauth',
        completedAt: new Date(),
        completionHash: hashOAuthSecret(ticket),
        displayName: 'Discord smoke identity',
        email: `oauth-${suffix}@watchly.test`,
        emailVerified: true,
        expiresAt: new Date(Date.now() + 60_000),
        initiatedByFirebaseUid: firebaseUid,
        provider: AuthProvider.DISCORD,
        providerUserId: `discord-${suffix}`,
        stateHash: hashOAuthSecret(`state-${suffix}`),
      },
    });
    attemptIds.push(attempt.id);

    await oauth.link({
      displayName: null,
      emailVerified: false,
      firebaseUid,
      provider: AuthProvider.GOOGLE,
      providerUserId: `google-${suffix}`,
    }, ticket);

    assert(await prisma.authIdentity.findUnique({
      where: {
        provider_providerUserId: {
          provider: AuthProvider.DISCORD,
          providerUserId: `discord-${suffix}`,
        },
      },
    }));
    await assert.rejects(() => oauth.link({
      displayName: null,
      emailVerified: false,
      firebaseUid,
      provider: AuthProvider.GOOGLE,
      providerUserId: `google-${suffix}`,
    }, ticket));

    const replacementTicket = `external-oauth-replacement-${suffix}`;
    const replacementAttempt = await prisma.oAuthAttempt.create({
      data: {
        appRedirectUri: 'com.tom.tvapp.dev://auth/oauth',
        completedAt: new Date(),
        completionHash: hashOAuthSecret(replacementTicket),
        expiresAt: new Date(Date.now() + 60_000),
        initiatedByFirebaseUid: firebaseUid,
        provider: AuthProvider.DISCORD,
        providerUserId: `discord-replacement-${suffix}`,
        stateHash: hashOAuthSecret(`replacement-state-${suffix}`),
      },
    });
    attemptIds.push(replacementAttempt.id);

    await assert.rejects(() => oauth.link({
      displayName: null,
      emailVerified: false,
      firebaseUid,
      provider: AuthProvider.GOOGLE,
      providerUserId: `google-${suffix}`,
    }, replacementTicket));
    const preservedIdentity = await prisma.authIdentity.findUnique({
      where: { userId_provider: { provider: AuthProvider.DISCORD, userId } },
    });
    assert.equal(preservedIdentity?.providerUserId, `discord-${suffix}`);

    const legacyMicrosoftSubject = `microsoft-legacy-${suffix}`;
    const microsoftTenantId = '11111111-2222-3333-4444-555555555555';
    await prisma.authIdentity.create({
      data: {
        provider: AuthProvider.MICROSOFT,
        providerUserId: legacyMicrosoftSubject,
        userId,
      },
    });
    const microsoftTicket = `external-oauth-microsoft-${suffix}`;
    const microsoftAttempt = await prisma.oAuthAttempt.create({
      data: {
        appRedirectUri: 'microsoft-token://watchly',
        completedAt: new Date(),
        completionHash: hashOAuthSecret(microsoftTicket),
        emailVerified: false,
        expiresAt: new Date(Date.now() + 60_000),
        initiatedByFirebaseUid: firebaseUid,
        provider: AuthProvider.MICROSOFT,
        providerUserId: `${microsoftTenantId}:${legacyMicrosoftSubject}`,
        stateHash: hashOAuthSecret(`microsoft-state-${suffix}`),
      },
    });
    attemptIds.push(microsoftAttempt.id);

    await oauth.link({
      displayName: null,
      emailVerified: false,
      firebaseUid,
      provider: AuthProvider.GOOGLE,
      providerUserId: `google-${suffix}`,
    }, microsoftTicket);

    assert(await prisma.authIdentity.findUnique({
      where: {
        provider_providerUserId: {
          provider: AuthProvider.MICROSOFT,
          providerUserId: `${microsoftTenantId}:${legacyMicrosoftSubject}`,
        },
      },
    }), 'a legacy Microsoft identity must migrate to the tenant-scoped identifier');
    assert.equal(await prisma.authIdentity.findUnique({
      where: {
        provider_providerUserId: {
          provider: AuthProvider.MICROSOFT,
          providerUserId: legacyMicrosoftSubject,
        },
      },
    }), null);

    console.log('External OAuth smoke passed.');
  } finally {
    if (attemptIds.length > 0) {
      await prisma.oAuthAttempt.deleteMany({ where: { id: { in: attemptIds } } });
    }
    if (userId) await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  }
}

void main();
